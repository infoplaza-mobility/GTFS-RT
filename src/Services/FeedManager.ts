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

export interface IFeedManager {
    /**
     * Updates the train feed, fetches the current realtime train data
     * from InfoPlus, then applies the specified removals and saves the generated
     * protobuf file to disk in ./publish/trainUpdates.pb and ./publish/trainUpdates.json
     * @param tripIdsToRemove The trip IDs to mark als "REMOVED"/"CANCELLED" in the feed
     */
    updateTrainFeed(tripIdsToRemove: TripIdWithDate[]): Promise<void>;

    /**
     * Updates the trip updates feed, fetches the current realtime trip updates
     * from OVApi, reads this protobuf and checks all trips if they are valid.
     * Fixes invalid trips and then writes back the protobuf to disk in ./publish/tripUpdates.pb
     * @throws Error if the trip updates feed could not be updated in any way
     */
    updateTripUpdatesFeed(): Promise<void>;
}

export class FeedManager implements IFeedManager {

    public constructor(
        private readonly infoplusRepository: InfoplusRepository,
        private readonly passtimesRepository: PassTimesRepository) {
    }

    /** @inheritDoc */
    public async updateTrainFeed(tripIdsToRemove: TripIdWithDate[]): Promise<void> {
        console.time('updateTrainFeed');
        console.log('Updating train feed...')
        //Get the current operationDate in YYYY-MM-DD format
        const currentOperationDate = new Date().toISOString().split('T')[0];

        const trainUpdates = await this.infoplusRepository.getCurrentRealtimeTripUpdates(currentOperationDate);

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

    /** @inheritDoc */
    public async updateTripUpdatesFeed(): Promise<void> {

    }
}