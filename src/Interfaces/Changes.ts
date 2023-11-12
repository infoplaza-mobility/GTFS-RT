/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

/**
 * All interfaces are modified (and translated) versions of from the raw infoplus data.
 * Normally, these interfaces hook into a shared repository which is part of the closed source part of R-OV,
 * so these is a small subset that is required for the project to work.
 */
export interface ChangeBase {
    changeReasonShort?: string;
    changeReasonLong?: string;
    trainReplacingTransportMessage?: string;
    changeMessages?: Presentatie;
}

export interface JourneyPartChange extends ChangeBase {
    changeType: JourneyPartChangeType;
}

export interface JourneyChange extends ChangeBase {
    changeType: JourneyChangeType;
}

export interface JourneyStationChange extends ChangeBase {
    changeType: JourneyStationChangeType;
}

export enum JourneyChangeType {
    ExtraTrain = "24",
    CancelledTrain = "25",
    ChangeStopBehaviour = "30",
    DivertedTrain = "33",
    ShortenedDestination = "34",
    ExtendedDestination = "35",
    OriginShortening = "36",
    OriginExtension = "37",
    ChangedDestination = "41",
    ChangedOrigin = "42",
    NotActualLogicalJourney = "50",
    TrainReplacementService = "51",
    NotLogicalIntercity = "80",
    NotLogicalSprinter = "81",
}

export enum JourneyPartChangeType {
    ExtraTrain = "24",
    CancelledTrain = "25",
    ChangeStopBehaviour = "30",
    DivertedTrain = "33",
    ShortenedDestination = "34",
    ExtendedDestination = "35",
    OriginShortening = "36",
    OriginExtension = "37",
    ChangedDestination = "41",
    ChangedOrigin = "42",
}

export enum JourneyStationChangeType {
    DepartureDelay = "10",
    ArrivalDelay = "11",
    DepartureTimeChange = "12",
    ArrivalTimeChange = "13",
    DepartureTrackChange = "20",
    ArrivalTrackChange = "21",
    FixDepartureTrack = "22",
    FixArrivalTrack = "23",
    ExtraDeparture = "31",
    CancelledDeparture = "32",
    ExtraArrival = "38",
    CancelledArrival = "39",
    ExtraPassing = "43",
    CancelledPassing = "44",
}

export interface Presentatie {
    Uitingen: Uiting | Uiting[];
}

export interface Uiting {
    Taal? : "en" | "nl",
    Uiting: string | UitingText | UitingText[];
}

export interface UitingText {
    Value: string;
    Prioriteit?: number;
    ReferentieType?: string;
    ReferentieWaarde?: string;
}