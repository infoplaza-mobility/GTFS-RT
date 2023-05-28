/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { Collection } from "./General/Collection";
import { TripUpdate } from "./TripUpdate";
import { transit_realtime } from "gtfs-realtime-bindings";
import Long from "long";
import FeedEntity = transit_realtime.FeedEntity;
import FeedMessage = transit_realtime.FeedMessage;
import Incrementality = transit_realtime.FeedHeader.Incrementality;
import { IDatabasePasstimesUpdate } from "../Interfaces/DatabasePasstimesUpdate";

export class TripUpdateCollection extends Collection<FeedEntity> {
    constructor(items: FeedEntity[]) {
        super(items);
    }

    /**
     * Converts a collection of database trip updates to a collection of TripUpdate objects.
     * @param updates The database trip updates.
     * @returns {TripUpdateCollection} The converted TripUpdateCollection.
     */
    public static fromDatabaseResult(updates: IDatabasePasstimesUpdate[]): TripUpdateCollection {
        return new TripUpdateCollection(
            updates.map(
                update => TripUpdate.fromPasstimesUpdate(update)?.toFeedEntity()
            ).filter(update => !!update) as FeedEntity[]
        );
    }

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