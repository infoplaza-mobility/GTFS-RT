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
        
        // Propagate delays to cancelled stops to prevent negative hop times
        this.propagateDelaysToCancelledStops();
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

            // Skip if previous stop is cancelled or has cancelled departure (can't compare against it)
            if (previousStop.isCancelled() || previousStop.isCancelledDeparture())
                continue;

            // Skip fixing cancelled arrivals/departures
            const isArrivalCancelled = currentStop.isCancelledArrival();
            const isDepartureCancelled = currentStop.isCancelledDeparture();

            // Initialize variables to keep track of whether the arrival and departure times are increasing
            let arrivalTimeIsIncreasing = true;
            let departureTimeIsIncreasing = true;

            // Check if the current stop's arrival time is increasing (only if arrival is not cancelled)
            if (!isArrivalCancelled && currentStop.arrivalTime !== null && currentStop.arrivalTime > 0) {
                if (previousStop.departureTime > 0 && currentStop.arrivalTime < previousStop.departureTime) {
                    // If the current stop's arrival time is not increasing, log a warning message
                    console.warn(`[StopUpdateCollection ${this.tripId}] Non-increasing arrival time detected for stop ${currentStop.stationCode} [${currentStop.sequence}]: ${new Date(currentStop.arrivalTime * 1000).toISOString()} < ${new Date(previousStop.departureTime * 1000).toISOString()}`);
                    arrivalTimeIsIncreasing = false;
                }
            }

            // Check if the current stop's departure time is increasing (only if departure is not cancelled)
            if (!isDepartureCancelled && currentStop.departureTime !== null && currentStop.departureTime > 0) {
                if (previousStop.departureTime > 0 && currentStop.departureTime < previousStop.departureTime) {
                    // If the current stop's departure time is not increasing, log a warning message
                    console.warn(`[StopUpdateCollection ${this.tripId}] Non-increasing departure time detected for stop ${currentStop.stationCode} [${currentStop.sequence}]: ${new Date(currentStop.departureTime * 1000).toISOString()} < ${new Date(previousStop.departureTime * 1000).toISOString()}`);
                    departureTimeIsIncreasing = false;
                }
            }

            // If both the arrival and departure times are increasing, we don't need to fix anything
            if (arrivalTimeIsIncreasing && departureTimeIsIncreasing) {
                continue;
            }


            // If there is a previous and next stop, we can fix both times (only if they're not cancelled)
            this.fixStopTime(previousStop, currentStop, !arrivalTimeIsIncreasing && !isArrivalCancelled, !departureTimeIsIncreasing && !isDepartureCancelled);

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
        console.info(`[StopUpdateCollection] Fixing stop times for stop ${currentStop.stopId}: ${currentStop.name} [${currentStop.sequence}]`)

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

        // If the previous stop has a cancelled departure, we can't fix the arrival time
        if (previousStop.isCancelledDeparture()) return;

        // If the previous stop has no departure time, we can't fix the arrival time
        if (previousStop.departureTime === null) return;

        // If the current stop has no planned arrival time, we can't fix the arrival time
        if (stopToFix.plannedArrivalTime === null) return;

        const orignalStopTime = (stopToFix.departureTime - stopToFix.arrivalTime) / 1000;

            // Calculate the base new arrival time
        let newArrivalTime = (stopToFix.plannedArrivalTime.getTime() / 1000) + previousStop.departureDelay;

        // Ensure the arrival time is strictly greater than the previous stop's departure time
        newArrivalTime = Math.max(newArrivalTime, previousStop.departureTime + 1);

        stopToFix.arrivalTime = newArrivalTime;
        stopToFix.arrivalDelay = previousStop.departureDelay;

        // Don't set departure time/delay if departure is cancelled
        if (stopToFix.isCancelledDeparture()) {
            return;
        }

        //We always stay at the station about 60 seconds, so we cannot run in all delay during the stop.
        if(orignalStopTime > 60)
            stopToFix.departureDelay = stopToFix.arrivalDelay - (orignalStopTime - 60);
        //If we weren't planned to stop for longer than a minute, we don't have to adjust the delay.
        else
            stopToFix.departureDelay = stopToFix.arrivalDelay;

        //If there is still a departure delay after the stop, we have to adjust the departure time.
        if(stopToFix.departureDelay > 0) {
            //The departure time will be the delay + the arrival time.
            stopToFix.departureTime = stopToFix.arrivalTime + stopToFix.departureDelay;

            //Log what was fixed, the original stop time, the new arrival time, the new departure time and the delay.
            // console.info(`[StopUpdateCollection] Fixed stop ${stopToFix.stopId}: ${stopToFix.name} [${stopToFix.sequence}] Arrival time: ${new Date(stopToFix.arrivalTime * 1000)} Departure time: ${new Date(stopToFix.departureTime * 1000)} Original stop time: ${orignalStopTime} seconds. Arrival delay: ${stopToFix.arrivalDelay} seconds. Departure delay: ${stopToFix.departureDelay} seconds.`);
        }
        //If there is no delay, we can just set the departure time to the planned departure time.
        else {

            if(stopToFix.plannedDepartureTime)
                stopToFix.departureTime = stopToFix.plannedDepartureTime.getTime() / 1000;
            else
                stopToFix.departureTime = stopToFix.arrivalTime + 30;
            //Log what was fixed, the original stop time, the new arrival time, the new departure time and the delay.
            // console.info(`[StopUpdateCollection] Fixed stop ${stopToFix.stopId}: ${stopToFix.name} [${stopToFix.sequence}] Arrival time: ${new Date(stopToFix.arrivalTime * 1000)} Departure time: ${new Date(stopToFix.departureTime * 1000)} Original stop time: ${orignalStopTime} seconds. Arrival delay: ${stopToFix.arrivalDelay} seconds. Departure delay: ${stopToFix.departureDelay} seconds.`);
        }

    }

    /**
     * Propagates delays from the last non-cancelled stop to cancelled stops to prevent negative hop times.
     * @private
     */
    private propagateDelaysToCancelledStops() {
        let lastNonCancelledStop: RitInfoStopUpdate | null = null;
        let lastNonCancelledDepartureDelay = 0;
        let lastNonCancelledDepartureTime = 0;

        for (let i = 0; i < this.length; i++) {
            const currentStop = this.get(i);

            if (currentStop.isCancelled()) {
                // If this stop is cancelled, use the delay from the last non-cancelled stop
                if (lastNonCancelledStop !== null && lastNonCancelledDepartureTime > 0) {
                    const originalArrivalTime = currentStop.arrivalTime;
                    const originalDepartureTime = currentStop.departureTime;

                    // Set arrival and departure delays to the last non-cancelled stop's departure delay
                    currentStop.arrivalDelay = lastNonCancelledDepartureDelay;
                    currentStop.departureDelay = lastNonCancelledDepartureDelay;

                    // Calculate times based on planned times + delay
                    if (currentStop.plannedArrivalTime) {
                        const plannedArrivalSeconds = currentStop.plannedArrivalTime.getTime() / 1000;
                        currentStop.arrivalTime = plannedArrivalSeconds + lastNonCancelledDepartureDelay;
                        // Ensure arrival time is at least 1 second after last departure
                        currentStop.arrivalTime = Math.max(currentStop.arrivalTime, lastNonCancelledDepartureTime + 1);
                    } else {
                        // If no planned arrival, set it to 1 second after last departure
                        currentStop.arrivalTime = lastNonCancelledDepartureTime + 1;
                    }

                    if (currentStop.plannedDepartureTime) {
                        const plannedDepartureSeconds = currentStop.plannedDepartureTime.getTime() / 1000;
                        currentStop.departureTime = plannedDepartureSeconds + lastNonCancelledDepartureDelay;
                        // Ensure departure time is at least equal to arrival time
                        currentStop.departureTime = Math.max(currentStop.departureTime, currentStop.arrivalTime);
                    } else {
                        // If no planned departure, set it to arrival time (zero dwell)
                        currentStop.departureTime = currentStop.arrivalTime;
                    }

                    // Log the fix only if something actually changed
                    const arrivalChanged = originalArrivalTime !== currentStop.arrivalTime;
                    const departureChanged = originalDepartureTime !== currentStop.departureTime;
                    if (arrivalChanged || departureChanged) {
                        console.info(`[StopUpdateCollection ${this.tripId}] Propagated delays to cancelled stop ${currentStop.stopId}: ${currentStop.name} [${currentStop.sequence}] - Delay: ${lastNonCancelledDepartureDelay}s from ${lastNonCancelledStop.stationCode} [${lastNonCancelledStop.sequence}], Arrival: ${originalArrivalTime ? new Date(originalArrivalTime * 1000).toISOString() : 'null'} -> ${new Date(currentStop.arrivalTime * 1000).toISOString()}, Departure: ${originalDepartureTime ? new Date(originalDepartureTime * 1000).toISOString() : 'null'} -> ${new Date(currentStop.departureTime * 1000).toISOString()}`);
                    }

                    this.set(i, currentStop);
                } else {
                    // No previous non-cancelled stop (cancelled stops at the start)
                    // Use planned times with zero delay to ensure we have arrival/departure events
                    const originalArrivalTime = currentStop.arrivalTime;
                    const originalDepartureTime = currentStop.departureTime;

                    if (currentStop.plannedArrivalTime) {
                        currentStop.arrivalTime = currentStop.plannedArrivalTime.getTime() / 1000;
                        currentStop.arrivalDelay = 0;
                    }
                    if (currentStop.plannedDepartureTime) {
                        currentStop.departureTime = currentStop.plannedDepartureTime.getTime() / 1000;
                        currentStop.departureDelay = 0;
                        // Ensure departure is at least equal to arrival
                        if (currentStop.arrivalTime) {
                            currentStop.departureTime = Math.max(currentStop.departureTime, currentStop.arrivalTime);
                        }
                    } else if (currentStop.arrivalTime) {
                        // If no planned departure, set it to arrival time (zero dwell)
                        currentStop.departureTime = currentStop.arrivalTime;
                        currentStop.departureDelay = 0;
                    }

                    // Log the fix only if something actually changed
                    const arrivalChanged = originalArrivalTime !== currentStop.arrivalTime;
                    const departureChanged = originalDepartureTime !== currentStop.departureTime;
                    if ((arrivalChanged || departureChanged) && (currentStop.arrivalTime || currentStop.departureTime)) {
                        console.info(`[StopUpdateCollection ${this.tripId}] Set times for cancelled stop at start ${currentStop.stopId}: ${currentStop.name} [${currentStop.sequence}] - Arrival: ${originalArrivalTime ? new Date(originalArrivalTime * 1000).toISOString() : 'null'} -> ${currentStop.arrivalTime ? new Date(currentStop.arrivalTime * 1000).toISOString() : 'null'}, Departure: ${originalDepartureTime ? new Date(originalDepartureTime * 1000).toISOString() : 'null'} -> ${currentStop.departureTime ? new Date(currentStop.departureTime * 1000).toISOString() : 'null'}`);
                    }

                    this.set(i, currentStop);
                }
            } else {
                // Update the last non-cancelled stop reference
                lastNonCancelledStop = currentStop;
                // Use departureDelay if available, otherwise fall back to arrivalDelay
                // This handles cases where departureDelay is null but arrivalDelay has a value
                lastNonCancelledDepartureDelay = currentStop.departureDelay > 0 ? currentStop.departureDelay : currentStop.arrivalDelay;
                
                // Use the actual departure time, ensuring it's not 0
                // For scheduled stops, departureTime should always be > 0, but use arrivalTime as fallback
                // If departure is earlier than arrival (data error), use arrival time instead
                let actualDepartureTime = currentStop.departureTime > 0 ? currentStop.departureTime : 
                    (currentStop.arrivalTime > 0 ? currentStop.arrivalTime : 0);
                // If arrival time is later than departure time, use arrival time (handles data errors)
                if (currentStop.arrivalTime > 0 && currentStop.arrivalTime > actualDepartureTime) {
                    actualDepartureTime = currentStop.arrivalTime;
                }
                lastNonCancelledDepartureTime = actualDepartureTime;
                
                // Ensure we have a valid departure time for the next cancelled stop
                if (actualDepartureTime === 0 && currentStop.plannedDepartureTime) {
                    // Fallback: use planned departure + delay if actual time is 0
                    lastNonCancelledDepartureTime = (currentStop.plannedDepartureTime.getTime() / 1000) + lastNonCancelledDepartureDelay;
                } else if (actualDepartureTime === 0 && currentStop.plannedArrivalTime) {
                    // Fallback: use planned arrival + delay if actual time is 0
                    lastNonCancelledDepartureTime = (currentStop.plannedArrivalTime.getTime() / 1000) + lastNonCancelledDepartureDelay;
                }
            }
        }
    }

    /**
     * Fix the departure time of the current stop by setting it to the actualArrivalTime + difference between plannedArrivalTime and plannedDepartureTime
     * This works under the assumption that no delay is removed while at the station.
     * @param stopToFix The stop that needs to be fixed
     * @private
     */
    private fixDepartureTime(stopToFix: RitInfoStopUpdate) {
        // If the current stop has a cancelled arrival, we can't fix the departure time
        if (stopToFix.isCancelledArrival()) return;

        // If the current stop has no planned arrival time, we can't fix the departure time
        if (stopToFix.plannedArrivalTime === null) return;

        // If the current stop has no planned departure time, we can't fix the departure time
        if (stopToFix.plannedDepartureTime === null) return;

        // If the current stop has no actual arrival time, we can't fix the departure time
        if (stopToFix.arrivalTime === null) return;

        // Calculate the base new departure time
        let newDepartureTime = stopToFix.arrivalTime + ((stopToFix.plannedDepartureTime.getTime() - stopToFix.plannedArrivalTime.getTime()) / 1000);

        // Ensure the departure time is strictly greater than the arrival time
        newDepartureTime = Math.max(newDepartureTime, stopToFix.arrivalTime + 1);

        stopToFix.departureTime = newDepartureTime;
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

    public get destination(): string {
        //Get the last stop before only cancelled stops.
        const lastStopBeforeOnlyCancelledStops = this.findLastStopBeforeOnlyCancelledStops();

        if(lastStopBeforeOnlyCancelledStops)
            return lastStopBeforeOnlyCancelledStops.destination;

        //If all stops are cancelled, return the destination of the last stop.
        const lastStop = this.last();
        return lastStop.destination;
    }
}
