ALTER TABLE pet_studies ADD COLUMN status TEXT NOT NULL DEFAULT 'received';

CREATE INDEX IF NOT EXISTS idx_pet_studies_pending
  ON pet_studies(pet_id)
  WHERE status = 'requested';
