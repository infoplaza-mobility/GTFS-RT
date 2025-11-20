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
        this._arrivalTime = update.arrivalTime ? new Date(update.arrivalTime) : null;
        this._departureTime = update.departureTime ? new Date(update.departureTime) : null;
        this._plannedArrivalTime = update.plannedArrivalTime ? new Date(update.plannedArrivalTime) : null;
        this._plannedDepartureTime = update.plannedDepartureTime ? new Date(update.plannedDepartureTime) : null;
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

    public set departureDelay(departureDelay: number) {
        this._departureDelay = departureDelay;
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

    public set arrivalDelay(arrivalDelay: number) {
        this._arrivalDelay = arrivalDelay;
    }

    /**
     * Get the departure time.
     * @returns {Long} The departure time in seconds since epoch.
     */
    public get departureTime(): number {
        if(this._departureTime && this._arrivalTime) {
            // Check if we have a valid dwell time; else we fix it.
            // Compare time values directly to avoid precision issues with Date object comparison
            const departureTimeValue = this._departureTime.getTime();
            const arrivalTimeValue = this._arrivalTime.getTime();
            if(departureTimeValue >= arrivalTimeValue) {
                return departureTimeValue / 1000;
            }

            //We do not have a valid dwell time, fix it by getting the planned dwell time (which should be valid) and adding that to the arrival time.
            if(this._plannedArrivalTime && this._plannedDepartureTime) {
                const plannedDwellTime = (this._plannedDepartureTime.getTime() - this._plannedArrivalTime.getTime()) / 1000;
                return (arrivalTimeValue / 1000) + plannedDwellTime;
            }

            //If we do not have planned times, just add 1 second to the arrival time.
            return (arrivalTimeValue / 1000) + 1;
        }

        if(this._departureTime)
            return this._departureTime.getTime() / 1000;

        if(!this._departureTime && !this._arrivalTime) {
            if(this._plannedDepartureTime)
                return this._plannedDepartureTime.getTime() / 1000;

            if(this._plannedArrivalTime)
                return this._plannedArrivalTime.getTime() / 1000;

            return 0;
        }

        if(this._arrivalTime) {
            return this._arrivalTime.getTime() / 1000;
        }
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
        if(this._arrivalTime)
            return this._arrivalTime.getTime() / 1000;

        //If we do not have a realtime arrival time, but we do have scheduled arrival time, use that + the arrival delay.
        if(this._plannedArrivalTime)
        {
            let plannedArrivalTimeSeconds = this._plannedArrivalTime.getTime() / 1000;
            plannedArrivalTimeSeconds += this.departureDelay;
            return plannedArrivalTimeSeconds;
        }

        if (!this._arrivalTime && !this._departureTime)
            return 0;

        //If we do not have an arrival time, but we do have a departure time, use the departure time.
        if(!this._arrivalTime)
            return this._departureTime.getTime() / 1000;

        if (this.isLastStop)
            return this._arrivalTime.getTime() / 1000 - 1;

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
        return new Date(this.arrivalTime * 1000);
    }

    public get departureTimeAsDate(): Date | null {
        return new Date(this.departureTime * 1000);
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
