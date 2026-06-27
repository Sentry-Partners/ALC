import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import type { ContextDb, ContextItem, Frame, ItemInput, ItemQuery } from "./types.js";

const { Pool } = pg;
const migrationPath = resolve(process.cwd(), "migrations/001_init_pg.sql");

export class PostgresContextDb implements ContextDb {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async migrate(): Promise<void> {
    await this.pool.query(readFileSync(migrationPath, "utf8"));
    await this.ensureBase();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ensureBase(): Promise<Frame> {
    const existing = await this.pool.query<Frame>("SELECT * FROM frames WHERE kind = 'base'");
    if (existing.rows[0]) return serializeFrame(existing.rows[0]);

    const now = new Date().toISOString();
    const result = await this.pool.query<Frame>(
      `INSERT INTO frames (id, seq, kind, title, body, created_at, archived_at)
       VALUES ($1, 0, 'base', 'Base context', 'No archived context yet.', $2, NULL)
       RETURNING *`,
      [randomUUID(), now]
    );
    return serializeFrame(result.rows[0]);
  }

  async upsertItem(input: ItemInput): Promise<ContextItem> {
    const now = new Date().toISOString();
    const result = await this.pool.query<ContextItem>(
      `INSERT INTO context_items
       (id, kind, key, title, body, status, refs, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT (kind, key)
       DO UPDATE SET title = EXCLUDED.title,
                     body = EXCLUDED.body,
                     status = EXCLUDED.status,
                     refs = EXCLUDED.refs,
                     tags = EXCLUDED.tags,
                     updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        randomUUID(),
        input.kind,
        input.key,
        input.title,
        input.body,
        input.status ?? "open",
        input.refs ?? [],
        input.tags ?? [],
        now
      ]
    );
    return serializeItem(result.rows[0]);
  }

  async queryItems(query: ItemQuery): Promise<ContextItem[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const next = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (query.kind) conditions.push(`kind = ${next(query.kind)}`);
    if (query.status) conditions.push(`status = ${next(query.status)}`);
    if (query.key) conditions.push(`key = ${next(query.key)}`);
    if (query.q) {
      const marker = next(`%${query.q}%`);
      conditions.push(`(key ILIKE ${marker} OR title ILIKE ${marker} OR body ILIKE ${marker})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await this.pool.query<ContextItem>(`SELECT * FROM context_items ${where} ORDER BY kind, key`, params);
    return result.rows.map(serializeItem);
  }

  async listItems(): Promise<ContextItem[]> {
    return this.queryItems({});
  }

  async appendFrame(title: string, body: string): Promise<Frame> {
    const now = new Date().toISOString();
    const result = await this.pool.query<Frame>(
      `INSERT INTO frames (id, seq, kind, title, body, created_at, archived_at)
       VALUES ($1, (SELECT COALESCE(MAX(seq), 0) + 1 FROM frames), 'frame', $2, $3, $4, NULL)
       RETURNING *`,
      [randomUUID(), title, body, now]
    );
    return serializeFrame(result.rows[0]);
  }

  async pull(k: number): Promise<{ base: Frame; frames: Frame[] }> {
    const base = await this.ensureBase();
    const result = await this.pool.query<Frame>(
      "SELECT * FROM frames WHERE kind = 'frame' AND archived_at IS NULL ORDER BY seq DESC LIMIT $1",
      [k]
    );
    return { base, frames: result.rows.map(serializeFrame) };
  }

  async replaceBase(body: string): Promise<Frame> {
    await this.ensureBase();
    const result = await this.pool.query<Frame>("UPDATE frames SET body = $1 WHERE kind = 'base' RETURNING *", [body]);
    return serializeFrame(result.rows[0]);
  }

  async framesToArchive(keep: number): Promise<Frame[]> {
    const result = await this.pool.query<Frame>(
      `SELECT * FROM frames
       WHERE kind = 'frame' AND archived_at IS NULL
       ORDER BY seq DESC
       OFFSET $1`,
      [keep]
    );
    return result.rows.map(serializeFrame);
  }

  async archiveFrames(seqs: number[]): Promise<void> {
    if (!seqs.length) return;
    await this.pool.query("UPDATE frames SET archived_at = $1 WHERE seq = ANY($2::int[])", [
      new Date().toISOString(),
      seqs
    ]);
  }

  async getFrame(seq: number): Promise<Frame | null> {
    const result = await this.pool.query<Frame>("SELECT * FROM frames WHERE seq = $1", [seq]);
    return result.rows[0] ? serializeFrame(result.rows[0]) : null;
  }
}

function serializeItem(item: ContextItem): ContextItem {
  return {
    ...item,
    created_at: new Date(item.created_at).toISOString(),
    updated_at: new Date(item.updated_at).toISOString()
  };
}

function serializeFrame(frame: Frame): Frame {
  return {
    ...frame,
    created_at: new Date(frame.created_at).toISOString(),
    archived_at: frame.archived_at ? new Date(frame.archived_at).toISOString() : null
  };
}
