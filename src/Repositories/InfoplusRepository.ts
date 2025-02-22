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
                   WHERE "date" >= :operationDateOfTodayOrYesterday::date
                     AND date <= :endOperationDate::date),
     trips AS (SELECT "tripId", "routeId", "directionId", "tripShortName", "shapeId", "serviceId"
               FROM "StaticData-NL".trips
               WHERE agency = 'IFF'
                 AND "serviceId" IN (SELECT DISTINCT "serviceId"
                                     FROM cal_dates)),
     stops AS (SELECT "stopId", upper(replace("zoneId", 'IFF:', '')) AS "stationCode", "platformCode", "stopName"
               FROM "StaticData-NL".stops
               WHERE stops."zoneId" IS NOT NULL AND stops."zoneId" LIKE 'IFF%')
SELECT jpjl."journeyPartNumber"                                                              AS "trainNumber",
       jpjl."shortJourneyPartNumber"                                                         AS "shortTrainNumber",
       r."trainType" ->> 'code'                                                              AS "trainType",
       r.agency,
       r."operationDate",
       r."showsInTravelPlanner"                                                              AS "showsInTripPlanner",
       r."timestamp",
       coalesce(lj."journeyChanges", jpjl."journeyPartChanges")                              AS "changes",
       t."tripId"                                                                            AS "tripId",
       coalesce(t."routeId", t_short."routeId")                                              AS "routeId",
       rt."routeType"                                                                        AS "routeType",
       rt."agencyId"                                                                         AS "agencyId",
       rt."routeLongName"                                                                    AS "routeLongName",
       coalesce(t."directionId", t_short."directionId")                                      AS "directionId",
       coalesce(t."shapeId", t_short."shapeId")                                              AS "shapeId",
       jsonb_agg(
       CASE
           WHEN s."stopId" IS NOT NULL OR lateral_stop."stopId" IS NOT NULL THEN
               jsonb_build_object(
                       'stationCode', si."stationCode",
                       'plannedWillStop', si."plannedWillStop",
                       'actualWillStop', si."actualWillStop",
                       'plannedArrivalTime', si."plannedArrivalTime",
                       'plannedDepartureTime', si."plannedDepartureTime",
                       'departureTime', coalesce(si."actualDepartureTime", si."plannedDepartureTime"),
                       'arrivalTime', coalesce(si."actualArrivalTime", si."plannedArrivalTime"),
                       'departureDelay', si."actualDepartureTime" - si."plannedDepartureTime",
                       'arrivalDelay', si."actualArrivalTime" - si."plannedArrivalTime",
                       'changes', si.changes,
                       'stopId', COALESCE(s."stopId", lateral_stop."stopId"),
                       'platform', s."platformCode",
                       'plannedTrack', coalesce(si."plannedArrivalTracks", si."plannedDepartureTracks"),
                       'actualTrack', coalesce(si."actualArrivalTracks", si."actualDepartureTracks"),
                       'track',
                       coalesce(si."actualArrivalTracks", si."actualDepartureTracks", si."plannedArrivalTracks",
                                si."plannedDepartureTracks"),
                       'sequence', si."stopOrder",
                       'name', COALESCE(s."stopName", lateral_stop."stopName", si."stationCode")
               )
           END
       ORDER BY si."stopOrder"
                ) FILTER (WHERE s."stopId" IS NOT NULL OR lateral_stop."stopId" IS NOT NULL) AS stops
FROM "InfoPlus-new".ritinfo r
         JOIN "InfoPlus-new".logical_journeys lj
              ON r."trainNumber" = lj."trainNumber" AND r."operationDate" = lj."operationDate"
         JOIN "InfoPlus-new".logical_journey_parts jpjl
              ON lj."journeyNumber" = jpjl."journeyNumber" AND
                 r."operationDate" = jpjl."operationDate"
         JOIN "InfoPlus-new".stop_information si
              ON jpjl."journeyPartNumber" = si."journeyPartNumber" AND
                 jpjl."operationDate" = si."operationDate" AND
                 si."stopType" != 'N' AND
                 ("plannedWillStop" = true OR "actualWillStop" = true) AND
                 (coalesce("plannedDepartureTime", "actualArrivalTime") IS NOT NULL OR
                  coalesce("plannedArrivalTime", "actualArrivalTime") IS NOT NULL)
         LEFT JOIN trips t
                   ON jpjl."journeyPartNumber" = t."tripShortName"::int
                       AND EXISTS (SELECT 1
                                   FROM cal_dates cd
                                   WHERE cd."serviceId" = t."serviceId"
                                     AND cd."date" = r."operationDate")

         LEFT JOIN trips t_short ON t."tripId" IS NULL AND jpjl."shortJourneyPartNumber" = t_short."tripShortName"::int
    AND EXISTS (SELECT 1
                FROM cal_dates cd
                WHERE cd."serviceId" = t_short."serviceId"
                  AND cd."date" = r."operationDate")
         LEFT JOIN stops s ON (s."stationCode" = si."stationCode" AND
                               s."platformCode" =
                               coalesce(si."actualArrivalTracks", si."actualDepartureTracks", si."plannedArrivalTracks",
                                        si."plannedDepartureTracks"))
         LEFT JOIN LATERAL (
    SELECT "stopId", "stopName"
    FROM stops lax
    WHERE lax."stationCode" = si."stationCode"
    LIMIT 1
    ) AS lateral_stop ON s."stopId" IS NULL
         LEFT JOIN "StaticData-NL".routes rt ON rt."routeId" = coalesce(t."routeId", t_short."routeId")
WHERE r."operationDate" >= :operationDateOfTodayOrYesterday::date
  AND NOT (
    r."operationDate" > :operationDateOfTodayOrTomorrow::date
        AND lj."journeyChanges" IS NULL
    )
GROUP BY r."trainNumber", jpjl."journeyPartNumber", r."shortTrainNumber", jpjl."shortJourneyPartNumber",
         r."trainType", r.agency,
         r."showsInTravelPlanner", r.timestamp, r."operationDate", t."tripId", coalesce(t."tripId", t_short."tripId"),
         coalesce(lj."journeyChanges", jpjl."journeyPartChanges"),
         t."tripId", coalesce(t."routeId", t_short."routeId"),
         coalesce(t."directionId", t_short."directionId"), coalesce(t."shapeId", t_short."shapeId"), rt."routeType",
         rt."agencyId", rt."routeLongName";
        `, { operationDateOfTodayOrYesterday, endOperationDate, operationDateOfTodayOrTomorrow }).then(result => {
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
                         FROM "InfoPlus-new".ritInfo
                         WHERE "trainNumber" IN (${trainNumberPlaceHolders})
                           AND "operationDate" = ?)
                    AND "journeyNumber" IN (${trainNumberPlaceHolders})`, [...TVVTrainNumbers, date, ...TVVTrainNumbers])
            .then(result => result.rows.map((row: { tripId: number }) => row.tripId));
    }
}