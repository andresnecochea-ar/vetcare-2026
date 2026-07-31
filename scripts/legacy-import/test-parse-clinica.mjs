import { DbfTable } from './dbf.mjs';
import { parseClinicaMemo } from './parse-clinica.mjs';

const SRC = process.argv[2] || '_otros/Backup_sistemaviejo/clinica.dbf';
const c = new DbfTable(SRC);

let patientsWithMemo = 0;
let patientsZeroEntries = 0;
let totalEntries = 0;
let vacunaCount = 0;
let consultaCount = 0;
let noDateCount = 0;
let emptyVetCount = 0;
let longBodyCount = 0; // posible fusión incorrecta de dos entradas
const zeroEntrySamples = [];
const longBodySamples = [];

for (const r of c.records()) {
  const text = r.DESCRIP;
  if (!text || !text.trim()) continue;
  patientsWithMemo++;
  const entries = parseClinicaMemo(text);
  if (entries.length === 0) {
    patientsZeroEntries++;
    if (zeroEntrySamples.length < 5) zeroEntrySamples.push({ codigo: r.CODIGOPACI, text: text.slice(0, 200) });
    continue;
  }
  for (const e of entries) {
    totalEntries++;
    if (e.type === 'vacuna') vacunaCount++; else consultaCount++;
    if (!e.date) noDateCount++;
    if (!e.vet) emptyVetCount++;
    if (e.body.length > 2000) {
      longBodyCount++;
      if (longBodySamples.length < 3) longBodySamples.push({ codigo: r.CODIGOPACI, len: e.body.length, preview: e.body.slice(0, 300) });
    }
  }
}
c.close();

console.log('pacientes con memo no vacío:', patientsWithMemo);
console.log('pacientes cuyo memo no produjo ninguna entrada:', patientsZeroEntries);
console.log('total entradas parseadas:', totalEntries);
console.log('  tipo vacuna:', vacunaCount, ' tipo consulta:', consultaCount);
console.log('  sin fecha reconocible:', noDateCount);
console.log('  sin veterinario:', emptyVetCount);
console.log('  entradas con body > 2000 chars (revisar fusión):', longBodyCount);
console.log('\n--- muestras memo->0 entradas ---');
console.log(zeroEntrySamples);
console.log('\n--- muestras body largo ---');
console.log(longBodySamples);
