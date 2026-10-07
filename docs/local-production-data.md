# Run locally with production database data

Open this checkout in WebStorm and select **GTFS-RT - production database** from
the Run configuration selector. Click Run, or Debug to use breakpoints in the
service. The configuration uses WebStorm's Bun runtime; if Bun has not been
configured, select the installed Bun executable in
Settings → Languages & Frameworks → JavaScript Runtime.

The launcher connects to `root@datav2.infoplazamobility.nl` using your existing
SSH configuration and keys. SSH must work without an interactive password
prompt. It inspects `deploy-gtfsrt-1` for the deployed database credentials and
`deploy-database-1` for its published PostgreSQL port. Credentials remain in
memory and are not stored in the run configuration or a local environment file.

An SSH tunnel listens on `127.0.0.1:15433` and forwards to the published database
port on the remote host. The service's database sessions use
`default_transaction_read_only=on`, a 20-second statement timeout, and a
5-second lock timeout. The launcher checks the service pool's read-only setting
before starting generation.

The local service refreshes the feed every 30 seconds and serves:

- `http://localhost:9595/trainUpdates.pb`
- `http://localhost:9595/trainUpdates.json`
- `http://localhost:9595/health`

Generated files are written to this checkout's `publish` directory. Stop the
WebStorm run to stop the service and its SSH tunnel. A lost SSH tunnel also stops
the service. Production services and database configuration are not changed.

For an occupied tunnel port, add `GTFS_RT_TUNNEL_PORT` with an available local
port to the run configuration's environment variables. The HTTP port remains
9595. `GTFS_RT_SSH_HOST` can override the SSH destination.

The same launcher can be run from the terminal with `bun run dev:prod-db`.

Do not point `GTFS_RT_TEST_DATABASE_URL` at production. That variable is for the
integration tests' disposable database and is unrelated to this launcher.
