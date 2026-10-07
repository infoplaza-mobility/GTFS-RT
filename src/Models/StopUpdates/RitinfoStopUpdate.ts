/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { IRitInfoStopUpdate } from '../../Interfaces/DatabaseRitInfoUpdate'
import { StopUpdate } from './StopUpdate';
import {IJourneyChange} from "../../Shared/src/Types/Infoplus/V2/JourneyChange";
import {
    LogicalJourneyPartStationChangeType
} from "../../Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyPartStationChangeType";
export class RitInfoStopUpdate extends StopUpdate {

    private readonly changes: IJourneyChange<LogicalJourneyPartStationChangeType>[];

    private readonly plannedPlatformCode: string | null;
    private readonly expectedPlatformCode: string | null;

    public readonly assignedStopId: string | null;

    private readonly plannedWillStop: boolean;
    private readonly actualWillStop: boolean;

    public readonly stationCode: string;

    public readonly name: string;

    constructor(update: IRitInfoStopUpdate) {
        super(update);

        this.changes = update.changes;
        this.stationCode = update.stationCode;

        this.plannedPlatformCode = update.plannedPlatformCode;
        this.expectedPlatformCode = update.expectedPlatformCode;
        this.assignedStopId = update.assignedStopId;

        this.plannedWillStop = update.plannedWillStop;
        this.actualWillStop = update.actualWillStop;

        this.name = update.name;
    }


    /**
     * Check if the current stop arrival has been cancelled.
     * E.g. train first went from A to B to C, but now only goes from B to C.
     * Thus the arrival at B has been cancelled, and the whole stop A has been cancelled.
     * (Cancelled Departure at A, Cancelled Arrival at B, C is left untouched)
     * @returns {boolean} True if the stop arrival has been cancelled, false otherwise.
     */
    public isCancelledArrival(): boolean {
        if (!this.changes) return false;

        return this.changes.some(change =>
            change.changeType == LogicalJourneyPartStationChangeType.CancelledArrival
        );
    }

    /**
     * Check if the current stop departure has been cancelled.
     * E.g. train first went from A to B to C, but now only goes from B to C.
     * Thus the arrival at B has been cancelled, and the whole stop A has been cancelled.
     * (Cancelled Departure at A, Cancelled Arrival at B, C is left untouched)
     * @returns {boolean} True if the stop departure has been cancelled, false otherwise.
     */
    public isCancelledDeparture(): boolean {
        if (!this.changes) return false;

        return this.changes.some(change =>
            change.changeType == LogicalJourneyPartStationChangeType.CancelledDeparture
        );
    }

    /**
     * Check if the current stop passing has been cancelled.
     * E.g. train first went from A to B to C, but now stop B has been cancelled.
     * Thus the passing at B has been cancelled.
     * (Cancelled Passing at B, A and C are left untouched)
     * @returns {boolean} True if the stop passing has been cancelled, false otherwise.
     */
    public isCancelledPassing(): boolean {
        if (!this.changes) return false;

        return this.changes.some(change =>
            change.changeType == LogicalJourneyPartStationChangeType.CancelledPassing
        );
    }

    /**
     * Check if the current stop has been cancelled.
     * @returns {boolean} True if the stop has been cancelled, false otherwise.
     */
    public isCancelled(): boolean {
        // If the train will not actually stop here, treat as skipped regardless of changes.
        // This handles international border stops (e.g. BHF for ICE) where plannedWillStop=true
        // but actualWillStop=false, causing out-of-order times that cannot be fixed.
        if (this.actualWillStop === false) return true;

        if (!this.changes) return false;

        //If the passing has been cancelled, the whole stop has been cancelled.
        //If both the arrival and departure have been cancelled, the whole stop has been cancelled.
        //If the first stop has no departure, the whole stop has been cancelled.
        //If the last stop has no arrival, the whole stop has been cancelled.
        return this.isCancelledPassing() 
        || (this.isCancelledArrival() && this.isCancelledDeparture())
        || (this.isFirstStop && this.isCancelledDeparture())
        || (this.isLastStop && this.isCancelledArrival());
    }

    /**
     * Does this stop have a reported or predicted platform change?
     */
    public hasPlatformChange(): boolean {
        if (this.isCancelled())
            return false;

        const hasReportedChange = this.changes?.some(change =>
            change.changeType == LogicalJourneyPartStationChangeType.ChangedArrivalPlatform ||
            change.changeType == LogicalJourneyPartStationChangeType.ChangedDeparturePlatform ||
            change.changeType == LogicalJourneyPartStationChangeType.FixedArrivalPlatform ||
            change.changeType == LogicalJourneyPartStationChangeType.FixedDeparturePlatform
        ) ?? false;
        const hasDifferentPlatform = this.expectedPlatformCode !== null &&
            this.expectedPlatformCode !== this.plannedPlatformCode;

        return hasReportedChange || hasDifferentPlatform;
    }

    /**
     * Is this an extra stop compared to the planned journey?
     * @returns {boolean} True if this is an extra stop, false otherwise.
     */
    public isExtraPassing(): boolean {
        if (!this.changes) return false;

        return this.changes.some(change =>
            change.changeType == LogicalJourneyPartStationChangeType.ExtraPassing ||
            change.changeType == LogicalJourneyPartStationChangeType.ExtraArrival ||
            change.changeType == LogicalJourneyPartStationChangeType.ExtraDeparture
        );
    }

    /**
     * Was this stop planned as a passing (or no stop at all), but will the vehicle actually stop at this stop?
     * @returns {boolean} True if the vehicle will stop at this newly added stop, false otherwise.
     */
    public wasntPlannedToStop(): boolean {
        return !this.plannedWillStop && this.actualWillStop;
    }
}
