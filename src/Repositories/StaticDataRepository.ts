/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {Repository} from "./Repository";

import {IStaticDataRepository} from "../Interfaces/Repositories/IStaticDataRepository";

export class StaticDataRepository extends Repository implements IStaticDataRepository {
    /** @inheritDoc */
    public async getTrainReplacementBusServiceTripShortNames(date: string): Promise<number[]> {
        return this.database.raw(`
            SELECT DISTINCT "journeyNumber"
            FROM "StaticData-NL".trips
            WHERE agency = 'IFF'
              AND "journeyNumber" >= 900000
              AND "serviceId" IN
                  (SELECT "serviceId" FROM "StaticData-NL".calendar_dates WHERE date = ?)`, [date])
            .then((result) => {
                return result.rows.map((row: { journeyNumber: string }) => parseInt(row.journeyNumber));
            });
    }

}