/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */
import { TrainUpdateCollection } from "../Models/TrainUpdateCollection";
import { IDatabaseRitInfoUpdate } from "../Interfaces/DatabaseRitInfoUpdate";
import { evaluateTrainFeedHealth, TrainFeedHealth } from "../Models/TrainFeedHealth";

import { TripIdWithDate } from "../Interfaces/TVVManager";
import { TripMerger } from "../Helpers/TripMerger";

import { transit_realtime } from "../Compiled/compiled";
import { IInfoPlusRepository } from "../Interfaces/Repositories/InfoplusRepository";
import { IFeedManager } from "../Interfaces/Services/UpdateTrainFeed";
import FeedMessage = transit_realtime.FeedMessage;
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Singleton class that handles updating (for now only) the train feed.
 * @Singleton
 */
export class FeedManager implements IFeedManager {

    private static instance: FeedManager | null;
    private readonly _infoplusRepository: IInfoPlusRepository;
    private health: TrainFeedHealth = {
        status: "unhealthy",
        lastUpdatedAt: null,
        lastGeneratedAt: null,
        updateCount: 0,
        cancelledUpdateCount: 0,
        ritInfoUpdateCount: 0,
        activeRitInfoUpdateCount: 0,
        reasons: ["not_generated"]
    };

    private constructor(infoPlusRepository: IInfoPlusRepository) {
        this._infoplusRepository = infoPlusRepository;
    }

    public static getInstance(infoPlusRepository: IInfoPlusRepository): FeedManager {
        if (!this.instance) {
            this.instance = new FeedManager(infoPlusRepository);
        }
        return this.instance;
    }

    public async updateTrainFeed(tripIdsToRemove: TripIdWithDate[]): Promise<void> {
        console.time('Updating train feed...');
        console.log('Updating train feed...')
        try {
            await this.generateTrainFeed(tripIdsToRemove);
        } catch (e) {
            this.health = { ...this.health, status: "unhealthy", reasons: ["refresh_failed"] };
            console.error(`[FeedManager] Error while updating train feed`, e);
        } finally {
            console.timeEnd('Updating train feed...');
        }
    }

    public getHealth(): TrainFeedHealth {
        return { ...this.health, reasons: [...this.health.reasons] };
    }

    private async generateTrainFeed(tripIdsToRemove: TripIdWithDate[]): Promise<void> {
        //Get the current operationDate in YYYY-MM-DD format
        const currentOperationDate = dayjs()
            .tz('Europe/Amsterdam')
            .format('YYYY-MM-DD');

        const operationDateTomorrow = dayjs(currentOperationDate)
            .add(1, 'days')
            .format('YYYY-MM-DD')

        const operationDateYesterday = dayjs(currentOperationDate)
            .subtract(1, 'days')
            .format('YYYY-MM-DD')

        //Get the operationDate 3 days from now in YYYY-MM-DD format
        const endOperationDate = dayjs(currentOperationDate)
            .add(3, 'days')
            .format('YYYY-MM-DD')

        let operationDateOfTodayOrTomorrow = currentOperationDate;
        let operationDateOfYesterdayOrToday = currentOperationDate;

        //Check if the current time is between 00:00 and 04:00, if so, set the current operationDate to yesterday.
        if (dayjs().tz('Europe/Amsterdam').hour() < 4) {
            operationDateOfYesterdayOrToday = operationDateYesterday;
        }

        //Check if the current time is after 22:00, if so, set the current operationDate to tomorrow.
        if (dayjs().tz('Europe/Amsterdam').hour() >= 22) {
            operationDateOfTodayOrTomorrow = operationDateTomorrow;
        }

        console.time('Getting realtime trip updates from database...')
        let trainUpdates: IDatabaseRitInfoUpdate[];
        try {
            trainUpdates = await this._infoplusRepository.getCurrentRealtimeTripUpdates(
                operationDateOfYesterdayOrToday,
                operationDateOfTodayOrTomorrow,
                endOperationDate
            );
        } finally {
            console.timeEnd('Getting realtime trip updates from database...')
        }

        const mergedUpdates = TripMerger.mergeTrips(trainUpdates);

        const trainUpdateCollection = TrainUpdateCollection.fromDatabaseResult(mergedUpdates);

        trainUpdateCollection.applyRemovals(tripIdsToRemove);
        trainUpdateCollection.checkForErrors();
        const trainUpdateFeed: FeedMessage = trainUpdateCollection.toFeedMessage();

        const constructedFeedMessage: FeedMessage = FeedMessage.fromObject(trainUpdateFeed);
        console.log(`[FeedManager] Constructed feed message with ${constructedFeedMessage.entity.length} entities.`);

        const protobuf = Buffer.from(FeedMessage.encode(constructedFeedMessage).finish());
        const json = Buffer.from(JSON.stringify(constructedFeedMessage.toJSON()));
        await this.saveToFile(protobuf, 'trainUpdates.pb');
        await this.saveToFile(json, 'trainUpdates.json');
        this.health = evaluateTrainFeedHealth(trainUpdates, constructedFeedMessage, new Date());
    }

    private async saveToFile(buffer: Buffer, fileName: string): Promise<void> {
        await Bun.write(`./publish/${fileName}`, buffer);

        console.log(`[FeedManager] Saved updates to ${fileName}`);
    }


}
