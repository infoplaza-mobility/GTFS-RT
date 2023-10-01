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
import { PassTimesRepository } from "../Repositories/PasstimesRepository";
import { TripUpdateCollection } from "../Models/TripUpdateCollection";
import {TripIdWithDate} from "../Interfaces/TVVManager";

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
            FeedMessage.verify(trainUpdateFeed);

            const file: File = new File('./publish/', 'trainUpdates.pb', Buffer.from(FeedMessage.encode(trainUpdateFeed).finish()));
            file.saveSync();

            console.log('Saved updates to trainUpdates.pb');

            const jsonFile: File = new File('./publish/', 'trainUpdates.json', Buffer.from(JSON.stringify(trainUpdateFeed)));
            jsonFile.saveSync();
            console.log('Saved updates to trainUpdates.json');

        } catch (e) {
            console.error(e);
        }

        console.timeEnd('updateTrainFeed');
    }

    public static async updateTripUpdatesFeed(): Promise<void> {
        console.time('updateTripUpdatesFeed');
        console.log('Updating trip updates feed...');

        //Get the current operationDate in YYYY-MM-DD format
        const currentOperationDate = new Date().toISOString().split('T')[0];

        const tripUpdates = await this._passtimesRepository.getCurrentRealtimeTripUpdates(currentOperationDate);
        
        const tripUpdateCollection = TripUpdateCollection.fromDatabaseResult(tripUpdates);

        const tripUpdateFeed: FeedMessage = tripUpdateCollection.toFeedMessage();

        try {
            FeedMessage.verify(tripUpdateFeed);

            const file: File = new File('./publish/', 'tripUpdates.pb', Buffer.from(FeedMessage.encode(tripUpdateFeed).finish()));
            file.saveSync();

            console.log('Saved updates to tripUpdates.pb');

            const jsonFile: File = new File('./publish/', 'tripUpdates.json', Buffer.from(JSON.stringify(tripUpdateFeed)));
            jsonFile.saveSync();
            console.log('Saved updates to tripUpdates.json');

        } catch (e) {
            console.error(e);
        }

        console.timeEnd('updateTripUpdatesFeed');
    }
}