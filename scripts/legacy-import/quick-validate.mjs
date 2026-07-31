// Validación rápida en memoria (node:sqlite) antes de tocar D1 real.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const db = new DatabaseSync(':memory:');

const migrationsDir = path.resolve('backend/migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
  db.exec(sql);
}
console.log('Migraciones de esquema aplicadas:', files.length);

const importSql = fs.readFileSync('backups/legacy-import/import.sql', 'utf8');
db.exec(importSql);
console.log('import.sql ejecutado OK');

const tables = ['owners', 'pets', 'pet_owners', 'pet_history', 'pet_vaccines', 'inventory'];
for (const t of tables) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get();
  console.log(t, '=', row.n);
}

db.exec('PRAGMA foreign_keys = ON;');
const fkIssues = db.prepare('PRAGMA foreign_key_check').all();
console.log('foreign_key_check issues:', fkIssues.length);
if (fkIssues.length) console.log(fkIssues.slice(0, 10));

// Nombres con comillas simples (para validar el escapado)
const apostrophes = db.prepare("SELECT name FROM owners WHERE name LIKE '%''%' LIMIT 5").all();
console.log('nombres con apóstrofe (muestra):', apostrophes);

const sampleHistory = db.prepare('SELECT date, type, title, vet, substr(description,1,80) AS desc FROM pet_history ORDER BY RANDOM() LIMIT 5').all();
console.log('muestra pet_history:', sampleHistory);
