import { TrainFeedHealth } from "../Models/TrainFeedHealth";

/**
 * True when the generator has not published a feed for longer than `maxStaleMs`
 * (or never published one within `maxStaleMs` of starting). The process should then exit so the
 * container restart policy replaces it: a hung generator must not stay "Up" for hours.
 */
export function shouldRestart(health: TrainFeedHealth, startedAt: number, now: number, maxStaleMs: number): boolean {
    const reference = health.lastGeneratedAt ? Date.parse(health.lastGeneratedAt) : startedAt;
    return Number.isFinite(reference) && now - reference > maxStaleMs;
}

export function startWatchdog(getHealth: () => TrainFeedHealth, maxStaleMs: number, checkEveryMs = 60_000): void {
    const startedAt = Date.now();
    setInterval(() => {
        const health = getHealth();
        if (shouldRestart(health, startedAt, Date.now(), maxStaleMs)) {
            console.error(`[Watchdog] No train feed published for more than ${Math.round(maxStaleMs / 60_000)} minutes (last: ${health.lastGeneratedAt ?? "never"}). Exiting so the container is restarted.`);
            process.exit(1);
        }
    }, checkEveryMs).unref();
}
