import { rmSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = resolve("demo/demo.sqlite");
rmSync(dbPath, { force: true });

process.env.DB_PATH = dbPath;
process.env.LLM_PROVIDER = "stub";
delete process.env.DATABASE_URL;

const { buildApp } = await import("../src/api/app.js");
const { createDb } = await import("../src/db/index.js");

const db = createDb();
await db.migrate();
const app = buildApp(db);

try {
  await post("/items", {
    kind: "decision",
    key: "auth-provider",
    title: "Authentication provider",
    body: "Use a local stub for the demo and keep provider-specific credentials in env vars.",
    status: "decided",
    refs: [],
    tags: ["demo", "llm"]
  });

  await post("/items", {
    kind: "gotcha",
    key: "point-dont-restate",
    title: "Point, do not restate",
    body: "Frames should reference substrate keys instead of copying durable item bodies.",
    status: "open",
    refs: ["auth-provider"],
    tags: ["context"]
  });

  await post("/frames", {
    title: "Session 1",
    body: "Created substrate rows for auth-provider and point-dont-restate. Future frames should point to those keys."
  });
  await post("/frames", {
    title: "Session 2",
    body: "Added the service API and kept the queried substrate separate from the linear frame stack."
  });
  await post("/frames", {
    title: "Session 3",
    body: "Prepared maintenance hooks. Keep local-agent upkeep invoked, not daemonized."
  });

  const compact = await post("/maintain/compact?keep=1", {});

  const driftFrame = (await post("/frames", {
    title: "Intentional drift",
    body: "Claim: status of auth-provider is open. This contradicts the current substrate."
  })) as { seq: number };

  const staleness = (await post(`/maintain/staleness?frame=${driftFrame.seq}`, {})) as {
    findings: unknown[];
  };
  if (!staleness.findings.length) {
    throw new Error("demo failed: staleness checker did not catch planted drift");
  }

  const pull = await get("/pull?k=2");

  console.log("compact result");
  console.log(JSON.stringify(compact, null, 2));
  console.log("\nstaleness result");
  console.log(JSON.stringify(staleness, null, 2));
  console.log("\npull result");
  console.log(JSON.stringify(pull, null, 2));
  console.log("\ndemo passed");
} finally {
  await db.close();
}

async function get(path: string): Promise<unknown> {
  const response = await app.request(path);
  return parse(response);
}

async function post(path: string, body: unknown): Promise<unknown> {
  const response = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parse(response);
}

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
