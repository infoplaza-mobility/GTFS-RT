/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {RitInfo} from "../Shared/src/Types/Infoplus/RitInfo";
import {transit_realtime} from "gtfs-realtime-bindings";
import {StopTimeUpdate} from "./GTFS/StopTimeUpdate";
import IStopTimeUpdate = transit_realtime.TripUpdate.IStopTimeUpdate;
import Long from "long";
import {StopUpdateCollection} from "./StopUpdateCollection";
import { IDatabasePasstimesUpdate } from '../Interfaces/DatabasePasstimesUpdate';
import { PasstimesStopUpdate } from './StopUpdates/PasstimesStopUpdate';

export class PasstimesUpdate {
    private readonly _stopCollection: StopUpdateCollection;
    private readonly _tripId: number | null;
    private readonly _routeId: number | null;

    constructor(update: IDatabasePasstimesUpdate) {
        this._stopCollection = new StopUpdateCollection(update.stops.map(stop => new PasstimesStopUpdate(stop)), update.tripId?.toString());
        this._tripId = update.tripId;
        this._routeId = update.routeId;

    }

    public get routeId(): string | null {
        if(!this._routeId)
            return null;

        return this._routeId.toString();
    }


    public get stops(): StopUpdateCollection {
        return this._stopCollection;
    }

    /**
     * Converts this RitInfoUpdate's stops to GTFS-RT StopTimeUpdates and returns them.
     * @returns {IStopTimeUpdate[]} The GTFS-RT StopTimeUpdates.
     */
    public get stopTimeUpdates(): IStopTimeUpdate[] {
        return this.stops.map(stop => StopTimeUpdate.fromStopUpdate(stop));
    }

    

    /**
     * Returns the trip ID of the trip.
     * @returns {string} The trip ID of the trip.
     */
    public get tripId(): string | null {
        if(!this._tripId)
            return null;
        return this._tripId.toString();
    }

    /**
     * Returns the start time of the trip in HH:mm:ss format.
     * @returns {string} The start time of the trip.
     */
    public get startTime(): string {

        const firstStop = this.stops.first();

        if(!firstStop || !firstStop.departureTimeAsDate)
            return '00:00:00';

        return firstStop
            .departureTimeAsDate
            .toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    }

    /**
     * Returns the start date of the trip in YYYYMMDD format.
     * @returns {string} The start date of the trip.
     */
    public get startDate(): string {
        const firstStop = this.stops.first();

        if(!firstStop || !firstStop.departureTimeAsDate)
            return '00000000';

        return firstStop
            .departureTimeAsDate
            .toISOString()
            .slice(0, 10)
            .replaceAll('-', '');
    }

    /**
     * Returns if the trip is cancelled by checking if every stop is cancelled.
     * @returns {boolean} True if the trip is cancelled, false otherwise.
     */
    public get isCancelled(): boolean {
        return this.stops.every(stop => stop.isCancelled());
    }

    /**
     * Returns if the trip is an extra (added) trip by checking if the trip ID is null.
     * @returns {boolean} True if the trip is an extra trip, false otherwise.
     */
    public get isAdded(): boolean {
       return this._tripId == null;
    }

    /**
     * Gets the timestamp of the update in seconds since epoch.
     * @returns {Long} The timestamp of the update in seconds since epoch.
     */
    public get timestamp(): Long {
        return new Long(Date.now() / 1000);
    }


}