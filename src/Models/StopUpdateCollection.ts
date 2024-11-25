/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { Collection } from "./General/Collection";
import { StopUpdate } from "./StopUpdates/StopUpdate";
import {RitInfoStopUpdate} from "./StopUpdates/RitinfoStopUpdate";

export class StopUpdateCollection extends Collection<RitInfoStopUpdate> {

    private readonly tripId?: string;

    constructor(items: RitInfoStopUpdate[], tripId?: string) {
        super(items);
        this.tripId = tripId;

        if(items.length === 0) return;

        this.setFirstStop();
        this.setLastStop();
        this.setIsLastStopBeforeOnlyCancelledStops();

        //Make sure all times are increasing
        this.checkIncreasingTimes();
    }

    private setFirstStop() {
        const firstStop = this.first();
        firstStop.isFirstStop = true;
        this.set(0, firstStop);
    }

    private setLastStop() {
        const lastStop = this.last();
        lastStop.isLastStop = true;
        this.set(this.length - 1, lastStop);
    }

    /**
     * Checks if the times are increasing. If not, it will fix them.
     * This is done by setting the arrival time to the planned arrival time + min(delay at previous stop, delay at next stop)
     * @private
     */
    private checkIncreasingTimes() {
        // Initialize variables to keep track of the last stop's arrival and departure times
        let lastStopArrivalTime: number | undefined = undefined;
        let lastStopDepartureTime: number | undefined = undefined;

        // Loop through each stop in the collection
        for (let i = 0; i < this.length; i++) {
            // Get the current stop, as well as the previous and next stops (if they exist)
            const currentStop = this.get(i);
            const previousStop = this.get(i - 1);

            // If the current stop is cancelled, skip it
            if (currentStop.isCancelled()) continue;

            //If there is no previous stop, the arrival and departure times can not be non-increasing, as this is the first stop.
            if(!previousStop)
                continue;

            // Initialize variables to keep track of whether the arrival and departure times are increasing
            let arrivalTimeIsIncreasing = true;
            let departureTimeIsIncreasing = true;

            // Check if the current stop's planned arrival time is increasing
            if (currentStop.arrivalTime !== null) {
                if (lastStopDepartureTime !== undefined && currentStop.arrivalTime && currentStop.arrivalTime < lastStopDepartureTime) {
                    // If the current stop's planned arrival time is not increasing, log a warning message
                    // console.warn(`[StopUpdateCollection ${this.tripId}] Non-increasing arrival time detected for stop ${currentStop.stationCode} [${currentStop.sequence}]`, new Date(currentStop.arrivalTime * 1000), new Date(lastStopDepartureTime * 1000))
                    arrivalTimeIsIncreasing = false;
                }

                lastStopArrivalTime = currentStop.arrivalTime;
            }

            // Check if the current stop's planned departure time is increasing
            if (currentStop.departureTime !== null) {
                if (lastStopDepartureTime !== undefined && currentStop.departureTime && currentStop.departureTime < lastStopDepartureTime) {

                    // If the current stop's planned departure time is not increasing, log a warning message
                    // console.warn(`[StopUpdateCollection ${this.tripId}] Non-increasing departure time detected for stop ${currentStop.stationCode} [${currentStop.sequence}]`, new Date(currentStop.departureTime * 1000), new Date(lastStopDepartureTime * 1000))
                    departureTimeIsIncreasing = false;
                }
                // Update the last stop's departure time to the current stop's planned departure time
                lastStopDepartureTime = currentStop.departureTime;
            }

            // If both the arrival and departure times are increasing, we don't need to fix anything
            if (arrivalTimeIsIncreasing && departureTimeIsIncreasing) {
                continue;
            }

            // If there is a previous and next stop, we can fix both times
            this.fixStopTime(previousStop, currentStop, !arrivalTimeIsIncreasing, !departureTimeIsIncreasing);

            // Update the current stop in the collection
            this.set(i, currentStop);
        }
    }

    /**
     * Set the sequence number of each stop to its index in the array + 1
     * @private
     */
    private setSequenceNumbers() {
        for (let i = 0; i < this.length; i++) {
            const stop = this.get(i);
            stop.sequence = i + 1;
            this.set(i, stop);
        }
    }

    /**
     * Fix the current stop time by setting the arrival time to the planned arrival time + min(delay at previous stop, delay at next stop)
     * @param previousStop The previous stop in the sequence
     * @param currentStop The stop that needs to be fixed
     * @param fixArrival Whether the arrival time should be fixed
     * @param fixDeparture Whether the departure time should be fixed
     */
    private fixStopTime(previousStop: RitInfoStopUpdate, currentStop: RitInfoStopUpdate, fixArrival: boolean, fixDeparture: boolean) {
        // console.info(`[StopUpdateCollection] Fixing stop times for stop ${currentStop.stopId} [${currentStop.sequence}]`)

        if(fixArrival)
            this.fixArrivalTime(previousStop, currentStop);

        if(fixDeparture)
            this.fixDepartureTime(currentStop);
    }

    /**
     * Fix the arrival time of the current stop by setting it to the planned arrival time + departure delay at previous stop
     * This works under the assumption that no delay is removed between stops.
     * @param previousStop The previous stop in the sequence
     * @param stopToFix The stop that needs to be fixed
     * @private
     */
    private fixArrivalTime(previousStop: RitInfoStopUpdate, stopToFix: RitInfoStopUpdate) {
        // If the previous stop is cancelled, we can't fix the arrival time
        if (previousStop.isCancelled()) return;

        // If the previous stop has no departure time, we can't fix the arrival time
        if (previousStop.departureTime === null) return;

        // If the current stop has no planned arrival time, we can't fix the arrival time
        if (stopToFix.plannedArrivalTime === null) return;

        // Calculate the new arrival time by adding the departure delay at the previous stop to the planned arrival time at the current stop
        const newArrivalTime = (stopToFix.plannedArrivalTime.getTime() / 1000) + previousStop.departureDelay;

        // If the new arrival time is not increasing, we can't fix the arrival time
        if (newArrivalTime < previousStop.departureTime) {
            console.error(`[StopUpdateCollection ${this.tripId}] Tried fixing arrival time for stop ${stopToFix.stationCode} [${stopToFix.sequence}], but the new arrival time is not increasing. New arrival time: ${new Date(newArrivalTime * 1000)}`);
        }

        // Update the arrival time of the current stop
        stopToFix.arrivalTime = newArrivalTime;

        // Update the arrival delay of the current stop
        stopToFix.arrivalDelay = previousStop.departureDelay;
    }

    /**
     * Fix the departure time of the current stop by setting it to the actualArrivalTime + difference between plannedArrivalTime and plannedDepartureTime
     * This works under the assumption that no delay is removed while at the station.
     * @param stopToFix The stop that needs to be fixed
     * @private
     */
    private fixDepartureTime(stopToFix: RitInfoStopUpdate) {
        // If the current stop has no planned arrival time, we can't fix the departure time
        if (stopToFix.plannedArrivalTime === null) return;

        // If the current stop has no planned departure time, we can't fix the departure time
        if (stopToFix.plannedDepartureTime === null) return;

        // If the current stop has no actual arrival time, we can't fix the departure time
        if (stopToFix.arrivalTime === null) return;

        // Calculate the new departure time by adding the difference between the planned arrival and departure times to the actual arrival time
        const newDepartureTime = stopToFix.arrivalTime + ((stopToFix.plannedDepartureTime.getTime() - stopToFix.plannedArrivalTime.getTime()) / 1000);

        // If the new departure time is not increasing, we can't fix the departure time
        if (newDepartureTime < stopToFix.arrivalTime) {
            console.error(`[StopUpdateCollection ${this.tripId}] Tried fixing departure time for stop ${stopToFix.stationCode} [${stopToFix.sequence}], but the new departure time is not increasing. New departure time: ${new Date(newDepartureTime * 1000)}`);
        }

        // Update the departure time of the current stop
        stopToFix.departureTime = newDepartureTime;

        // Update the departure delay of the current stop
        stopToFix.departureDelay = stopToFix.arrivalDelay;
    }

    /**
     * Finds the last stop that is still served before only cancelled stops happen.
     * Updates it so that it does not have a departure time, as it will never depart because it is the last stop now.
     */
    private setIsLastStopBeforeOnlyCancelledStops() {

        const collectionHasCancelledStops = this.some(stop => stop.isCancelled());

        // If no stops are cancelled, there is no need to do anything.
        if (!collectionHasCancelledStops) return;

        const lastStopBeforeOnlyCancelledStops = this.findLastStopBeforeOnlyCancelledStops();

        if (lastStopBeforeOnlyCancelledStops === null) return;

        lastStopBeforeOnlyCancelledStops.isLastStopBeforeOnlyCancelledStops = true;

    }

    private findLastStopBeforeOnlyCancelledStops(): StopUpdate | null {
        let lastStopBeforeOnlyCancelledStops: StopUpdate | null = null;

        for (let i = 0; i < this.length; i++) {
            const stop = this.get(i);

            if (stop.isCancelled()) continue;

            lastStopBeforeOnlyCancelledStops = stop;
        }

        return lastStopBeforeOnlyCancelledStops;
    }

    /**
     * Removes all stops that are cancelled in this collection, and returns a new collection without the cancelled stops.
     */
    public removeStopsNotServed() {
        //First check if all stops are cancelled, if so we can just return an empty collection.
        if(this.every(stop => stop.isCancelled()))
            return new StopUpdateCollection([], this.tripId);

        const withoutFilterLength = this.length;
        const filteredStops = this.filter(stop => !stop.isCancelled());
        const filteredLength = filteredStops.length;

        //Sort the stops by their respective arrival or departure times.
        const withNewIndexes = filteredStops.sort((a, b) => {
            if(a.arrivalTime && b.arrivalTime)
                return a.arrivalTime - b.arrivalTime;

            if(a.departureTime && b.departureTime)
                return a.departureTime - b.departureTime;

            if(a.arrivalTime && b.departureTime)
                return a.arrivalTime - b.departureTime;

            if(a.departureTime && b.arrivalTime)
                return a.departureTime - b.arrivalTime;

            return 0;
        // Set the sequence number of each stop to its index in the array + 1
        }).map((stop, index) => {
            stop.sequence = index + 1;
            return stop;
        })

        console.warn(`[StopUpdateCollection] Removed ${withoutFilterLength - filteredLength} stops from trip ${this.tripId} as they were not served.`);
        return new StopUpdateCollection(withNewIndexes, this.tripId);

    }
}
