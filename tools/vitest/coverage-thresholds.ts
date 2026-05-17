/**
 * @file Shared Vitest coverage thresholds for Friendly-AIAEP.
 * Imported by every project's `vitest.config.mts` so a regression below
 * the target percentages fails the run.
 *
 * Override in a project by spreading + replacing fields:
 *
 *   import { coverageThresholds } from '../../tools/vitest/coverage-thresholds';
 *   ...
 *   coverage: {
 *     ...coverageThresholds(),
 *     thresholds: { ...coverageThresholds().thresholds, lines: 85 },
 *   }
 */

export interface CoverageThresholdConfig {
  thresholds: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  exclude: string[];
  reporter: Array<'text' | 'lcov' | 'json' | 'json-summary' | 'html'>;
}

/**
 * The workspace-wide bar for unit-test coverage. Adjust here to move the
 * gate globally; tweak per project only when there's a documented reason.
 */
export const COVERAGE_TARGET = {
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 75,
} as const;

export function coverageThresholds(): CoverageThresholdConfig {
  return {
    thresholds: { ...COVERAGE_TARGET },
    reporter: ['text', 'lcov', 'json', 'json-summary', 'html'],
    exclude: [
      '**/*.stories.{ts,tsx}',
      '**/*.fixture.ts',
      '**/index.ts',
      '**/environment.*.ts',
      '**/main.ts',
      '**/main-with-telemetry.ts',
      '**/*.config.{ts,mts,mjs,js}',
      '**/dist/**',
      '**/.angular/**',
      '**/node_modules/**',
    ],
  };
}
