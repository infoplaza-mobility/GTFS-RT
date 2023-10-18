/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {InfoplusRepository} from "../Repositories/InfoplusRepository";
import {TrainUpdateCollection} from "../Models/TrainUpdateCollection";

import { File } from "../Models/General/File";
import { PassTimesRepository } from "../Repositories/PasstimesRepository";

import {TripIdWithDate} from "../Interfaces/TVVManager";

import {transit_realtime} from "../Compiled/compiled";
import FeedMessage = transit_realtime.FeedMessage;

export class FeedManager {

    private static _infoplusRepository: InfoplusRepository = new InfoplusRepository();
    private static _passtimesRepository: PassTimesRepository = new PassTimesRepository();

    public static async updateTrainFeed(tripIdsToRemove: TripIdWithDate[]): Promise<void> {
        console.time('updateTrainFeed');
        console.log('Updating train feed...')
        //Get the current operationDate in YYYY-MM-DD format
        const currentOperationDate = new Date().toISOString().split('T')[0];

        const trainUpdates = await this._infoplusRepository.getCurrentRealtimeTripUpdates(currentOperationDate);

        const trainUpdateCollection = TrainUpdateCollection.fromDatabaseResult(trainUpdates);

        trainUpdateCollection.applyRemovals(tripIdsToRemove);

        const trainUpdateFeed: FeedMessage = trainUpdateCollection.toFeedMessage();

        try {
            const constructedFeedMessage: FeedMessage = FeedMessage.fromObject(trainUpdateFeed);

            const file: File = new File('./publish/', 'trainUpdates.pb', Buffer.from(FeedMessage.encode(constructedFeedMessage).finish()));
            file.saveSync();

            console.log('Saved updates to trainUpdates.pb');

            const jsonFile: File = new File('./publish/', 'trainUpdates.json', Buffer.from(JSON.stringify(constructedFeedMessage.toJSON())));
            jsonFile.saveSync();
            console.log('Saved updates to trainUpdates.json');

        } catch (e) {
            console.error(e);
        }

        console.timeEnd('updateTrainFeed');
    }
}