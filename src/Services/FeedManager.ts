/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {InfoplusRepository} from "../Repositories/InfoplusRepository";
import {TrainUpdateCollection} from "../Models/TrainUpdateCollection";
import {transit_realtime} from "gtfs-realtime-bindings";
import FeedMessage = transit_realtime.FeedMessage;
import { File } from "../Models/General/File";

export class FeedManager {

    private static _infoplusRepository: InfoplusRepository = new InfoplusRepository();

    public static async updateTrainFeed(): Promise<void> {
        console.time('updateTrainFeed');
        console.log('Updating train feed...')
        //Get the current operationDate in YYYY-MM-DD format
        const currentOperationDate = new Date().toISOString().split('T')[0];

        const updates = await this._infoplusRepository.getCurrentRealtimeTripUpdates(currentOperationDate);

        const collection = TrainUpdateCollection.fromDatabaseResult(updates);

        const feed: FeedMessage = collection.toFeedMessage();

        try {
            FeedMessage.verify(feed);

            const file: File = new File('./publish/', 'trainUpdates.pb', Buffer.from(FeedMessage.encode(feed).finish()));
            file.saveSync();

            console.log('Saved updates to trainUpdates.pb');

            const jsonFile: File = new File('./publish/', 'trainUpdates.json', Buffer.from(JSON.stringify(feed)));
            jsonFile.saveSync();
            console.log('Saved updates to trainUpdates.json');

        } catch (e) {
            console.error(e);
        }

        console.timeEnd('updateTrainFeed');
    }
}