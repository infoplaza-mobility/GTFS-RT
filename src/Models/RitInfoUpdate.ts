/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {IDatabaseRitInfoUpdate} from '../Interfaces/DatabaseTripUpdate'
import {RitInfo} from "../Shared/src/Types/Infoplus/RitInfo";
import {transit_realtime} from "gtfs-rb";
import {StopTimeUpdate} from "./GTFS/StopTimeUpdate";
import {Collection} from "./General/Collection";
import IStopTimeUpdate = transit_realtime.TripUpdate.IStopTimeUpdate;
import JourneyChangeType = RitInfo.JourneyChangeType;
import Long from "long";
import {RitInfoStopUpdate} from "./RitinfoStopUpdate";
import {StopUpdateCollection} from "./StopUpdateCollection";

export class RitInfoUpdate {
    private readonly _agency: string;
    private readonly _changes: RitInfo.Internal.JourneyChange[] | null;
    private readonly _shortTrainNumber: number;
    private readonly _showsInTripPlanner: boolean;
    private readonly _stopCollection: StopUpdateCollection;
    private readonly _trainNumber: number;
    private readonly _trainType: string;
    private readonly _tripId: number | null;
    private readonly _routeId: number | null;
    private readonly _directionId: number | null;
    private readonly _timestamp: Date;

    constructor(update: IDatabaseRitInfoUpdate) {
        this._agency = update.agency;
        this._changes = update.changes;
        this._shortTrainNumber = update.shortTrainNumber;
        this._showsInTripPlanner = update.showsInTripPlanner;
        this._stopCollection = new StopUpdateCollection(update.stops.map(stop => new RitInfoStopUpdate(stop)));
        this._trainNumber = update.trainNumber;
        this._trainType = update.trainType;
        this._tripId = update.tripId;
        this._routeId = update.routeId;
        this._directionId = update.directionId;
        this._timestamp = update.timestamp;
    }

    public get routeId(): string | null {
        if(!this._routeId)
            return null;

        return this._routeId.toString();
    }

    public get directionId(): number | null {
        return this._directionId;
    }

    public get stops(): Collection<RitInfoStopUpdate> {
        return this._stopCollection;
    }

    /**
     * Converts this RitInfoUpdate's stops to GTFS-RT StopTimeUpdates and returns them.
     * @returns {IStopTimeUpdate[]} The GTFS-RT StopTimeUpdates.
     */
    public get stopTimeUpdates(): IStopTimeUpdate[] {
        return this.stops.map(stop => StopTimeUpdate.fromRitInfoStopUpdate(stop));
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
     * Returns if the trip is cancelled by checking if a change type of 25 (cancelled) is present.
     * @returns {boolean} True if the trip is cancelled, false otherwise.
     */
    public get isCancelled(): boolean {
        if(!this._changes)
            return false;

        return this._changes.some(change =>
            change.changeType == JourneyChangeType.CancelledTrain
        )
    }

    /**
     * Returns if the trip is an extra (added) trip by checking if a change type of 24 (extra train) is present.
     * @returns {boolean} True if the trip is an extra trip, false otherwise.
     */
    public get isAdded(): boolean {
        if (this._changes)
            return this._changes.some(change =>
                change.changeType == JourneyChangeType.ExtraTrain
            )

        // If the short train number does not match the train number, it is an extra train. (E.g. 301234 vs 1234, 701234 vs 1234 or 201234 vs 1234)
        return this._shortTrainNumber !== this._trainNumber || this._trainNumber > 200_000;
    }

    /**
     * Gets the timestamp of the update in seconds since epoch.
     * @returns {Long} The timestamp of the update in seconds since epoch.
     */
    public get timestamp(): Long {
        return Long.fromNumber(this._timestamp.getTime() / 1000);
    }


}