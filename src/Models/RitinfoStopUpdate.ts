/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { IRitInfoStopUpdate } from '../Interfaces/DatabaseTripUpdate'
import { RitInfo } from "../Shared/src/Types/Infoplus/RitInfo";
import JourneyStationChangeType = RitInfo.JourneyStationChangeType;
import { Delay } from "./Delay";
import Long from 'long';
export class RitInfoStopUpdate {
    private readonly _departureDelay: string | null;
    private readonly _arrivalDelay: string | null;
    private readonly _arrivalTime: Date | null;
    private readonly _departureTime: Date | null;
    private readonly _sequence: number;
    private _isFirstStop: boolean = false;
    private _isLastStop: boolean = false;
    private _isLastStopBeforeOnlyCancelledStops: boolean = false;
    private readonly _stopId: number | null;
    changes: RitInfo.Internal.JourneyStationChange[] | null;
    platform: string | null;
    stationCode: string;

    constructor(update: IRitInfoStopUpdate) {
        this._departureDelay = update.departureDelay;
        this._arrivalDelay = update.arrivalDelay;
        this._arrivalTime = update.arrivalTime ? new Date(update.arrivalTime) : null;
        this._departureTime = update.departureTime ? new Date(update.departureTime) : null;
        this.changes = update.changes;
        this.platform = update.platform;
        this._sequence = update.sequence;
        this.stationCode = update.stationCode;
        this._stopId = update.stopId;
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



    public set isFirstStop(isFirstStop) {
        this._isFirstStop = isFirstStop;
    }

    public get isFirstStop(): boolean {
        return this._isFirstStop;
    }

    public set isLastStop(isLastStop) {
        this._isLastStop = isLastStop;
    }

    public set isLastStopBeforeOnlyCancelledStops(isLastStopBeforeOnlyCancelledStops) {
        this._isLastStopBeforeOnlyCancelledStops = isLastStopBeforeOnlyCancelledStops;
    }

    public get isLastStop(): boolean {
        return this._isLastStop;
    }

    /**
     * Is this stop the last stop before only cancelled stops after this stop?
     */
    public get isLastStopBeforeOnlyCancelledStops(): boolean {
        return this._isLastStopBeforeOnlyCancelledStops;
    }

    /**
     * Get the departure delay in seconds.
     * @returns {number} The departure delay in seconds.
     * @returns {number} 0 if there is no departure delay.
     */
    public get departureDelay(): number {
        if (!this._departureDelay)
            return 0;

        return new Delay(this._departureDelay).toSeconds();
    }

    /**
     * Get the arrival delay in seconds.
     * @returns {number} The arrival delay in seconds.
     * @returns {number} 0 if there is no arrival delay.
     */
    public get arrivalDelay(): number {
        if (!this._arrivalDelay)
            return 0;

        return new Delay(this._arrivalDelay).toSeconds();
    }

    /**
     * Get the departure time.
     * @returns {Long} The departure time in seconds since epoch.
     */
    public get departureTime(): Long {
        if (!this._departureTime)
            return Long.fromNumber(0);

        if (this.isFirstStop)
            return Long.fromNumber(this._departureTime.getTime() / 1000 + 1);

        return Long.fromNumber(this._departureTime.getTime() / 1000);
    }

    /**
     * Get the arrival time.
     * @returns {Long} The arrival time in seconds since epoch.
     */
    public get arrivalTime(): Long {
        if (!this._arrivalTime)
            return Long.fromNumber(0);

        return Long.fromNumber(this._arrivalTime.getTime() / 1000);
    }

    public get arrivalTimeAsDate(): Date | null {
        return this._arrivalTime;
    }

    public get departureTimeAsDate(): Date | null {
        return this._departureTime;
    }

    /**
     * Get the stop ID.
     * @returns {string} The stop ID.
     * @returns {string} Empty string if there is no stop ID.
     */
    public get stopId(): string {
        if (!this._stopId)
            return '';

        return this._stopId.toString();
    }

    /**
     * Get the sequence number.
     * @returns {number} The sequence number.
     */
    public get sequence(): number {
        return this._sequence;
    }
}