CREATE TABLE IF NOT EXISTS clinical_close_operations (
  idempotency_key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  claim_token TEXT NOT NULL UNIQUE,
  pet_id TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL DEFAULT '',
  reminder_id TEXT NOT NULL DEFAULT '',
  invoice_id TEXT NOT NULL DEFAULT '',
  result_revision INTEGER NOT NULL DEFAULT 0,
  invoice_number TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_clinical_close_pet
  ON clinical_close_operations(pet_id, created_at DESC);
