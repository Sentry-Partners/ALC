# Almost Living Context

A small MIT-licensed reference implementation for the Living Context pattern described in
`Sentry-Partners/geno` at `docs/whitepaper-living-context.md`.

It demonstrates the core loop on plain SQLite or Postgres:

- a queried substrate of durable `context_items`
- a time-linear delta-frame stack
- compaction that folds older frames into a bounded base
- point-don't-restate context upkeep
- invoked local agents for compaction and staleness checks

The implementation is intentionally small. The default `stub` LLM adapter makes the full demo run offline.

## Quick Start

```sh
npm install
npm run demo
```

The demo creates a fresh SQLite database, seeds substrate items, pushes three frames, compacts older frames,
plants an intentionally stale claim, and verifies that the staleness checker catches it.

## Service

```sh
cp .env.example .env
npm run migrate
npm run dev
```

Default service URL: `http://localhost:8787`.

### Endpoints

- `POST /items` upserts a substrate item by `kind + key`
- `GET /items?kind=&status=&q=&key=` queries substrate items
- `GET /pull?k=2` returns the base plus top unarchived frames
- `POST /frames` appends a delta frame
- `POST /base` replaces the base body
- `POST /maintain/compact?keep=3` archives older frames and rewrites the base
- `POST /maintain/staleness?frame=<seq>` checks a frame against current substrate items

## MCP Server

Run the API first, then:

```sh
npm run mcp
```

Tools:

- `ctx_pull(k)`
- `ctx_push_frame(title, body)`
- `ctx_upsert_item(kind, key, title, body, status, refs, tags)`
- `ctx_query_items(kind, status, q, key)`
- `ctx_compact(keep)`
- `ctx_check_staleness(frame)`

## Storage

SQLite is the default:

```sh
DB_PATH=.alc.sqlite
```

Set `DATABASE_URL` to use Postgres:

```sh
DATABASE_URL=postgres://user:password@localhost:5432/almost_living_context
```

## LLM Adapters

Set `LLM_PROVIDER` to one of:

- `stub` for deterministic offline behavior
- `ollama` for a local Ollama model
- `openai` with `OPENAI_API_KEY`
- `anthropic` with `ANTHROPIC_API_KEY`

Provider keys are read only from environment variables.

## Why This Exists

A monolithic handoff doc grows without bound and goes stale. This repo keeps durable state in a queried
substrate, keeps recent work in thin frames, and folds old frames into a low-resolution base. The result is
bounded read cost with explicit checks for stale claims.
