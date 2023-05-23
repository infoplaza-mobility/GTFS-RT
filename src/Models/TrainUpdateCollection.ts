/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { Collection } from "./General/Collection";
import { TrainUpdate } from "./TrainUpdate";
import { IDatabaseRitInfoUpdate } from "../Interfaces/DatabaseTripUpdate";
import { transit_realtime } from "gtfs-rb";
import Long from "long";
import FeedEntity = transit_realtime.FeedEntity;
import FeedMessage = transit_realtime.FeedMessage;
import Incrementality = transit_realtime.FeedHeader.Incrementality;

export class TrainUpdateCollection extends Collection<FeedEntity> {
    constructor(items: FeedEntity[]) {
        super(items);
    }

    /**
     * Converts a collection of database train updates to a collection of TrainUpdate objects.
     * @param updates The database train updates.
     * @returns {TrainUpdateCollection} The converted TrainUpdateCollection.
     */
    public static fromDatabaseResult(updates: IDatabaseRitInfoUpdate[]): TrainUpdateCollection {
        return new TrainUpdateCollection(
            updates.map(
                update => TrainUpdate.fromRitInfoUpdate(update)?.toFeedEntity()
            ).filter(update => !!update) as FeedEntity[]
        );
    }

    /**
     * Checks for duplicate trip id's. Sets the wasAdded field of the TripUpdate to true if the short train number is different from the original.
     * @returns {TrainUpdateCollection} The collection with the duplicates fixed.
     */
    // private static fixDuplicates(updates: IDatabaseRitInfoUpdate[]): IDatabaseRitInfoUpdate[] {
    //     const result: IDatabaseRitInfoUpdate[] = [];
    
    //     for (const update of updates) {
    
    //         //If the trip doesn't have a trip id, we can't check for duplicates, so we just add the update to the result.
    //         if (!update.tripId) {
    //             result.push(update);
    //             continue;
    //         }
    
    //         //The trip id is not in the list yet, so we can add it.
    //         if (!result.some(u => u.tripId === update.tripId)) {
    //             result.push(update);
    //             continue;
    //         }
    
    //         //The trip id is already in the list, so we need to check if the short train number is different.
    //         const existingUpdate = result.find(u => u.tripId === update.tripId);
    
    //         //If the short train number is different, we set the wasAdded field to true.
    //         if (!existingUpdate)
    //             continue;
    
    
    //         if (existingUpdate.shortTrainNumber !== existingUpdate.trainNumber)
    //             existingUpdate.wasAdded = true;
    //         else
    //             existingUpdate.wasAdded = false;
    
    
    //         if (update.shortTrainNumber !== update.trainNumber)
    //             update.wasAdded = true;
    //         else
    //             update.wasAdded = false;
    
    
    //         //We add the update to the result.
    //         result.push(update);
    
    //     }
    
    //     return result;
    // }

    /**
     * Converts the TrainUpdateCollection to a FeedMessage.
     * @returns {FeedMessage} The converted FeedMessage.
     */
    public toFeedMessage(): FeedMessage {
        return new FeedMessage({
            header: {
                gtfsRealtimeVersion: "2.0",
                timestamp: Long.fromNumber(Date.now() / 1000),
                incrementality: Incrementality.FULL_DATASET
            },
            entity: this.toArray()
        })
    }
}