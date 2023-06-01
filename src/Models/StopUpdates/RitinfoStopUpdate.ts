/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { IRitInfoStopUpdate } from '../../Interfaces/DatabaseRitInfoUpdate'
import { RitInfo } from "../../Shared/src/Types/Infoplus/RitInfo";
import JourneyStationChangeType = RitInfo.JourneyStationChangeType;
import { StopUpdate } from './StopUpdate';
export class RitInfoStopUpdate extends StopUpdate {

    private readonly changes: RitInfo.Internal.JourneyStationChange[] | null;

    private readonly plannedTrack: string | null;
    private readonly actualTrack: string | null;

    private readonly platform: string | null;
    private readonly track: string | null;

    private readonly stationCode: string;

    constructor(update: IRitInfoStopUpdate) {
        super(update);

        this.changes = update.changes;
        this.stationCode = update.stationCode;

        this.plannedTrack = update.plannedTrack;
        this.actualTrack = update.actualTrack;

        this.platform = update.platform;
        this.track = update.track;

        if(this.platform !== this.track)
            console.log(`[RitInfoStopUpdate] Platform and Track are not the same for stop ${this.stationCode}! Platform: ${this.platform}, Track: ${this.track}`)
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
            change.changeType == JourneyStationChangeType.CancelledArrival
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
            change.changeType == JourneyStationChangeType.CancelledDeparture
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
            change.changeType == JourneyStationChangeType.CancelledPassing
        );
    }

    /**
     * Check if the current stop has been cancelled.
     * @returns {boolean} True if the stop has been cancelled, false otherwise.
     */
    public isCancelled(): boolean {
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
     * Did this stop have a track change?
     * @returns {boolean} True if the stop had a track change, false otherwise.
     */
    public didTrackChange(): boolean {

        if(this.isCancelled())
            return false;

        let hasChange = false;

        if(this.changes)
            hasChange = this.changes.some(change =>
                change.changeType == JourneyStationChangeType.ArrivalTrackChange ||
                change.changeType == JourneyStationChangeType.DepartureTrackChange ||
                change.changeType == JourneyStationChangeType.FixArrivalTrack ||
                change.changeType == JourneyStationChangeType.FixDepartureTrack
            );

        if(hasChange)
            return true;


        //Check for changes with the planned arrival/departure track
        return this.plannedTrack != this.actualTrack;


    }

    /**
     * Is this an extra stop compared to the planned journey?
     * @returns {boolean} True if this is an extra stop, false otherwise.
     */
    public isExtraPassing(): boolean {
        if (!this.changes) return false;

        return this.changes.some(change =>
            change.changeType == JourneyStationChangeType.ExtraPassing ||
            change.changeType == JourneyStationChangeType.ExtraArrival ||
            change.changeType == JourneyStationChangeType.ExtraDeparture
        );
    }
}