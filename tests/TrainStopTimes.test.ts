import { describe, expect, it } from "bun:test";
import { IDatabaseRitInfoUpdate, IRitInfoStopUpdate } from "../src/Interfaces/DatabaseRitInfoUpdate";
import { Delay } from "../src/Models/Delay";
import { RitInfoStopUpdate } from "../src/Models/StopUpdates/RitinfoStopUpdate";
import { StopUpdateCollection } from "../src/Models/StopUpdateCollection";
import { TrainUpdate } from "../src/Models/TrainUpdate";
import { TrainUpdateCollection } from "../src/Models/TrainUpdateCollection";
import { TripMerger } from "../src/Helpers/TripMerger";
import { transit_realtime } from "../src/Compiled/compiled";
import { decodeNativeFeed } from "./nativeFeed";
import { LogicalJourneyChangeType as JourneyChange } from "../src/Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyChangeType";
import { LogicalJourneyPartStationChangeType as StopChange } from "../src/Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyPartStationChangeType";

const time = (clock: string) => `2026-10-07T${clock}Z`;
const seconds = (clock: string) => Date.parse(time(clock)) / 1000;

function call(stationCode: string, arrival: string, departure: string, overrides: Partial<IRitInfoStopUpdate> = {}): IRitInfoStopUpdate {
    return {
        stopId: 100, scheduledStopId: "100", scheduledStopSequence: 1, assignedStopId: null,
        sequence: 1, stationCode, name: stationCode, plannedPlatformCode: "1", expectedPlatformCode: "1",
        arrivalTime: arrival ? time(arrival) : null, departureTime: departure ? time(departure) : null,
        plannedArrivalTime: arrival ? time(arrival) : null, plannedDepartureTime: departure ? time(departure) : null,
        arrivalDelay: 0, departureDelay: 0, plannedWillStop: true, actualWillStop: true,
        destination: "C", changes: [], ...overrides
    };
}

function trip(stops: IRitInfoStopUpdate[], overrides: Partial<IDatabaseRitInfoUpdate> = {}): IDatabaseRitInfoUpdate {
    return {
        trainNumber: 1130, shortTrainNumber: 1130, trainType: "IC", agency: "NS",
        showsInTripPlanner: true, tripId: 12345, routeId: 1, routeType: 2, routeLongName: "A - C",
        agencyId: "NS", directionId: 0, shapeId: 1, changes: [], materialNumbers: [],
        timestamp: new Date(time("09:00:00")), operationDate: new Date("2026-10-07"),
        stops: stops.map((stop, i) => ({ ...stop, sequence: i + 1, scheduledStopSequence: i + 1 })),
        ...overrides
    };
}

function publish(update: IDatabaseRitInfoUpdate) {
    const train = TrainUpdate.fromRitInfoUpdate(update);
    const feed = transit_realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: "2.0" }, entity: [train.toFeedEntity()]
    });
    expect(transit_realtime.FeedMessage.verify(feed)).toBeNull();
    return decodeNativeFeed(transit_realtime.FeedMessage.encode(feed).finish()).entity[0].tripUpdate;
}

describe("Train timestamp authority and fallbacks", () => {
    it("keeps actual timestamps and derives delays from them, even when reported delays disagree", () => {
        const published = publish(trip([
            call("A", null, "08:00:00"),
            call("B", "08:10:00", "08:11:00", {
                arrivalTime: time("08:12:00"), departureTime: time("08:13:00"),
                arrivalDelay: "00:45:00", departureDelay: "-00:05:00"
            }),
            call("C", "08:20:00", null)
        ]));
        expect(published.stopTimeUpdate[1].arrival).toMatchObject({ time: seconds("08:12:00"), delay: 120 });
        expect(published.stopTimeUpdate[1].departure).toMatchObject({ time: seconds("08:13:00"), delay: 120 });
    });

    it("does not silently repair timestamps in getters", () => {
        const stop = new RitInfoStopUpdate(call("B", "08:10:00", "08:11:00", { departureTime: time("08:09:00") }));
        expect(stop.departureTime).toBe(seconds("08:09:00"));
    });

    it("uses the arrival's own delay only when its actual time is missing", () => {
        const stop = new RitInfoStopUpdate(call("B", "08:10:00", "08:11:00", {
            arrivalTime: null, arrivalDelay: "00:02:00", departureDelay: "00:05:00"
        }));
        expect(stop.arrivalTime).toBe(seconds("08:12:00"));
    });

    it("uses the departure's delay when its actual time is missing", () => {
        const stop = new RitInfoStopUpdate(call("B", "08:10:00", "08:11:00", {
            departureTime: null, departureDelay: "00:03:00"
        }));
        expect(stop.departureTime).toBe(seconds("08:14:00"));
    });

    it("accepts epoch seconds and discards invalid dates without inventing a 1970 event", () => {
        const stop = new RitInfoStopUpdate(call("B", null, null, {
            arrivalTime: seconds("08:10:00"), departureTime: "invalid", arrivalDelay: null, departureDelay: null
        }));
        expect(stop.arrivalTime).toBe(seconds("08:10:00"));
        expect(stop.departureTime).toBe(seconds("08:10:00"));
        const missing = new RitInfoStopUpdate(call("C", null, null));
        expect(missing.arrivalTimeAsDate).toBeNull();
        expect(missing.departureTimeAsDate).toBeNull();
    });

    for (const [input, result] of [["-00:01:30", -90], ["00:00:12.9", 12], ["25:01:30", 90090], ["invalid", 0]] as const) {
        it(`parses interval ${input} without reversing early departures or emitting NaN`, () => {
            expect(new Delay(input).toSeconds()).toBe(result);
        });
    }
});

describe("Train chronological repairs", () => {
    it("repairs the captured Breda/Rotterdam contradiction and updates both event delays", () => {
        const input = trip([
            call("BD", "08:21:00", "08:23:00", { departureTime: time("09:46:00") }),
            call("RTD", "08:44:00", "08:49:00"),
            call("DT", "08:59:00", null)
        ]);
        const original = structuredClone(input);
        const published = publish(input);
        expect(input).toEqual(original);
        expect(published.stopTimeUpdate[0].departure.time).toBe(seconds("09:46:00"));
        expect(published.stopTimeUpdate[1].arrival).toMatchObject({ time: seconds("10:07:00"), delay: 4980 });
        expect(published.stopTimeUpdate[1].departure).toMatchObject({ time: seconds("10:12:00"), delay: 4980 });
        expect(published.stopTimeUpdate[2].arrival.time).toBe(seconds("10:22:00"));
    });

    it("repairs the first dwell and rechecks dwell after changing an arrival", () => {
        const stops = new StopUpdateCollection([
            new RitInfoStopUpdate(call("A", "08:00:00", "08:01:00", { arrivalTime: time("08:05:00") })),
            new RitInfoStopUpdate(call("B", "08:10:00", "08:11:00", { arrivalTime: time("08:04:00") }))
        ]);
        expect(stops.get(0).departureTime).toBe(seconds("08:06:00"));
        expect(stops.get(1).arrivalTime).toBe(seconds("08:15:00"));
        expect(stops.get(1).departureTime).toBe(seconds("08:16:00"));
        expect(stops.get(1).arrivalDelay).toBe(300);
        expect(stops.get(1).departureDelay).toBe(300);
    });

    it("allows zero dwell and handles missing or negative planned durations", () => {
        const stops = new StopUpdateCollection([
            new RitInfoStopUpdate(call("A", "08:00:00", "08:00:00", { departureTime: time("07:59:00") })),
            new RitInfoStopUpdate(call("B", "07:59:00", "07:58:00")),
            new RitInfoStopUpdate(call("C", null, null, { arrivalTime: time("07:00:00"), departureTime: time("07:00:00") }))
        ]);
        expect(stops.toArray().map(stop => [stop.arrivalTime, stop.departureTime])).toEqual([
            [seconds("08:00:00"), seconds("08:00:00")],
            [seconds("08:00:00"), seconds("08:00:00")],
            [seconds("08:00:00"), seconds("08:00:00")]
        ]);
    });

    it("keeps valid times, stop order and static sequences across a skipped call", () => {
        const input = trip([
            call("A", null, "08:00:00"),
            call("SKIP", "09:00:00", "09:01:00", { actualWillStop: false }),
            call("C", "08:20:00", null)
        ]);
        const published = publish(input);
        expect(published.stopTimeUpdate.map(stop => stop.stopSequence)).toEqual([1, 2, 3]);
        expect(published.stopTimeUpdate[1].scheduleRelationship).toBe(transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED);
        expect(published.stopTimeUpdate[1].arrival).toBeUndefined();
        expect(published.stopTimeUpdate[1].departure).toBeUndefined();
        expect(published.stopTimeUpdate[2].arrival.time).toBe(seconds("08:20:00"));
    });

    it("handles a changed terminus after earlier cancelled calls without moving its actual arrival", () => {
        const stops = new StopUpdateCollection([
            call("SKIP", "09:05:00", "09:08:00", { actualWillStop: false }),
            call("END", "09:12:00", "09:13:00", {
                arrivalTime: time("08:30:00"), changes: [{ changeType: StopChange.CancelledDeparture }]
            })
        ].map(stop => new RitInfoStopUpdate(stop)));
        expect(stops.get(1).arrivalTime).toBe(seconds("08:30:00"));
        expect(stops.get(1).departureTime).toBe(seconds("08:30:00"));
    });

    for (const changeType of [JourneyChange.Diversion, JourneyChange.ExtraTrain]) {
        it(`omits skipped calls from a complete new pattern (${changeType})`, () => {
            const published = publish(trip([
                call("A", null, "08:00:00"),
                call("SKIP", "07:00:00", "07:01:00", { actualWillStop: false }),
                call("C", "08:20:00", null)
            ], { changes: [{ changeType }] }));
            expect(published.stopTimeUpdate).toHaveLength(2);
            expect(published.stopTimeUpdate.map(stop => stop.stopSequence)).toEqual([1, 2]);
            expect(published.stopTimeUpdate[1].arrival.time).toBe(seconds("08:20:00"));
        });
    }
});

describe("Merged trip timestamp ownership", () => {
    it("publishes each trip once when the departing continuation appears earlier in the database result", () => {
        const first = trip([call("A", null, "08:00:00"), call("B", "08:10:00", null)], {
            trainNumber: 2200, shortTrainNumber: 2200, tripId: 2200, materialNumbers: ["1234"]
        });
        const second = trip([call("B", null, "08:11:00"), call("C", "08:20:00", null)], {
            trainNumber: 1100, shortTrainNumber: 1100, tripId: 1100, materialNumbers: ["1234"]
        });
        const merged = TripMerger.mergeTrips([second, first]);
        expect(merged).toHaveLength(2);
        expect(merged.filter(row => row.tripId === 1100)).toHaveLength(1);
        expect(merged.find(row => row.tripId === 1100).changes).toContainEqual({ changeType: JourneyChange.Cancelled });
    });

    it("keeps both served halves when a cancelled terminus joins a new origin", () => {
        const first = trip([call("A", null, "08:00:00"), call("B", "08:10:00", null, {
            changes: [{ changeType: StopChange.CancelledDeparture }]
        })], { trainNumber: 1100, shortTrainNumber: 1100, materialNumbers: ["1234"] });
        const second = trip([call("B", null, "08:11:00", {
            changes: [{ changeType: StopChange.CancelledArrival }]
        }), call("C", "08:20:00", null)], {
            trainNumber: 2200, shortTrainNumber: 2200, tripId: 67890, materialNumbers: ["1234"]
        });
        const [merged] = TripMerger.mergeTrips([first, second]);
        const connection = publish(merged).stopTimeUpdate[1];
        expect(connection.arrival.time).toBe(seconds("08:10:00"));
        expect(connection.departure.time).toBe(seconds("08:11:00"));
        expect(connection.scheduleRelationship).toBe(transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED);
    });

    it("keeps valid short hops and does not mutate either source trip", () => {
        const first = trip([call("A", null, "08:00:00"), call("B", "08:10:00", null)], {
            trainNumber: 1100, shortTrainNumber: 1100, materialNumbers: ["1234"]
        });
        const second = trip([call("B", null, "08:11:00"), call("C", "08:11:20", null)], {
            trainNumber: 2200, shortTrainNumber: 2200, tripId: 67890, materialNumbers: ["1234"]
        });
        const original = structuredClone([first, second]);
        const [merged] = TripMerger.mergeTrips([first, second]);
        expect([first, second]).toEqual(original);
        expect(publish(merged).stopTimeUpdate[2].arrival.time).toBe(seconds("08:11:20"));
    });
});

describe("Train feed instance identity", () => {
    it("keeps different operation dates distinct and uses the latest duplicate update on the same date", () => {
        const first = trip([call("A", null, "08:00:00"), call("B", "08:10:00", null)]);
        first.timestamp = new Date(time("09:00:00.200"));
        const newer = structuredClone(first);
        newer.timestamp = new Date(time("09:00:00.231"));
        newer.stops[0].departureTime = time("08:01:00");
        const tomorrow = structuredClone(first);
        tomorrow.operationDate = new Date("2026-10-08");
        const feed = TrainUpdateCollection.fromDatabaseResult([newer, first, tomorrow]).toFeedMessage();
        expect(feed.entity).toHaveLength(2);
        expect(new Set(feed.entity.map(entity => entity.id)).size).toBe(2);
        const today = feed.entity.find(entity => entity.tripUpdate.trip.startDate === "20261007");
        expect(Number(today.tripUpdate.stopTimeUpdate[0].departure.time)).toBe(seconds("08:01:00"));
    });
});
