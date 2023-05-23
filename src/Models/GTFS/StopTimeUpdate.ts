/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {transit_realtime} from "gtfs-rb";
import IStopTimeUpdate = transit_realtime.TripUpdate.IStopTimeUpdate;
import IStopTimeEvent = transit_realtime.TripUpdate.IStopTimeEvent;
import StopTimeEvent = transit_realtime.TripUpdate.StopTimeEvent;
import {RitInfoStopUpdate} from "../RitinfoStopUpdate";

export class StopTimeUpdate implements IStopTimeUpdate {
    departure: IStopTimeEvent;
    arrival: IStopTimeEvent;
    stopId: string;
    scheduleRelationship: transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship;
    stopSequence: number;

    constructor(stopTimeUpdate: IStopTimeUpdate) {
        Object.assign(this, stopTimeUpdate);
    }

    /**
     * Creates a new StopTimeUpdate from a RitInfoStopUpdate.
     * @param update The RitInfoStopUpdate to convert.
     * @returns {StopTimeUpdate} The converted StopTimeUpdate.
     */
    public static fromRitInfoStopUpdate(update: RitInfoStopUpdate): StopTimeUpdate {

        let { departureDelay, arrivalDelay, departureTime, arrivalTime, stopId, sequence, isLastStop, isFirstStop  } = update;

        const departureBeforeArrival = !departureTime.isZero() && !arrivalTime.isZero() && departureTime < arrivalTime;

        // If the departure is before the arrival, this must be an error, so we add 1 minute to the arrival time and make it the new departure time.
        if(departureBeforeArrival) {
            console.log(`[StopTimeUpdate] Departure before arrival (NEGATIVE_DWELL_TIME). Adding 1 minute to the arrival time and setting it as the departure time. StopId: ${stopId}, departureTime: ${departureTime}, arrivalTime: ${arrivalTime}`)
            departureTime = arrivalTime.add(60)
        }
            
        const departure = new StopTimeEvent({
            time: departureTime,
            delay: departureDelay
        });

        const arrival = new StopTimeEvent({
            time: arrivalTime,
            delay: arrivalDelay
        });


        //The stop is skipped entirely if the passing is cancelled.
        const scheduleRelationship = update.isCancelled() ?
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED :
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED;


        const shouldHaveDeparture = !isLastStop && !update.isCancelledDeparture() && !update.isLastStopBeforeOnlyCancelledStops;
        const shouldHaveArrival = !isFirstStop && !update.isCancelledArrival();

        

        return new StopTimeUpdate({
            stopId,
            stopSequence: sequence,
            arrival: shouldHaveArrival ? arrival : undefined,
            departure: shouldHaveDeparture ? departure : undefined,
            scheduleRelationship
        });
    }
}