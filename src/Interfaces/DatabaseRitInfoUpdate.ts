/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { IDatabaseStopUpdate } from "./DatabaseStopUpdate";
import {JourneyChange, JourneyStationChange} from "./Changes";



export interface IDatabaseRitInfoUpdate {
    trainNumber: number;
    shortTrainNumber: number;
    trainType: string;
    agency: string;
    showsInTripPlanner: boolean;
    stops: IRitInfoStopUpdate[];
    tripId: number | null;
    routeId: number | null;
    directionId: number | null;
    shapeId: number | null;
    changes: JourneyChange[] | null;
    timestamp: Date;
}

export interface IRitInfoStopUpdate extends IDatabaseStopUpdate {
    changes: JourneyStationChange[] | null;
    /** PlatformCode in GTFS */
    platform: string | null;
    /** Arrival or DepartureTrack Message in Infoplus */
    track: string | null;

    plannedArrivalTime: string | null;
    plannedDepartureTime: string | null;

    plannedTrack: string | null;
    actualTrack: string | null;
    stationCode: string;
}