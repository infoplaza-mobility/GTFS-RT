export interface IDatabaseStopUpdate {
    stopId: number | null;
    sequence: number;
    /** Arrival time in seconds since Epoch, or ISO string */
    arrivalTime: number | string | null;
    /** Arrival delay in seconds,  or HH:MM:SS */
    arrivalDelay: number | string | null;
    /** Departure time in seconds since Epoch, or ISO string */
    departureTime: number | string | null;
    /** Departure delay in seconds, or HH:MM:SS */
    departureDelay: number | string | null;
    /** Planned arrival time in seconds since Epoch, or ISO string */
    plannedArrivalTime: number | string | null;
    /** Planned departure time in seconds since Epoch, or ISO string */
    plannedDepartureTime: number | string | null;
    /** Was this vehicle planned to stop at this stop? */
    plannedWillStop: boolean;
    /** Is this vehicle actually stopping at this stop? */
    actualWillStop: boolean;
}