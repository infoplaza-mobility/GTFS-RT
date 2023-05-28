/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {Repository} from "./Repository";
import { IDatabasePasstimesUpdate } from "../Interfaces/DatabasePasstimesUpdate";

export class PassTimesRepository extends Repository {

    /**
     * Fetches all Passtimes messages plus their stops (including GTFS trip and stop ids) from the Realtime Passtimes database.
     * Limited to all vehicles that had at least one stop in the last hour, and driving future stops.
     * @returns {Promise<IDatabasePasstimesUpdate[]>} Passtimes messages with their associated stops.
     * @param operationDate The operation date in YYYY-MM-DD format.
     */
    public async getCurrentRealtimeTripUpdates(operationDate: string): Promise<IDatabasePasstimesUpdate[]> {
        return this.database.raw(`
        WITH trips AS (SELECT "tripId", "journeyNumber", "planningNumber", agency, "routeId"
               FROM "StaticData-NL".trips
               WHERE agency != 'IFF'
                 AND "serviceId" IN (SELECT "serviceId" FROM "StaticData-NL".calendar_dates WHERE date = ?))
SELECT current_trips.stops, trips."routeId", trips."tripId", current_trips."VejoDepartureTime", current_trips."OperationDate"
FROM (SELECT "JourneyNumber",
             "LinePlanningNumber",
             pt."DataOwnerCode",
             "VejoDepartureTime",
             "OperationDate",
             jsonb_agg(
                     jsonb_build_object(
                             'arrivalTime', EXTRACT(EPOCH FROM CAST(TO_DATE(?, 'YYYY-MM-DD') +
                                                                    (coalesce(nullif("RecordedArrivalTime", '0'),
                                                                              nullif("ExpectedArrivalTime", '0'),
                                                                              "TargetArrivalTime")::interval -
                                                                     '00:00:00'::interval) AS timestamp))::int,
                             'departureTime', EXTRACT(EPOCH FROM CAST(TO_DATE(?, 'YYYY-MM-DD') +
                                                                      (coalesce(nullif("RecordedDepartureTime", '0'),
                                                                                nullif("ExpectedDepartureTime", '0'),
                                                                                "TargetDepartureTime")::interval -
                                                                       '00:00:00'::interval) AS timestamp))::int,
                                                                       'plannedArrivalTime', EXTRACT(EPOCH FROM CAST(TO_DATE('2023-05-27', 'YYYY-MM-DD') +
                                                                       ("TargetArrivalTime"::interval -
                                                                        '00:00:00'::interval) AS timestamp))::int,
                              'plannedDepartureTime', EXTRACT(EPOCH FROM CAST(TO_DATE('2023-05-27', 'YYYY-MM-DD') +
                                                                       ("TargetDepartureTime"::interval -
                                                                        '00:00:00'::interval) AS timestamp))::int,
                             'stopId', coalesce(s1."stopId", s2."stopId", s3."stopId"),
                             'arrivalDelay', EXTRACT(EPOCH FROM
                                                     (COALESCE(NULLIF("RecordedArrivalTime", '0'), "ExpectedArrivalTime")::interval -
                                                      "TargetArrivalTime"::interval))::int,
                             'departureDelay', EXTRACT(EPOCH FROM (COALESCE(NULLIF("RecordedDepartureTime", '0'),
                                                                            "ExpectedDepartureTime")::interval -
                                                                   "TargetDepartureTime"::interval))::int,
                             'tripStopStatus', "TripStopStatus",
                             'stopOrder', "UserStopOrderNumber"
                         ) ORDER BY "UserStopOrderNumber"
                 ) AS stops
      FROM "PassTimes".passtimes pt
               JOIN "StaticData-NL".quay_index qi
                    ON qi.dataownercode = pt."DataOwnerCode" AND (qi.userstopcode = pt."UserStopCode")
               LEFT JOIN "StaticData-NL".stops s1 ON (CASE
                                                          WHEN length(s1."stopCode"::text) < 8
                                                              THEN LPAD(s1."stopCode"::text, 5, '0')
                                                          ELSE s1."stopCode"::text
          END) = qi.userstopcode
               LEFT JOIN "StaticData-NL".stops s2 ON 'NL:Q:' || (
          CASE
              WHEN length(s2."stopCode"::text) < 8 THEN LPAD(s2."stopCode"::text, 5, '0')
              ELSE s2."stopCode"::text
              END) = qi.quaycode
               LEFT JOIN "StaticData-NL".stops s3 ON s3."stopCode" = qi.userstopcode
      WHERE "OperationDate" = ?
        AND ("VejoDepartureTime" > (current_timestamp - interval '1 hour')::time::text)
        AND "TripStopStatus" IN ('DRIVING', 'CANCEL', 'ARRIVED', 'UNKNOWN', 'PASSED')
      GROUP BY "JourneyNumber", "LinePlanningNumber", pt."DataOwnerCode", "VejoDepartureTime", "OperationDate") AS current_trips
         LEFT JOIN trips ON (trips."journeyNumber" = current_trips."JourneyNumber" AND
                             trips."planningNumber" = current_trips."LinePlanningNumber" AND
                             trips.agency = current_trips."DataOwnerCode");
        `, [operationDate, operationDate, operationDate, operationDate]).then(result => {
           return result.rows;
        }).catch(error => {
            console.error(error);
            throw error;
        });
    }
}