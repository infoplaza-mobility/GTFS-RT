import { transit_realtime } from "../Compiled/compiled";
import { IDatabaseRitInfoUpdate } from "../Interfaces/DatabaseRitInfoUpdate";
import { LogicalJourneyChangeType } from "../Shared/src/Types/Infoplus/V2/Changes/LogicalJourneyChangeType";

export interface TrainFeedHealth {
    status: "healthy" | "unhealthy";
    /** Latest RitInfo source timestamp in the last successfully generated feed. */
    lastUpdatedAt: string | null;
    /** Time at which the feed files were last successfully written. */
    lastGeneratedAt: string | null;
    updateCount: number;
    cancelledUpdateCount: number;
    /** Source updates before trip merging and synthetic cancellations. */
    ritInfoUpdateCount: number;
    activeRitInfoUpdateCount: number;
    reasons: string[];
}

export function evaluateTrainFeedHealth(
    ritInfoUpdates: IDatabaseRitInfoUpdate[],
    feed: transit_realtime.FeedMessage,
    generatedAt: Date
): TrainFeedHealth {
    let latestTimestamp: number | null = null;
    let activeRitInfoUpdateCount = 0;
    for (const update of ritInfoUpdates) {
        const timestamp = update.timestamp.getTime();
        if (latestTimestamp === null || timestamp > latestTimestamp)
            latestTimestamp = timestamp;
        if (!update.changes?.some(change => change.changeType == LogicalJourneyChangeType.Cancelled))
            activeRitInfoUpdateCount++;
    }

    const updateCount = feed.entity.length;
    const cancelledUpdateCount = feed.entity.filter(entity =>
        entity.tripUpdate?.trip?.scheduleRelationship === transit_realtime.TripDescriptor.ScheduleRelationship.CANCELED
    ).length;
    const reasons: string[] = [];
    if (ritInfoUpdates.length === 0)
        reasons.push("no_ritinfo_updates");
    else if (ritInfoUpdates.length < 200)
        reasons.push("insufficient_ritinfo_updates");
    if (ritInfoUpdates.length > 0 && activeRitInfoUpdateCount === 0)
        reasons.push("only_cancelled_ritinfo_updates");
    if (updateCount === cancelledUpdateCount)
        reasons.push("no_active_updates");

    return {
        status: reasons.length === 0 ? "healthy" : "unhealthy",
        lastUpdatedAt: latestTimestamp === null ? null : new Date(latestTimestamp).toISOString(),
        lastGeneratedAt: generatedAt.toISOString(),
        updateCount,
        cancelledUpdateCount,
        ritInfoUpdateCount: ritInfoUpdates.length,
        activeRitInfoUpdateCount,
        reasons
    };
}
