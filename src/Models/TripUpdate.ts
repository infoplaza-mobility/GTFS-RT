/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { transit_realtime } from 'gtfs-realtime-bindings';
import ITripUpdate = transit_realtime.ITripUpdate;
import ITripDescriptor = transit_realtime.ITripDescriptor;
import IStopTimeUpdate = transit_realtime.TripUpdate.IStopTimeUpdate;
import {IDatabasePasstimesUpdate} from "../Interfaces/DatabasePasstimesUpdate";
import ScheduleRelationship = transit_realtime.TripDescriptor.ScheduleRelationship;
import FeedEntity = transit_realtime.FeedEntity;
import { PasstimesUpdate } from './PasstimesUpdate';

export class TripUpdate implements ITripUpdate {
    trip: ITripDescriptor & { shapeId?: string };
    stopTimeUpdate: IStopTimeUpdate[];

    constructor(tripUpdate: ITripUpdate & { trip: ITripDescriptor & { shapeId?: string }}) {
        Object.assign(this, tripUpdate);
    }

    public static fromPasstimesUpdate(tripUpdate: IDatabasePasstimesUpdate): TripUpdate | null {
        const createdTrip = new PasstimesUpdate(tripUpdate);

        const { routeId, startTime, startDate, isCancelled, isAdded, timestamp } = createdTrip;
        let { tripId, stopTimeUpdates } = createdTrip;

        let customTripId = false;

        if(!tripId) {
            tripId = `${tripUpdate.startDate}_${tripUpdate.startTime}_TODO:FIX`;
            customTripId = true;
        }

        let scheduleRelationship = ScheduleRelationship.SCHEDULED;

        let shouldRemoveSkippedStops = false;

        if (isAdded || customTripId) {
            // Add a suffix to the tripId to make it unique for the added trip.
            tripId = tripId + '_added';
            scheduleRelationship = ScheduleRelationship.ADDED;

            /**
             * Remove all skipped stops, as OTP expects no skipped stops.
             * @deprecated OTP Does allow skipped stops, but they *need* an arrival and departure event.
             */
            shouldRemoveSkippedStops = false;
        }

        if (isCancelled)
            scheduleRelationship = ScheduleRelationship.CANCELED;

        // If this is a added and cancelled trip, we don't want to send it.
        if (isCancelled && isAdded)
            return null;

        if (shouldRemoveSkippedStops)
            stopTimeUpdates = stopTimeUpdates.filter(stopTimeUpdate => stopTimeUpdate.scheduleRelationship !== transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED);


        return new TripUpdate({
            trip: {
                tripId,
                routeId,
                startTime,
                startDate,
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

