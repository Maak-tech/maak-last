import 'dotenv/config'
import { pool } from './lib/db.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS hospital_staff (
  id                      TEXT PRIMARY KEY,
  email                   TEXT UNIQUE NOT NULL,
  name                    TEXT NOT NULL,
  role                    TEXT NOT NULL CHECK (role IN ('doctor','nurse','admin','viewer')),
  password_hash           TEXT NOT NULL,
  is_active               BOOLEAN DEFAULT true,
  failed_login_attempts   INT DEFAULT 0,
  locked_until            TIMESTAMPTZ,
  password_changed_at     TIMESTAMPTZ DEFAULT now(),
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_history (
  id          TEXT PRIMARY KEY,
  staff_id    TEXT NOT NULL REFERENCES hospital_staff(id),
  hash        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti         TEXT PRIMARY KEY,
  revoked_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  date_of_birth      DATE NOT NULL,
  blood_type         TEXT,
  emergency_contacts JSONB DEFAULT '[]',
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consents (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  consent_type TEXT NOT NULL CHECK (consent_type IN ('biometric','data_sharing','twin_access','biometric_continuous_monitoring')),
  given        BOOLEAN NOT NULL,
  given_at     TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  given_by     TEXT
);

CREATE TABLE IF NOT EXISTS biometric_enrollments (
  id                    TEXT PRIMARY KEY,
  patient_id            TEXT NOT NULL REFERENCES patients(id),
  compreface_subject_id TEXT NOT NULL,
  -- HMAC-SHA256(subjectId) stored as a fast lookup index — no IV, deterministic.
  -- Allows O(1) lookup in recognize.ts instead of decrypting every row.
  subject_id_hmac       TEXT,
  -- NULL means patient self-enrolled (no staff involved).
  -- NOT NULL + FK applies only for staff-assisted enrollments.
  enrolled_by           TEXT REFERENCES hospital_staff(id),
  is_active             BOOLEAN DEFAULT true,
  enrolled_at           TIMESTAMPTZ DEFAULT now(),
  deactivated_at        TIMESTAMPTZ
);

-- Add subject_id_hmac to existing tables that were created before this column existed
ALTER TABLE biometric_enrollments ADD COLUMN IF NOT EXISTS subject_id_hmac TEXT;
CREATE INDEX IF NOT EXISTS idx_enrollments_hmac ON biometric_enrollments(subject_id_hmac) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS digital_twins (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  risk_score   INTEGER NOT NULL,
  risk_level   TEXT NOT NULL CHECK (risk_level IN ('low','moderate','high','critical')),
  computed_at  TIMESTAMPTZ DEFAULT now(),
  summary_json JSONB NOT NULL,
  content_hash TEXT
);

CREATE TABLE IF NOT EXISTS twin_alerts (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  alert_type  TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS twin_vitals_summary (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  vital_type  TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  value       NUMERIC NOT NULL,
  unit        TEXT
);

CREATE TABLE IF NOT EXISTS medications (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  name        TEXT NOT NULL,
  dosage      TEXT,
  frequency   TEXT,
  adherence   NUMERIC DEFAULT 100,
  is_active   BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS qr_tokens (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_by  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recognition_sessions (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id),
  staff_id     TEXT NOT NULL REFERENCES hospital_staff(id),
  access_level TEXT DEFAULT 'preview' CHECK (access_level IN ('preview','confirmed','full')),
  method       TEXT NOT NULL CHECK (method IN ('face','qr','manual','camera')),
  confirmed    BOOLEAN DEFAULT false,
  -- NOT NULL ensures session ordering is deterministic; DEFAULT now() so callers
  -- don't need to supply it explicitly.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS access_audit_logs (
  id          TEXT PRIMARY KEY,
  staff_id    TEXT,
  patient_id  TEXT,
  action      TEXT NOT NULL,
  method      TEXT,
  success     BOOLEAN,
  confidence  NUMERIC,
  ip_address  TEXT,
  -- NOT NULL prevents NULL sort ordering surprises in DESC queries.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camera_feeds (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  rtsp_url   TEXT NOT NULL,
  location   TEXT,
  is_active  BOOLEAN DEFAULT true,
  added_by   TEXT REFERENCES hospital_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Core indexes (present from initial schema)
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON recognition_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON access_audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_staff ON access_audit_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient_time ON twin_vitals_summary(patient_id, recorded_at);

-- Additional indexes for hot query paths identified during review
-- biometric_enrollments: patient.ts and recognize.ts both filter (patient_id, is_active)
CREATE INDEX IF NOT EXISTS idx_enrollments_patient_active ON biometric_enrollments(patient_id, is_active);
-- recognition_sessions: session expiry checks filter (staff_id, expires_at)
CREATE INDEX IF NOT EXISTS idx_sessions_staff_expires ON recognition_sessions(staff_id, expires_at);
-- access_audit_logs: audit.ts paginates by created_at DESC; BRIN is inefficient for DESC queries
CREATE INDEX IF NOT EXISTS idx_audit_created_desc ON access_audit_logs(created_at DESC);
-- consents: HIPAA compliance queries fetch consent history by patient + time
CREATE INDEX IF NOT EXISTS idx_consents_patient_time ON consents(patient_id, given_at DESC);
`

async function migrate() {
  console.log('Running migrations...')
  await pool.query(SCHEMA)
  console.log('Migrations complete.')
  await pool.end()
}

migrate().catch(console.error)
