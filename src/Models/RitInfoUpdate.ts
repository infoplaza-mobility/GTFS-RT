/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {IDatabaseRitInfoUpdate, IRitInfoStopUpdate} from '../Interfaces/DatabaseRitInfoUpdate'
import {ExtendedStopTimeUpdate} from "./GTFS/StopTimeUpdate";
import {RitInfoStopUpdate} from "./StopUpdates/RitinfoStopUpdate";
import {StopUpdateCollection} from "./StopUpdateCollection";
import {InternationalAgencys, InternationalTrainSeries} from '../Utilities/InternationalAgencys';
import {IJourneyChange} from "../Shared/src/Types/Infoplus/V2/JourneyChange";
import {LogicalJourneyChangeType} from "../Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyChangeType";
import {TrainType} from "../Shared/src/Types/API/V2/InfoPlus/TrainType";

export class RitInfoUpdate {
    private readonly _agency: string;
    private readonly _changes: IJourneyChange<LogicalJourneyChangeType>[];
    private readonly _shortTrainNumber: number;
    private readonly _showsInTripPlanner: boolean;
    private readonly _stopCollection: StopUpdateCollection;
    private readonly _trainNumber: number;
    private readonly _trainType: string;
    private readonly _tripId: number | null;
    private readonly _routeId: number | null;
    private readonly _routeLongName: string | null;
    private readonly _routeType: number | null;
    private readonly _agencyId: string | null;
    private readonly _shapeId: number | null;
    private readonly _directionId: number | null;
    private readonly _timestamp: Date;

    private readonly _isInternationalTrain: boolean = false;

    constructor(update: IDatabaseRitInfoUpdate) {
        this._agency = update.agency;
        this._changes = update.changes;
        this._shortTrainNumber = update.shortTrainNumber;
        this._showsInTripPlanner = update.showsInTripPlanner;
        this._stopCollection = new StopUpdateCollection(
            update.stops !== null ? update.stops.map(stop => new RitInfoStopUpdate(stop)) : [],
            update.tripId?.toString()
        );

        this._shapeId = update.shapeId;
        this._trainNumber = update.trainNumber;
        this._trainType = update.trainType;
        this._tripId = update.tripId;
        this._routeId = update.routeId;
        this._directionId = update.directionId;
        this._timestamp = update.timestamp;

        this._routeType = update.routeType;
        this._routeLongName = this.getRouteLongName(update);
        this._agencyId = update.agencyId;

        this._isInternationalTrain = this.setInternationalTrain();
    }

    private getRouteLongName(update: IDatabaseRitInfoUpdate): string {
        if(update.routeLongName)
            return update.routeLongName;

        const firstStop = this.stops.first();
        const lastStop = this.stops.last();

        //The trainseries of e.g. 1234 is 1200, 570 is 500, 29290 is 29000
        const trainSeries = update.trainNumber - (update.trainNumber % 100);
        const trainType = update.trainType;
        const longTrainType = TrainType.shortToLong(TrainType.fromStringToShort(trainType));

        //Haarlem <-> Amsterdam Sloterdijk BST26000
        //Nachtnettrein Amsterdam Bijlmer ArenA <-> Leiden Centraal

        //Rotterdam Centraal <-> Amsterdam Centraal ICD1100
        if(firstStop?.name && lastStop?.name) {
            return `${firstStop.name} <-> ${lastStop.name} ${trainType}${trainSeries}`;
        }

        return `${longTrainType} ${trainSeries}`;

    }

    private setInternationalTrain(): boolean {
        let isInternationalTrain = false;

        if (InternationalAgencys.includes(this._agency))
            isInternationalTrain = true;

        if (this._trainNumber < 500)
            isInternationalTrain = true;

        for (const series of InternationalTrainSeries) {
            if (this._trainNumber >= series.start && this._trainNumber <= series.end)
                isInternationalTrain = true;
        }

        return isInternationalTrain;
    }

    /**
     * Is this train a long-distance international train?
     * Hits true when the train is from an international agency or when the train number is below 500.
     * Also hits true for the Utrecht Maliebaan train.
     * @see InternationalAgencys
     * @returns {boolean} True if the train is a long-distance international train, false otherwise.
     */
    public get isSpecialTrain(): boolean {
        return this._isInternationalTrain;
    }

    public get routeId(): string | null {
        if (!this._routeId)
            return null;

        return this._routeId.toString();
    }

    public get shapeId(): string | null {
        if (!this._shapeId)
            return null;

        return this._shapeId.toString();
    }

    public get agencyId(): string | null {
        return this._agencyId;
    }

    public get routeType(): number | null {
        return this._routeType;
    }

    public get routeLongName(): string | null {
        return this._routeLongName;
    }

    public get trainType(): string {
        return this._trainType;
    }

    public get directionId(): number | null {
        return this._directionId;
    }

    public get stops(): StopUpdateCollection {
        return this._stopCollection;
    }

    /**
     * Converts this RitInfoUpdate's stops to GTFS-RT StopTimeUpdates and returns them.
     * @returns {IStopTimeUpdate[]} The GTFS-RT StopTimeUpdates.
     */
    public get stopTimeUpdates(): ExtendedStopTimeUpdate[] {
        return this.stops.map(stop => ExtendedStopTimeUpdate.fromStopUpdate(stop));
    }


    /**
     * Did this trip have any platform changes?
     * @returns {boolean} True if the trip had any platform changes, false otherwise.
     */
    public get hadPlatformChange(): boolean {
        return this.stops.some(stop => (stop as RitInfoStopUpdate).didTrackChange());
    }

    /**
     * Does this trip have any changed stops?
     * @returns {boolean} True if the trip had any changed stops, false otherwise.
     */
    public get hadChangedStops(): boolean {
        return this.stops.some(stop => (stop as RitInfoStopUpdate).isExtraPassing());
    }

    /**
     * Did this trip change its route?
     * True for the following:
     * ChangeStopBehaviour = "30",
     DivertedTrain = "33",
     ShortenedDestination = "34",
     ExtendedDestination = "35",
     OriginShortening = "36",
     OriginExtension = "37",
     ChangedDestination = "41",
     ChangedOrigin = "42",
     * @returns {boolean} True if the trip changed its route, false otherwise.
     */
    public get hasChangedTrip(): boolean {
        if (!this._changes)
            return false;

        return this._changes.some(change =>
            change.changeType == LogicalJourneyChangeType.StopPatternChange ||
            change.changeType == LogicalJourneyChangeType.Diversion ||
            change.changeType == LogicalJourneyChangeType.ShortenedDestination ||
            change.changeType == LogicalJourneyChangeType.ExtendedDestination ||
            change.changeType == LogicalJourneyChangeType.ShortenedOrigin ||
            change.changeType == LogicalJourneyChangeType.ExtendedOrigin ||
            change.changeType == LogicalJourneyChangeType.ChangedDestination ||
            change.changeType == LogicalJourneyChangeType.ChangedOrigin
        );
    }

    public get changes(): IJourneyChange<LogicalJourneyChangeType>[] | null {
        return this._changes;
    }

    /**
     * Returns the trip ID of the trip.
     * @returns {string} The trip ID of the trip.
     */
    public get tripId(): string | null {
        if (!this._tripId)
            return null;
        return this._tripId.toString();
    }

    /**
     * Returns the start time of the trip in HH:mm:ss format.
     * @returns {string} The start time of the trip.
     */
    public get startTime(): string {

        const firstStop = this.stops.first();

        if (!firstStop || !firstStop.departureTimeAsDate)
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

        if (!firstStop || !firstStop.departureTimeAsDate)
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
        if (!this._changes)
            return false;

        return this._changes.some(change =>
            change.changeType == LogicalJourneyChangeType.Cancelled
        )
    }

    /**
     * Returns if the trip is an extra (added) trip by checking if a change type of 24 (extra train) is present.
     * @returns {boolean} True if the trip is an extra trip, false otherwise.
     */
    public get isAdded(): boolean {
        let isAdded = false;

        if (this._changes)
            isAdded = this._changes.some(change =>
                change.changeType == LogicalJourneyChangeType.ExtraTrain
            )

        //Could be incorrect, maybe only 300.000 and 700.000 are added.
        if (!isAdded) {
            // If the short train number does not match the train number, it is an extra train. (E.g. 301234 vs 1234, 701234 vs 1234 or 201234 vs 1234)
            isAdded = this._shortTrainNumber !== this._trainNumber || (this._trainNumber > 100_000 && this._trainNumber < 900_000);
        }

        return isAdded;
    }

    public get hasModifiedStopBehaviour(): boolean {
        let didModify = false;

        if (this._changes)
            didModify = this._changes.some(change =>
                change.changeType == LogicalJourneyChangeType.StopPatternChange
            )

        if (!didModify)
            didModify = this.stops.some(stop => stop.isExtraPassing() || stop.wasntPlannedToStop())

        return didModify;
    }

    /**
     * Gets the timestamp of the update in seconds since epoch.
     * @returns {Long} The timestamp of the update in seconds since epoch.
     */
    public get timestamp(): number {
        return Math.round(this._timestamp.getTime() / 1000);
    }


}