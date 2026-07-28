PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT '',
  breed TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  birthdate TEXT NOT NULL DEFAULT '',
  weight TEXT NOT NULL DEFAULT '',
  microchip TEXT NOT NULL DEFAULT '',
  allergies TEXT NOT NULL DEFAULT '',
  chronicConditions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  petId TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  vet TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (petId) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groomingAppointments (
  id TEXT PRIMARY KEY,
  petId TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  groomer TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  petId TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  quantity TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  minStock TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  ownerId TEXT NOT NULL DEFAULT '',
  petId TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pet_history (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  treatment TEXT NOT NULL DEFAULT '',
  vet TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pet_vaccines (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  nextDose TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pet_images (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pet_owners (
  pet_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  PRIMARY KEY (pet_id, owner_id),
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_grooming_date ON groomingAppointments(date);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(date);
CREATE INDEX IF NOT EXISTS idx_pet_history_pet ON pet_history(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_vaccines_pet ON pet_vaccines(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_images_pet ON pet_images(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_owners_owner ON pet_owners(owner_id);
