import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { TVVManager } from "../src/Interfaces/TVVManager";
import { IStaticDataRepository } from "../src/Interfaces/Repositories/IStaticDataRepository";
import { IInfoPlusRepository } from "../src/Interfaces/Repositories/InfoplusRepository";

function managerReturning(tripIdsByDate: Record<string, number[]>) {
    const requestedDates: string[] = [];
    const staticData = {
        getTrainReplacementBusServiceTripShortNames: async (date: string) => { requestedDates.push(date); return [900001]; }
    } as unknown as IStaticDataRepository;
    const infoPlus = {
        getTripIdsForTVVNotInInfoPlus: async (_: number[], date: string) => tripIdsByDate[date] ?? [],
        getCurrentRealtimeTripUpdates: async () => []
    } as unknown as IInfoPlusRepository;
    return { manager: new TVVManager(staticData, infoPlus), requestedDates };
}

describe("TVVManager operation dates", () => {
    afterEach(() => setSystemTime());

    it("uses the Dutch operation date, not the UTC date, just after local midnight", async () => {
        // 00:30 in Amsterdam on 10 Nov = 23:30 UTC on 9 Nov.
        setSystemTime(new Date("2026-11-09T23:30:00Z"));
        const { manager, requestedDates } = managerReturning({ "2026-11-10": [1], "2026-11-09": [2] });
        const result = await manager.findTVVNotInInfoPlus();
        expect(requestedDates).toEqual(["2026-11-10", "2026-11-09"]);
        expect(result).toEqual([
            { tripId: 1, operationDate: "2026-11-10" },
            { tripId: 2, operationDate: "2026-11-09" }
        ]);
    });

    it("includes the next operation day from 23:00 Dutch time", async () => {
        // 23:15 in Amsterdam = 22:15 UTC (winter time).
        setSystemTime(new Date("2026-11-09T22:15:00Z"));
        const { manager, requestedDates } = managerReturning({});
        await manager.findTVVNotInInfoPlus();
        expect(requestedDates).toEqual(["2026-11-09", "2026-11-10"]);
    });

    it("removes duplicate trip/date pairs", async () => {
        setSystemTime(new Date("2026-11-09T12:00:00Z"));
        const { manager } = managerReturning({ "2026-11-09": [5, 5, 6] });
        expect(await manager.findTVVNotInInfoPlus()).toEqual([
            { tripId: 5, operationDate: "2026-11-09" },
            { tripId: 6, operationDate: "2026-11-09" }
        ]);
    });
});
