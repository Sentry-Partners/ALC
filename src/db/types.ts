export type ContextKind = "decision" | "item" | "gotcha" | "component" | "note";
export type ContextStatus = "open" | "decided" | "done" | "retired";
export type FrameKind = "base" | "frame";

export interface ContextItem {
  id: string;
  kind: ContextKind;
  key: string;
  title: string;
  body: string;
  status: ContextStatus;
  refs: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Frame {
  id: string;
  seq: number;
  kind: FrameKind;
  title: string;
  body: string;
  created_at: string;
  archived_at: string | null;
}

export interface ItemInput {
  kind: ContextKind;
  key: string;
  title: string;
  body: string;
  status?: ContextStatus;
  refs?: string[];
  tags?: string[];
}

export interface ItemQuery {
  kind?: ContextKind;
  status?: ContextStatus;
  q?: string;
  key?: string;
}

export interface ContextDb {
  migrate(): Promise<void>;
  close(): Promise<void>;
  ensureBase(): Promise<Frame>;
  upsertItem(input: ItemInput): Promise<ContextItem>;
  queryItems(query: ItemQuery): Promise<ContextItem[]>;
  listItems(): Promise<ContextItem[]>;
  appendFrame(title: string, body: string): Promise<Frame>;
  pull(k: number): Promise<{ base: Frame; frames: Frame[] }>;
  replaceBase(body: string): Promise<Frame>;
  framesToArchive(keep: number): Promise<Frame[]>;
  archiveFrames(seqs: number[]): Promise<void>;
  getFrame(seq: number): Promise<Frame | null>;
}
