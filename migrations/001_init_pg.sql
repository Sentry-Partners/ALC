CREATE TABLE IF NOT EXISTS context_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('decision', 'item', 'gotcha', 'component', 'note')),
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'decided', 'done', 'retired')),
  refs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (kind, key)
);

CREATE INDEX IF NOT EXISTS idx_context_items_kind_status ON context_items (kind, status);
CREATE INDEX IF NOT EXISTS idx_context_items_key ON context_items (key);

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('base', 'frame')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_frames_single_base ON frames (kind) WHERE kind = 'base';
CREATE INDEX IF NOT EXISTS idx_frames_archived_seq ON frames (archived_at, seq);
