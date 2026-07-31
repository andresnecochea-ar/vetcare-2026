// ETL único: lee el backup del sistema viejo (Visual FoxPro / "Vetter") en
// _otros/Backup_sistemaviejo y genera un SQL de import + un reporte de
// calidad de datos en backups/legacy-import/. No toca ninguna base D1: solo
// produce archivos para revisar antes de aplicarlos.
//
// Decisiones de negocio (confirmadas con el usuario el 2026-07-31):
//  - Corte de actividad: solo entran mascotas/dueños con última visita (o alta,
//    si no hay última visita) en los últimos 5 años. El resto queda en el
//    backup original, no se pierde, pero no entra en esta carga inicial.
//  - Historia clínica sin veterinario identificado: si la entrada cae dentro
//    del corte de 5 años, se le asigna "Dr. Héctor Eduardo Escobar" (Nito).
//    Las entradas fuera del corte no se migran, así que no hace falta decidir
//    sobre ellas.
//  - Próxima dosis de vacunas: se migra la fecha tal cual, vencida o no.
//  - Inventario (stock.dbf): NO se migra en esta carga; el equipo lo arma con
//    un recuento físico real.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DbfTable } from './dbf.mjs';
import { parseClinicaMemo } from './parse-clinica.mjs';
import { normalizeSpecies, normalizeSex, dbfDateToIso, collapseSpaces, isLikelyEmail } from './normalize.mjs';
import { BatchInsertWriter } from './sql.mjs';

const SRC_DIR = path.resolve('_otros/Backup_sistemaviejo');
const OUT_DIR = path.resolve('backups/legacy-import');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TODAY = '2026-07-31';
const CUTOFF_DATE = '2021-07-31'; // últimos 5 años
const DEFAULT_VET = 'Dr. Héctor Eduardo Escobar';

const warnings = [];
const counts = {};
function warn(msg) {
  warnings.push(msg);
}

const sqlPath = path.join(OUT_DIR, 'import.sql');
const stream = fs.createWriteStream(sqlPath, { encoding: 'utf8' });
// Sin BEGIN TRANSACTION/COMMIT explícitos: D1 remoto los rechaza (maneja su
// propia atomicidad por debajo vía Durable Objects). SQLite local los acepta
// igual, así que no hace falta para la validación en memoria/local.
stream.write('PRAGMA foreign_keys = ON;\n\n');

// ---------------------------------------------------------------------------
// 0) PACIENTES.DBF -> quién entra según el corte de actividad de 5 años
// ---------------------------------------------------------------------------
const includedCodigoPaci = new Set(); // CODIGOPACI que sí se migran
const neededOwnerCodes = new Set(); // CODIGO (clientes) referenciados por mascotas incluidas
let excludedByCutoff = 0;

{
  const t = new DbfTable(path.join(SRC_DIR, 'PACIENTES.DBF'));
  for (const r of t.records()) {
    const lastActivity = dbfDateToIso(r.ULTIMA_VES) || dbfDateToIso(r.FECHAALTA);
    if (lastActivity && lastActivity >= CUTOFF_DATE) {
      includedCodigoPaci.add(r.CODIGOPACI);
      neededOwnerCodes.add(r.CODIGOPACI.split('/')[0]);
    } else {
      excludedByCutoff++;
    }
  }
  t.close();
}
counts.pets_excluded_by_cutoff = excludedByCutoff;

// ---------------------------------------------------------------------------
// 1) clientes.dbf -> owners (solo los que tienen alguna mascota incluida)
// ---------------------------------------------------------------------------
const TIPOS_LABEL = {};
{
  const t = new DbfTable(path.join(SRC_DIR, 'tipos.dbf'));
  for (const r of t.records()) TIPOS_LABEL[r.CODIGO] = r.TIPO;
  t.close();
}

const ownerIdByCodigo = new Map(); // CODIGO (clientes) -> owners.id
const ownerNameByCodigo = new Map();

const ownersOut = new BatchInsertWriter(stream, 'owners', ['id', 'name', 'phone', 'email', 'address', 'relationship', 'dni', 'notes']);

{
  const t = new DbfTable(path.join(SRC_DIR, 'clientes.dbf'));
  let invalidEmails = 0;
  let excludedOwners = 0;
  for (const r of t.records()) {
    if (!neededOwnerCodes.has(r.CODIGO)) { excludedOwners++; continue; }
    const id = randomUUID();
    ownerIdByCodigo.set(r.CODIGO, id);
    ownerNameByCodigo.set(r.CODIGO, collapseSpaces(r.NOMBRE).toUpperCase());

    const addressParts = [r.DIRECCION, r.LOCALIDAD, r.PROVINCIA].map(collapseSpaces).filter(Boolean);
    let address = addressParts.join(', ');
    if (r.CODPOSTAL.trim()) address += (address ? ' ' : '') + `(CP ${r.CODPOSTAL.trim()})`;

    const email = isLikelyEmail(r.EMAIL) ? r.EMAIL.trim() : '';
    if (r.EMAIL.trim() && !email) invalidEmails++;

    const noteParts = [];
    const tipoLabel = TIPOS_LABEL[r.TIPO];
    if (tipoLabel && tipoLabel !== 'PROPIO') noteParts.push(`Categoría (sistema anterior): ${tipoLabel}`);
    const saldo = parseFloat(r.SALDO || '0');
    if (!Number.isNaN(saldo) && Math.abs(saldo) > 0.01) noteParts.push(`Saldo cta. cte. (sistema anterior): $${saldo.toFixed(2)}`);
    if (r.EMAIL.trim() && !email) noteParts.push(`Email sin formato válido (sistema anterior): ${r.EMAIL.trim()}`);
    const altaIso = dbfDateToIso(r.FECHAALTA);
    if (altaIso) noteParts.push(`Cliente desde: ${altaIso} (sistema anterior)`);

    ownersOut.push({
      id,
      name: collapseSpaces(r.NOMBRE),
      phone: collapseSpaces(r.TELEFONO),
      email,
      address,
      relationship: '',
      dni: '',
      notes: noteParts.join('. '),
    });
  }
  ownersOut.end();
  counts.owners = ownersOut.total;
  counts.owners_excluded_by_cutoff = excludedOwners;
  if (invalidEmails) warn(`clientes.dbf: ${invalidEmails} emails con formato inválido (guardados en notes, no en email).`);
  t.close();
}

// ---------------------------------------------------------------------------
// 2) PACIENTES.DBF + paci2.DBF -> pets (solo los incluidos por el corte)
// ---------------------------------------------------------------------------
const petIdByCodigoPaci = new Map(); // CODIGOPACI -> pets.id
const petNameByCodigoPaci = new Map();
const petColorByCodigoPaci = new Map();

{
  const t2 = new DbfTable(path.join(SRC_DIR, 'paci2.DBF'));
  for (const r of t2.records()) {
    if (r.PELAJE.trim()) petColorByCodigoPaci.set(r.CODIGOPACI, collapseSpaces(r.PELAJE));
  }
  t2.close();
}

const petsOut = new BatchInsertWriter(stream, 'pets', [
  'id', 'name', 'species', 'breed', 'sex', 'color', 'birthdate', 'weight',
  'microchip', 'allergies', 'chronicConditions', 'notes', 'photo',
]);
const petOwnersOut = new BatchInsertWriter(stream, 'pet_owners', ['pet_id', 'owner_id']);

{
  const t = new DbfTable(path.join(SRC_DIR, 'PACIENTES.DBF'));
  let orphanPets = 0;
  for (const r of t.records()) {
    if (!includedCodigoPaci.has(r.CODIGOPACI)) continue;
    const id = randomUUID();
    petIdByCodigoPaci.set(r.CODIGOPACI, id);
    petNameByCodigoPaci.set(r.CODIGOPACI, collapseSpaces(r.NOMBRE).toUpperCase());

    const notes = r.VIVE === 'F' ? 'Fallecido (registro sistema anterior).' : '';

    petsOut.push({
      id,
      name: collapseSpaces(r.NOMBRE),
      species: normalizeSpecies(r.ESPECIE),
      breed: collapseSpaces(r.RAZA),
      sex: normalizeSex(r.SEXO),
      color: petColorByCodigoPaci.get(r.CODIGOPACI) || '',
      birthdate: dbfDateToIso(r.FECHA_NAC),
      weight: '',
      microchip: collapseSpaces(r.MICROCHIP),
      allergies: '',
      chronicConditions: '',
      notes,
      photo: '',
    });

    const ownerCode = r.CODIGOPACI.split('/')[0];
    const ownerId = ownerIdByCodigo.get(ownerCode);
    if (ownerId) {
      petOwnersOut.push({ pet_id: id, owner_id: ownerId });
    } else {
      orphanPets++;
    }
  }
  petsOut.end();
  petOwnersOut.end();
  counts.pets = petsOut.total;
  counts.pet_owners = petOwnersOut.total;
  if (orphanPets) warn(`PACIENTES.DBF: ${orphanPets} mascotas incluidas sin dueño encontrado (se migraron igual, sin vínculo).`);
  t.close();
}

// ---------------------------------------------------------------------------
// Historia clínica: helper común que aplica el veterinario por defecto
// (Dr. Héctor Eduardo Escobar) solo cuando la entrada no tiene profesional
// Y su fecha cae dentro del corte de 5 años.
// ---------------------------------------------------------------------------
const petHistoryOut = new BatchInsertWriter(stream, 'pet_history', [
  'id', 'pet_id', 'date', 'type', 'title', 'description', 'treatment', 'vet',
]);
let vetBackfilled = 0;

function addHistory(fields) {
  let vet = fields.vet;
  if (!vet && fields.date && fields.date >= CUTOFF_DATE) {
    vet = DEFAULT_VET;
    vetBackfilled++;
  }
  petHistoryOut.push({ ...fields, vet });
}

// ---------------------------------------------------------------------------
// 3) clinica.dbf (memo de historia clínica) -> pet_history
// ---------------------------------------------------------------------------
{
  const t = new DbfTable(path.join(SRC_DIR, 'clinica.dbf'));
  let unmatched = 0;
  for (const r of t.records()) {
    const petId = petIdByCodigoPaci.get(r.CODIGOPACI);
    if (!petId) { unmatched++; continue; }
    const entries = parseClinicaMemo(r.DESCRIP);
    for (const e of entries) {
      addHistory({
        id: randomUUID(),
        pet_id: petId,
        date: e.date,
        type: e.type,
        title: e.title,
        description: e.body,
        treatment: '',
        vet: e.vet,
      });
    }
  }
  if (unmatched) warn(`clinica.dbf: ${unmatched} registros de historia sin mascota incluida (fuera del corte u orfanos).`);
  t.close();
}

// ---------------------------------------------------------------------------
// 4) vacunas.dbf -> pet_vaccines (ES_VACUNA=T) / pet_history (ES_VACUNA=F, antiparasitarios y similares)
// ---------------------------------------------------------------------------
const petVaccinesOut = new BatchInsertWriter(stream, 'pet_vaccines', ['id', 'pet_id', 'name', 'date', 'nextDose']);

{
  const t = new DbfTable(path.join(SRC_DIR, 'vacunas.dbf'));
  let unmatched = 0;
  for (const r of t.records()) {
    const petId = petIdByCodigoPaci.get(r.CODIGOPACI);
    if (!petId) { unmatched++; continue; }

    const name = collapseSpaces(r.VACUNA) + (r.MARCA.trim() ? ` (${collapseSpaces(r.MARCA)})` : '');
    const date = dbfDateToIso(r.FECHA_APLI);

    if (r.ES_VACUNA === 'T') {
      // Próxima dosis: se migra tal cual, vencida o no (decisión del usuario).
      const nextDose = r.CANCELADA === 'T' ? '' : dbfDateToIso(r.FECHA_REVA);
      petVaccinesOut.push({ id: randomUUID(), pet_id: petId, name, date, nextDose });
    } else {
      const nextIso = dbfDateToIso(r.FECHA_REVA);
      const descParts = [collapseSpaces(r.VACUNA)];
      if (r.MARCA.trim()) descParts.push(`Marca: ${collapseSpaces(r.MARCA)}`);
      descParts.push(r.CANCELADA === 'T' ? 'Seguimiento cancelado.' : (nextIso ? `Próximo control: ${nextIso}.` : ''));
      addHistory({
        id: randomUUID(),
        pet_id: petId,
        date,
        type: 'tratamiento',
        title: collapseSpaces(r.VACUNA).slice(0, 70),
        description: descParts.filter(Boolean).join(' '),
        treatment: '',
        vet: '',
      });
    }
  }
  if (unmatched) warn(`vacunas.dbf: ${unmatched} registros sin mascota incluida (fuera del corte u orfanos).`);
  t.close();
}

// ---------------------------------------------------------------------------
// 5) metodos.dbf (resultados de laboratorio) -> pet_history
// ---------------------------------------------------------------------------
{
  const t = new DbfTable(path.join(SRC_DIR, 'metodos.dbf'));
  let unmatched = 0;
  for (const r of t.records()) {
    const petId = petIdByCodigoPaci.get(r.CODIGO_PAC);
    if (!petId) { unmatched++; continue; }
    addHistory({
      id: randomUUID(),
      pet_id: petId,
      date: dbfDateToIso(r.FECHA),
      type: 'laboratorio',
      title: collapseSpaces(r.TITULO) || 'Resultado de laboratorio',
      description: collapseSpaces(r.DATOS),
      treatment: '',
      vet: '',
    });
  }
  if (unmatched) warn(`metodos.dbf: ${unmatched} registros sin mascota incluida (fuera del corte u orfanos).`);
  t.close();
}

// ---------------------------------------------------------------------------
// 6) interna.dbf / guarderia.dbf -> pet_history (solo si el match dueño+mascota es inequívoco)
// ---------------------------------------------------------------------------
function buildNamePetIndex() {
  const idx = new Map(); // `${ownerNameUpper}||${petNameUpper}` -> [petId,...]
  for (const [codigopaci, petId] of petIdByCodigoPaci) {
    const ownerCode = codigopaci.split('/')[0];
    const ownerName = ownerNameByCodigo.get(ownerCode);
    const petName = petNameByCodigoPaci.get(codigopaci);
    if (!ownerName || !petName) continue;
    const key = `${ownerName}||${petName}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(petId);
  }
  return idx;
}
const namePetIndex = buildNamePetIndex();

function importByNameMatch(fileName, type) {
  const t = new DbfTable(path.join(SRC_DIR, fileName));
  let matched = 0, unmatched = 0;
  for (const r of t.records()) {
    const key = `${collapseSpaces(r.CLIENTE).toUpperCase()}||${collapseSpaces(r.PACIENTE).toUpperCase()}`;
    const candidates = namePetIndex.get(key);
    if (!candidates || candidates.length !== 1) { unmatched++; continue; }
    matched++;
    const petId = candidates[0];
    const notasTexto = collapseSpaces(r.NOTAS || '');
    const medicacionTexto = 'MEDICACION' in r ? collapseSpaces(r.MEDICACION || '') : '';
    const alimentoTexto = 'ALIMENTO' in r ? collapseSpaces(r.ALIMENTO || '') : '';
    const descParts = [];
    if (medicacionTexto) descParts.push(`Medicación: ${medicacionTexto}`);
    if (alimentoTexto) descParts.push(`Alimento: ${alimentoTexto}`);
    if (notasTexto) descParts.push(notasTexto);
    if (r.FECHA_SALE.trim()) descParts.push(`Egreso: ${dbfDateToIso(r.FECHA_SALE) || r.FECHA_SALE.trim()}`);
    addHistory({
      id: randomUUID(),
      pet_id: petId,
      date: dbfDateToIso(r.FECHA_ING),
      type,
      title: type === 'internación' ? 'Internación' : 'Guardería',
      description: descParts.filter(Boolean).join(' | '),
      treatment: '',
      vet: '',
    });
  }
  t.close();
  return { matched, unmatched };
}

{
  const res = importByNameMatch('interna.dbf', 'internación');
  counts.interna_matched = res.matched;
  if (res.unmatched) warn(`interna.dbf: ${res.unmatched} registros sin match unívoco de dueño+mascota (omitidos).`);
}
{
  const res = importByNameMatch('guarderia.dbf', 'guardería');
  counts.guarderia_matched = res.matched;
  if (res.unmatched) warn(`guarderia.dbf: ${res.unmatched} registros sin match unívoco de dueño+mascota (omitidos).`);
}

petHistoryOut.end();
petVaccinesOut.end();
counts.pet_history = petHistoryOut.total;
counts.pet_vaccines = petVaccinesOut.total;
counts.pet_history_vet_backfilled = vetBackfilled;

// Nota: stock.dbf (inventario) NO se migra en esta carga — decisión del
// usuario, el equipo lo arma con un recuento físico real.
counts.inventory = 0;
warn('stock.dbf: inventario no migrado en esta carga (decisión del usuario); se arma con recuento físico real.');

stream.end();

const idMap = {
  owners: Object.fromEntries(ownerIdByCodigo),
  pets: Object.fromEntries(petIdByCodigoPaci),
};
fs.writeFileSync(path.join(OUT_DIR, 'id-map.json'), JSON.stringify(idMap));

const report = {
  generatedAt: new Date().toISOString(),
  sourceDir: SRC_DIR,
  cutoffDate: CUTOFF_DATE,
  referenceToday: TODAY,
  defaultVet: DEFAULT_VET,
  counts,
  warnings,
};
fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

stream.on('finish', () => {
  console.log('SQL generado en', sqlPath);
  console.log(JSON.stringify(report, null, 2));
});
