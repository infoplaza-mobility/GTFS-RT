/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {Repository} from "./Repository";
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseTripUpdate";

export class InfoplusRepository extends Repository {

    /**
     * Fetches all RitInfo messages plus their stops (including GTFS trip and stop ids) from the InfoPlus database.
     * Limited to 500 results (about 30 minutes of updates). If a train isn't updated in the last 30 minutes, it's probably not driving anymore.
     * @returns {Promise<IDatabaseRitInfoUpdate[]>} RitInfo messages with their associated stops.
     * @param operationDate The operation date in YYYY-MM-DD format.
     * If this query is slow all of a sudden, an index is probably missing.
     */
    public async getCurrentRealtimeTripUpdates(operationDate: string): Promise<IDatabaseRitInfoUpdate[]> {
        return this.database.raw(`
            WITH trips AS (SELECT "tripId", "routeId", "directionId", "tripShortName"
                           FROM "StaticData-NL".trips
                           WHERE agency = 'IFF'
                             AND "serviceId" IN (SELECT "serviceId"
                                                 FROM "StaticData-NL".calendar_dates
                                                 WHERE date = ?)),
                stops AS (SELECT "stopId", "zoneId", "platformCode"
            FROM "StaticData-NL".stops
            WHERE "zoneId" LIKE 'IFF:%')
            SELECT r."trainNumber",
                   r."shortTrainNumber",
                   r."trainType",
                   r.agency,
                   r."showsInTripPlanner",
                   r."timestamp",
                   jpjl."logicalJourneyChanges" AS        "changes",
                   trips."tripId",
                   trips."routeId",
                   trips."directionId",
                   jsonb_agg(
                           jsonb_build_object(
                                   'stationCode',
                                   si."stationCode",
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
                                            LIMIT 1)),
                                   'platform',
                                   s."platformCode",
                                   'sequence',
                                   si."stopOrder"
                               ) ORDER BY si."stopOrder") stops
            FROM "InfoPlus".ritinfo r
                     JOIN "InfoPlus".journey_part_journey_links jpjl USING ("trainNumber", "operationDate")
                     JOIN "InfoPlus".stop_information si USING ("logicalJourneyPartNumber", "operationDate")
                     LEFT JOIN "StaticData-NL".stops s
                               ON (s."zoneId" = concat('IFF:', lower(si."stationCode")) AND s."platformCode" = coalesce(
                                       si."departureTrackMessage" -> 'Uitingen' ->> 'Uiting',
                                   si."arrivalTrackMessage" -> 'Uitingen' ->> 'Uiting'))
                     JOIN trips ON trips."tripShortName"::int = r."shortTrainNumber"
            WHERE r."operationDate" = ?
               OR (CURRENT_DATE = ?::date + INTERVAL '1 day' AND
                r."operationDate" = ?::date - INTERVAL '2 hours')
            GROUP BY r."trainNumber", r."shortTrainNumber", r."trainType", r.agency, r."showsInTripPlanner", r.timestamp,
                jpjl."logicalJourneyChanges", trips."tripId", trips."routeId", trips."directionId"
            HAVING max(coalesce(si."actualDepartureTime", si."plannedDepartureTime")) >= now() - INTERVAL '1 hours';
        `, [operationDate, operationDate, operationDate, operationDate]).then(result => {
           return result.rows;
        }).catch(error => {
            console.error(error);
            throw error;
        });
    }
}