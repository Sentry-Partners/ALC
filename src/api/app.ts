import { Hono } from "hono";
import { summarizeCompaction } from "../agents/compaction.js";
import { checkStaleness } from "../agents/staleness.js";
import type { ContextDb, ContextKind, ContextStatus, ItemInput } from "../db/types.js";
import { createLlmAdapter } from "../llm/adapter.js";

export function buildApp(db: ContextDb): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/items", async (c) => {
    const body = (await c.req.json()) as ItemInput;
    requireString(body.kind, "kind");
    requireString(body.key, "key");
    requireString(body.title, "title");
    requireString(body.body, "body");

    const item = await db.upsertItem({
      kind: body.kind,
      key: body.key,
      title: body.title,
      body: body.body,
      status: body.status ?? "open",
      refs: body.refs ?? [],
      tags: body.tags ?? []
    });
    return c.json(item);
  });

  app.get("/items", async (c) => {
    const items = await db.queryItems({
      kind: optionalKind(c.req.query("kind")),
      status: optionalStatus(c.req.query("status")),
      q: c.req.query("q"),
      key: c.req.query("key")
    });
    return c.json({ items });
  });

  app.get("/pull", async (c) => {
    const k = parsePositiveInt(c.req.query("k") ?? "2", 2);
    return c.json(await db.pull(k));
  });

  app.post("/frames", async (c) => {
    const body = (await c.req.json()) as { title?: string; body?: string };
    requireString(body.title, "title");
    requireString(body.body, "body");
    return c.json(await db.appendFrame(body.title, body.body));
  });

  app.post("/base", async (c) => {
    const body = (await c.req.json()) as { body?: string };
    requireString(body.body, "body");
    return c.json(await db.replaceBase(body.body));
  });

  app.post("/maintain/compact", async (c) => {
    const keep = parsePositiveInt(c.req.query("keep") ?? "3", 3);
    const { base } = await db.pull(0);
    const frames = await db.framesToArchive(keep);
    const llm = createLlmAdapter();
    const nextBase = await summarizeCompaction(base, frames, llm);
    const updatedBase = await db.replaceBase(nextBase);
    await db.archiveFrames(frames.map((frame) => frame.seq));
    return c.json({
      archived: frames.map((frame) => frame.seq),
      base: updatedBase,
      llm_provider: llm.name
    });
  });

  app.post("/maintain/staleness", async (c) => {
    const seq = parsePositiveInt(c.req.query("frame") ?? "", NaN);
    const frame = await db.getFrame(seq);
    if (!frame) return c.json({ error: `frame ${seq} not found` }, 404);
    const llm = createLlmAdapter();
    const report = await checkStaleness(frame, await db.listItems(), llm);
    return c.json(report);
  });

  return app;
}

function requireString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  if (Number.isFinite(fallback)) return fallback;
  throw new Error("expected a positive integer");
}

function optionalKind(value?: string): ContextKind | undefined {
  if (!value) return undefined;
  if (["decision", "item", "gotcha", "component", "note"].includes(value)) return value as ContextKind;
  throw new Error(`invalid kind: ${value}`);
}

function optionalStatus(value?: string): ContextStatus | undefined {
  if (!value) return undefined;
  if (["open", "decided", "done", "retired"].includes(value)) return value as ContextStatus;
  throw new Error(`invalid status: ${value}`);
}
