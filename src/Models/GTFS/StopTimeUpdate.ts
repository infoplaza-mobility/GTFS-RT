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

        let {
            departureDelay,
            arrivalDelay,
            departureTime,
            arrivalTime,
            stopId,
            sequence,
            isLastStop,
            isFirstStop,
            plannedTrack,
            actualTrack,
            destination
        } = update;

        // Check cancellation status
        const isFullyCancelled = update.isCancelled();
        const isArrivalCancelled = update.isCancelledArrival();
        const isDepartureCancelled = update.isCancelledDeparture();

        // If the stop is fully cancelled, don't include arrival/departure fields
        if (isFullyCancelled) {
            const scheduleRelationship = transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED;
            return StopTimeUpdate.create({
                stopId,
                stopSequence: sequence,
                arrival: undefined,
                departure: undefined,
                scheduleRelationship,
                ".transit_realtime.ovapiStopTimeUpdate": {
                    stationId: update.stationCode,
                    scheduledTrack: plannedTrack,
                    actualTrack: actualTrack
                },
                stopTimeProperties: {
                    stopHeadsign: destination
                }
            });
        }

        const departureBeforeArrival = departureTime !== 0 && arrivalTime !== 0 && departureTime < arrivalTime;
        const arrivalIsZero = arrivalTime === 0;
        const departureIsZero = departureTime === 0;
        // If the departure is before the arrival, this must be an error, so we add 1 minute to the arrival time and make it the new departure time.
        if(departureBeforeArrival) {
            departureTime = arrivalTime + 60;
        }
            
        // Create departure event
        let departure: StopTimeEvent | undefined = undefined;
        if (!isDepartureCancelled) {
            departure = StopTimeEvent.create({
                time: !departureIsZero ? departureTime : arrivalTime,
                delay: departureDelay,
                uncertainty: null
            });
        } else if (isArrivalCancelled === false) {
            // If departure is cancelled but arrival is not, use arrival time for departure
            departure = StopTimeEvent.create({
                time: !arrivalIsZero ? arrivalTime : departureTime,
                delay: arrivalDelay,
                uncertainty: null
            });
        }

        // Create arrival event
        let arrival: StopTimeEvent | undefined = undefined;
        if (!isArrivalCancelled) {
            arrival = StopTimeEvent.create({
                time: !arrivalIsZero ? arrivalTime : departureTime,
                delay: arrivalDelay,
                uncertainty: null
            });
        } else if (isDepartureCancelled === false) {
            // If arrival is cancelled but departure is not, use departure time for arrival
            arrival = StopTimeEvent.create({
                time: !departureIsZero ? departureTime : arrivalTime,
                delay: departureDelay,
                uncertainty: null
            });
        }

        if(isFirstStop && arrival && departure)
            arrival = departure;

        if(isLastStop && arrival && departure)
            departure = arrival;

        //The stop is skipped entirely if the passing is cancelled.
        const scheduleRelationship = update.isCancelled() ?
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED :
            transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED;

        return StopTimeUpdate.create({
            stopId,
            stopSequence: sequence,
            arrival: arrival,
            departure: departure,
            scheduleRelationship,
            ".transit_realtime.ovapiStopTimeUpdate": {
                stationId: update.stationCode,
                scheduledTrack: plannedTrack,
                actualTrack: actualTrack
            },
            stopTimeProperties: {
                stopHeadsign: destination
            }
        })


    }
}
