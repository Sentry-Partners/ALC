# Frame 001 - Initial Build

Created the standalone TypeScript implementation:

- SQLite default and Postgres optional migrations
- Hono service API for substrate, frames, pull, base replacement, compaction, and staleness checks
- MCP stdio server that wraps the service API
- pluggable LLM adapters with offline `stub`
- demo acceptance path that compacts frames and catches planted drift
