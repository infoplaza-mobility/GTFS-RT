/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {transit_realtime} from "gtfs-realtime-bindings";
import IStopTimeUpdate = transit_realtime.TripUpdate.IStopTimeUpdate;
import IStopTimeEvent = transit_realtime.TripUpdate.IStopTimeEvent;
import StopTimeEvent = transit_realtime.TripUpdate.StopTimeEvent;
import { StopUpdate } from "../StopUpdates/StopUpdate";

export class  StopTimeUpdate implements IStopTimeUpdate {
    departure: IStopTimeEvent;
    arrival: IStopTimeEvent;
    stopId: string;
    scheduleRelationship: transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship;
    stopSequence: number;
    stopTimeProperties?: transit_realtime.TripUpdate.StopTimeUpdate.IStopTimeProperties;

    constructor(stopTimeUpdate: IStopTimeUpdate) {
        Object.assign(this, stopTimeUpdate);
    }

    /**
     * Creates a new StopTimeUpdate from a RitInfoStopUpdate.
     * @param update The RitInfoStopUpdate to convert.
     * @returns {StopTimeUpdate} The converted StopTimeUpdate.
     */
    public static fromStopUpdate(update: StopUpdate): StopTimeUpdate {

        let { departureDelay, arrivalDelay, departureTime, arrivalTime, stopId, sequence, isLastStop, isFirstStop  } = update;

        const departureBeforeArrival = !departureTime.isZero() && !arrivalTime.isZero() && departureTime < arrivalTime;
        const arrivalIsZero = arrivalTime.isZero();
        const departureIsZero = departureTime.isZero();
        // If the departure is before the arrival, this must be an error, so we add 1 minute to the arrival time and make it the new departure time.
        if(departureBeforeArrival) {
            // console.log(`[StopTimeUpdate] Departure before arrival (NEGATIVE_DWELL_TIME). Adding 1 minute to the arrival time and setting it as the departure time.`)
            departureTime = arrivalTime.add(60)
        }
            
        let departure = new StopTimeEvent({
            time: !departureIsZero ? departureTime : arrivalTime,
            delay: departureDelay
        });

        let arrival = new StopTimeEvent({
            time: !arrivalIsZero ? arrivalTime : departureTime,
            delay: arrivalDelay
        });

        if(isFirstStop)
            arrival = departure;

        if(isLastStop)
            departure = arrival;


        //The stop is skipped entirely if the passing is cancelled.
        const scheduleRelationship = update.isCancelled() ?
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED :
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED;

        const shouldHaveDepartureAndArrival = true;

        return new StopTimeUpdate({
            stopId,
            stopSequence: sequence,
            arrival: shouldHaveDepartureAndArrival ? arrival : undefined,
            departure: shouldHaveDepartureAndArrival ? departure : undefined,
            scheduleRelationship,
            stopTimeProperties: {
                assignedStopId: stopId,
            }
        });
    }
}