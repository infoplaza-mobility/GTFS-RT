/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import {transit_realtime} from "../../Compiled/gtfs-realtime";
import StopTimeEvent = transit_realtime.TripUpdate.StopTimeEvent;
import StopTimeUpdate = transit_realtime.TripUpdate.StopTimeUpdate;
import { StopUpdate } from "../StopUpdates/StopUpdate";

export class ExtendedStopTimeUpdate extends StopTimeUpdate {

    constructor(stopTimeUpdate: StopTimeUpdate) {
        super(stopTimeUpdate);
    }

    /**
     * Creates a new StopTimeUpdate from a RitInfoStopUpdate.
     * @param update The RitInfoStopUpdate to convert.
     * @returns {StopTimeUpdate} The converted StopTimeUpdate.
     */
    public static fromStopUpdate(update: StopUpdate): StopTimeUpdate {

        let { departureDelay, arrivalDelay, departureTime, arrivalTime, stopId, sequence, isLastStop, isFirstStop  } = update;

        const departureBeforeArrival = departureTime !== 0 && arrivalTime !== 0 && departureTime < arrivalTime;
        const arrivalIsZero = arrivalTime === 0;
        const departureIsZero = departureTime === 0;
        // If the departure is before the arrival, this must be an error, so we add 1 minute to the arrival time and make it the new departure time.
        if(departureBeforeArrival) {
            console.log(`[StopTimeUpdate] Departure before arrival (NEGATIVE_DWELL_TIME). Adding 1 minute to the arrival time and setting it as the departure time.`)
            departureTime = arrivalTime + 60;
        }
            
        let departure = StopTimeEvent.fromObject({
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

        const shouldHaveDepartureAndArrival = true; //!update.isCancelled();

        return StopTimeUpdate.fromObject({
            stop_id: stopId,
            stop_sequence: sequence,
            arrival: shouldHaveDepartureAndArrival ? arrival : undefined,
            departure: shouldHaveDepartureAndArrival ? departure : undefined,
            schedule_relationship: scheduleRelationship,
            // stop_time_properties: {
            //     assigned_stop_id: stopId,
            // }
        })


    }
}