import type { ContextItem, Frame } from "../db/types.js";
import type { LlmAdapter } from "../llm/adapter.js";

export interface DriftFinding {
  claim: string;
  key: string;
  expected: string;
  actual: string;
  reason: string;
}

export interface DriftReport {
  frame: number;
  findings: DriftFinding[];
  checked_items: number;
  llm_provider: string;
}

export async function checkStaleness(frame: Frame, items: ContextItem[], llm: LlmAdapter): Promise<DriftReport> {
  const deterministic = heuristicFindings(frame, items);
  if (llm.name === "stub" || deterministic.length) {
    return {
      frame: frame.seq,
      findings: deterministic,
      checked_items: items.length,
      llm_provider: llm.name
    };
  }

  const prompt = [
    "Find claims in this frame that contradict or are unsupported by the current substrate.",
    "Return JSON with shape {\"findings\":[{\"claim\":\"...\",\"key\":\"...\",\"expected\":\"...\",\"actual\":\"...\",\"reason\":\"...\"}]}",
    "",
    "# Frame",
    `seq: ${frame.seq}`,
    frame.body,
    "",
    "# Current substrate",
    JSON.stringify(items, null, 2)
  ].join("\n");
  const response = await llm.complete(prompt);

  return {
    frame: frame.seq,
    findings: parseFindings(response),
    checked_items: items.length,
    llm_provider: llm.name
  };
}

function heuristicFindings(frame: Frame, items: ContextItem[]): DriftFinding[] {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const findings: DriftFinding[] = [];
  const patterns = [
    /(?:status of\s+)?([a-z0-9][a-z0-9-_.]*)\s+(?:is|=)\s+(open|decided|done|retired)\b/gi,
    /([a-z0-9][a-z0-9-_.]*)\s+status\s+(?:is|=)\s+(open|decided|done|retired)\b/gi
  ];

  for (const pattern of patterns) {
    for (const match of frame.body.matchAll(pattern)) {
      const key = match[1];
      const expected = match[2].toLowerCase();
      const actual = byKey.get(key)?.status;
      if (actual && actual !== expected) {
        findings.push({
          claim: match[0],
          key,
          expected,
          actual,
          reason: `Frame says ${key} is ${expected}, but substrate status is ${actual}.`
        });
      }
    }
  }

  return dedupeFindings(findings);
}

function parseFindings(response: string): DriftFinding[] {
  try {
    const parsed = JSON.parse(response) as { findings?: DriftFinding[] };
    return Array.isArray(parsed.findings) ? dedupeFindings(parsed.findings) : [];
  } catch {
    return [];
  }
}

function dedupeFindings(findings: DriftFinding[]): DriftFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const id = `${finding.key}:${finding.expected}:${finding.actual}:${finding.claim}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
