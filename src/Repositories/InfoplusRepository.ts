/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {Repository} from "./Repository";
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseRitInfoUpdate";
import {IInfoPlusRepository} from "../Interfaces/Repositories/InfoplusRepository";

export class InfoplusRepository extends Repository implements IInfoPlusRepository {

    /** @inheritDoc */
    public async getCurrentRealtimeTripUpdates(operationDateOfTodayOrYesterday: string, operationDateOfTodayOrTomorrow: string, endOperationDate: string): Promise<IDatabaseRitInfoUpdate[]> {
        console.time('getCurrentRealtimeTripUpdates');
        return this.database.raw(`
            WITH cal_dates AS (SELECT DISTINCT "serviceId", "date"
                               FROM "StaticData-NL".calendar_dates
                               WHERE "date" >= ?
                                 AND date <= ?),
                trips AS (SELECT "tripId", "routeId", "directionId", "tripShortName", "shapeId", "serviceId"
            FROM "StaticData-NL".trips
            WHERE agency = 'IFF'
              AND "serviceId" IN (SELECT DISTINCT "serviceId"
                FROM cal_dates)),
                stops AS (SELECT "stopId", "stationCode", "platformCode"
            FROM "StaticData-NL".stops
            WHERE "stationCode" IS NOT NULL)
            SELECT jpjl."logicalJourneyPartNumber"                                          AS "trainNumber",
                   jpjl."shortJourneyPartNumber"                                            AS "shortTrainNumber",
                   r."trainType",
                   r.agency,
                   r."operationDate",
                   r."showsInTripPlanner",
                   r."timestamp",
                   coalesce(jpjl."logicalJourneyPartChanges", jpjl."logicalJourneyChanges") AS "changes",
                   t."tripId"                                                               AS "tripId",
                   coalesce(t."routeId", t_short."routeId")                                 AS "routeId",
                   coalesce(t."directionId", t_short."directionId")                         AS "directionId",
                   coalesce(t."shapeId", t_short."shapeId")                                 AS "shapeId",
                   jsonb_agg(
                           jsonb_build_object(
                                   'stationCode',
                                   si."stationCode",
                                   'plannedWillStop',
                                   si."plannedWillStop",
                                   'actualWillStop',
                                   si."actualWillStop",
                                   'plannedArrivalTime',
                                   si."plannedArrivalTime",
                                   'plannedDepartureTime',
                                   si."plannedDepartureTime",
                                   'departureTime',
                                   coalesce(si."actualDepartureTime", si."plannedDepartureTime"),
                                   'arrivalTime',
                                   coalesce(si."actualArrivalTime", si."plannedArrivalTime"),
                                   'departureDelay',
                                   si."actualDepartureTime" - si."plannedDepartureTime",
                                   'arrivalDelay',
                                   si."actualArrivalTime" - si."plannedArrivalTime",
                                   'changes',
                                   si.changes,
                                   'stopId',
                                   COALESCE(s."stopId", lateral_stop."stopId", si."stationCode"),
                                   'platform',
                                   s."platformCode",
                                   'plannedTrack',
                                   coalesce(si."plannedArrivalTrack", si."plannedDepartureTrack"),
                                   'actualTrack',
                                   coalesce(si."actualArrivalTrack", si."actualDepartureTrack"),
                                   'track',
                                   coalesce(si."departureTrackMessage" -> 'Uitingen' ->> 'Uiting',
                                si."arrivalTrackMessage" -> 'Uitingen' ->> 'Uiting'),
                                   'sequence',
                                   si."stopOrder"
                           ) ORDER BY si."stopOrder")                                          stops
            FROM "InfoPlus".ritinfo r
                     JOIN "InfoPlus".journey_part_journey_links jpjl ON jpjl."trainNumber" = r."trainNumber" AND
                                                                        jpjl."operationDate" = r."operationDate"
                     JOIN "InfoPlus".stop_information si
                          ON jpjl."logicalJourneyPartNumber" = si."logicalJourneyPartNumber" AND
                             jpjl."operationDate" = si."operationDate" AND
                             ("plannedWillStop" = true OR "actualWillStop" = true) AND
                             (coalesce("plannedDepartureTime", "actualArrivalTime") IS NOT NULL OR
                              coalesce("plannedArrivalTime", "actualArrivalTime") IS NOT NULL)
                     LEFT JOIN trips t
                               ON jpjl."logicalJourneyPartNumber" = t."tripShortName"::int
                       AND EXISTS (SELECT 1
                                   FROM cal_dates cd
                                   WHERE cd."serviceId" = t."serviceId"
                                     AND cd."date" = r."operationDate")

         LEFT JOIN trips t_short ON t."tripId" IS NULL AND jpjl."shortJourneyPartNumber" = t_short."tripShortName"::int
                AND EXISTS (SELECT 1
                FROM cal_dates cd
                WHERE cd."serviceId" = t_short."serviceId"
                AND cd."date" = r."operationDate")
                LEFT JOIN stops s ON (s."stationCode" = lower(si."stationCode") AND s."platformCode" = coalesce(si."departureTrackFull", si."arrivalTrackFull"))
                LEFT JOIN LATERAL (
                SELECT "stopId"
                FROM stops lax
                WHERE lax."stationCode" = lower(si."stationCode")
                LIMIT 1
                ) AS lateral_stop ON s."stopId" IS NULL
            WHERE r."operationDate" >= ?
              AND NOT (
                r."operationDate" > ?
              AND jpjl."logicalJourneyChanges" IS NULL
                )
            GROUP BY r."trainNumber", jpjl."logicalJourneyPartNumber", r."shortTrainNumber", jpjl."shortJourneyPartNumber",
                r."trainType", r.agency,
                r."showsInTripPlanner", r.timestamp, r."operationDate", t."tripId", coalesce(t."tripId", t_short."tripId"),
                coalesce(jpjl."logicalJourneyPartChanges", jpjl."logicalJourneyChanges"),
                t."tripId", coalesce(t."routeId", t_short."routeId"),
                coalesce(t."directionId", t_short."directionId"), coalesce(t."shapeId", t_short."shapeId");
        `, [operationDateOfTodayOrYesterday, endOperationDate, operationDateOfTodayOrYesterday, operationDateOfTodayOrTomorrow]).then(result => {
            console.timeEnd('getCurrentRealtimeTripUpdates');
            return result.rows;
        }).catch(error => {
            console.error(error);
            throw error;
        });
    }

    /**
     * Fetches all trip ids for TVV train numbers that are in the StaticData-NL.trips table but not in the InfoPlus.ritInfo table.
     * @param TVVTrainNumbers The TVV train numbers to check.
     * @param date The date to check for.
     */
    public async getTripIdsForTVVNotInInfoPlus(TVVTrainNumbers: number[], date: string): Promise<number[]> {
        const trainNumberPlaceHolders = TVVTrainNumbers.map(() => "?").join(",")

        return this.database
            .raw(`SELECT DISTINCT "tripId"
                  FROM "StaticData-NL".trips
                  WHERE "journeyNumber" NOT IN
                        (SELECT DISTINCT "trainNumber"
                         FROM "InfoPlus".ritInfo
                         WHERE "trainNumber" IN (${trainNumberPlaceHolders})
                           AND "operationDate" = ?)
                    AND "journeyNumber" IN (${trainNumberPlaceHolders})`, [...TVVTrainNumbers, date, ...TVVTrainNumbers])
            .then(result => result.rows.map((row: { tripId: number }) => row.tripId));
    }
}