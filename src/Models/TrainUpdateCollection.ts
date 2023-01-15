/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {Collection} from "./General/Collection";
import {TrainUpdate} from "./TrainUpdate";
import {IDatabaseRitInfoUpdate} from "../Interfaces/DatabaseTripUpdate";
import {transit_realtime} from "gtfs-rb";
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
                update =>
                    TrainUpdate.fromRitInfoUpdate(update)
                        .toFeedEntity()
            )
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