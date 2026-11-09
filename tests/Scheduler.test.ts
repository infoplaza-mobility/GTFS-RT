import { describe, expect, it } from "bun:test";
import { runRepeatedly } from "../src/Helpers/Scheduler";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("runRepeatedly", () => {
    it("never runs a task while the previous run is still in progress", async () => {
        let running = 0;
        let maxConcurrent = 0;
        let runs = 0;
        const stop = runRepeatedly("test", 5, async () => {
            running++;
            maxConcurrent = Math.max(maxConcurrent, running);
            runs++;
            await sleep(25); // much slower than the interval
            running--;
        });
        await sleep(120);
        stop();
        expect(runs).toBeGreaterThan(1);
        expect(maxConcurrent).toBe(1);
    });

    it("keeps running after a task throws or rejects", async () => {
        let runs = 0;
        const stop = runRepeatedly("test", 5, async () => {
            runs++;
            throw new Error("test failure");
        });
        await sleep(60);
        stop();
        expect(runs).toBeGreaterThan(2);
    });

    it("starts the first run immediately and stops when asked", async () => {
        let runs = 0;
        const stop = runRepeatedly("test", 10_000, async () => { runs++; });
        await sleep(20);
        stop();
        expect(runs).toBe(1);
        await sleep(20);
        expect(runs).toBe(1);
    });
});
