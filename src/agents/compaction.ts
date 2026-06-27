import type { Frame } from "../db/types.js";
import type { LlmAdapter } from "../llm/adapter.js";

export async function summarizeCompaction(base: Frame, frames: Frame[], llm: LlmAdapter): Promise<string> {
  const ordered = [...frames].sort((a, b) => a.seq - b.seq);
  if (llm.name === "stub") return stubSummary(base, ordered);

  const prompt = [
    "Rewrite the base handoff context as a compact, low-resolution rollup.",
    "Keep only durable points. Do not restate transient frame detail.",
    "",
    "# Current base",
    base.body,
    "",
    "# Frames to fold",
    ordered.map((frame) => `## ${frame.seq}: ${frame.title}\n${frame.body}`).join("\n\n"),
    "",
    "Return only the new base body."
  ].join("\n");

  const response = (await llm.complete(prompt)).trim();
  return response || stubSummary(base, ordered);
}

function stubSummary(base: Frame, frames: Frame[]): string {
  const lines = ["# Base rollup", "", base.body.trim()];
  if (frames.length) {
    lines.push("", "## Folded frames");
    for (const frame of frames) {
      lines.push(`- #${frame.seq} ${frame.title}: ${firstSentence(frame.body)}`);
    }
  }
  return lines.join("\n").trim();
}

function firstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.{1,220}?[.!?])\s/);
  return match?.[1] ?? normalized.slice(0, 220);
}
