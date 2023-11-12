/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {IInfoPlusRepository} from "./Repositories/InfoplusRepository";

import {IStaticDataRepository} from "./Repositories/IStaticDataRepository";

/**
 * The TVV (TreinVervangend Vervoer) manager is responsible for keeping track of any TVV trips that are in the planned data,
 * but are not in the InfoPlus data, and thus should be removed.
 */
export interface ITVVManager {
    /**
     * Returns all trip IDs that are in the planned data, but not in the InfoPlus data.
     */
    findTVVNotInInfoPlus(): Promise<TripIdWithDate[]>;
}

export type TripIdWithDate = { tripId: number, operationDate: string };

/**
 * The TVV (TreinVervangend Vervoer) manager is responsible for keeping track of any TVV trips that are in the planned data.
 */
export class TVVManager implements ITVVManager {
    private readonly _staticDataRepository: IStaticDataRepository;
    private readonly _infoPlusRepository: IInfoPlusRepository;

    constructor(staticDataRepository: IStaticDataRepository, infoPlusRepository: IInfoPlusRepository) {
        this._staticDataRepository = staticDataRepository;
        this._infoPlusRepository = infoPlusRepository;
    }

    /** @inheritDoc */
    public async findTVVNotInInfoPlus(): Promise<TripIdWithDate[]> {

        const currentDate = new Date().toISOString().split("T")[0];
        let fetchedTripIds = await this.fetchTVVNotInInfoPlus(currentDate);

        const tripIdsWithDates = fetchedTripIds.map((tripId) => {
            return {tripId, operationDate: currentDate};
        });

        //If the hour is before 4AM, we need to check the previous day
        const currentHour = new Date().getHours();

        if(currentHour < 4) {
            const previousDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            const previousFetchedTripIds = await this.fetchTVVNotInInfoPlus(previousDate);

            const previousFetchedTripIdsWithDate = previousFetchedTripIds.map((tripId) => {
                return {tripId, operationDate: previousDate};
            });

            //Merge the two arrays and remove duplicates
            return [...tripIdsWithDates, ...previousFetchedTripIdsWithDate].filter((value, index, self) => self.indexOf(value) === index);
        }

        //If the hour is 11PM or later, we need to check the next day
        if(currentHour >= 23) {
            const nextDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            const nextFetchedTripIds = await this.fetchTVVNotInInfoPlus(nextDate);

            const nextFetchedTripIdsWithDate = nextFetchedTripIds.map((tripId) => {
                return {tripId, operationDate: nextDate};
            });

            //Merge the two arrays and remove duplicates
            return [...tripIdsWithDates, ...nextFetchedTripIdsWithDate].filter((value, index, self) => self.indexOf(value) === index);
        }

        return tripIdsWithDates;
    }

    private async fetchTVVNotInInfoPlus(date: string): Promise<number[]> {
        console.time("Find TVV not in InfoPlus")

        const trainNumbers = await this._staticDataRepository.getTrainReplacementBusServiceTripShortNames(date);

        console.log(`[TVVManager] Found ${trainNumbers.length} train replacement bus service trips in the static data for ${date}`);

        const tripIdsWithoutInfoPlusData = await this._infoPlusRepository.getTripIdsForTVVNotInInfoPlus(trainNumbers, date);

        console.log(`[TVVManager] Found ${tripIdsWithoutInfoPlusData.length} TVV trips in OpenTripPlanner that are not in InfoPlus for ${date}`);
        console.timeEnd("Find TVV not in InfoPlus")
        return tripIdsWithoutInfoPlusData;
    }

}