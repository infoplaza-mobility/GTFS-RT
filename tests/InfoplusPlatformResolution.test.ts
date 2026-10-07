import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import knex, { Knex } from "knex";
import { decodeNativeFeed } from "./nativeFeed";
import { transit_realtime } from "../src/Compiled/compiled";
import { InfoplusRepository } from "../src/Repositories/InfoplusRepository";
import { TrainUpdate } from "../src/Models/TrainUpdate";

// Use an empty, disposable PostgreSQL database. All fixtures are rolled back.
const databaseUrl = process.env.GTFS_RT_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

class TestInfoplusRepository extends InfoplusRepository {
    constructor(database: Knex) {
        super();
        this.database = database;
    }
}

integration("InfoPlus platform resolution to native GTFS-RT", () => {
    let client: Knex;
    let transaction: Knex.Transaction;
    let repository: InfoplusRepository;

    beforeAll(async () => {
        client = knex({ client: "pg", connection: databaseUrl });
        transaction = await client.transaction();
        repository = new TestInfoplusRepository(transaction);
        await transaction.raw(`
            CREATE SCHEMA "InfoPlus-new";
            CREATE SCHEMA "StaticData-NL";
            CREATE TABLE "InfoPlus-new".ritinfo (
                "trainNumber" int, "shortTrainNumber" int, "trainType" jsonb, agency text,
                "operationDate" date, "showsInTravelPlanner" boolean, timestamp timestamptz,
                "travelInformationProductId" text
            );
            CREATE TABLE "InfoPlus-new".logical_journeys (
                "trainNumber" int, "journeyNumber" text, "operationDate" date, "journeyChanges" jsonb
            );
            CREATE TABLE "InfoPlus-new".logical_journey_parts (
                "journeyNumber" text, "journeyPartNumber" int, "shortJourneyPartNumber" int,
                "operationDate" date, "journeyPartChanges" jsonb
            );
            CREATE TABLE "InfoPlus-new".stop_information (
                "journeyNumber" text, "journeyPartNumber" int, "operationDate" date,
                "stationCode" text, "stopType" text, "plannedWillStop" boolean, "actualWillStop" boolean,
                "plannedArrivalTime" timestamptz, "plannedDepartureTime" timestamptz,
                "actualArrivalTime" timestamptz, "actualDepartureTime" timestamptz,
                "plannedArrivalTracks" text, "plannedDepartureTracks" text,
                "actualArrivalTracks" text, "actualDepartureTracks" text, changes jsonb, "stopOrder" int
            );
            CREATE TABLE "InfoPlus-new".destinations (
                "journeyNumber" text, "journeyPartNumber" int, "operationDate" date,
                "stationCode" text, "plannedDestination" text, "actualDestination" text
            );
            CREATE TABLE "InfoPlus-new".stations ("stationCode" text, "longName" text);
            CREATE TABLE "InfoPlus-new".material_parts (
                "journeyPartNumber" int, "operationDate" date,
                "shortMaterialNumber" varchar, "travelInformationProductId" text
            );
            CREATE TABLE "StaticData-NL".iff_stops (
                "stopId" varchar, "stationCode" text, "platformCode" text, "stopName" text
            );
            CREATE TABLE "StaticData-NL".mv_active_schedule (
                "tripId" int, trip_number int, date date, first_station_code text,
                "routeId" int, "directionId" int, "shapeId" int
            );
            CREATE TABLE "StaticData-NL".stop_times (
                trip_id varchar, stop_id varchar, stop_sequence int, arrival_time varchar, departure_time varchar
            );
            CREATE TABLE "StaticData-NL".routes (
                "routeId" int, "routeType" int, "agencyId" text, "routeLongName" text
            );
            INSERT INTO "InfoPlus-new".ritinfo VALUES
                (1234, 1234, '{"code":"IC"}', 'NS', '2026-10-07', true, '2026-10-07T09:00:00Z', 'test');
            INSERT INTO "InfoPlus-new".logical_journeys VALUES (1234, 'journey', '2026-10-07', null);
            INSERT INTO "InfoPlus-new".logical_journey_parts VALUES
                ('journey', 1234, 1234, '2026-10-07', null);
            INSERT INTO "InfoPlus-new".stop_information VALUES (
                'journey', 1234, '2026-10-07', 'UT', 'X', true, true,
                '2026-10-07T10:00:00Z', '2026-10-07T10:01:00Z',
                '2026-10-07T10:00:00Z', '2026-10-07T10:01:00Z',
                '14', '14', null, '14a', null, 1
            );
            INSERT INTO "InfoPlus-new".destinations VALUES
                ('journey', 1234, '2026-10-07', 'UT', 'EHV', null);
            INSERT INTO "InfoPlus-new".stations VALUES ('EHV', 'Eindhoven Centraal');
            INSERT INTO "StaticData-NL".mv_active_schedule VALUES (12345, 1234, '2026-10-07', 'UT', 1, 0, 1);
            INSERT INTO "StaticData-NL".stop_times VALUES ('12345', '906665', 1, '12:00:00', '12:01:00');
            INSERT INTO "StaticData-NL".routes VALUES (1, 2, 'NS', 'Utrecht - Eindhoven');
        `);
    });

    beforeEach(async () => {
        await transaction.withSchema("StaticData-NL").table("stop_times").delete();
        await transaction.withSchema("StaticData-NL").table("stop_times").insert({
            trip_id: "12345", stop_id: "906665", stop_sequence: 1, arrival_time: "12:00:00", departure_time: "12:01:00"
        });
        await transaction.withSchema("StaticData-NL").table("iff_stops").delete();
        await transaction.withSchema("StaticData-NL").table("iff_stops").insert([
            { stopId: "906665", stationCode: "UT", platformCode: "14", stopName: "Utrecht Centraal" },
            { stopId: "906866", stationCode: "UT", platformCode: "14a", stopName: "Utrecht Centraal" },
            { stopId: "906865", stationCode: "UT", platformCode: "14b", stopName: "Utrecht Centraal" },
            { stopId: "999999", stationCode: "OTHER", platformCode: "99", stopName: "Other station" }
        ]);
        await setTracks({
            plannedArrivalTracks: "14", plannedDepartureTracks: "14",
            actualArrivalTracks: null, actualDepartureTracks: "14a",
            plannedArrivalTime: "2026-10-07T10:00:00Z",
            actualArrivalTime: "2026-10-07T10:00:00Z",
            plannedDepartureTime: "2026-10-07T10:01:00Z",
            actualDepartureTime: "2026-10-07T10:01:00Z",
            plannedWillStop: true, actualWillStop: true
        });
    });

    afterAll(async () => {
        await transaction?.rollback();
        await client?.destroy();
    });

    async function setTracks(values: Record<string, unknown>) {
        await transaction.withSchema("InfoPlus-new").table("stop_information").update(values);
    }

    async function readStop() {
        const rows = await repository.getCurrentRealtimeTripUpdates("2026-10-07", "2026-10-08", "2026-10-08");
        expect(rows).toHaveLength(1);
        expect(rows[0].stops).toHaveLength(1);
        const train = TrainUpdate.fromRitInfoUpdate(rows[0]);
        const feed = transit_realtime.FeedMessage.fromObject({
            header: { gtfsRealtimeVersion: "2.0" }, entity: [train.toFeedEntity()]
        });
        expect(transit_realtime.FeedMessage.verify(feed)).toBeNull();
        const decoded = decodeNativeFeed(transit_realtime.FeedMessage.encode(feed).finish());
        const tripUpdate = decoded.entity[0].tripUpdate;
        return { resolved: rows[0].stops[0], published: tripUpdate.stopTimeUpdate[0], trip: tripUpdate.trip };
    }

    for (const [track, id] of [["14", "906665"], ["14a", "906866"], ["14b", "906865"]] as const) {
        it(`resolves platform ${track} at Utrecht before publishing`, async () => {
            await setTracks({ plannedDepartureTracks: "12", actualDepartureTracks: track });
            const { resolved, published, trip } = await readStop();
            expect(resolved.assignedStopId).toBe(id);
            expect(published.stopTimeProperties.assignedStopId).toBe(id);
            expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED);
            expect(Object.hasOwn(published, "stopId")).toBe(false);
            expect(published.stopSequence).toBe(1);
        });
    }

    it("normalizes case and whitespace while retaining the section", async () => {
        await setTracks({ actualDepartureTracks: " 14B " });
        const { resolved, published } = await readStop();
        expect(resolved.plannedPlatformCode).toBe("14");
        expect(resolved.expectedPlatformCode).toBe("14b");
        expect(published.stopTimeProperties.assignedStopId).toBe("906865");
    });

    it("normalizes the plan and prediction once without inventing a platform change", async () => {
        await transaction.withSchema("StaticData-NL").table("stop_times").update({ stop_id: "906866" });
        await setTracks({ plannedDepartureTracks: " 14A ", actualDepartureTracks: "14a" });
        const { resolved, published } = await readStop();
        expect(resolved.plannedPlatformCode).toBe("14a");
        expect(resolved.expectedPlatformCode).toBe("14a");
        expect(Object.hasOwn(published.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("uses the planned platform as the expectation when realtime tracks are missing", async () => {
        await setTracks({ actualArrivalTracks: null, actualDepartureTracks: "" });
        const { resolved, published } = await readStop();
        expect(resolved.plannedPlatformCode).toBe("14");
        expect(resolved.expectedPlatformCode).toBe("14");
        expect(Object.hasOwn(published.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("uses the departure platform when arrival and departure platforms differ", async () => {
        await setTracks({ actualArrivalTracks: "14b", actualDepartureTracks: "14a" });
        const { published } = await readStop();
        expect(published.stopTimeProperties.assignedStopId).toBe("906866");
    });

    it("uses the arrival platform at a terminus", async () => {
        await setTracks({
            actualArrivalTracks: "14b", actualDepartureTracks: "14a",
            plannedDepartureTime: null, actualDepartureTime: null
        });
        const { published } = await readStop();
        expect(published.stopTimeProperties.assignedStopId).toBe("906865");
    });

    it("retains the planned stop when the expected platform is unknown at this station", async () => {
        await setTracks({ actualDepartureTracks: "99" });
        const { resolved, published } = await readStop();
        expect(resolved.assignedStopId).toBeNull();
        expect(published.stopId).toBe("906665");
        expect(Object.hasOwn(published.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("retains the static scheduled stop when no track strings are available", async () => {
        await setTracks({
            actualArrivalTracks: null, actualDepartureTracks: "",
            plannedArrivalTracks: null, plannedDepartureTracks: null
        });
        const { resolved, published } = await readStop();
        expect(resolved.assignedStopId).toBeNull();
        expect(published.stopId).toBe("906665");
        expect(Object.hasOwn(published.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("does not collapse a whole-platform assignment into either section", async () => {
        await transaction.withSchema("StaticData-NL").table("iff_stops").where("stopId", "906665").delete();
        await setTracks({ plannedDepartureTracks: "14b", actualDepartureTracks: "14" });
        const { resolved, published } = await readStop();
        expect(resolved.assignedStopId).toBeNull();
        expect(published.stopId).toBe("906865");
        expect(Object.hasOwn(published.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("does not publish an ambiguous platform assignment or duplicate the stop", async () => {
        await transaction.withSchema("StaticData-NL").table("iff_stops").insert({
            stopId: "900001", stationCode: "UT", platformCode: "14a", stopName: "Duplicate platform"
        });
        const { resolved, published } = await readStop();
        expect(resolved.assignedStopId).toBeNull();
        expect(published.stopId).toBe("906665");
        expect(Object.hasOwn(published.stopTimeProperties, "assignedStopId")).toBe(false);
    });

    it("publishes the imported sequence instead of the InfoPlus order", async () => {
        await transaction.withSchema("StaticData-NL").table("stop_times").update({ stop_sequence: 23 });
        const { resolved, published, trip } = await readStop();
        expect(resolved.sequence).toBe(1);
        expect(resolved.scheduledStopId).toBe("906665");
        expect(resolved.scheduledStopSequence).toBe(23);
        expect(published.stopSequence).toBe(23);
        expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED);
    });

    it("matches repeated station visits by planned time independently of the expected platform", async () => {
        await transaction.withSchema("StaticData-NL").table("stop_times").update({ departure_time: "09:01:00" });
        await transaction.withSchema("StaticData-NL").table("stop_times").insert({
            trip_id: "12345", stop_id: "906865", stop_sequence: 5, arrival_time: "12:00:00", departure_time: "12:01:00"
        });
        const { resolved, published, trip } = await readStop();
        expect(resolved.scheduledStopId).toBe("906865");
        expect(published.stopSequence).toBe(5);
        expect(published.stopTimeProperties.assignedStopId).toBe("906866");
        expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED);
    });

    for (const departureTime of ["13:01:00", "12:01:00"]) {
        it(`does not choose an ambiguous or unmatched repeated visit (${departureTime})`, async () => {
            await transaction.withSchema("StaticData-NL").table("stop_times").update({ departure_time: departureTime });
            await transaction.withSchema("StaticData-NL").table("stop_times").insert({
                trip_id: "12345", stop_id: "906865", stop_sequence: 5,
                arrival_time: "12:00:00", departure_time: departureTime
            });
            const { resolved, published, trip } = await readStop();
            expect(resolved.scheduledStopId).toBeNull();
            expect(resolved.scheduledStopSequence).toBeNull();
            expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.REPLACEMENT);
            expect(published.stopId).toBe("906866");
        });
    }

    it("matches GTFS times beyond 24 hours using the operation date and Dutch local time", async () => {
        await transaction.withSchema("StaticData-NL").table("stop_times").insert({
            trip_id: "12345", stop_id: "906865", stop_sequence: 7, arrival_time: "26:00:00", departure_time: "26:01:00"
        });
        await setTracks({
            plannedArrivalTime: "2026-10-08T00:00:00Z", actualArrivalTime: "2026-10-08T00:00:00Z",
            plannedDepartureTime: "2026-10-08T00:01:00Z", actualDepartureTime: "2026-10-08T00:01:00Z"
        });
        const { published, trip } = await readStop();
        expect(published.stopSequence).toBe(7);
        expect(trip.startDate).toBe("20261007");
        expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED);
    });

    it("assigns the expected platform when the InfoPlus plan differs from static GTFS", async () => {
        await setTracks({ plannedDepartureTracks: "14a", actualDepartureTracks: "14a" });
        const { resolved, published, trip } = await readStop();
        expect(resolved.scheduledStopId).toBe("906665");
        expect(published.stopTimeProperties.assignedStopId).toBe("906866");
        expect(Object.hasOwn(published, "stopId")).toBe(false);
        expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED);
    });

    it("uses a replacement when the station is not part of the matched static trip", async () => {
        await transaction.withSchema("StaticData-NL").table("stop_times").update({ stop_id: "999999" });
        const { resolved, trip } = await readStop();
        expect(resolved.scheduledStopSequence).toBeNull();
        expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.REPLACEMENT);
    });

    it("retains the original GTFS identity for a skipped scheduled call", async () => {
        await setTracks({ actualWillStop: false });
        const { published, trip } = await readStop();
        expect(trip.scheduleRelationship).toBe(transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED);
        expect(published.stopId).toBe("906665");
        expect(published.stopSequence).toBe(1);
        expect(published.scheduleRelationship).toBe(transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED);
    });
});
