import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const configHome = join(projectRoot, '.wrangler-config');
const wranglerCli = join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

mkdirSync(configHome, { recursive: true });

const result = spawnSync(process.execPath, [wranglerCli, ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: {
    ...process.env,
    XDG_CONFIG_HOME: configHome,
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
