import { PostgresContextDb } from "./pg.js";
import { SqliteContextDb } from "./sqlite.js";
import type { ContextDb } from "./types.js";

export function createDb(): ContextDb {
  if (process.env.DATABASE_URL) {
    return new PostgresContextDb(process.env.DATABASE_URL);
  }

  return new SqliteContextDb(process.env.DB_PATH ?? ".alc.sqlite");
}

export * from "./types.js";
