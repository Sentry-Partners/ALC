import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ContextDb, ContextItem, Frame, ItemInput, ItemQuery } from "./types.js";

const migrationPath = resolve(process.cwd(), "migrations/001_init_sqlite.sql");

type SqliteItemRow = Omit<ContextItem, "refs" | "tags"> & { refs: string; tags: string };

export class SqliteContextDb implements ContextDb {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
  }

  async migrate(): Promise<void> {
    this.db.exec(readFileSync(migrationPath, "utf8"));
    await this.ensureBase();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async ensureBase(): Promise<Frame> {
    const existing = this.db.prepare("SELECT * FROM frames WHERE kind = 'base'").get() as Frame | undefined;
    if (existing) return existing;

    const now = new Date().toISOString();
    const frame: Frame = {
      id: randomUUID(),
      seq: 0,
      kind: "base",
      title: "Base context",
      body: "No archived context yet.",
      created_at: now,
      archived_at: null
    };
    this.db
      .prepare(
        "INSERT INTO frames (id, seq, kind, title, body, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(frame.id, frame.seq, frame.kind, frame.title, frame.body, frame.created_at, frame.archived_at);
    return frame;
  }

  async upsertItem(input: ItemInput): Promise<ContextItem> {
    const now = new Date().toISOString();
    const refs = input.refs ?? [];
    const tags = input.tags ?? [];
    const existing = this.db
      .prepare("SELECT * FROM context_items WHERE kind = ? AND key = ?")
      .get(input.kind, input.key) as SqliteItemRow | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE context_items
           SET title = ?, body = ?, status = ?, refs = ?, tags = ?, updated_at = ?
           WHERE kind = ? AND key = ?`
        )
        .run(
          input.title,
          input.body,
          input.status ?? existing.status,
          JSON.stringify(refs),
          JSON.stringify(tags),
          now,
          input.kind,
          input.key
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO context_items
           (id, kind, key, title, body, status, refs, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          randomUUID(),
          input.kind,
          input.key,
          input.title,
          input.body,
          input.status ?? "open",
          JSON.stringify(refs),
          JSON.stringify(tags),
          now,
          now
        );
    }

    const [item] = await this.queryItems({ kind: input.kind, key: input.key });
    return item;
  }

  async queryItems(query: ItemQuery): Promise<ContextItem[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.kind) {
      conditions.push("kind = ?");
      params.push(query.kind);
    }
    if (query.status) {
      conditions.push("status = ?");
      params.push(query.status);
    }
    if (query.key) {
      conditions.push("key = ?");
      params.push(query.key);
    }
    if (query.q) {
      conditions.push("(key LIKE ? OR title LIKE ? OR body LIKE ?)");
      const q = `%${query.q}%`;
      params.push(q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM context_items ${where} ORDER BY kind, key`)
      .all(...params) as SqliteItemRow[];
    return rows.map(decodeItem);
  }

  async listItems(): Promise<ContextItem[]> {
    return this.queryItems({});
  }

  async appendFrame(title: string, body: string): Promise<Frame> {
    const seq = ((this.db.prepare("SELECT MAX(seq) AS seq FROM frames").get() as { seq: number | null }).seq ?? 0) + 1;
    const now = new Date().toISOString();
    const frame: Frame = {
      id: randomUUID(),
      seq,
      kind: "frame",
      title,
      body,
      created_at: now,
      archived_at: null
    };
    this.db
      .prepare(
        "INSERT INTO frames (id, seq, kind, title, body, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(frame.id, frame.seq, frame.kind, frame.title, frame.body, frame.created_at, frame.archived_at);
    return frame;
  }

  async pull(k: number): Promise<{ base: Frame; frames: Frame[] }> {
    const base = await this.ensureBase();
    const frames = this.db
      .prepare("SELECT * FROM frames WHERE kind = 'frame' AND archived_at IS NULL ORDER BY seq DESC LIMIT ?")
      .all(k) as Frame[];
    return { base, frames };
  }

  async replaceBase(body: string): Promise<Frame> {
    await this.ensureBase();
    this.db.prepare("UPDATE frames SET body = ? WHERE kind = 'base'").run(body);
    return (await this.ensureBase()) as Frame;
  }

  async framesToArchive(keep: number): Promise<Frame[]> {
    return this.db
      .prepare(
        `SELECT * FROM frames
         WHERE kind = 'frame' AND archived_at IS NULL
         ORDER BY seq DESC
         LIMIT -1 OFFSET ?`
      )
      .all(keep) as Frame[];
  }

  async archiveFrames(seqs: number[]): Promise<void> {
    if (!seqs.length) return;
    const now = new Date().toISOString();
    const update = this.db.prepare("UPDATE frames SET archived_at = ? WHERE seq = ?");
    const tx = this.db.transaction((values: number[]) => {
      for (const seq of values) update.run(now, seq);
    });
    tx(seqs);
  }

  async getFrame(seq: number): Promise<Frame | null> {
    return (this.db.prepare("SELECT * FROM frames WHERE seq = ?").get(seq) as Frame | undefined) ?? null;
  }
}

function decodeItem(row: SqliteItemRow): ContextItem {
  return {
    ...row,
    refs: JSON.parse(row.refs) as string[],
    tags: JSON.parse(row.tags) as string[]
  };
}
