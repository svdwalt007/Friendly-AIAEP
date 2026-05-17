import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { coverageThresholds } from '../../tools/vitest/coverage-thresholds';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/aep-preview-host',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'aep-preview-host',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.{ts,mts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/aep-preview-host',
      provider: 'v8' as const,
      ...coverageThresholds(),
    },
  },
}));
