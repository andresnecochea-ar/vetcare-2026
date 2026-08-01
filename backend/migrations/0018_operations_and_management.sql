ALTER TABLE pets ADD COLUMN inactiveAt TEXT NOT NULL DEFAULT '';
ALTER TABLE pets ADD COLUMN inactiveReason TEXT NOT NULL DEFAULT '';

ALTER TABLE pet_vaccines ADD COLUMN vaccineType TEXT NOT NULL DEFAULT '';
ALTER TABLE pet_vaccines ADD COLUMN productId TEXT NOT NULL DEFAULT '';
ALTER TABLE pet_dewormings ADD COLUMN productId TEXT NOT NULL DEFAULT '';

ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN license TEXT NOT NULL DEFAULT '';

ALTER TABLE groomingAppointments ADD COLUMN invoiceId TEXT NOT NULL DEFAULT '';

ALTER TABLE invoices ADD COLUMN paymentMethod TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN amountPaid REAL NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN stockAppliedAt TEXT NOT NULL DEFAULT '';

-- Los recibos cobrados anteriores a los pagos parciales ya estaban saldados.
-- Sin este backfill aparecerían como deuda y el panel perdería su facturación.
UPDATE invoices SET amountPaid = total WHERE status = 'paid';

CREATE TABLE IF NOT EXISTS followupActions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  refId TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('archive', 'snooze')),
  untilDate TEXT NOT NULL DEFAULT '',
  userId TEXT NOT NULL DEFAULT '',
  userName TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_actions_ref
  ON followupActions(kind, refId);

CREATE TABLE IF NOT EXISTS user_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email
  ON user_invitations(email, expires_at);

CREATE TABLE IF NOT EXISTS clinic_access (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
