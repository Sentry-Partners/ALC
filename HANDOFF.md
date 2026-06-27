# ALC Handoff

Generated from the local Almost Living Context MCP server on 2026-06-27.

## First Read

This repo is `Sentry-Partners/ALC`, a public MIT reference implementation for Almost Living Context:
a queried context substrate, a time-linear frame stack, compaction, staleness checking, and an MCP stdio
server over a local Hono API.

Local checkout:

```sh
/Users/carlosnevarez/Library/Mobile Documents/com~apple~CloudDocs/projects/ALC
```

Remote:

```sh
https://github.com/Sentry-Partners/ALC
```

Latest pushed commit before this handoff was:

```sh
3ff2917 Fix compiled migration lookup
```

## Current State

- `main` tracks `origin/main`.
- Netlify app is live at `https://sentry-partners-alc.netlify.app`.
- Netlify admin URL is `https://app.netlify.com/projects/sentry-partners-alc`.
- Netlify project ID is `cb22edd8-de44-4241-8fe8-646b40c9c8d7`.
- Static docs page lives at `public/index.html`.
- Netlify config lives at `netlify.toml`.
- API service lives at `src/api`.
- MCP stdio server lives at `src/mcp/server.ts`.
- DB adapters and migrations live at `src/db` and `migrations`.
- Demo acceptance path lives at `demo/demo.ts`.

## MCP Pull Snapshot

Base:

```text
No archived context yet.
```

Top frame:

```text
Current goal: create a root HANDOFF.md that a fresh session can read first. Repo is clean on main after
commit 3ff2917. Use npm run build and npx tsx demo/demo.ts for verification. The MCP server has been
tested through stdio. Netlify page is live at https://sentry-partners-alc.netlify.app. Local ignored
.alc.sqlite now contains MCP context items for this handoff. Next likely work: connect Netlify/GitHub CI,
add richer docs, or register this external project back in Geno.
```

## Durable Context Items

- `repo-alc`: public GitHub repository and local checkout path.
- `mcp-server`: stdio MCP server exposes `ctx_pull`, `ctx_push_frame`, `ctx_upsert_item`,
  `ctx_query_items`, `ctx_compact`, and `ctx_check_staleness`.
- `service-api`: Hono API runs with `npm run dev`; SQLite defaults via `DB_PATH`, Postgres via
  `DATABASE_URL`.
- `static-docs-page`: Netlify instructions page in `public/index.html`.
- `netlify-site`: Netlify project `sentry-partners-alc`.
- `compiled-migrations-cwd`: migration lookup deliberately resolves from `process.cwd()/migrations`
  so compiled `dist` and `tsx` runs both work from repo root.
- `verification-mcp-smoke`: MCP smoke test passed through the actual stdio server and caught planted drift.
- `latest-commit-before-handoff`: commit `3ff2917`, following page commit `b2970e7`.

## Resume Commands

Verify repo and build:

```sh
git status --short --branch
npm run build
npx tsx demo/demo.ts
```

Run the local API service:

```sh
cp .env.example .env
npm run migrate
npm run dev
```

Run the MCP server after the API is listening:

```sh
SERVICE_URL=http://localhost:8787 npm run mcp
```

For a compiled smoke run from repo root:

```sh
npm run build
DB_PATH=.alc.sqlite PORT=8791 LLM_PROVIDER=stub node dist/src/api/server.js
SERVICE_URL=http://localhost:8791 node dist/src/mcp/server.js
```

## Suggested Next Work

1. Connect Netlify to GitHub CI/deploys instead of relying only on manual CLI deploys.
2. Add a short README section linking to the live MCP instructions page.
3. Register this external project back in the Geno repo under the Living Context white paper artifact.
4. Add a lightweight automated MCP smoke test script so protocol verification is repeatable.

## Notes

The local `.alc.sqlite` file is ignored by git and now contains MCP context items matching this handoff.
Fresh clones should rely on this `HANDOFF.md`; local sessions on this machine can also run the service with
`DB_PATH=.alc.sqlite` and call `ctx_pull`.
