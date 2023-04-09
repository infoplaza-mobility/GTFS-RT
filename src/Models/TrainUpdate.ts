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
    trip: ITripDescriptor & { shapeId?: string };
    stopTimeUpdate: IStopTimeUpdate[];

    constructor(tripUpdate: ITripUpdate & { trip: ITripDescriptor & { shapeId?: string }}) {
        Object.assign(this, tripUpdate);
    }

    public static fromRitInfoUpdate(infoPlusTripUpdate: IDatabaseRitInfoUpdate): TrainUpdate {
        const createdTrip = new RitInfoUpdate(infoPlusTripUpdate);

        const { routeId, startTime, startDate, directionId, isCancelled, isAdded, stopTimeUpdates, timestamp, shapeId } = createdTrip;
        let { tripId } = createdTrip;

        let customTripId = false;

        if(!tripId) {
            tripId = `${infoPlusTripUpdate.trainNumber}_${infoPlusTripUpdate.trainType}_${infoPlusTripUpdate.agency}`;
            customTripId = true;
        }

        let scheduleRelationship = ScheduleRelationship.SCHEDULED;

        if (isAdded || customTripId) {
            // Add a suffix to the tripId to make it unique for the added trip.
            tripId = tripId + '_added';
            scheduleRelationship = ScheduleRelationship.ADDED;
        }

        if (isCancelled)
            scheduleRelationship = ScheduleRelationship.CANCELED;

        return new TrainUpdate({
            trip: {
                tripId,
                routeId,
                startTime,
                startDate,
                directionId,
                scheduleRelationship,
                shapeId: shapeId || undefined
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

