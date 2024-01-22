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
     * @param operationDateOfTodayOrYesterday The operation date of today or yesterday in YYYY-MM-DD format. Which date to use should be decided based on the current time, if it's before 04:00, use yesterday, otherwise use today.
     * @param operationDateOfTodayOrTomorrow The operation date of today or tomorrow in YYYY-MM-DD format. Which date to use should be decided based on the current time, if it's after 22:00, use tomorrow, otherwise use today.
     * @param endOperationDate The end operation date in YYYY-MM-DD format. (Generally three days after the operation date)
     * If this query is slow all of a sudden, an index is probably missing.
     */
    getCurrentRealtimeTripUpdates(operationDateOfTodayOrYesterday: string, operationDateOfTodayOrTomorrow: string, endOperationDate: string): Promise<IDatabaseRitInfoUpdate[]>;

    /**
     * Fetches all trip ids for TVV train numbers that are in the StaticData-NL.trips table but not in the InfoPlus.ritInfo table.
     * @param TVVTrainNumbers The TVV train numbers to check.
     * @param date The date to check for.
     */
    getTripIdsForTVVNotInInfoPlus(TVVTrainNumbers: number[], date: string): Promise<number[]>
}