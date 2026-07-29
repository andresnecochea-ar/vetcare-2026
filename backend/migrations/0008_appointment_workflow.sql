ALTER TABLE appointments ADD COLUMN status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','confirmed','arrived','waiting','in_consultation','completed','no_show','cancelled'));
ALTER TABLE appointments ADD COLUMN duration TEXT NOT NULL DEFAULT '30';
ALTER TABLE appointments ADD COLUMN checkedInAt TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN startedAt TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN completedAt TEXT NOT NULL DEFAULT '';
ALTER TABLE pet_history ADD COLUMN appointmentId TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_pet_history_appointment ON pet_history(appointmentId);
