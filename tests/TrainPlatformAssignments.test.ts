import { describe, expect, it } from "bun:test";
import { decodeNativeFeed } from "./nativeFeed";
import { transit_realtime } from "../src/Compiled/compiled";
import { IDatabaseRitInfoUpdate, IRitInfoStopUpdate } from "../src/Interfaces/DatabaseRitInfoUpdate";
import { ExtendedStopTimeUpdate } from "../src/Models/GTFS/StopTimeUpdate";
import { RitInfoStopUpdate } from "../src/Models/StopUpdates/RitinfoStopUpdate";
import { TrainUpdate } from "../src/Models/TrainUpdate";
import { LogicalJourneyChangeType } from "../src/Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyChangeType";
import { LogicalJourneyPartStationChangeType } from "../src/Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyPartStationChangeType";

function platformStop(overrides: Partial<IRitInfoStopUpdate> = {}): IRitInfoStopUpdate {
    return {
        stopId: 906665,
        scheduledStopId: "906665",
        scheduledStopSequence: 2,
        assignedStopId: "906866",
        sequence: 2,
        stationCode: "UT",
        name: "Utrecht Centraal",
        plannedPlatformCode: "14",
        expectedPlatformCode: "14a",
        arrivalTime: "2026-10-07T10:00:00Z",
        departureTime: "2026-10-07T10:01:00Z",
        plannedArrivalTime: "2026-10-07T10:00:00Z",
        plannedDepartureTime: "2026-10-07T10:01:00Z",
        arrivalDelay: 0,
        departureDelay: 0,
        plannedWillStop: true,
        actualWillStop: true,
        destination: "Eindhoven Centraal",
        changes: [],
        ...overrides
    };
}

function encodeStop(overrides: Partial<IRitInfoStopUpdate> = {}) {
    const stop = ExtendedStopTimeUpdate.fromStopUpdate(new RitInfoStopUpdate(platformStop(overrides)));
    const feed = transit_realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: "2.0" },
        entity: [{
            id: "train",
            tripUpdate: { trip: { tripId: "12345" }, stopTimeUpdate: [stop] }
        }]
    });
    expect(transit_realtime.FeedMessage.verify(feed)).toBeNull();
    const bytes = transit_realtime.FeedMessage.encode(feed).finish();
    return {
        nativeStop: decodeNativeFeed(bytes).entity[0].tripUpdate.stopTimeUpdate[0],
        extendedStop: transit_realtime.FeedMessage.decode(bytes).entity[0].tripUpdate.stopTimeUpdate[0]
    };
}

describe("Native train platform assignments", () => {
    // IDs from the local gtfs-iff-nl.zip; full platforms and their sections are distinct.
    for (const [platformCode, id] of [["14", "906665"], ["14a", "906866"], ["14b", "906865"]] as const) {
        it(`publishes the existing stop ID for platform ${platformCode} through the native decoder`, () => {
            const { nativeStop, extendedStop } = encodeStop({
                plannedPlatformCode: "12",
                expectedPlatformCode: platformCode,
                assignedStopId: id
            });
            expect(nativeStop.stopTimeProperties.assignedStopId).toBe(id);
            expect(nativeStop.stopId).toBe(id);
            expect(nativeStop.stopSequence).toBe(2);
            expect(nativeStop.stopTimeProperties.stopHeadsign).toBe("Eindhoven Centraal");
            const extension = extendedStop[".transit_realtime.ovapiStopTimeUpdate"];
            expect(extension.stationId).toBe("UT");
            expect(Object.hasOwn(extension, "scheduledTrack")).toBe(false);
            expect(Object.hasOwn(extension, "actualTrack")).toBe(false);
        });
    }

    it("does not claim an assignment for an unknown platform", () => {
        const { nativeStop } = encodeStop({ assignedStopId: null, expectedPlatformCode: "99" });
        expect(Object.hasOwn(nativeStop.stopTimeProperties, "assignedStopId")).toBe(false);
        expect(nativeStop.stopId).toBe("906665");
    });

    it("does not claim an assignment when no expected platform is available", () => {
        const { nativeStop } = encodeStop({ expectedPlatformCode: null, assignedStopId: null });
        expect(Object.hasOwn(nativeStop.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("does not claim an assignment when the expected platform equals the plan", () => {
        const { nativeStop } = encodeStop({ plannedPlatformCode: "14a", expectedPlatformCode: "14a", scheduledStopId: "906866" });
        expect(Object.hasOwn(nativeStop.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("uses explicit platform-change messages when the track labels are equal", () => {
        const { nativeStop } = encodeStop({
            plannedPlatformCode: "14a",
            changes: [{ changeType: LogicalJourneyPartStationChangeType.ChangedDeparturePlatform }]
        });
        expect(nativeStop.stopTimeProperties.assignedStopId).toBe("906866");
    });

    it("does not assign a platform to a skipped stop", () => {
        const { nativeStop } = encodeStop({ actualWillStop: false });
        expect(nativeStop.scheduleRelationship).toBe(transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED);
        expect(Object.hasOwn(nativeStop.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("keeps deprecated OVAPI track fields decodable in historical feeds", () => {
        const legacy = transit_realtime.OVapiStopTimeUpdate.create({
            stationId: "UT", scheduledTrack: "14", actualTrack: "14a"
        });
        const decoded = transit_realtime.OVapiStopTimeUpdate.decode(
            transit_realtime.OVapiStopTimeUpdate.encode(legacy).finish()
        );
        expect(decoded.scheduledTrack).toBe("14");
        expect(decoded.actualTrack).toBe("14a");
    });
});

function scheduledTrain(overrides: Partial<IDatabaseRitInfoUpdate> = {}): IDatabaseRitInfoUpdate {
    return {
        trainNumber: 1234, shortTrainNumber: 1234, trainType: "IC", agency: "NS",
        showsInTripPlanner: true, tripId: 12345, routeId: 1, routeType: 2,
        routeLongName: "Amsterdam - Eindhoven", agencyId: "NS", directionId: 0, shapeId: 1,
        changes: [], timestamp: new Date("2026-10-07T09:00:00Z"),
        operationDate: new Date("2026-10-07"), materialNumbers: [],
        stops: [
            platformStop({
                stopId: 100, stationCode: "ASD", name: "Amsterdam Centraal", sequence: 10,
                scheduledStopId: "100", scheduledStopSequence: 1,
                plannedPlatformCode: "1", expectedPlatformCode: "1", assignedStopId: null,
                arrivalTime: "2026-10-07T09:30:00Z", departureTime: "2026-10-07T09:31:00Z",
                plannedArrivalTime: "2026-10-07T09:30:00Z", plannedDepartureTime: "2026-10-07T09:31:00Z"
            }),
            platformStop({ sequence: 20 }),
            platformStop({
                stopId: 200, stationCode: "EHV", name: "Eindhoven Centraal", sequence: 30,
                scheduledStopId: "200", scheduledStopSequence: 3,
                plannedPlatformCode: "1", expectedPlatformCode: "1", assignedStopId: null,
                arrivalTime: "2026-10-07T10:30:00Z", departureTime: null,
                plannedArrivalTime: "2026-10-07T10:30:00Z", plannedDepartureTime: null
            })
        ],
        ...overrides
    };
}

function encodeTrain(update: IDatabaseRitInfoUpdate) {
    const train = TrainUpdate.fromRitInfoUpdate(update);
    expect(train).not.toBeNull();
    const feed = transit_realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: "2.0" }, entity: [train.toFeedEntity()]
    });
    expect(transit_realtime.FeedMessage.verify(feed)).toBeNull();
    return decodeNativeFeed(transit_realtime.FeedMessage.encode(feed).finish()).entity[0].tripUpdate;
}

describe("Train relationships with platform assignments", () => {
    const ScheduleRelationship = transit_realtime.TripDescriptor.ScheduleRelationship;

    it("keeps a platform-only change scheduled and identifies the original call by sequence", () => {
        const published = encodeTrain(scheduledTrain());
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
        expect(published.stopTimeUpdate.map(stop => stop.stopSequence)).toEqual([1, 2, 3]);
        const changedStop = published.stopTimeUpdate[1];
        expect(changedStop.stopTimeProperties.assignedStopId).toBe("906866");
        expect(Object.hasOwn(changedStop, "stopId")).toBe(false);
        expect(published.stopTimeUpdate[0].stopId).toBe("100");
        expect(published.stopTimeUpdate[2].stopId).toBe("200");
    });

    it("keeps reported platform changes scheduled even when the platform labels are equal", () => {
        for (const changeType of [
            LogicalJourneyPartStationChangeType.ChangedArrivalPlatform,
            LogicalJourneyPartStationChangeType.ChangedDeparturePlatform,
            LogicalJourneyPartStationChangeType.FixedArrivalPlatform,
            LogicalJourneyPartStationChangeType.FixedDeparturePlatform
        ]) {
            const update = scheduledTrain();
            update.stops[1].plannedPlatformCode = "14a";
            update.stops[1].changes = [{ changeType }];
            const published = encodeTrain(update);
            expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
            expect(published.stopTimeUpdate[1].stopTimeProperties.assignedStopId).toBe("906866");
            expect(Object.hasOwn(published.stopTimeUpdate[1], "stopId")).toBe(false);
        }
    });

    it("publishes delays alongside a scheduled platform assignment", () => {
        const update = scheduledTrain();
        Object.assign(update.stops[1], {
            arrivalTime: "2026-10-07T10:02:00Z", departureTime: "2026-10-07T10:03:00Z",
            arrivalDelay: 120, departureDelay: 120
        });
        const published = encodeTrain(update);
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
        expect(published.stopTimeUpdate[1].arrival.delay).toBe(120);
        expect(published.stopTimeUpdate[1].departure.delay).toBe(120);
        expect(published.stopTimeUpdate[1].stopTimeProperties.assignedStopId).toBe("906866");
    });

    it("uses imported sequences instead of InfoPlus order or array positions", () => {
        const update = scheduledTrain();
        update.stops.forEach((stop, i) => { stop.scheduledStopSequence = [5, 8, 13][i]; });
        const published = encodeTrain(update);
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
        expect(published.stopTimeUpdate.map(stop => stop.stopSequence)).toEqual([5, 8, 13]);
    });

    it("preserves the original sequences when earlier calls are absent from the update", () => {
        const update = scheduledTrain();
        update.stops.shift();
        const published = encodeTrain(update);
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
        expect(published.stopTimeUpdate.map(stop => stop.stopSequence)).toEqual([2, 3]);
        expect(published.stopTimeUpdate[0].stopTimeProperties.assignedStopId).toBe("906866");
    });

    for (const sequences of [[1, null, 3], [1, 1, 3], [3, 2, 1]]) {
        it(`uses a replacement for unmatched, duplicate or reordered calls: ${sequences}`, () => {
            const update = scheduledTrain();
            update.stops.forEach((stop, i) => { stop.scheduledStopSequence = sequences[i]; });
            const published = encodeTrain(update);
            expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.REPLACEMENT);
            expect(published.stopTimeUpdate.map(stop => stop.stopSequence)).toEqual([1, 2, 3]);
            expect(published.stopTimeUpdate[1].stopId).toBe("906866");
        });
    }

    it("assigns a platform that differs from static GTFS even when InfoPlus plan and prediction agree", () => {
        const update = scheduledTrain();
        update.stops[1].plannedPlatformCode = "14a";
        const published = encodeTrain(update);
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
        expect(published.stopTimeUpdate[1].stopTimeProperties.assignedStopId).toBe("906866");
        expect(Object.hasOwn(published.stopTimeUpdate[1], "stopId")).toBe(false);
    });

    it("uses the original static stop ID on a skipped scheduled call", () => {
        const update = scheduledTrain();
        update.stops[1].actualWillStop = false;
        update.stops[1].stopId = 906866;
        const published = encodeTrain(update);
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
        expect(published.stopTimeUpdate[1].stopId).toBe("906665");
        expect(published.stopTimeUpdate[1].scheduleRelationship).toBe(transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED);
    });

    for (const changeType of [LogicalJourneyChangeType.StopPatternChange, LogicalJourneyChangeType.Diversion]) {
        it(`retains replacement stop IDs for journey change ${changeType} alongside a platform change`, () => {
            const published = encodeTrain(scheduledTrain({ changes: [{ changeType }] }));
            expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.REPLACEMENT);
            expect(published.stopTimeUpdate[1].stopId).toBe("906866");
            expect(published.stopTimeUpdate[1].stopTimeProperties.assignedStopId).toBe("906866");
        });
    }

    it("retains replacement stop IDs when an extra stop has a platform assignment", () => {
        const update = scheduledTrain();
        update.stops[1].changes = [{ changeType: LogicalJourneyPartStationChangeType.ExtraPassing }];
        const published = encodeTrain(update);
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.REPLACEMENT);
        expect(published.stopTimeUpdate[1].stopId).toBe("906866");
    });

    it("retains replacement handling for special trains", () => {
        const published = encodeTrain(scheduledTrain({ trainNumber: 50, shortTrainNumber: 50 }));
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.REPLACEMENT);
        expect(published.stopTimeUpdate[1].stopId).toBe("906866");
    });

    it("retains stop IDs for added trips with platform assignments", () => {
        const published = encodeTrain(scheduledTrain({ changes: [{ changeType: LogicalJourneyChangeType.ExtraTrain }] }));
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.ADDED);
        expect(published.stopTimeUpdate[1].stopId).toBe("906866");
    });

    it("keeps cancellation handling when a platform change is also reported", () => {
        const published = encodeTrain(scheduledTrain({ changes: [{ changeType: LogicalJourneyChangeType.Cancelled }] }));
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.CANCELED);
        expect(published.stopTimeUpdate).toBeUndefined();
    });

    it("retains the known stop when the changed platform cannot be resolved", () => {
        const update = scheduledTrain();
        update.stops[1].expectedPlatformCode = "99";
        update.stops[1].assignedStopId = null;
        const published = encodeTrain(update);
        expect(published.trip.scheduleRelationship).toBe(ScheduleRelationship.SCHEDULED);
        expect(published.stopTimeUpdate[1].stopId).toBe("906665");
        expect(Object.hasOwn(published.stopTimeUpdate[1].stopTimeProperties, "assignedStopId")).toBe(false);
    });
});
