-- Migration 0015: DNA parsing queue for retry visibility
-- Tracks DNA file parsing jobs so failures don't silently disappear.
-- When dnaParsingJob restarts after a crash, it picks up rows where
-- status='processing' AND processing_started_at < now() - interval '30 minutes'
-- and retries them (up to max 3 attempts).

CREATE TABLE IF NOT EXISTS "dna_parsing_queue" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "user_id"               TEXT NOT NULL,
  "file_key"              TEXT NOT NULL,
  "provider"              TEXT,
  "status"                TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  "attempts"              INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at"       TIMESTAMPTZ,
  "processing_started_at" TIMESTAMPTZ,
  "completed_at"          TIMESTAMPTZ,
  "error_message"         TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "dna_parsing_queue_user_idx"
  ON "dna_parsing_queue" ("user_id");

CREATE INDEX IF NOT EXISTS "dna_parsing_queue_status_idx"
  ON "dna_parsing_queue" ("status", "created_at");

COMMENT ON TABLE "dna_parsing_queue" IS
  'Tracks DNA file parsing jobs. Rows with status=processing AND
   processing_started_at < now()-30min are considered stale and retried by dnaParsingJob.
   Max 3 attempts before status=failed. Failed rows are never auto-deleted.';
