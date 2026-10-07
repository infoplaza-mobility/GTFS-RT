/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {transit_realtime} from "../../Compiled/compiled";
import StopTimeEvent = transit_realtime.TripUpdate.StopTimeEvent;
import StopTimeUpdate = transit_realtime.TripUpdate.StopTimeUpdate;
import {RitInfoStopUpdate} from "../StopUpdates/RitinfoStopUpdate";

export class ExtendedStopTimeUpdate extends StopTimeUpdate {

    constructor(stopTimeUpdate: StopTimeUpdate) {
        super(stopTimeUpdate);
    }

    /**
     * Creates a new StopTimeUpdate from a RitInfoStopUpdate.
     * @param update The RitInfoStopUpdate to convert.
     * @returns {StopTimeUpdate} The converted StopTimeUpdate.
     */
    public static fromStopUpdate(update: RitInfoStopUpdate): StopTimeUpdate {

        const { departureDelay, arrivalDelay, departureTime, arrivalTime, stopId, sequence, destination } = update;
        const departure = departureTime > 0 ? StopTimeEvent.create({ time: departureTime, delay: departureDelay }) : undefined;
        const arrival = arrivalTime > 0 ? StopTimeEvent.create({ time: arrivalTime, delay: arrivalDelay }) : undefined;

        //The stop is skipped entirely if the passing is cancelled.
        const scheduleRelationship = update.isCancelled() ?
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED :
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED;

        const shouldHaveDepartureAndArrival = !update.isCancelled();
        const assignedStopId = update.hasPlatformChange() ? update.assignedStopId : null;

        return StopTimeUpdate.create({
            stopId: assignedStopId ?? stopId,
            stopSequence: sequence,
            arrival: shouldHaveDepartureAndArrival ? arrival : undefined,
            departure: shouldHaveDepartureAndArrival ? departure : undefined,
            scheduleRelationship,
            ".transit_realtime.ovapiStopTimeUpdate": {
                stationId: update.stationCode,
                // Keep the deprecated strings for consumers that still read the OVAPI extension.
                scheduledTrack: update.plannedPlatformCode,
                actualTrack: update.expectedPlatformCode
            },
            stopTimeProperties: {
                ...(assignedStopId && { assignedStopId }),
                stopHeadsign: destination
            }
        })
    }
}
