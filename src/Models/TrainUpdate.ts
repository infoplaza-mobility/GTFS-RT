/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { transit_realtime } from 'gtfs-rb';
import ITripUpdate = transit_realtime.ITripUpdate;
import ITripDescriptor = transit_realtime.ITripDescriptor;
import IStopTimeUpdate = transit_realtime.TripUpdate.IStopTimeUpdate;
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseTripUpdate";
import {RitInfoUpdate} from "./RitInfoUpdate";
import ScheduleRelationship = transit_realtime.TripDescriptor.ScheduleRelationship;
import FeedEntity = transit_realtime.FeedEntity;

export class TrainUpdate implements ITripUpdate {
    trip: ITripDescriptor;
    stopTimeUpdate: IStopTimeUpdate[];

    constructor(tripUpdate: ITripUpdate) {
        Object.assign(this, tripUpdate);
    }

    public static fromRitInfoUpdate(infoPlusTripUpdate: IDatabaseRitInfoUpdate): TrainUpdate {
        const createdTrip = new RitInfoUpdate(infoPlusTripUpdate);

        const { tripId, routeId, startTime, startDate, directionId, isCancelled, isAdded, stopTimeUpdates, timestamp } = createdTrip;

        let scheduleRelationship = ScheduleRelationship.SCHEDULED;
        if (isCancelled)
            scheduleRelationship = ScheduleRelationship.CANCELED;
        if (isAdded)
            scheduleRelationship = ScheduleRelationship.ADDED;

        return new TrainUpdate({
            trip: {
                tripId,
                routeId,
                startTime,
                startDate,
                directionId,
                scheduleRelationship
            },
            stopTimeUpdate: !isCancelled ? stopTimeUpdates : undefined,
            timestamp: timestamp
        })
    }

    /**
     * Converts the TrainUpdate to a FeedEntity.
     * @returns {FeedEntity} The converted FeedEntity.
     */
    public toFeedEntity(): FeedEntity {
        return new FeedEntity({
            tripUpdate: this,
            id: this.trip.tripId || Date.now().toString()
        })
    }
}

