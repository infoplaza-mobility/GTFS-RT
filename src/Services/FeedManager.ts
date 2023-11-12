/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */
import {TrainUpdateCollection} from "../Models/TrainUpdateCollection";

import { File } from "../Models/General/File";

import {TripIdWithDate} from "../Interfaces/TVVManager";

import {transit_realtime} from "../Compiled/compiled";
import FeedMessage = transit_realtime.FeedMessage;
import {IInfoPlusRepository} from "../Interfaces/Repositories/InfoplusRepository";

/**
 * Singleton class that handles updating (for now only) the train feed.
 * @Singleton
 */
export class FeedManager {

    private static instance: FeedManager | null;
    private readonly _infoplusRepository: IInfoPlusRepository;

    private constructor(infoPlusRepository: IInfoPlusRepository) {
        this._infoplusRepository = infoPlusRepository;
    }

    public static getInstance(infoPlusRepository: IInfoPlusRepository): FeedManager {
        if (!this.instance) {
            this.instance = new FeedManager(infoPlusRepository);
        }
        return this.instance;
    }

    /**
     * Update the protobuf feeds in the publish folder with the latest realtime train updates from infoplus.
     * Removes the trips that are in the tripIdsToRemove array.
     * Outputs both a .pb and .json file to /publish.
     * @param tripIdsToRemove The tripIds that should be removed from the feed.
     */
    public async updateTrainFeed(tripIdsToRemove: TripIdWithDate[]): Promise<void> {
        console.time('Updating train feed...');
        console.log('Updating train feed...')
        //Get the current operationDate in YYYY-MM-DD format
        const currentOperationDate = new Date().toISOString().split('T')[0];

        const trainUpdates = await this._infoplusRepository.getCurrentRealtimeTripUpdates(currentOperationDate);

        const trainUpdateCollection = TrainUpdateCollection.fromDatabaseResult(trainUpdates);

        trainUpdateCollection.applyRemovals(tripIdsToRemove);

        const trainUpdateFeed: FeedMessage = trainUpdateCollection.toFeedMessage();

        try {
            const constructedFeedMessage: FeedMessage = FeedMessage.fromObject(trainUpdateFeed);
            this.saveToFile(Buffer.from(FeedMessage.encode(constructedFeedMessage).finish()), 'trainUpdates.pb');
            this.saveToFile(Buffer.from(JSON.stringify(constructedFeedMessage.toJSON())), 'trainUpdates.json');
        } catch (e) {
            console.error(`[FeedManager] Error while saving train feed`, e);
        }

        console.timeEnd('Updating train feed...');
    }

    private saveToFile(buffer: Buffer, fileName: string): void {
        const file: File = new File(
            './publish/',
            fileName,
            buffer
        );

        file.saveSync();

        console.log(`[FeedManager] Saved updates to ${fileName}`);
    }
}