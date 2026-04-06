-- Migration 0008: Feature flags table
-- Enables gradual rollout of new capabilities without a full deploy.

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "name"               TEXT        NOT NULL PRIMARY KEY,
  "description"        TEXT,
  "enabled_for_all"    BOOLEAN     NOT NULL DEFAULT false,
  "rollout_percent"    INTEGER     NOT NULL DEFAULT 0,
  "enabled_user_ids"   JSONB       DEFAULT '[]'::jsonb,
  "enabled_org_ids"    JSONB       DEFAULT '[]'::jsonb,
  "created_at"         TIMESTAMPTZ DEFAULT now(),
  "updated_at"         TIMESTAMPTZ DEFAULT now()
);

-- Seed well-known flags (all OFF by default — enable deliberately after testing)
INSERT INTO "feature_flags" ("name", "description", "enabled_for_all", "rollout_percent")
VALUES
  ('ddi-warnings',            'Show drug-drug interaction warnings when adding medications', false, 0),
  ('vhi-genetics-tab',        'Show genetics/DNA section in the VHI tab', false, 0),
  ('vhi-full-tab',            'Enable the full Virtual Health Identity tab for users', false, 0),
  ('caregiver-digest-push',   'Send daily caregiver digest push notifications', false, 0),
  ('wearable-staleness-push', 'Send push when a wearable has not synced within threshold', false, 0),
  ('clinical-notes-upload',   'Allow PDF clinical note uploads via the mobile app', false, 0),
  ('hospital-camera-watcher', 'Enable IP camera automatic patient detection', false, 0),
  ('nora-medgemma',           'Use MedGemma model for Nora explanations instead of GPT-4o', false, 0),
  ('forecast-cycle',          'Run 7/14/30-day vital forecast on elevated risk users', false, 0),
  ('sdk-public-api',          'Enable public SDK API endpoints for org API keys', false, 0)
ON CONFLICT ("name") DO NOTHING;
