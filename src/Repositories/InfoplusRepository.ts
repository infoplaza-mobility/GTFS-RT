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
     */
    public async getCurrentRealtimeTripUpdates(operationDate: string): Promise<IDatabaseRitInfoUpdate[]> {
        return this.database.raw(`
            SELECT r."trainNumber", r."shortTrainNumber", r."trainType", r.agency, r."showsInTripPlanner", r."timestamp",
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
                                coalesce(s."stopId", (SELECT "stopId" FROM "StaticData-NL".stops WHERE stops."zoneId" = concat('IFF:', lower(si."stationCode")) LIMIT 1)),
                                'platform',
                                s."platformCode",
                                'sequence',
                                si."stopOrder"
                           )
                       ORDER BY si."stopOrder"
                   ) stops,
                coalesce(t."tripId", (SELECT "tripId" FROM "StaticData-NL".trips WHERE "tripShortName"::int = r."shortTrainNumber" AND trips."serviceId" IN (SELECT "serviceId" FROM "StaticData-NL".calendar_dates WHERE date = ?) LIMIT 1)) AS "tripId",
                coalesce(t."routeId", (SELECT "routeId" FROM "StaticData-NL".trips WHERE "tripShortName"::int = r."shortTrainNumber" AND trips."serviceId" IN (SELECT "serviceId" FROM "StaticData-NL".calendar_dates WHERE date = ?) LIMIT 1)) AS "routeId",
                coalesce(t."directionId", (SELECT "directionId" FROM "StaticData-NL".trips WHERE "tripShortName"::int = r."shortTrainNumber" AND trips."serviceId" IN (SELECT "serviceId" FROM "StaticData-NL".calendar_dates WHERE date = ?) LIMIT 1)) AS "directionId"
            FROM "InfoPlus".ritinfo r
                    LEFT JOIN "StaticData-NL".trips t ON t.agency = 'IFF' AND t."tripShortName"::int = r."trainNumber" AND t."serviceId" IN (SELECT "serviceId" FROM "StaticData-NL".calendar_dates WHERE date = ?)
                    JOIN "InfoPlus".journey_part_journey_links jpjl ON jpjl."trainNumber" = r."trainNumber" AND jpjl."operationDate" = r."operationDate"
                    JOIN "InfoPlus".stop_information si
                          ON jpjl."logicalJourneyPartNumber" = si."logicalJourneyPartNumber" AND jpjl."operationDate" = si."operationDate" AND coalesce(si."plannedArrivalTime", "plannedDepartureTime") IS NOT NULL
                     LEFT JOIN "StaticData-NL".stops s ON (s."zoneId" = concat('IFF:', lower(si."stationCode")) AND s."platformCode" = coalesce(
                            si."departureTrackMessage" -> 'Uitingen' ->> 'Uiting',
                            si."arrivalTrackMessage" -> 'Uitingen' ->> 'Uiting'))
            
            WHERE r."operationDate" = ? OR r."operationDate" = ?::date - INTERVAL '1 DAY'
            GROUP BY r."trainNumber", r."shortTrainNumber", r."trainType", r.agency, r."showsInTripPlanner", t."tripId", r.timestamp
            ORDER BY r.timestamp DESC LIMIT 500;
       `, [operationDate, operationDate, operationDate, operationDate, operationDate]).then(result => {
           return result.rows;
        }).catch(error => {
            console.error(error);
            throw error;
        });
    }
}