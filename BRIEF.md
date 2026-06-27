# Project Brief / Handoff — `almost-living-context` reference implementation

> Self-contained seed for a NEW, standalone, public repo. A fresh session with no other context
> should be able to build this end-to-end from this file alone. Drop it in as the new repo's
> `BRIEF.md` (or the BASE of its own handoff stack) and say: "build per BRIEF.md, concrete-first."

## What this is
A small, runnable, MIT-licensed reference implementation that accompanies the **"Living Context"** white
paper. It lets anyone *without* Geno reproduce the core pattern on plain Postgres/SQLite: a **queried
substrate** + a **time-linear delta-frame stack** + **compaction** + **point-don't-restate**, with the
"living" upkeep performed by **two local agents you invoke** (not always-on daemons). Hence *almost* living.

## Why
A white paper describes a pattern; a runnable `service + MCP server` lets a reader adopt it in an afternoon.
This repo is the concrete proof behind the paper, and a star-able public example.

## The thesis (so this session has it without the paper)
Long-horizon, multi-session, multi-agent work needs context handed between sessions. A monolithic handoff
doc fails two ways: unbounded read cost, and hand-written state that goes stale the moment the system
changes. Fix: split context into (1) a durable substrate you **query** (so it can't drift from itself) and
(2) a thin stack of delta-frames that **point** at the substrate instead of restating it; **compact** old
frames into a low-res base on a watermark so read cost stays bounded. The "almost" = the maintenance a full
system does autonomically (compaction, staleness-checking) is here done by **invoked local agents**.

## Scope (v1 — full runnable end-to-end)
1. DB schema + migrations (SQLite default, Postgres via `DATABASE_URL`).
2. Service API (substrate + stack endpoints).
3. MCP server exposing the API as tools.
4. The two invoked maintenance agents + a pluggable LLM adapter.
5. `npm run demo` proving the whole loop, README, LICENSE (MIT), `.env.example`.

## Data model — two tables
**`context_items`** (the queried substrate; never transcribed into prose):
`id` (pk), `kind` (`decision|item|gotcha|component|note`), `key` (stable slug, unique per kind),
`title`, `body`, `status` (`open|decided|done|retired`), `refs` (text[] of other keys),
`tags` (text[]), `created_at`, `updated_at`. Indexes: (kind, status), (key).

**`frames`** (the time-linear stack):
`id` (pk), `seq` (int, 0 = base), `kind` (`base|frame`), `title`, `body`, `created_at`,
`archived_at` (nullable — non-null = folded into base). Exactly one `base` row (seq 0). Index: (archived_at, seq).

## Service API (Node 20 + TypeScript, Hono)
Substrate: `POST /items` (upsert by kind+key) · `GET /items?kind=&status=&q=&key=` (query).
Stack: `GET /pull?k=2` → `{ base, frames: [top k where archived_at IS NULL] }` ·
`POST /frames {title, body}` (append next seq) · `POST /base {body}` (replace base body).
Maintain (invoke agents): `POST /maintain/compact?keep=3` (archive all but top `keep`, then call the
compaction-summarizer to rewrite the base) · `POST /maintain/staleness?frame=<seq>` (call the
staleness-checker: diff that frame's claims against current `context_items`, return a drift report).

## MCP server (`@modelcontextprotocol/sdk`, stdio)
Tools, thin wrappers over the API (`SERVICE_URL` from env):
`ctx_pull(k)`, `ctx_push_frame(title, body)`, `ctx_upsert_item(kind, key, title, body, status, refs)`,
`ctx_query_items(kind, status, q)`, `ctx_compact(keep)`, `ctx_check_staleness(frame)`.

## The two invoked agents ("local agents in the role of Geno")
Plain functions, callable via `/maintain` and MCP; both take a **pluggable LLM adapter** (env-selected:
`ollama` local default, or `anthropic`/`openai`; plus a `stub` adapter so the demo runs with no model/key).
- **compaction-summarizer** — input: current base + the frames being archived; output: a rewritten,
  low-resolution base rollup (durable points only). 
- **staleness-checker** — input: a frame + current `context_items`; output: the frame's claims that
  contradict or aren't supported by the substrate (drift). This is the paper's opening failure, now a callable op.

## Repo layout
```
src/{db,api,mcp,agents,llm}/   migrations/   demo/   README.md   LICENSE(MIT)   .env.example   package.json
```
Scripts: `dev`, `build`, `migrate`, `demo`, `mcp`. DB: `better-sqlite3` default + `pg` adapter on `DATABASE_URL`.

## Demo = acceptance test (`npm run demo`, uses the `stub` LLM so it runs offline)
1. Fresh DB migrate. 2. Seed a few `context_items` (a decision, a gotcha). 3. Push 3 frames.
4. `compact keep=1` → folds 1–2 into the base via the summarizer. 5. Plant a frame whose claim contradicts
an item. 6. `staleness-checker` → flags the planted drift. 7. Print `pull` (base + top frame).
Passing = the loop works end-to-end **including the staleness catch**.

## Build order (concrete-first; straight build, it's well-specified)
1. Schema + migrations + DB adapter. 2. Substrate + stack API. 3. MCP server. 4. Agents + `/maintain` + LLM
adapter (stub first). 5. Demo + README + LICENSE. 6. (optional) deploy note (Railway/Fly) + a hosted instance.

## Conventions / guardrails
- Provider-agnostic LLM via a tiny adapter interface; **never hardcode keys** (env only); ship a `stub` adapter.
- Keep it small and readable — this is a teaching artifact; target a few hundred lines, not a framework.
- README opens by linking the white paper and stating the keep/drop reduction.

## Pointer back
This is the reference implementation promised by **`docs/whitepaper-living-context.md`** in the Geno repo
(`Sentry-Partners/geno`). Keep the two in sync; when this repo exists, register it in Geno as an external
project under `CON-docs-library` / the white paper artifact (`ART-whitepaper-living-context`).

## How to start (for Carlos)
1. Create the new public repo (suggested name: `almost-living-context` or `living-context-kit`).
2. Add this file as `BRIEF.md`; seed a `handoff/` stack (BASE + frame 001) if you want the same discipline.
3. Open a fresh session in that repo: "build per BRIEF.md, concrete-first; start with schema + API."
