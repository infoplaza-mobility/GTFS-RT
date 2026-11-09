import { describe, expect, it } from "bun:test";
import { shouldRestart } from "../src/Helpers/Watchdog";
import { TrainFeedHealth } from "../src/Models/TrainFeedHealth";

const minutes = (n: number) => n * 60_000;
const health = (lastGeneratedAt: string | null): TrainFeedHealth => ({
    status: "healthy", lastUpdatedAt: null, lastGeneratedAt, updateCount: 0, cancelledUpdateCount: 0,
    ritInfoUpdateCount: 0, activeRitInfoUpdateCount: 0, reasons: []
});

describe("Watchdog", () => {
    const start = Date.parse("2026-11-09T05:00:00Z");

    it("does not restart while feeds are published", () => {
        expect(shouldRestart(health("2026-11-09T05:59:00Z"), start, Date.parse("2026-11-09T06:00:00Z"), minutes(10))).toBe(false);
    });

    it("restarts when the last feed is older than the limit", () => {
        expect(shouldRestart(health("2026-11-09T05:49:00Z"), start, Date.parse("2026-11-09T06:00:00Z"), minutes(10))).toBe(true);
    });

    it("gives a fresh process the full limit to publish its first feed", () => {
        expect(shouldRestart(health(null), start, start + minutes(9), minutes(10))).toBe(false);
        expect(shouldRestart(health(null), start, start + minutes(11), minutes(10))).toBe(true);
    });
});
