/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { StopUpdate } from './StopUpdate';
import { IDatabasePasstimesStopUpdate } from '../../Interfaces/DatabasePasstimesUpdate';

/**
 * Represents a stop update from the Passtimes table.
 */
export class PasstimesStopUpdate extends StopUpdate {

    private _tripStopStatus: "UNKNOWN" | "DRIVING" | "PLANNED" | "PASSED" | "ARRIVED" | "CANCEL";

    constructor(update: IDatabasePasstimesStopUpdate) {
        super(update);

        this._tripStopStatus = update.tripStopStatus;
    }

    /**
     * Check if the current stop has been cancelled.
     * @returns {boolean} True if the stop has been cancelled, false otherwise.
     */
    public isCancelled(): boolean {
        return this._tripStopStatus == "CANCEL";
    }
}