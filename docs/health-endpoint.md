# Train feed health

`GET /health` on the existing HTTP server (port 9595) returns JSON with HTTP
200 when healthy and HTTP 503 when unhealthy. Responses use
`Cache-Control: no-store`.

```json
{
  "status": "healthy",
  "lastUpdatedAt": "2026-10-07T09:00:00.000Z",
  "lastGeneratedAt": "2026-10-07T09:00:10.000Z",
  "updateCount": 250,
  "cancelledUpdateCount": 50,
  "ritInfoUpdateCount": 210,
  "activeRitInfoUpdateCount": 200,
  "reasons": []
}
```

`lastUpdatedAt` is the newest RitInfo source timestamp in the last successfully
generated feed, or null when that feed has no RitInfo input. `lastGeneratedAt`
is the time at which both feed files finished writing successfully, or null
before the first successful publication. Timestamps are ISO 8601 in UTC.

`updateCount` counts the entities in the published train feed, including
synthetic cancellation records. `cancelledUpdateCount` counts its cancelled
trip updates. `ritInfoUpdateCount` counts the source trip updates returned by
the existing RitInfo query before merging trips or adding synthetic
cancellations. `activeRitInfoUpdateCount` excludes source trips marked
cancelled. Stops within a trip are not counted individually.

The service is unhealthy when:

- No feed has been generated yet (`not_generated`).
- A query, conversion, or file write fails (`refresh_failed`).
- The feed has no RitInfo input (`no_ritinfo_updates`).
- The input has fewer than 200 RitInfo updates (`insufficient_ritinfo_updates`).
- All RitInfo input updates are cancelled (`only_cancelled_ritinfo_updates`).
- The generated feed is empty or contains only cancellations (`no_active_updates`).

Exactly 200 RitInfo updates satisfy the minimum. At least one must be active,
and the generated feed must contain an active update. Synthetic cancellations
cannot satisfy the RitInfo minimum. The count includes all dates selected by
the existing feed query.

After a failed refresh, the endpoint retains the last successful timestamps
and counts while returning `refresh_failed` and HTTP 503. The next successful
refresh reevaluates health. The endpoint uses the in-memory feed metadata and
does not query the database per request. Timestamp age is reported but does
not introduce an additional health threshold.
