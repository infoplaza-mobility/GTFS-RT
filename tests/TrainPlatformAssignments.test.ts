import { describe, expect, it } from "bun:test";
import { decodeNativeFeed } from "./nativeFeed";
import { transit_realtime } from "../src/Compiled/compiled";
import { IRitInfoStopUpdate } from "../src/Interfaces/DatabaseRitInfoUpdate";
import { ExtendedStopTimeUpdate } from "../src/Models/GTFS/StopTimeUpdate";
import { RitInfoStopUpdate } from "../src/Models/StopUpdates/RitinfoStopUpdate";
import { LogicalJourneyPartStationChangeType } from "../src/Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyPartStationChangeType";

function platformStop(overrides: Partial<IRitInfoStopUpdate> = {}): IRitInfoStopUpdate {
    return {
        stopId: 906665,
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
        const { nativeStop } = encodeStop({ plannedPlatformCode: "14a", expectedPlatformCode: "14a" });
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
