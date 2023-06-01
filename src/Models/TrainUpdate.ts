/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { transit_realtime } from 'gtfs-realtime-bindings';
import ITripUpdate = transit_realtime.ITripUpdate;
import ITripDescriptor = transit_realtime.ITripDescriptor;
import IStopTimeUpdate = transit_realtime.TripUpdate.IStopTimeUpdate;
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseRitInfoUpdate";
import {RitInfoUpdate} from "./RitInfoUpdate";
import ScheduleRelationship = transit_realtime.TripDescriptor.ScheduleRelationship;
import FeedEntity = transit_realtime.FeedEntity;

export class TrainUpdate implements ITripUpdate {
    trip: ITripDescriptor & { shapeId?: string };
    stopTimeUpdate: IStopTimeUpdate[];

    constructor(tripUpdate: ITripUpdate & { trip: ITripDescriptor & { shapeId?: string }}) {
        Object.assign(this, tripUpdate);
    }

    public static fromRitInfoUpdate(infoPlusTripUpdate: IDatabaseRitInfoUpdate): TrainUpdate | null {
        const createdTrip = new RitInfoUpdate(infoPlusTripUpdate);

        const { routeId, startTime, startDate, directionId, isCancelled, isAdded, timestamp, shapeId, hadChangedStops, hadPlatformChange, hasChangedTrip, isSpecialTrain } = createdTrip;
        let { tripId, stopTimeUpdates } = createdTrip;

        let customTripId = false;

        if(!tripId) {
            tripId = `${infoPlusTripUpdate.trainNumber}_${infoPlusTripUpdate.trainType}_${infoPlusTripUpdate.agency}`;
            customTripId = true;
        }

        let scheduleRelationship = ScheduleRelationship.SCHEDULED;

        let shouldRemoveSkippedStops = false;

        if(hasChangedTrip || hadPlatformChange || hadChangedStops) {

            if(hasChangedTrip)
                console.log(`[TrainUpdate] Trip ${tripId} had a changed trip. Change types: ` + createdTrip.changes!.map(change => change.changeType).join(', '));

            scheduleRelationship = ScheduleRelationship.REPLACEMENT;
            /**
             * Remove all skipped stops, as OTP expects no skipped stops.
             * @deprecated OTP Does allow skipped stops, but they *need* an arrival and departure event.
             */
            shouldRemoveSkippedStops = false;
        }

        // If this is a special train, we want to mark it as a replacement, as the sequence numbers do not match with the static GTFS.
        if(isSpecialTrain) {
            scheduleRelationship = ScheduleRelationship.REPLACEMENT;

            //For these special trains there can be duplicate stops, so we need to remove them. Only keep one stop with the same stopId.
            stopTimeUpdates = stopTimeUpdates.filter((stopTimeUpdate, index, self) =>
                index === self.findIndex((t) => (
                    t.stopId === stopTimeUpdate.stopId
                ))
            )
        }


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

