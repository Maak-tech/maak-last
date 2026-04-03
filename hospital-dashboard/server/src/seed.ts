import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pool } from './lib/db.js'

const SALT_ROUNDS = 12
const PASSWORD = 'Password123!'

async function seed() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS)

  // ── Staff ──────────────────────────────────────────────────────────────────
  const staffDoctor = { id: uuidv4(), email: 'dr.chen@hospital.test', name: 'Dr. Sarah Chen', role: 'doctor' }
  const staffNurse = { id: uuidv4(), email: 'nurse.james@hospital.test', name: 'Nurse Marcus James', role: 'nurse' }
  const staffAdmin = { id: uuidv4(), email: 'admin@hospital.test', name: 'Admin Taylor', role: 'admin' }
  const allStaff = [staffDoctor, staffNurse, staffAdmin]

  for (const s of allStaff) {
    await pool.query(
      `INSERT INTO hospital_staff (id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash`,
      [s.id, s.email, s.name, s.role, passwordHash]
    )
  }
  console.log(`Seeded ${allStaff.length} staff members`)

  // ── Patients ───────────────────────────────────────────────────────────────
  const patients = [
    {
      id: uuidv4(),
      name: 'Ahmed Al-Rashidi',
      dob: '1958-03-14',
      blood_type: 'A+',
      emergency_contacts: [
        { name: 'Fatima Al-Rashidi', phone: '+966501234567', relation: 'Spouse' },
      ],
    },
    {
      id: uuidv4(),
      name: 'Maria Gonzalez',
      dob: '1965-07-22',
      blood_type: 'O-',
      emergency_contacts: [
        { name: 'Carlos Gonzalez', phone: '+1-555-234-5678', relation: 'Son' },
      ],
    },
    {
      id: uuidv4(),
      name: 'John Okafor',
      dob: '1972-11-05',
      blood_type: 'B+',
      emergency_contacts: [
        { name: 'Ngozi Okafor', phone: '+2348012345678', relation: 'Wife' },
      ],
    },
    {
      id: uuidv4(),
      name: 'Elena Petrov',
      dob: '1945-02-19',
      blood_type: 'AB+',
      emergency_contacts: [
        { name: 'Dmitri Petrov', phone: '+7-495-123-4567', relation: 'Son' },
        { name: 'Anna Petrov', phone: '+7-495-765-4321', relation: 'Daughter' },
      ],
    },
    {
      id: uuidv4(),
      name: 'Liu Wei',
      dob: '1980-09-30',
      blood_type: 'A-',
      emergency_contacts: [
        { name: 'Chen Mei', phone: '+86-138-0013-8000', relation: 'Spouse' },
      ],
    },
  ]

  for (const p of patients) {
    await pool.query(
      `INSERT INTO patients (id, name, date_of_birth, blood_type, emergency_contacts)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.name, p.dob, p.blood_type, JSON.stringify(p.emergency_contacts)]
    )
  }
  console.log(`Seeded ${patients.length} patients`)

  // ── Digital Twins ──────────────────────────────────────────────────────────
  const twinProfiles = [
    {
      patientId: patients[0].id,
      risk_score: 72,
      risk_level: 'high',
      summary: {
        vhi: 72,
        fall_risk: 68,
        adherence_score: 55,
        deterioration_risk: 78,
        chronic_conditions: ['Type 2 Diabetes', 'Hypertension'],
        last_hospitalization: '2025-11-20',
      },
    },
    {
      patientId: patients[1].id,
      risk_score: 45,
      risk_level: 'moderate',
      summary: {
        vhi: 45,
        fall_risk: 30,
        adherence_score: 82,
        deterioration_risk: 48,
        chronic_conditions: ['Osteoporosis', 'Mild COPD'],
        last_hospitalization: '2025-08-05',
      },
    },
    {
      patientId: patients[2].id,
      risk_score: 28,
      risk_level: 'low',
      summary: {
        vhi: 28,
        fall_risk: 15,
        adherence_score: 91,
        deterioration_risk: 22,
        chronic_conditions: ['Hypertension'],
        last_hospitalization: null,
      },
    },
    {
      patientId: patients[3].id,
      risk_score: 88,
      risk_level: 'critical',
      summary: {
        vhi: 88,
        fall_risk: 85,
        adherence_score: 40,
        deterioration_risk: 90,
        chronic_conditions: ['Heart Failure', 'Atrial Fibrillation', 'CKD Stage 3'],
        last_hospitalization: '2025-12-15',
      },
    },
    {
      patientId: patients[4].id,
      risk_score: 18,
      risk_level: 'low',
      summary: {
        vhi: 18,
        fall_risk: 10,
        adherence_score: 95,
        deterioration_risk: 14,
        chronic_conditions: [],
        last_hospitalization: null,
      },
    },
  ]

  for (const twin of twinProfiles) {
    await pool.query(
      `INSERT INTO digital_twins (id, patient_id, risk_score, risk_level, summary_json)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [uuidv4(), twin.patientId, twin.risk_score, twin.risk_level, JSON.stringify(twin.summary)]
    )
  }
  console.log(`Seeded ${twinProfiles.length} digital twins`)

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alertsData: Array<{ patientIdx: number; alert_type: string; severity: string; message: string }> = [
    {
      patientIdx: 0,
      alert_type: 'vital_anomaly',
      severity: 'high',
      message: 'Elevated heart rate sustained for 48h — avg 102 bpm',
    },
    {
      patientIdx: 0,
      alert_type: 'medication_adherence',
      severity: 'medium',
      message: 'Missed medication: Metformin 500mg (3 doses in 7 days)',
    },
    {
      patientIdx: 0,
      alert_type: 'fall_risk',
      severity: 'high',
      message: 'Fall risk elevated: HRV declined 18% over 5 days',
    },
    {
      patientIdx: 1,
      alert_type: 'vital_anomaly',
      severity: 'medium',
      message: 'SpO2 dropped below 92% on 2 occasions this week',
    },
    {
      patientIdx: 1,
      alert_type: 'medication_adherence',
      severity: 'low',
      message: 'Bisphosphonate dose delay noted — taken 4h late',
    },
    {
      patientIdx: 3,
      alert_type: 'deterioration',
      severity: 'critical',
      message: 'Rapid deterioration signal: weight gain +3.2 kg in 48h (fluid retention)',
    },
    {
      patientIdx: 3,
      alert_type: 'vital_anomaly',
      severity: 'critical',
      message: 'Irregular rhythm episodes detected — 7 AF events in 24h',
    },
    {
      patientIdx: 3,
      alert_type: 'medication_adherence',
      severity: 'high',
      message: 'Missed medication: Warfarin (INR monitoring required)',
    },
    {
      patientIdx: 3,
      alert_type: 'fall_risk',
      severity: 'high',
      message: 'Fall risk critical: gait instability + dizziness reported',
    },
    {
      patientIdx: 2,
      alert_type: 'vital_anomaly',
      severity: 'low',
      message: 'Blood pressure slightly elevated — 142/88 mmHg (3-day average)',
    },
  ]

  for (const a of alertsData) {
    await pool.query(
      `INSERT INTO twin_alerts (id, patient_id, alert_type, severity, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), patients[a.patientIdx].id, a.alert_type, a.severity, a.message]
    )
  }
  console.log(`Seeded ${alertsData.length} alerts`)

  // ── Vitals (7 days) ────────────────────────────────────────────────────────
  const vitalTypes = [
    { type: 'heart_rate', unit: 'bpm', baseValues: [72, 95, 68, 88, 65] },
    { type: 'sleep_hours', unit: 'h', baseValues: [6.5, 5.8, 7.2, 4.5, 7.8] },
    { type: 'spo2', unit: '%', baseValues: [97, 93, 98, 95, 99] },
  ]

  const now = new Date()
  let vitalsCount = 0

  for (let patientIdx = 0; patientIdx < patients.length; patientIdx++) {
    const patientId = patients[patientIdx].id
    for (const vt of vitalTypes) {
      const base = vt.baseValues[patientIdx]
      for (let day = 6; day >= 0; day--) {
        const recordedAt = new Date(now.getTime() - day * 24 * 60 * 60 * 1000)
        // Add realistic variation: ±5% of base value
        const variation = (Math.random() - 0.5) * 0.1 * base
        const value = Math.round((base + variation) * 10) / 10

        await pool.query(
          `INSERT INTO twin_vitals_summary (id, patient_id, vital_type, recorded_at, value, unit)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), patientId, vt.type, recordedAt.toISOString(), value, vt.unit]
        )
        vitalsCount++
      }
    }
  }
  console.log(`Seeded ${vitalsCount} vital records`)

  // ── Medications ────────────────────────────────────────────────────────────
  const medicationsData: Array<{ patientIdx: number; name: string; dosage: string; frequency: string; adherence: number }> = [
    { patientIdx: 0, name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', adherence: 55 },
    { patientIdx: 0, name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', adherence: 78 },
    { patientIdx: 0, name: 'Atorvastatin', dosage: '40mg', frequency: 'Once daily at bedtime', adherence: 82 },
    { patientIdx: 1, name: 'Alendronate', dosage: '70mg', frequency: 'Once weekly', adherence: 88 },
    { patientIdx: 1, name: 'Salbutamol inhaler', dosage: '100mcg', frequency: 'As needed', adherence: 95 },
    { patientIdx: 2, name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', adherence: 91 },
    { patientIdx: 3, name: 'Warfarin', dosage: '5mg', frequency: 'Once daily', adherence: 40 },
    { patientIdx: 3, name: 'Furosemide', dosage: '40mg', frequency: 'Once daily', adherence: 62 },
    { patientIdx: 3, name: 'Digoxin', dosage: '0.125mg', frequency: 'Once daily', adherence: 58 },
    { patientIdx: 3, name: 'Carvedilol', dosage: '6.25mg', frequency: 'Twice daily', adherence: 45 },
    { patientIdx: 4, name: 'Vitamin D3', dosage: '1000 IU', frequency: 'Once daily', adherence: 96 },
  ]

  for (const m of medicationsData) {
    await pool.query(
      `INSERT INTO medications (id, patient_id, name, dosage, frequency, adherence)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), patients[m.patientIdx].id, m.name, m.dosage, m.frequency, m.adherence]
    )
  }
  console.log(`Seeded ${medicationsData.length} medications`)

  // ── Biometric enrollments (placeholder — CompreFace not running during seed) ──
  const enrolledPatientIndices = [0, 1, 3]
  for (const idx of enrolledPatientIndices) {
    const placeholderSubjectId = `SEED_PLACEHOLDER_${uuidv4()}`
    await pool.query(
      `INSERT INTO biometric_enrollments (id, patient_id, compreface_subject_id, enrolled_by, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO NOTHING`,
      [uuidv4(), patients[idx].id, placeholderSubjectId, staffDoctor.id]
    )
  }
  console.log(`Seeded ${enrolledPatientIndices.length} biometric enrollment placeholders`)

  console.log('\nSeed complete.')
  console.log('Staff login credentials (all use password: Password123!):')
  for (const s of allStaff) {
    console.log(`  ${s.role.padEnd(6)} — ${s.email}`)
  }

  await pool.end()
}

seed().catch(console.error)
