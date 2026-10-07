/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { Collection } from "./General/Collection";
import { StopUpdate } from "./StopUpdates/StopUpdate";
import { RitInfoStopUpdate } from "./StopUpdates/RitinfoStopUpdate";

export class StopUpdateCollection extends Collection<RitInfoStopUpdate> {

    private readonly tripId?: string;

    constructor(items: RitInfoStopUpdate[], tripId?: string) {
        super(items);
        this.tripId = tripId;

        if (items.length === 0) return;

        this.setFirstStop();
        this.setLastStop();
        this.setIsLastStopBeforeOnlyCancelledStops();

        //Make sure all times are increasing
        this.checkIncreasingTimes();

        // Generated stop lists use consecutive sequences. TrainUpdate restores the matched
        // static sequences when publishing a SCHEDULED trip.
        this.setSequenceNumbers();
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

    /** Repair served calls in their source order, then recheck dwell after an arrival repair. */
    private checkIncreasingTimes() {
        let previousServedStop: RitInfoStopUpdate | null = null;
        let repairedHops = 0;
        let repairedDwells = 0;
        for (const stop of this.toArray()) {
            if (stop.isCancelled()) continue;

            if (stop.isCancelledArrival() && stop.departureTime > 0)
                stop.arrivalTime = stop.departureTime;

            if (previousServedStop?.departureTime > 0 && stop.arrivalTime > 0 &&
                stop.arrivalTime < previousServedStop.departureTime) {
                const plannedHop = this.plannedDuration(previousServedStop.plannedDepartureTime, stop.plannedArrivalTime);
                stop.arrivalTime = previousServedStop.departureTime + plannedHop;
                repairedHops++;
            }

            if (stop.isCancelledDeparture() && stop.arrivalTime > 0) {
                stop.departureTime = stop.arrivalTime;
            } else if (stop.arrivalTime > 0 && stop.departureTime > 0 && stop.departureTime < stop.arrivalTime) {
                stop.departureTime = stop.arrivalTime + this.plannedDuration(stop.plannedArrivalTime, stop.plannedDepartureTime);
                repairedDwells++;
            }
            previousServedStop = stop;
        }
        if (repairedHops || repairedDwells)
            console.warn(`[StopUpdateCollection ${this.tripId}] Repaired ${repairedHops} negative hop times and ${repairedDwells} negative dwell times. Source timestamps are inconsistent.`);
    }

    private plannedDuration(from: Date | null, to: Date | null): number {
        return from && to ? Math.max(0, (to.getTime() - from.getTime()) / 1000) : 0;
    }

    /** Generated stop lists use consecutive sequences, preserving their source order. */
    private setSequenceNumbers() {
        this.toArray().forEach((stop, index) => { stop.sequence = index + 1; });
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
        if (this.every(stop => stop.isCancelled()))
            return new StopUpdateCollection([], this.tripId);

        return new StopUpdateCollection(this.filter(stop => !stop.isCancelled()), this.tripId);
    }

    public get destination(): string | null {
        //Get the last stop before only cancelled stops.
        const lastStopBeforeOnlyCancelledStops = this.findLastStopBeforeOnlyCancelledStops();

        if (lastStopBeforeOnlyCancelledStops)
            return lastStopBeforeOnlyCancelledStops.destination;

        //If all stops are cancelled, return the destination of the last stop.
        const lastStop = this.last();
        return lastStop?.destination ?? null;
    }
}
