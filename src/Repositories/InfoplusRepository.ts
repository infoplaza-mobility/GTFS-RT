/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {Repository} from "./Repository";
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseRitInfoUpdate";
import knex from "knex";

export class InfoplusRepository extends Repository {

    /**
     * Fetches all RitInfo messages plus their stops (including GTFS trip and stop ids) from the InfoPlus database.
     * Limited to all trains that had at least one stop in the last hour and all planned trains in the future for the current day.
     * @returns {Promise<IDatabaseRitInfoUpdate[]>} RitInfo messages with their associated stops.
     * @param operationDate The operation date in YYYY-MM-DD format.
     * If this query is slow all of a sudden, an index is probably missing.
     */
    public async getCurrentRealtimeTripUpdates(operationDate: string): Promise<IDatabaseRitInfoUpdate[]> {
        console.time('getCurrentRealtimeTripUpdates');
        return this.database.raw(`
            WITH trips AS (SELECT "tripId", "routeId", "directionId", "tripShortName", "shapeId"
                           FROM "StaticData-NL".trips
                           WHERE agency = 'IFF'
                             AND "serviceId" IN (SELECT "serviceId"
                                                 FROM "StaticData-NL".calendar_dates
                                                 WHERE date = ?)), stops AS (
            SELECT "stopId", "zoneId", "platformCode"
            FROM "StaticData-NL".stops
            WHERE "zoneId" LIKE 'IFF:%')
            SELECT r."trainNumber",
                   r."shortTrainNumber",
                   r."trainType",
                   r.agency,
                   r."showsInTripPlanner",
                   r."timestamp",
                   coalesce(jpjl."logicalJourneyPartChanges", jpjl."logicalJourneyChanges") AS "changes",
                   coalesce(trips."tripId", t_short."tripId")                               AS "tripId",
                   coalesce(trips."routeId", t_short."routeId")                             AS "routeId",
                   coalesce(trips."directionId", t_short."directionId")                     AS "directionId",
                   coalesce(trips."shapeId", t_short."shapeId")                             AS "shapeId",
                   jsonb_agg(
                           jsonb_build_object(
                                   'stationCode',
                                   si."stationCode",
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
                                   coalesce(s."stopId", (SELECT "stopId"
                                                         FROM stops
                                                         WHERE stops."zoneId" = concat('IFF:', lower(si."stationCode"))
                                            LIMIT 1), si."stationCode"),
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
                               ) ORDER BY si."stopOrder")                                      stops
            FROM "InfoPlus".ritinfo r
                     JOIN "InfoPlus".journey_part_journey_links jpjl ON jpjl."trainNumber" = r."trainNumber" AND
                                                                        jpjl."operationDate" = r."operationDate"
                     JOIN "InfoPlus".stop_information si
                          ON jpjl."logicalJourneyPartNumber" = si."logicalJourneyPartNumber" AND
                             jpjl."operationDate" = si."operationDate" AND "plannedWillStop" = true AND
                             (coalesce("plannedDepartureTime", "actualArrivalTime") IS NOT NULL OR
                              coalesce("plannedArrivalTime", "actualArrivalTime") IS NOT NULL)
--                                                                 AND ("plannedDepartureTime" != "actualDepartureTime" OR "plannedArrivalTime" != "actualArrivalTime")
                     LEFT JOIN "StaticData-NL".stops s
                               ON (s."zoneId" = concat('IFF:', lower(si."stationCode")) AND s."platformCode" = coalesce(
                                       si."departureTrackMessage" -> 'Uitingen' ->> 'Uiting',
                si."arrivalTrackMessage" -> 'Uitingen' ->> 'Uiting'))
-- Get trip ids both with the long and short train number
                     LEFT JOIN trips ON trips."tripShortName"::int = jpjl."logicalJourneyPartNumber"
LEFT JOIN trips t_short
            ON t_short."tripShortName":: int = r."shortTrainNumber"
            WHERE r."operationDate" = ?
               OR (CURRENT_DATE = ?:: date + INTERVAL '1 day'
              AND
                r."operationDate" = ?:: date - INTERVAL '2 hours')
            GROUP BY r."trainNumber", jpjl."logicalJourneyPartNumber", r."shortTrainNumber", r."trainType", r.agency, r."showsInTripPlanner", r.timestamp,
                coalesce (jpjl."logicalJourneyPartChanges", jpjl."logicalJourneyChanges"), coalesce (trips."tripId", t_short."tripId"), coalesce (trips."routeId", t_short."routeId"), coalesce (trips."directionId", t_short."directionId"), coalesce (trips."shapeId", t_short."shapeId")
            HAVING max (coalesce (si."actualDepartureTime", si."plannedDepartureTime")) >= now() - INTERVAL '1 hours';
        `, [operationDate, operationDate, operationDate, operationDate]).then(result => {
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