import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputDirectory = join(projectRoot, 'dist');

if (outputDirectory !== resolve(projectRoot, 'dist')) {
  throw new Error('Directorio de salida inválido.');
}

if (existsSync(outputDirectory)) rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

for (const entry of ['index.html', 'assets', 'css', 'js']) {
  cpSync(join(projectRoot, entry), join(outputDirectory, entry), { recursive: true });
}

console.log(`Frontend preparado en ${outputDirectory}`);
