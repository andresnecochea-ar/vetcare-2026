import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const roots = [join(projectRoot, 'js'), join(projectRoot, 'scripts')];
const files = [];

function collectJavaScript(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScript(fullPath);
    else if (extname(entry.name) === '.js' || extname(entry.name) === '.mjs') files.push(fullPath);
  }
}

for (const root of roots) collectJavaScript(root);

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`Sintaxis válida: ${files.length} archivos JavaScript.`);
