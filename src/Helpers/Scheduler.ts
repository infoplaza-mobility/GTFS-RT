/**
 * Runs `task` repeatedly, starting the next run `intervalMs` after the previous run *started*,
 * but never while the previous run is still in progress (unlike setInterval).
 * Errors are logged and never escape, so one failed run cannot crash the process or stop the loop.
 *
 * @returns a function that stops the loop after the current run.
 */
export function runRepeatedly(name: string, intervalMs: number, task: () => Promise<unknown>): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
        const startedAt = Date.now();
        try {
            await task();
        } catch (error) {
            console.error(`[Scheduler] ${name} failed`, error);
        }
        if (stopped) return;
        const elapsed = Date.now() - startedAt;
        if (elapsed > intervalMs)
            console.warn(`[Scheduler] ${name} took ${elapsed} ms, longer than its ${intervalMs} ms interval.`);
        timer = setTimeout(run, Math.max(0, intervalMs - elapsed));
    };

    timer = setTimeout(run, 0);

    return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
    };
}
