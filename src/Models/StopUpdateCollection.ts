/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { Collection } from "./General/Collection";
import { StopUpdate } from "./StopUpdates/StopUpdate";
import {RitInfoStopUpdate} from "./StopUpdates/RitinfoStopUpdate";

export class StopUpdateCollection extends Collection<RitInfoStopUpdate> {

    private tripId?: string;

    constructor(items: RitInfoStopUpdate[], tripId?: string) {
        super(items);
        this.tripId = tripId;

        if(items.length === 0) return;

        this.setFirstStop();
        this.setLastStop();
        this.setIsLastStopBeforeOnlyCancelledStops();
        // this.checkIncreasingTimes();


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
            const nextStop = this.get(i + 1);

            // If the current stop is cancelled, skip it
            if (currentStop.isCancelled()) continue;

            // Initialize variables to keep track of whether the arrival and departure times are increasing
            let arrivalTimeIsIncreasing = true;
            let departureTimeIsIncreasing = true;

            // Check if the current stop's planned arrival time is increasing
            if (currentStop.arrivalTime !== null) {
                if (lastStopArrivalTime !== undefined && currentStop.arrivalTime < lastStopArrivalTime) {
                    // If the current stop's planned arrival time is not increasing, log a warning message
                    console.warn(`[StopUpdateCollection] Non-increasing arrival time detected for stop ${currentStop.stopId} [${currentStop.sequence}]`)
                    arrivalTimeIsIncreasing = false;
                }
                // Update the last stop's arrival time to the current stop's planned arrival time
                lastStopArrivalTime = currentStop.arrivalTime;
            }

            // Check if the current stop's planned departure time is increasing
            if (currentStop.departureTime !== null) {
                if (lastStopDepartureTime !== undefined && currentStop.departureTime < lastStopDepartureTime) {
                    // If the current stop's planned departure time is not increasing, log a warning message
                    console.warn(`[StopUpdateCollection] Non-increasing departure time detected for stop ${currentStop.stopId} [${currentStop.sequence}]`)
                    departureTimeIsIncreasing = false;
                }
                // Update the last stop's departure time to the current stop's planned departure time
                lastStopDepartureTime = currentStop.departureTime;
            }

            // If both the arrival and departure times are increasing, we don't need to fix anything
            if (arrivalTimeIsIncreasing && departureTimeIsIncreasing) {
                continue;
            }

            // If there is no previous stop, the times can not be non-increasing
            if (previousStop === undefined) {
                continue;
            } else if (nextStop === undefined) {
                // If there is no next stop, we can only fix the arrival time
                this.fixStopTime(previousStop, currentStop, undefined);
            } else {
                // If there is a previous and next stop, we can fix both times
                this.fixStopTime(previousStop, currentStop, nextStop);
            }

            // Update the current stop in the collection
            this.set(i, currentStop);
        }
    }

    /**
     * Fix the current stop time by setting the arrival time to the planned arrival time + min(delay at previous stop, delay at next stop)
     * @param previousStop The previous stop in the sequence
     * @param currentStop The stop that needs to be fixed
     * @param nextStop The next stop in the sequence
     */
    private fixStopTime(previousStop: StopUpdate, currentStop: StopUpdate, nextStop?: StopUpdate) {

        console.info(`[StopUpdateCollection] Fixing stop time for stop ${currentStop.stopId} [${currentStop.sequence}]`)

        const previousStopDelay = previousStop.departureDelay;
        const nextStopDelay = nextStop?.arrivalDelay;

        let minDelay: number;

        if (nextStopDelay === undefined)
            minDelay = previousStopDelay;
        else
            minDelay = Math.min(previousStopDelay, nextStopDelay);

        let timeToUse: Date = (currentStop.plannedArrivalTime ?? currentStop.plannedDepartureTime)!;

        //Add the delay to the time to use
        currentStop.arrivalTime = timeToUse.getTime() / 1000 + minDelay;

        if (currentStop.plannedDepartureTime !== null) {
            //Calculate the difference between the planned arrival time and the planned departure time
            const plannedArrivalTime = currentStop.plannedArrivalTime
            const plannedDepartureTime = currentStop.plannedDepartureTime

            let difference: number;
            if (plannedArrivalTime && plannedDepartureTime)
                difference = plannedDepartureTime.getTime() - plannedArrivalTime.getTime();
            else
                difference = 0;

            let newDepartureTime = currentStop.arrivalTime + difference;
            newDepartureTime = newDepartureTime / 1000;

            //Set the departure time to the arrival time + the difference between the planned arrival time and the planned departure time
            currentStop.departureTime = newDepartureTime;
        }

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

        if(withoutFilterLength !== filteredLength) {
            console.warn(`[StopUpdateCollection] Removed ${withoutFilterLength - filteredLength} stops from trip ${this.tripId} as they were not served.`);
            return new StopUpdateCollection(filteredStops, this.tripId);
        }

        return this;
    }
}