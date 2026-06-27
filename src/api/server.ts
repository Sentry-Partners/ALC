import { serve } from "@hono/node-server";
import { buildApp } from "./app.js";
import { createDb } from "../db/index.js";

const db = createDb();
await db.migrate();

const port = Number.parseInt(process.env.PORT ?? "8787", 10);

serve({
  fetch: buildApp(db).fetch,
  port
});

console.log(`almost-living-context service listening on http://localhost:${port}`);

process.on("SIGINT", async () => {
  await db.close();
  process.exit(0);
});
