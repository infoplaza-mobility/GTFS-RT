/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { Collection } from "./General/Collection";
import { TrainUpdate } from "./TrainUpdate";
import { IDatabaseRitInfoUpdate } from "../Interfaces/DatabaseRitInfoUpdate";
import { transit_realtime } from "../Compiled/compiled";
import FeedEntity = transit_realtime.FeedEntity;
import FeedMessage = transit_realtime.FeedMessage;
import Incrementality = transit_realtime.FeedHeader.Incrementality;
import {TripIdWithDate} from "../Interfaces/TVVManager";

export class TrainUpdateCollection extends Collection<FeedEntity> {

    private static TrainUpdatesWithCustomTripId: TrainUpdate[] = [];

    /**
     * Converts a collection of database train updates to a collection of TrainUpdate objects.
     * @param updates The database train updates.
     * @returns {TrainUpdateCollection} The converted TrainUpdateCollection.
     */
    public static fromDatabaseResult(updates: IDatabaseRitInfoUpdate[]): TrainUpdateCollection {
        const trainUpdates = updates.map(
            update => {
                const trainUpdate = TrainUpdate.fromRitInfoUpdate(update);

                if(trainUpdate) {
                    //If the train update has a custom trip ID, add it to the TrainUpdatesWithCustomTripId array.
                    //We do this so we can check if this update is there the next iteration as well, if not, we add a new stop time update
                    //that cancels the trip.
                    if(trainUpdate.hasCustomTripId && !this.TrainUpdatesWithCustomTripId.find(u => u.trip.tripId == trainUpdate.trip.tripId)) {
                        console.log(`[TrainUpdateCollection] Adding ${trainUpdate.trip.tripId} to TrainUpdatesWithCustomTripId array.`)
                        this.TrainUpdatesWithCustomTripId.push(trainUpdate);
                    }

                    return trainUpdate;
                }
            }
        ).filter(update => !!update) as TrainUpdate[];

        const collection = new TrainUpdateCollection(
            trainUpdates.map(
                update => update.toFeedEntity()
            )
        );

        const trainUpdatesNotFound = TrainUpdateCollection.checkForRemovedUpdatesWithCustomTripId(trainUpdates)

        if(trainUpdatesNotFound.length > 0) {
            console.info(`[TrainUpdateCollection] Found ${trainUpdatesNotFound.length} updates that were not found in the current collection of size ${this.TrainUpdatesWithCustomTripId.length}. Adding them as cancelled trips.`);
            console.info(`[TrainUpdateCollection] ${trainUpdatesNotFound.map(update => update.trip.tripId).join(', ')}`)

            collection.addDeletedUpdates(trainUpdatesNotFound);
        }

        return collection;
    }

    /**
     * Adds the updates to the collection and marks them as deleted.
     * Removes the updates that were marked for deletion from the TrainUpdatesWithCustomTripId array.
     * @param trainUpdates The updates to add.
     * @private
     */
    private addDeletedUpdates(trainUpdates: TrainUpdate[]) {
        for(const deletedUpdate of trainUpdates) {
            deletedUpdate.markAsDeleted();
        }

        this.push(...trainUpdates.map(trainUpdate => trainUpdate.toFeedEntity()));
        console.info(`[TrainUpdateCollection | AddDeletedUpdates] Pushed ${trainUpdates.length} deleted updates to collection and marked them for removal.`);

        const lengthBefore = TrainUpdateCollection.TrainUpdatesWithCustomTripId.length;

        //Remove the updates from the TrainUpdatesWithCustomTripId array
        TrainUpdateCollection.TrainUpdatesWithCustomTripId = TrainUpdateCollection.TrainUpdatesWithCustomTripId.filter(update => !trainUpdates.find(u => u.trip.tripId == update.trip.tripId));

        const lengthAfter = TrainUpdateCollection.TrainUpdatesWithCustomTripId.length;
        console.info(`[TrainUpdateCollection | AddDeletedUpdates] Removed ${lengthBefore - lengthAfter} updates from the TrainUpdatesWithCustomTripId array.`);
    }

    public applyRemovals(tripIdsToRemove: TripIdWithDate[]) {
        console.log(`[TrainUpdateCollection | applyRemovals] Applying ${tripIdsToRemove.length} removals.`)
        for(const tripId of tripIdsToRemove) {
            const update = TrainUpdate.fromTripId(tripId);

            this.push(update.toFeedEntity());
        }
    }

    /**
     * Checks if there are any updates with a custom trip ID that have been removed.
     * (So if there is an update with a custom trip ID in the TrainUpdatesWithCustomTripId array, but not in the current collection)
     * @return {TrainUpdate[]} The removed updates.
     */
    private static checkForRemovedUpdatesWithCustomTripId(collectionToCheckAgainst: TrainUpdate[]): TrainUpdate[] {
        const removedUpdates: TrainUpdate[] = [];

        console.log(`[TrainUpdateCollection | checkForRemovedUpdatesWithCustomTripId] Checking for removed updates. Current size of TrainUpdatesWithCustomTripId: ${this.TrainUpdatesWithCustomTripId.length}`)

        this.TrainUpdatesWithCustomTripId.forEach(update => {
            if(!collectionToCheckAgainst.find(u => u.trip.tripId == update.trip.tripId))
                removedUpdates.push(update);
        })
        return removedUpdates;
    }

    /**
     * Converts the TrainUpdateCollection to a FeedMessage.
     * @returns {FeedMessage} The converted FeedMessage.
     */
    public toFeedMessage(): FeedMessage {
        return FeedMessage.create({
            header: {
                gtfsRealtimeVersion: "2.0",
                timestamp: Math.round(Date.now() / 1000),
                incrementality: Incrementality.FULL_DATASET
            },
            entity: this.toArray()
        })
    }
}