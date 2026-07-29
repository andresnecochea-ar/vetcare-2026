ALTER TABLE invoices ADD COLUMN encounterId TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_encounter
  ON invoices(encounterId)
  WHERE encounterId <> '';
