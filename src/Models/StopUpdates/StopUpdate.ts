import Long from "long";
import { Delay } from "../Delay";
import { IDatabaseStopUpdate } from "../../Interfaces/DatabaseStopUpdate";

interface IStopUpdate {
    readonly departureDelay: number | null;
    readonly arrivalDelay: number | null;
    readonly arrivalTime: number | null;
    readonly departureTime: number | null;
    readonly plannedArrivalTime: Date | null;
    readonly plannedDepartureTime: Date | null;
}

export abstract class StopUpdate implements IStopUpdate {
    private readonly _departureDelay: string | number | null;
    private readonly _arrivalDelay: string | number | null;

    
    private readonly _plannedArrivalTime: Date | null;
    private readonly _plannedDepartureTime: Date | null;
    private readonly _sequence: number;
    private readonly _stopId: number | null;

    private _isFirstStop: boolean = false;
    private _isLastStop: boolean = false;
    private _isLastStopBeforeOnlyCancelledStops: boolean = false;

    private _departureTime: Date | null;
    private _arrivalTime: Date | null;


    constructor(update: IDatabaseStopUpdate) {
        this._departureDelay = update.departureDelay;
        this._arrivalDelay = update.arrivalDelay;
        this._arrivalTime = update.arrivalTime ? new Date(update.arrivalTime) : null;
        this._departureTime = update.departureTime ? new Date(update.departureTime) : null;
        this._plannedArrivalTime = update.plannedArrivalTime ? new Date(update.plannedArrivalTime) : null;
        this._plannedDepartureTime = update.plannedDepartureTime ? new Date(update.plannedDepartureTime) : null;
        this._sequence = update.sequence;
        this._stopId = update.stopId;
    }


    public get plannedArrivalTime(): Date | null {
        return this._plannedArrivalTime;
    }

    public get plannedDepartureTime(): Date | null {
        return this._plannedDepartureTime;
    }

    /**
     * Check if the current stop has been cancelled.
     * @returns {boolean} True if the stop has been cancelled, false otherwise.
     */
    public abstract isCancelled(): boolean;


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

        if(typeof this._departureDelay === 'number')
            return this._departureDelay;

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

        if(typeof this._arrivalDelay === 'number')
            return this._arrivalDelay;

        return new Delay(this._arrivalDelay).toSeconds();
    }

    /**
     * Get the departure time.
     * @returns {Long} The departure time in seconds since epoch.
     */
    public get departureTime(): number {
        if (!this._departureTime)
            return 0;

        if (this.isFirstStop)
            return this._departureTime.getTime() / 1000 + 1;

        return this._departureTime.getTime() / 1000;
    }

    /**
     * Set the departure time.
     * @param {Long} departureTime The departure time in seconds since epoch.
     */
    public set departureTime(departureTime: number) {
        this._departureTime = new Date(departureTime * 1000);
    }

    /**
     * Get the arrival time.
     * @returns {Long} The arrival time in seconds since epoch.
     */
    public get arrivalTime(): number {
        if (!this._arrivalTime)
            return 0;

        return this._arrivalTime.getTime() / 1000;
    }

    /**
     * Set the arrival time.
     * @param {Long} arrivalTime The arrival time in seconds since epoch.
    */
    public set arrivalTime(arrivalTime: number) {
        this._arrivalTime = new Date(arrivalTime * 1000);
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