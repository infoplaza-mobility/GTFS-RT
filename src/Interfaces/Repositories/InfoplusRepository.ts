/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {IDatabaseRitInfoUpdate} from "../DatabaseRitInfoUpdate";

export interface IInfoPlusRepository {
    /**
     * Fetches all RitInfo messages plus their stops (including GTFS trip and stop ids) from the InfoPlus database.
     * Limited to all trains that had at least one stop in the last hour and all planned trains in the future for the current day.
     * @returns {Promise<IDatabaseRitInfoUpdate[]>} RitInfo messages with their associated stops.
     * @param operationDate The operation date in YYYY-MM-DD format.
     * Make sure to have correct indexes on the database, otherwise this query will be (very) slow.
     */
    getCurrentRealtimeTripUpdates(operationDate: string): Promise<IDatabaseRitInfoUpdate[]>;

    /**
     * Fetches all trip ids for TVV train numbers that are in the StaticData-NL.trips table but not in the InfoPlus.ritInfo table.
     * @param TVVTrainNumbers The TVV train numbers to check.
     * @param date The date to check for.
     */
    getTripIdsForTVVNotInInfoPlus(TVVTrainNumbers: number[], date: string): Promise<number[]>
}