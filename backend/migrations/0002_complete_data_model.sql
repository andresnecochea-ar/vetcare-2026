ALTER TABLE owners ADD COLUMN dni TEXT NOT NULL DEFAULT '';
ALTER TABLE owners ADD COLUMN notes TEXT NOT NULL DEFAULT '';

ALTER TABLE groomingAppointments ADD COLUMN reminder TEXT NOT NULL DEFAULT '';
ALTER TABLE groomingAppointments ADD COLUMN notes TEXT NOT NULL DEFAULT '';

ALTER TABLE inventory ADD COLUMN lots TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS pet_studies (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  clinicName TEXT NOT NULL DEFAULT 'VetCare',
  settings TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO app_settings (id, clinicName, settings)
VALUES ('singleton', 'VetCare', '{}');

CREATE INDEX IF NOT EXISTS idx_pet_studies_pet ON pet_studies(pet_id);
