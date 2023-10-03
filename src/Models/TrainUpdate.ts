/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {transit_realtime} from '../Compiled/gtfs-realtime';
import TripDescriptor = transit_realtime.TripDescriptor;
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseRitInfoUpdate";
import {RitInfoUpdate} from "./RitInfoUpdate";
import ScheduleRelationship = transit_realtime.TripDescriptor.ScheduleRelationship;
import FeedEntity = transit_realtime.FeedEntity;
import {TripIdWithDate} from "../Interfaces/TVVManager";

import TripUpdate = transit_realtime.TripUpdate;

export class TrainUpdate extends TripUpdate {
    constructor(tripUpdate: TripUpdate,  private readonly shape_id: string | undefined, public readonly hasCustomTripId: boolean = false) {
        super(tripUpdate);
    }

    public static fromRitInfoUpdate(infoPlusTripUpdate: IDatabaseRitInfoUpdate): TrainUpdate | null {
        const createdTrip = new RitInfoUpdate(infoPlusTripUpdate);

        const {
            routeId,
            startTime,
            startDate,
            directionId,
            isCancelled,
            isAdded,
            timestamp,
            shapeId,
            hadChangedStops,
            hadPlatformChange,
            hasChangedTrip,
            isSpecialTrain
        } = createdTrip;
        let {tripId, stopTimeUpdates} = createdTrip;

        let customTripId = false;

        if (!tripId) {
            tripId = `${infoPlusTripUpdate.trainNumber}_${infoPlusTripUpdate.trainType}_${infoPlusTripUpdate.agency}`;
            customTripId = true;
        }

        let scheduleRelationship = ScheduleRelationship.SCHEDULED;

        let shouldRemoveSkippedStops = false;

        if (hasChangedTrip || hadPlatformChange || hadChangedStops) {

            // if(hasChangedTrip)
            //     console.log(`[TrainUpdate] Trip ${tripId} had a changed trip. Change types: ` + createdTrip.changes!.map(change => change.changeType).join(', '));

            scheduleRelationship = ScheduleRelationship.REPLACEMENT;
            /**
             * Remove all skipped stops, as OTP expects no skipped stops.
             * @deprecated OTP Does allow skipped stops, but they *need* an arrival and departure event.
             */
            shouldRemoveSkippedStops = false;
        }

        // If this is a special train, we want to mark it as a replacement, as the sequence numbers do not match with the static GTFS.
        if (isSpecialTrain) {
            scheduleRelationship = ScheduleRelationship.REPLACEMENT;

            //For these special trains there can be duplicate stops, so we need to remove them. Only keep one stop with the same stopId.
            stopTimeUpdates = stopTimeUpdates.filter((stopTimeUpdate, index, self) =>
                    index === self.findIndex((t) => (
                        t.stop_id === stopTimeUpdate.stop_id
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
            stopTimeUpdates = stopTimeUpdates.filter(stopTimeUpdate => stopTimeUpdate.schedule_relationship !== transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED);

        const tripDescriptor: TripDescriptor = TripDescriptor.fromObject({
            trip_id: tripId,
            route_id: routeId,
            start_time: startTime,
            start_date: startDate,
            direction_id: directionId,
            schedule_relationship: scheduleRelationship,
        });


        const tripUpdate = TripUpdate.fromObject({
            trip: tripDescriptor,
            stop_time_update: !isCancelled ? stopTimeUpdates : [],
            timestamp: timestamp
        })

        return new TrainUpdate(tripUpdate, shapeId, customTripId)
    }

    /**
     * Will create a TrainUpdate with a DELETE schedule relationship for the given tripId.
     * @param tripId The tripId to create the TrainUpdate for.
     */
    public static fromTripId(tripId: TripIdWithDate): TrainUpdate {
        return new TrainUpdate(
            TripUpdate.fromObject({
                trip: TripDescriptor.fromObject({
                    trip_id: tripId.tripId.toString(),
                    schedule_relationship: ScheduleRelationship.CANCELED,
                    start_date: tripId.operationDate.replaceAll('-', '')
                }),
                stop_time_update: []
            }), undefined)
    }

    /**
     * Marks this TrainUpdate as deleted, by setting the schedule relationship to DELETED (or CANCELED).
     *
     * @modifies this.trip.scheduleRelationShip
     */
    public markAsDeleted() {
        this.trip.schedule_relationship = ScheduleRelationship.DELETED;
        this.stop_time_update = [];
    }

    /**
     * Converts the TrainUpdate to a FeedEntity.
     * @returns {FeedEntity} The converted FeedEntity.
     */
    public toFeedEntity(): FeedEntity {
        return FeedEntity.fromObject(
            {
                id: this.trip.trip_id + '_' + this.trip.start_date,
                trip_update: this,
                shape: {
                    shape_id: this.shape_id,
                    encoded_polyline: undefined
                }
            }
        )
    }
}

