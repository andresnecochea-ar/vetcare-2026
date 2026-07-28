import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const projectRoot = resolve(import.meta.dirname);

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(join(projectRoot, 'backend', 'migrations'));
      return {
        wrangler: {
          configPath: join(projectRoot, 'backend', 'wrangler.jsonc'),
        },
        miniflare: {
          bindings: {
            INVITE_CODE: 'test-invite-code',
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  test: {
    setupFiles: ['./backend/test/apply-migrations.js'],
    include: ['./backend/test/**/*.test.js'],
  },
});
