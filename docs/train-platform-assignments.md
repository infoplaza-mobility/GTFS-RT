# Train platform assignments

Train platform changes are published using the native GTFS Realtime field
`TripUpdate.StopTimeUpdate.stop_time_properties.assigned_stop_id`.
The value is an existing `stop_id` from the corresponding static train GTFS feed.

The producer resolves the InfoPlus station code and full expected track against
`StaticData-NL.iff_stops`. Matching ignores surrounding whitespace and letter
case, while retaining platform section letters. For example, `14`, `14a`,
and `14b` are three different platform codes. A whole platform is never
substituted for a section, and a section is never selected for a whole platform.

Platform data is normalized once in the database query and has three meanings
throughout the train update flow:

| Field | Meaning |
| --- | --- |
| `plannedPlatformCode` | The platform in the InfoPlus plan, including its section letter. |
| `expectedPlatformCode` | The realtime platform prediction, falling back to the plan when unavailable. |
| `assignedStopId` | The existing GTFS stop resolved from the expected platform, or null when unresolved. |

The former `plannedTrack`, `actualTrack`, `track`, and `platform` properties
are replaced by these fields. The stop model consumes them directly and does
not normalize or compare duplicate representations of the expected platform.

At a stop with a departure, the departure track takes precedence. At a terminus,
the arrival track takes precedence. Missing actual track information falls back
to the planned track for stop resolution. An assignment is published for a
detected platform change only when the expected platform resolves uniquely.
Skipped stops do not receive an assignment.

If resolution is unknown or ambiguous, `assigned_stop_id` is omitted. The
producer retains the planned platform, the static scheduled stop at that station,
or an existing stop without a platform when available. It does not publish an
arbitrary platform as the expected assignment.

Each published assignment includes `stop_sequence`. The accompanying
`stop_id` equals `assigned_stop_id`, as required by the
[GTFS Realtime reference](https://gtfs.org/documentation/realtime/reference/#message-stoptimeproperties).
For example, the local train GTFS snapshot has these Utrecht Centraal stops:

| Platform | Stop ID |
| --- | --- |
| 14 | 906665 |
| 14a | 906866 |
| 14b | 906865 |

These IDs are examples from the local snapshot. The producer uses the imported
GTFS lookup, rather than hardcoded station or platform IDs.

The OVAPI `scheduled_track` and `actual_track` fields are deprecated and are
no longer emitted. Their protobuf field numbers remain defined for decoding
historical feeds. Consumers should read the scheduled platform from static GTFS
and the expected platform from the stop referenced by `assigned_stop_id`.
The OVAPI `station_id` field continues to be emitted.

Trip merging requires a known, matching expected platform at the connection
station. Matching planned platforms alone does not join trips with different
expected platforms. At a merged connection, the arriving trip supplies the
arrival times, and the departing trip supplies its platform plan, expectation,
and resolved stop ID together.

## Verification

`bun test` runs the platform serialization and existing trip-merging tests.
`bun run build:ts` checks the TypeScript source.

The database tests execute the real InfoPlus query and decode its output using
the native GTFS Realtime schema without OVAPI extensions. Run them against an empty disposable
PostgreSQL database:

```sh
GTFS_RT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/test_database bun test
```

The database fixtures are created inside a transaction and rolled back after
the suite. Without this variable, the database tests are skipped.
