import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { coverageThresholds } from '../../../tools/vitest/coverage-thresholds';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/iot/types-shared',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'iot-types-shared',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/iot/types-shared',
      provider: 'v8' as const,
      ...coverageThresholds(),
      // types-shared exports pure types — a low function bar is appropriate.
      thresholds: { lines: 0, statements: 0, functions: 0, branches: 0 },
    },
  },
}));
