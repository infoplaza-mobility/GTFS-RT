import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { once } from "events";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { AddressInfo } from "net";
import { tmpdir } from "os";
import { join } from "path";
import { transit_realtime } from "../src/Compiled/compiled";
import { createApp } from "../src/Http/createApp";
import { IDatabaseRitInfoUpdate } from "../src/Interfaces/DatabaseRitInfoUpdate";
import { IInfoPlusRepository } from "../src/Interfaces/Repositories/InfoplusRepository";
import { evaluateTrainFeedHealth } from "../src/Models/TrainFeedHealth";
import { FeedManager } from "../src/Services/FeedManager";
import { LogicalJourneyChangeType } from "../src/Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyChangeType";
import { decodeNativeFeed } from "./nativeFeed";

const sourceTimestamp = new Date("2026-10-07T09:00:00Z");

function ritInfoUpdates(count: number, cancelledCount = 0): IDatabaseRitInfoUpdate[] {
    return Array.from({ length: count }, (_, i) => ({
        trainNumber: 1234, shortTrainNumber: 1234, trainType: "IC", agency: "NS",
        showsInTripPlanner: true, tripId: 12345 + i, routeId: 1, routeType: 2,
        routeLongName: "Utrecht - Eindhoven", agencyId: "NS", directionId: 0, shapeId: 1,
        changes: i < cancelledCount ? [{ changeType: LogicalJourneyChangeType.Cancelled }] : [],
        timestamp: sourceTimestamp, operationDate: new Date("2026-10-07"), materialNumbers: [],
        stops: [
            {
                stopId: 906665, sequence: 1, stationCode: "UT", name: "Utrecht Centraal",
                scheduledStopId: "906665", scheduledStopSequence: 1,
                plannedPlatformCode: "14", expectedPlatformCode: "14", assignedStopId: "906665",
                arrivalTime: "2026-10-07T10:00:00Z", departureTime: "2026-10-07T10:01:00Z",
                plannedArrivalTime: "2026-10-07T10:00:00Z", plannedDepartureTime: "2026-10-07T10:01:00Z",
                arrivalDelay: 0, departureDelay: 0, plannedWillStop: true, actualWillStop: true,
                destination: "Eindhoven Centraal", changes: []
            }
        ]
    }));
}

function feedWithUpdates(count: number, cancelledCount = 0): transit_realtime.FeedMessage {
    return transit_realtime.FeedMessage.create({
        header: { gtfsRealtimeVersion: "2.0" },
        entity: Array.from({ length: count }, (_, i) => ({
            id: `${i}`,
            tripUpdate: {
                trip: {
                    tripId: `${i}`,
                    scheduleRelationship: i < cancelledCount
                        ? transit_realtime.TripDescriptor.ScheduleRelationship.CANCELED
                        : transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED
                }
            }
        }))
    });
}

describe("Train feed health", () => {
    it("uses the latest source timestamp and counts the input separately from the output", () => {
        const updates = ritInfoUpdates(200, 199);
        updates[10].timestamp = new Date("2026-10-07T09:05:00Z");
        const health = evaluateTrainFeedHealth(updates, feedWithUpdates(250, 249), new Date("2026-10-07T09:06:00Z"));
        expect(health).toEqual({
            status: "healthy", lastUpdatedAt: "2026-10-07T09:05:00.000Z",
            lastGeneratedAt: "2026-10-07T09:06:00.000Z", updateCount: 250,
            cancelledUpdateCount: 249, ritInfoUpdateCount: 200, activeRitInfoUpdateCount: 1,
            reasons: []
        });
    });

    it("does not count synthetic cancellations toward the 200 RitInfo minimum", () => {
        const health = evaluateTrainFeedHealth(ritInfoUpdates(199), feedWithUpdates(300, 101), new Date());
        expect(health.status).toBe("unhealthy");
        expect(health.reasons).toContain("insufficient_ritinfo_updates");
    });

    it("is unhealthy without RitInfo even if the feed contains many cancellations", () => {
        const health = evaluateTrainFeedHealth([], feedWithUpdates(250, 250), new Date());
        expect(health.status).toBe("unhealthy");
        expect(health.lastUpdatedAt).toBeNull();
        expect(health.reasons).toEqual(["no_ritinfo_updates", "no_active_updates"]);
    });

    it("is unhealthy when all RitInfo updates are cancelled", () => {
        const health = evaluateTrainFeedHealth(ritInfoUpdates(200, 200), feedWithUpdates(200, 200), new Date());
        expect(health.status).toBe("unhealthy");
        expect(health.activeRitInfoUpdateCount).toBe(0);
        expect(health.reasons).toContain("only_cancelled_ritinfo_updates");
    });

    it("is unhealthy when the generated feed contains no active updates", () => {
        const health = evaluateTrainFeedHealth(ritInfoUpdates(200), feedWithUpdates(200, 200), new Date());
        expect(health.status).toBe("unhealthy");
        expect(health.reasons).toEqual(["no_active_updates"]);
    });

    it("is unhealthy for an empty feed", () => {
        const health = evaluateTrainFeedHealth([], feedWithUpdates(0), new Date());
        expect(health.status).toBe("unhealthy");
        expect(health.updateCount).toBe(0);
    });
});

describe("FeedManager health state", () => {
    let updates: IDatabaseRitInfoUpdate[] = [];
    let queryError: Error | null = null;
    const repository: IInfoPlusRepository = {
        getCurrentRealtimeTripUpdates: async () => {
            if (queryError) throw queryError;
            return updates;
        },
        getTripIdsForTVVNotInInfoPlus: async () => []
    };
    const manager = FeedManager.getInstance(repository);
    let writer: ReturnType<typeof spyOn>;

    afterEach(() => writer?.mockRestore());

    it("starts unhealthy before the first feed is generated", () => {
        expect(manager.getHealth().status).toBe("unhealthy");
        expect(manager.getHealth().lastGeneratedAt).toBeNull();
        expect(manager.getHealth().reasons).toEqual(["not_generated"]);
    });

    it("reports the count of the actual published feed, including synthetic cancellations", async () => {
        updates = ritInfoUpdates(200);
        writer = spyOn(Bun, "write").mockResolvedValue(1);
        await manager.updateTrainFeed([{ tripId: 999999, operationDate: "2026-10-07" }]);
        const health = manager.getHealth();
        expect(health.status).toBe("healthy");
        expect(health.ritInfoUpdateCount).toBe(200);
        expect(health.updateCount).toBe(201);
        expect(health.cancelledUpdateCount).toBe(1);
        expect(health.lastUpdatedAt).toBe(sourceTimestamp.toISOString());
        expect(health.lastGeneratedAt).not.toBeNull();
        expect(writer).toHaveBeenCalledTimes(2);
        const published = decodeNativeFeed(writer.mock.calls[0][1] as Uint8Array);
        expect(published.entity).toHaveLength(health.updateCount);
    });

    it("marks query and write failures unhealthy, retains the last successful metadata, and recovers", async () => {
        updates = ritInfoUpdates(200);
        writer = spyOn(Bun, "write").mockResolvedValue(1);
        await manager.updateTrainFeed([]);
        const successful = manager.getHealth();

        queryError = new Error("test query failure");
        await manager.updateTrainFeed([]);
        expect(manager.getHealth()).toEqual({ ...successful, status: "unhealthy", reasons: ["refresh_failed"] });
        queryError = null;

        writer.mockRejectedValue(new Error("test write failure"));
        await manager.updateTrainFeed([]);
        expect(manager.getHealth()).toEqual({ ...successful, status: "unhealthy", reasons: ["refresh_failed"] });

        writer.mockResolvedValue(1);
        await manager.updateTrainFeed([]);
        expect(manager.getHealth().status).toBe("healthy");
        expect(manager.getHealth().reasons).toEqual([]);
    });

    it("does not report success before the feed writes complete", async () => {
        updates = ritInfoUpdates(199);
        const previousHealth = manager.getHealth();
        let finishWrite: (bytes: number) => void;
        let startedWrite: () => void;
        const pendingWrite = new Promise<number>(resolve => { finishWrite = resolve; });
        const writeStarted = new Promise<void>(resolve => { startedWrite = resolve; });
        writer = spyOn(Bun, "write").mockImplementation(() => {
            startedWrite();
            return pendingWrite;
        });
        const refresh = manager.updateTrainFeed([]);
        await writeStarted;
        expect(manager.getHealth()).toEqual(previousHealth);
        finishWrite(1);
        await refresh;
        expect(manager.getHealth().status).toBe("unhealthy");
        expect(manager.getHealth().ritInfoUpdateCount).toBe(199);
    });
});

describe("GET /health", () => {
    let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
    let directory: string;

    afterAll(async () => {
        if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        if (directory) await rm(directory, { recursive: true, force: true });
    });

    it("returns uncached JSON with HTTP 200 or 503 and still serves feed files", async () => {
        directory = await mkdtemp(join(tmpdir(), "gtfs-rt-health-"));
        await writeFile(join(directory, "trainUpdates.pb"), "test feed");
        let health = evaluateTrainFeedHealth(ritInfoUpdates(200), feedWithUpdates(200), new Date());
        const app = createApp({ getHealth: () => health, updateTrainFeed: async () => {} }, directory);
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        const healthyResponse = await fetch(`${url}/health`);
        expect(healthyResponse.status).toBe(200);
        expect(healthyResponse.headers.get("cache-control")).toBe("no-store");
        expect(await healthyResponse.json()).toEqual(health);

        health = evaluateTrainFeedHealth(ritInfoUpdates(199), feedWithUpdates(300, 101), new Date());
        const unhealthyResponse = await fetch(`${url}/health`);
        expect(unhealthyResponse.status).toBe(503);
        expect(await unhealthyResponse.json()).toEqual(health);

        const feedResponse = await fetch(`${url}/trainUpdates.pb`);
        expect(feedResponse.status).toBe(200);
        expect(await feedResponse.text()).toBe("test feed");
    });
});
