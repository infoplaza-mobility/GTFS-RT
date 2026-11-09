/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { Repository } from "./Repository";
import { IDatabaseRitInfoUpdate } from "../Interfaces/DatabaseRitInfoUpdate";
import { IInfoPlusRepository } from "../Interfaces/Repositories/InfoplusRepository";

export class InfoplusRepository extends Repository implements IInfoPlusRepository {

    /**
     * Columns of the per-run temp table holding the core journey/stop join.
     * Materialising this join (and ANALYZE-ing it) gives the planner real row counts for the
     * static lookups that follow. Without it, the correlated multi-column join between
     * logical_journey_parts, stop_information and destinations is estimated at ~1 row instead of
     * ~70k, which makes the planner pick nested-loop plans that can run for hours after a
     * statistics change (see the 2026-11 production stalls).
     */
    private static readonly JOURNEY_STOPS_TABLE = "gtfs_rt_journey_stops";

    /** @inheritDoc */
    public async getCurrentRealtimeTripUpdates(operationDateOfTodayOrYesterday: string, operationDateOfTodayOrTomorrow: string, endOperationDate: string): Promise<IDatabaseRitInfoUpdate[]> {
        console.time('getCurrentRealtimeTripUpdates');
        const bindings = { operationDateOfTodayOrYesterday, operationDateOfTodayOrTomorrow };
        const table = InfoplusRepository.JOURNEY_STOPS_TABLE;

        try {
            return await this.database.transaction(async trx => {
                // The temp table lives for this transaction only. DROP first so a caller-supplied
                // outer transaction (as used in the integration tests) can call this repeatedly.
                await trx.raw(`DROP TABLE IF EXISTS pg_temp.${table}`);
                await trx.raw(`
                    CREATE TEMP TABLE ${table} ON COMMIT DROP AS
                    SELECT r."trainNumber",
                           r."shortTrainNumber",
                           r."trainType",
                           r.agency,
                           r."operationDate",
                           r."showsInTravelPlanner",
                           r."timestamp",
                           r."travelInformationProductId",
                           lj."journeyChanges",
                           jpjl."journeyNumber",
                           jpjl."journeyPartNumber",
                           jpjl."shortJourneyPartNumber",
                           jpjl."journeyPartChanges",
                           first_stop.first_station_code,
                           si."stationCode",
                           si."plannedWillStop",
                           si."actualWillStop",
                           si."plannedArrivalTime",
                           si."plannedDepartureTime",
                           si."actualArrivalTime",
                           si."actualDepartureTime",
                           si."plannedArrivalTracks",
                           si."plannedDepartureTracks",
                           si."actualArrivalTracks",
                           si."actualDepartureTracks",
                           si.changes,
                           si."stopOrder",
                           stat."longName" AS "destinationName"
                    FROM "InfoPlus-new".ritinfo r
                        JOIN "InfoPlus-new".logical_journeys lj
                            ON r."trainNumber" = lj."trainNumber" AND r."operationDate" = lj."operationDate"
                            AND lj."operationDate" >= :operationDateOfTodayOrYesterday::date
                        JOIN "InfoPlus-new".logical_journey_parts jpjl
                            ON lj."journeyNumber" = jpjl."journeyNumber" AND
                               r."operationDate" = jpjl."operationDate" AND
                               jpjl."operationDate" >= :operationDateOfTodayOrYesterday::date
                        JOIN "InfoPlus-new".stop_information si
                            ON jpjl."journeyNumber" = si."journeyNumber" AND
                               jpjl."journeyPartNumber" = si."journeyPartNumber" AND
                               jpjl."operationDate" = si."operationDate" AND
                               si."operationDate" >= :operationDateOfTodayOrYesterday::date AND
                               si."stopType" != 'N' AND
                               (si."plannedWillStop" = true OR si."actualWillStop" = true) AND
                               (coalesce(si."plannedDepartureTime", si."actualArrivalTime") IS NOT NULL OR
                                coalesce(si."plannedArrivalTime", si."actualArrivalTime") IS NOT NULL)
                        JOIN "InfoPlus-new".destinations dest
                            ON si."journeyNumber" = dest."journeyNumber" AND
                               si."journeyPartNumber" = dest."journeyPartNumber" AND
                               si."operationDate" = dest."operationDate" AND
                               si."stationCode" = dest."stationCode" AND
                               dest."operationDate" >= :operationDateOfTodayOrYesterday::date
                        JOIN "InfoPlus-new".stations stat ON stat."stationCode" = coalesce(dest."actualDestination", dest."plannedDestination")
                        -- First served stop of the journey part, used to disambiguate the static trip.
                        -- One index probe per row (idx_stop_info_journey_part_stop_order matches this
                        -- predicate exactly), so it stays cheap even when the planner misestimates the
                        -- outer row count. The previous DISTINCT ON CTE turned into a sort of the whole
                        -- stop_information table per outer row under such a misestimate.
                        LEFT JOIN LATERAL (
                            SELECT first_si."stationCode" AS first_station_code
                            FROM "InfoPlus-new".stop_information first_si
                            WHERE first_si."journeyNumber" = jpjl."journeyNumber"
                              AND first_si."journeyPartNumber" = jpjl."journeyPartNumber"
                              AND first_si."operationDate" = jpjl."operationDate"
                              AND first_si."stopType" != 'N'
                              AND (first_si."plannedWillStop" = true OR first_si."actualWillStop" = true)
                            ORDER BY first_si."stopOrder"
                            LIMIT 1
                        ) first_stop ON true
                    WHERE r."operationDate" >= :operationDateOfTodayOrYesterday::date
                      AND NOT (
                        r."operationDate" > :operationDateOfTodayOrTomorrow::date
                        AND lj."journeyChanges" IS NULL
                      )
                `, bindings);
                await trx.raw(`ANALYZE pg_temp.${table}`);

                const result = await trx.raw(`
                    WITH material_parts_agg AS (
                        SELECT "journeyPartNumber", "operationDate", array_remove(array_agg(distinct "shortMaterialNumber"), NULL) AS "materialNumbers", "travelInformationProductId"
                        FROM "InfoPlus-new".material_parts
                        WHERE "operationDate" >= :operationDateOfTodayOrYesterday::date
                        GROUP BY "journeyPartNumber", "operationDate", "travelInformationProductId"
                    )
                    SELECT si."journeyPartNumber"                                                         AS "trainNumber",
                           si."shortJourneyPartNumber"                                                    AS "shortTrainNumber",
                           si."trainType" ->> 'code'                                                      AS "trainType",
                           si.agency,
                           si."operationDate",
                           si."showsInTravelPlanner"                                                      AS "showsInTripPlanner",
                           si."timestamp",
                           coalesce(si."journeyChanges", si."journeyPartChanges")                         AS "changes",
                           t."tripId"                                                                     AS "tripId",
                           coalesce(t."routeId", t_short."routeId")                                       AS "routeId",
                           rt."routeType"                                                                 AS "routeType",
                           rt."agencyId"                                                                  AS "agencyId",
                           rt."routeLongName"                                                             AS "routeLongName",
                           coalesce(t."directionId", t_short."directionId")                               AS "directionId",
                           COALESCE(MIN(mp."materialNumbers"), ARRAY[]::varchar[])                        AS "materialNumbers",
                           coalesce(t."shapeId", t_short."shapeId")                                       AS "shapeId",
                           jsonb_agg(
                               CASE
                               WHEN s."stopId" IS NOT NULL OR scheduled_call."stopId" IS NOT NULL OR lateral_stop."stopId" IS NOT NULL THEN
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
                                   'stopId', COALESCE(s."stopId", scheduled_call."stopId", lateral_stop."stopId"),
                                   'scheduledStopId', scheduled_call."stopId",
                                   'scheduledStopSequence', scheduled_call."stopSequence",
                                   'assignedStopId', s."stopId"::text,
                                   'plannedPlatformCode', platforms."plannedPlatformCode",
                                   'expectedPlatformCode', platforms."expectedPlatformCode",
                                   'sequence', si."stopOrder",
                                   'name', COALESCE(s."stopName", scheduled_call."stopName", lateral_stop."stopName", si."stationCode"),
                                   'destination', si."destinationName"
                               )
                               END
                               ORDER BY si."stopOrder"
                           ) FILTER (WHERE s."stopId" IS NOT NULL OR scheduled_call."stopId" IS NOT NULL OR lateral_stop."stopId" IS NOT NULL) AS stops
                    FROM pg_temp.${table} si

                        -- Optimization: Use Materialized View for Trip Lookup
                        LEFT JOIN "StaticData-NL".mv_active_schedule t
                            ON t.trip_number = si."journeyPartNumber"
                            AND t.date = si."operationDate"
                            AND t.first_station_code = si.first_station_code

                        LEFT JOIN "StaticData-NL".mv_active_schedule t_short
                            ON t_short.trip_number = si."shortJourneyPartNumber"
                            AND t_short.date = si."operationDate"
                            AND t_short.first_station_code = si.first_station_code
                            AND t."tripId" IS NULL

                        -- Resolve the original static call independently of its expected platform.
                        -- Repeated visits to a station require a unique planned-time match.
                        LEFT JOIN LATERAL (
                            SELECT min(candidate.stop_id) AS "stopId",
                                   min(candidate.stop_sequence) AS "stopSequence",
                                   min(candidate."stopName") AS "stopName"
                            FROM (
                                SELECT scheduled.stop_id, scheduled.stop_sequence, original."stopName",
                                       count(*) OVER () AS station_visits,
                                       CASE WHEN si."plannedDepartureTime" IS NOT NULL
                                           THEN nullif(btrim(scheduled.departure_time), '')::interval =
                                                (si."plannedDepartureTime" AT TIME ZONE 'Europe/Amsterdam') - si."operationDate"::timestamp
                                           ELSE nullif(btrim(scheduled.arrival_time), '')::interval =
                                                (si."plannedArrivalTime" AT TIME ZONE 'Europe/Amsterdam') - si."operationDate"::timestamp
                                       END AS matches_planned_time
                                FROM "StaticData-NL".stop_times scheduled
                                JOIN "StaticData-NL".iff_stops original ON original."stopId" = scheduled.stop_id
                                WHERE scheduled.trip_id = t."tripId"::text
                                  AND original."stationCode" = upper(btrim(si."stationCode"))
                                  AND si."plannedWillStop" = true
                            ) candidate
                            WHERE candidate.station_visits = 1 OR candidate.matches_planned_time
                            HAVING count(*) = 1
                        ) scheduled_call ON true

                        -- A stop has one native assignment: prefer its departure platform,
                        -- or its arrival platform at a terminus. Keep section letters.
                        CROSS JOIN LATERAL (
                            SELECT
                                CASE WHEN coalesce(si."plannedDepartureTime", si."actualDepartureTime") IS NOT NULL
                                    THEN coalesce(nullif(lower(btrim(si."plannedDepartureTracks")), ''),
                                                  nullif(lower(btrim(si."plannedArrivalTracks")), ''))
                                    ELSE coalesce(nullif(lower(btrim(si."plannedArrivalTracks")), ''),
                                                  nullif(lower(btrim(si."plannedDepartureTracks")), ''))
                                END AS "plannedPlatformCode",
                                CASE WHEN coalesce(si."plannedDepartureTime", si."actualDepartureTime") IS NOT NULL
                                    THEN coalesce(nullif(lower(btrim(si."actualDepartureTracks")), ''),
                                                  nullif(lower(btrim(si."actualArrivalTracks")), ''),
                                                  nullif(lower(btrim(si."plannedDepartureTracks")), ''),
                                                  nullif(lower(btrim(si."plannedArrivalTracks")), ''))
                                    ELSE coalesce(nullif(lower(btrim(si."actualArrivalTracks")), ''),
                                                  nullif(lower(btrim(si."actualDepartureTracks")), ''),
                                                  nullif(lower(btrim(si."plannedArrivalTracks")), ''),
                                                  nullif(lower(btrim(si."plannedDepartureTracks")), ''))
                                END AS "expectedPlatformCode"
                        ) platforms
                        LEFT JOIN LATERAL (
                            SELECT min(platform."stopId") AS "stopId",
                                   min(platform."stopName") AS "stopName"
                            FROM "StaticData-NL".iff_stops platform
                            WHERE platform."stationCode" = upper(btrim(si."stationCode"))
                              AND nullif(lower(btrim(platform."platformCode")), '') =
                                  platforms."expectedPlatformCode"
                            HAVING count(DISTINCT platform."stopId") = 1
                        ) s ON true
                        LEFT JOIN LATERAL (
                            SELECT lax."stopId", lax."stopName"
                            FROM "StaticData-NL".iff_stops lax
                            LEFT JOIN "StaticData-NL".stop_times scheduled_stop
                              ON scheduled_stop.trip_id = coalesce(t."tripId", t_short."tripId")::text
                             AND scheduled_stop.stop_id = lax."stopId"
                            WHERE lax."stationCode" = upper(btrim(si."stationCode"))
                            -- An unresolved assignment must not choose an arbitrary platform.
                            -- Retain the planned/scheduled stop or an existing stop without a platform.
                              AND (nullif(lower(btrim(lax."platformCode")), '') = platforms."plannedPlatformCode"
                                   OR scheduled_stop.stop_id IS NOT NULL
                                   OR nullif(btrim(lax."platformCode"), '') IS NULL)
                            ORDER BY (nullif(lower(btrim(lax."platformCode")), '') = platforms."plannedPlatformCode") DESC NULLS LAST,
                                     scheduled_stop.stop_sequence NULLS LAST,
                                     lax."stopId"
                            LIMIT 1
                        ) AS lateral_stop ON s."stopId" IS NULL AND scheduled_call."stopId" IS NULL

                        LEFT JOIN "StaticData-NL".routes rt ON rt."routeId" = coalesce(t."routeId", t_short."routeId")

                        -- Use CTE for material parts to PREVENT DUPLICATE STOPS (Cartesian product)
                        LEFT JOIN material_parts_agg mp ON mp."journeyPartNumber" = si."journeyPartNumber" AND mp."operationDate" = si."operationDate" AND mp."travelInformationProductId" = si."travelInformationProductId"

                    GROUP BY si."trainNumber", si."journeyNumber", si."journeyPartNumber", si."shortTrainNumber", si."shortJourneyPartNumber",
                        si."trainType", si.agency,
                        si."showsInTravelPlanner", si.timestamp, si."operationDate", t."tripId", coalesce(t."tripId", t_short."tripId"),
                        coalesce(si."journeyChanges", si."journeyPartChanges"),
                        coalesce(t."routeId", t_short."routeId"),
                        coalesce(t."directionId", t_short."directionId"), coalesce(t."shapeId", t_short."shapeId"), rt."routeType",
                        rt."agencyId", rt."routeLongName"
                `, bindings);
                return result.rows as IDatabaseRitInfoUpdate[];
            });
        } catch (error) {
            console.error(`[InfoplusRepository] Fetching realtime trip updates failed`, error);
            throw error;
        } finally {
            console.timeEnd('getCurrentRealtimeTripUpdates');
        }
    }

    /**
     * Fetches all trip ids for TVV train numbers that are in the StaticData-NL.trips table but not in the InfoPlus.ritInfo table.
     * @param TVVTrainNumbers The TVV train numbers to check.
     * @param date The date to check for.
     */
    public async getTripIdsForTVVNotInInfoPlus(TVVTrainNumbers: number[], date: string): Promise<number[]> {
        if (TVVTrainNumbers.length === 0)
            return [];

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
