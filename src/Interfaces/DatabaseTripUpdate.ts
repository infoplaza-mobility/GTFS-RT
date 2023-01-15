/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

export interface IDatabaseRitInfoUpdate {
    trainNumber: number;
    shortTrainNumber: number;
    trainType: string;
    agency: string;
    showsInTripPlanner: boolean;
    stops: IRitInfoUpdateStop[];
    tripId: number | null;
    changes:
}

export interface IRitInfoUpdateStop {
    stopId: number | null;
    changes: number | null;
}