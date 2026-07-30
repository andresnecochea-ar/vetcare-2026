// Sincroniza la versión de VetCare en los siete lugares que deben coincidir.
// Existe porque un reemplazo global de "2.9.0" también pisó la versión de una
// dependencia en package-lock.json y rompió `npm ci`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const target = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(target || '')) {
  console.error('Uso: node scripts/bump-version.mjs <major.minor.patch>');
  process.exit(1);
}

const read = (file) => readFileSync(join(projectRoot, file), 'utf8');
const write = (file, text) => writeFileSync(join(projectRoot, file), text, 'utf8');
const current = JSON.parse(read('package.json')).version;
if (current === target) {
  console.log(`La versión ya es ${target}.`);
  process.exit(0);
}

const escaped = current.replace(/\./g, '\\.');
const edits = [
  // Solo el campo version del propio paquete, nunca el de una dependencia.
  ['package.json', new RegExp(`("version":\\s*")${escaped}(")`), 1],
  ['package-lock.json', new RegExp(`("name":\\s*"vetcare",\\s*\\r?\\n\\s*"version":\\s*")${escaped}(")`, 'g'), 2],
  ['backend/wrangler.jsonc', new RegExp(`("APP_VERSION":\\s*")${escaped}(")`), 1],
  ['backend/worker-configuration.d.ts', new RegExp(`(APP_VERSION:\\s*")${escaped}(")`), 1],
  ['backend/test/worker.test.js', new RegExp(`(version:\\s*')${escaped}(')`), 1],
  ['js/settings.js', new RegExp(`(APP_VERSION\\s*=\\s*')${escaped}(')`), 1],
  ['index.html', new RegExp(`(\\?v=)${escaped}(-\\d+)`, 'g'), null],
];

for (const [file, pattern, expected] of edits) {
  const text = read(file);
  const matches = text.match(pattern);
  const found = matches ? (pattern.flags.includes('g') ? matches.length : 1) : 0;
  if (!found || (expected !== null && found !== expected)) {
    console.error(`${file}: se esperaban ${expected ?? '1 o más'} coincidencias de ${current} y hubo ${found}.`);
    process.exit(1);
  }
  write(file, text.replace(pattern, `$1${target}$2`));
  console.log(`${file}: ${found} referencia${found === 1 ? '' : 's'} actualizada${found === 1 ? '' : 's'}.`);
}

console.log(`\nVersión ${current} → ${target}. Falta correr: npm run worker:types`);
