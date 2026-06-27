import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const serviceUrl = process.env.SERVICE_URL ?? "http://localhost:8787";

const server = new Server(
  {
    name: "almost-living-context",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ctx_pull",
      description: "Read the base context plus the top k unarchived frames.",
      inputSchema: {
        type: "object",
        properties: { k: { type: "number", default: 2 } }
      }
    },
    {
      name: "ctx_push_frame",
      description: "Append a new delta frame.",
      inputSchema: {
        type: "object",
        required: ["title", "body"],
        properties: {
          title: { type: "string" },
          body: { type: "string" }
        }
      }
    },
    {
      name: "ctx_upsert_item",
      description: "Upsert a context substrate item by kind and key.",
      inputSchema: {
        type: "object",
        required: ["kind", "key", "title", "body"],
        properties: {
          kind: { type: "string", enum: ["decision", "item", "gotcha", "component", "note"] },
          key: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          status: { type: "string", enum: ["open", "decided", "done", "retired"] },
          refs: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } }
        }
      }
    },
    {
      name: "ctx_query_items",
      description: "Query context substrate items.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["decision", "item", "gotcha", "component", "note"] },
          status: { type: "string", enum: ["open", "decided", "done", "retired"] },
          q: { type: "string" },
          key: { type: "string" }
        }
      }
    },
    {
      name: "ctx_compact",
      description: "Archive all but the top keep frames and rewrite the base rollup.",
      inputSchema: {
        type: "object",
        properties: { keep: { type: "number", default: 3 } }
      }
    },
    {
      name: "ctx_check_staleness",
      description: "Check one frame against current substrate items.",
      inputSchema: {
        type: "object",
        required: ["frame"],
        properties: { frame: { type: "number" } }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  const name = request.params.name;

  if (name === "ctx_pull") return json(await get(`/pull?k=${Number(args.k ?? 2)}`));
  if (name === "ctx_push_frame") {
    return json(await post("/frames", { title: args.title, body: args.body }));
  }
  if (name === "ctx_upsert_item") return json(await post("/items", args));
  if (name === "ctx_query_items") {
    const params = new URLSearchParams();
    for (const key of ["kind", "status", "q", "key"]) {
      if (typeof args[key] === "string") params.set(key, args[key] as string);
    }
    return json(await get(`/items?${params}`));
  }
  if (name === "ctx_compact") return json(await post(`/maintain/compact?keep=${Number(args.keep ?? 3)}`, {}));
  if (name === "ctx_check_staleness") return json(await post(`/maintain/staleness?frame=${Number(args.frame)}`, {}));

  throw new Error(`unknown tool: ${name}`);
});

await server.connect(new StdioServerTransport());

async function get(path: string): Promise<unknown> {
  const response = await fetch(`${serviceUrl}${path}`);
  return parseResponse(response);
}

async function post(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${serviceUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function json(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
