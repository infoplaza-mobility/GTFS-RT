import { Delay } from "../Delay";
import { IDatabaseStopUpdate } from "../../Interfaces/DatabaseStopUpdate";

interface IStopUpdate {
    readonly departureDelay: number | null;
    readonly arrivalDelay: number | null;
    readonly arrivalTime: number | null;
    readonly departureTime: number | null;
    readonly plannedArrivalTime: Date | null;
    readonly plannedDepartureTime: Date | null;
    readonly destination: string | null;
}

export abstract class StopUpdate implements IStopUpdate {

    /* Can be updated in case of fixing stop times */
    private _departureDelay: string | number | null;

    /* Can be updated in case of fixing stop times */
    private _arrivalDelay: string | number | null;

    
    private readonly _plannedArrivalTime: Date | null;
    private readonly _plannedDepartureTime: Date | null;

    private readonly _stopId: number | null;

    private _isFirstStop: boolean = false;
    private _isLastStop: boolean = false;
    private _isLastStopBeforeOnlyCancelledStops: boolean = false;

    private _departureTime: Date | null;
    private _arrivalTime: Date | null;

    private _sequence: number;

    private readonly _destination: string | null = null;

    protected constructor(update: IDatabaseStopUpdate) {
        this._departureDelay = update.departureDelay;
        this._arrivalDelay = update.arrivalDelay;
        this._arrivalTime = StopUpdate.parseTime(update.arrivalTime);
        this._departureTime = StopUpdate.parseTime(update.departureTime);
        this._plannedArrivalTime = StopUpdate.parseTime(update.plannedArrivalTime);
        this._plannedDepartureTime = StopUpdate.parseTime(update.plannedDepartureTime);
        this._sequence = update.sequence;
        this._stopId = update.stopId;
        this._destination = update.destination;
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

    public get destination(): string | null {
        return this._destination;
    }

    /**
     * Is this stop the last stop before only cancelled stops after this stop?
     */
    public get isLastStopBeforeOnlyCancelledStops(): boolean {
        return this._isLastStopBeforeOnlyCancelledStops;
    }

    /** Actual timestamps take precedence; reported delays are only missing-time fallbacks. */
    public get departureDelay(): number {
        if (this._plannedDepartureTime && this.departureTime > 0)
            return this.departureTime - this._plannedDepartureTime.getTime() / 1000;
        return Delay.parseSeconds(this._departureDelay) ?? 0;
    }

    public set departureDelay(departureDelay: number) {
        this._departureDelay = departureDelay;
    }

    public get arrivalDelay(): number {
        if (this._plannedArrivalTime && this.arrivalTime > 0)
            return this.arrivalTime - this._plannedArrivalTime.getTime() / 1000;
        return Delay.parseSeconds(this._arrivalDelay) ?? 0;
    }

    public set arrivalDelay(arrivalDelay: number) {
        this._arrivalDelay = arrivalDelay;
    }

    /** Getters only resolve missing times. Chronological repairs belong to StopUpdateCollection. */
    public get departureTime(): number {
        return this._departureTime?.getTime() / 1000 ||
            this.plannedTimeWithDelay(this._plannedDepartureTime, this._departureDelay) ||
            this._arrivalTime?.getTime() / 1000 ||
            this.plannedTimeWithDelay(this._plannedArrivalTime, this._arrivalDelay);
    }

    public set departureTime(departureTime: number) {
        this._departureTime = StopUpdate.parseTime(departureTime);
    }

    public get arrivalTime(): number {
        return this._arrivalTime?.getTime() / 1000 ||
            this.plannedTimeWithDelay(this._plannedArrivalTime, this._arrivalDelay) ||
            this._departureTime?.getTime() / 1000 ||
            this.plannedTimeWithDelay(this._plannedDepartureTime, this._departureDelay);
    }

    public set arrivalTime(arrivalTime: number) {
        this._arrivalTime = StopUpdate.parseTime(arrivalTime);
    }

    public get arrivalTimeAsDate(): Date | null {
        return this.arrivalTime > 0 ? new Date(this.arrivalTime * 1000) : null;
    }

    public get departureTimeAsDate(): Date | null {
        return this.departureTime > 0 ? new Date(this.departureTime * 1000) : null;
    }

    private plannedTimeWithDelay(planned: Date | null, delay: string | number | null): number {
        return planned ? planned.getTime() / 1000 + (Delay.parseSeconds(delay) ?? 0) : 0;
    }

    private static parseTime(value: number | string | null): Date | null {
        if (value == null) return null;
        const milliseconds = typeof value === "number" ? value * 1000 : Date.parse(value);
        // GTFS-RT event times are integer epoch seconds; keep delay calculations in the same units.
        return Number.isFinite(milliseconds) && milliseconds > 0
            ? new Date(Math.floor(milliseconds / 1000) * 1000) : null;
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

    /**
     * ONLY USE IN CASE OF RE-SORTING STOP UPDATES!
     * @param sequence The new sequence number.
     */
    public set sequence(sequence: number) {
        this._sequence = sequence;
    }
}
