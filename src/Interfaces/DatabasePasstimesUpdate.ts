/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { IDatabaseStopUpdate } from "./DatabaseStopUpdate";


export interface IDatabasePasstimesUpdate {
    stops: IDatabasePasstimesStopUpdate[];
    /** Null when no trip found, so this is an ADDED trip. */
    tripId: number | null;
    /** Null when no trip found. */
    routeId: number | null;
    /** Start time in HH:MM:SS */
    startTime: string;
    /** Start date in YYYY-MM-DD */
    startDate: string;
}

export interface IDatabasePasstimesStopUpdate extends IDatabaseStopUpdate {
    /** Stop status */
    tripStopStatus: "UNKNOWN" | "DRIVING" | "PLANNED" | "PASSED" | "ARRIVED" | "CANCEL";
}