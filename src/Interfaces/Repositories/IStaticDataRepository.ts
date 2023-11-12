/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

export interface IStaticDataRepository {
    /**
     * Gets all train replacement bus service trip short names for a given date.
     * @param date The date to get the trips for.
     */
    getTrainReplacementBusServiceTripShortNames(date: string): Promise<number[]>;
}