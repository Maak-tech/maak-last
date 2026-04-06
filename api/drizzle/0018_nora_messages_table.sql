-- Migration 0018: Normalised Nora messages table
-- This is the target for migrating away from noraConversations.messages JSONB blob.
-- noraConversations is NOT dropped — both tables coexist during the transition.
-- Once reads are fully migrated to nora_messages, noraConversations can be archived.

CREATE TABLE IF NOT EXISTS "nora_messages" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "conversation_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "role"            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  "content"         TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "metadata"        JSONB
);

CREATE INDEX IF NOT EXISTS "nora_messages_conversation_idx"
  ON "nora_messages" ("conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "nora_messages_user_idx"
  ON "nora_messages" ("user_id", "created_at");
