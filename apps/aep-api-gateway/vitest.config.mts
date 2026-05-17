import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { coverageThresholds } from '../../tools/vitest/coverage-thresholds';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/aep-api-gateway',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'aep-api-gateway',
    watch: false,
    globals: true,
    environment: 'node',
    // Bumped from the 5s default — Fastify plugin specs pay a 10–15s
    // cold-import penalty (the first @fastify/sensible / @fastify/cors
    // require resolves a long dep chain), which trips testTimeout on the
    // first `it()` of every file. Subsequent tests in the same file run
    // in milliseconds, so 30s is comfortable headroom without slowing
    // the happy path.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/aep-api-gateway',
      provider: 'v8' as const,
      ...coverageThresholds(),
    },
  },
}));
