/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {Repository} from "./Repository";
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseRitInfoUpdate";
import knex from "knex";
import {IInfoPlusRepository} from "../Interfaces/Repositories/InfoplusRepository";

export class InfoplusRepository extends Repository implements IInfoPlusRepository {

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
                                                 WHERE date = ?)),
                 -- We only need stops that are train stations, these all have 'IFF:' as a prefix.
                stops AS (SELECT "stopId", "zoneId", "platformCode"
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
                   -- Build the stops array
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
                             jpjl."operationDate" = si."operationDate" AND
                             ("plannedWillStop" = true OR "actualWillStop" = true) AND
                             (coalesce("plannedDepartureTime", "actualArrivalTime") IS NOT NULL OR
                              coalesce("plannedArrivalTime", "actualArrivalTime") IS NOT NULL)
--                                                                 AND ("plannedDepartureTime" != "actualDepartureTime" OR "plannedArrivalTime" != "actualArrivalTime")
                     LEFT JOIN "StaticData-NL".stops s
                               ON (s."zoneId" = concat('IFF:', lower(si."stationCode")) AND s."platformCode" = coalesce(
                                       si."departureTrackMessage" -> 'Uitingen' ->> 'Uiting',
                                   si."arrivalTrackMessage" -> 'Uitingen' ->> 'Uiting'))
                -- We use either the original train number, or the short train number to match trips 
                -- (Static data does not know about "ingelegde" ritten 100.000, 300.000, 700.000)
                     LEFT JOIN trips ON trips."tripShortName"::int = jpjl."logicalJourneyPartNumber"
         LEFT JOIN trips t_short ON t_short."tripShortName":: int = r."shortTrainNumber"
            -- We only want to show trains that are running today or tomorrow, during the "magic" switchover times (0-4am), we need both days.
-- There's still a bug in here, where updates are not entirely correct during the switchover time.
            WHERE r."operationDate" = ? OR (CURRENT_DATE = ?:: date + INTERVAL '1 day' AND r."operationDate" = ?:: date - INTERVAL '2 hours')
            GROUP BY r."trainNumber", jpjl."logicalJourneyPartNumber", r."shortTrainNumber", r."trainType", r.agency,
                r."showsInTripPlanner", r.timestamp,
                coalesce(jpjl."logicalJourneyPartChanges", jpjl."logicalJourneyChanges"),
                coalesce(trips."tripId", t_short."tripId"), coalesce(trips."routeId", t_short."routeId"),
                coalesce(trips."directionId", t_short."directionId"), coalesce(trips."shapeId", t_short."shapeId")
            -- Only take trips where the train is still running, or the last stop has only been passed for max 1 hour.
-- You can remove or change this filter to your liking to only show trains that are still running, have all updates for the day, etc.
            HAVING max(coalesce(si."actualDepartureTime", si."plannedDepartureTime")) >= now() - INTERVAL '1 hours';
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