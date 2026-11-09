/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {IInfoPlusRepository} from "./Repositories/InfoplusRepository";

import {IStaticDataRepository} from "./Repositories/IStaticDataRepository";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const OPERATION_TIMEZONE = "Europe/Amsterdam";

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

        // Operation dates and the day-boundary windows are defined in Dutch local time,
        // not in the container's UTC clock.
        const now = dayjs().tz(OPERATION_TIMEZONE);
        const dates = [now.format("YYYY-MM-DD")];

        //If the hour is before 4AM, we need to check the previous day
        if (now.hour() < 4)
            dates.push(now.subtract(1, "day").format("YYYY-MM-DD"));

        //If the hour is 11PM or later, we need to check the next day
        if (now.hour() >= 23)
            dates.push(now.add(1, "day").format("YYYY-MM-DD"));

        const unique = new Map<string, TripIdWithDate>();
        for (const date of dates) {
            for (const tripId of await this.fetchTVVNotInInfoPlus(date))
                unique.set(`${tripId}|${date}`, { tripId, operationDate: date });
        }
        return [...unique.values()];
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