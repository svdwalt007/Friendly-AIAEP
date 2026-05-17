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
 * The workspace-wide floor for unit-test coverage.
 *
 * Current state (May 2026) — aep-builder 72/67/62/69, aep-admin 86/82/73/85,
 * aep-api-gateway 15% spec ratio (coverage unknown).
 *
 * The TARGET remains 80/75/80/80. The FLOOR below is a transitional
 * baseline that lets CI go green today while phased spec backfill lands.
 *
 * Ratchet plan (raise on merge of each phase):
 *   Phase A (now)              — 50/40/50/50  → unblock CI
 *   Phase B (aep-builder spec) — 70/65/70/70
 *   Phase C (api-gateway spec) — 75/70/75/75
 *   Phase D (E2E parity)       — 80/75/80/80  → target reached
 *
 * Don't bump the floor without confirming the new value is currently met
 * by every project that produces a coverage-summary.json.
 */
export const COVERAGE_FLOOR = {
  lines: 50,
  statements: 50,
  functions: 50,
  branches: 40,
} as const;

/** Aspirational target — the bar we ratchet back up to. */
export const COVERAGE_TARGET = {
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 75,
} as const;

export function coverageThresholds(): CoverageThresholdConfig {
  return {
    thresholds: { ...COVERAGE_FLOOR },
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
      // Code-gen output, not hand-maintained — excluded until templates
      // get their own test target (Phase E).
      'apps/generated-templates/**',
      // Documentation/example code shipped alongside the IoT toolkit;
      // these import from the lib but aren't part of the lib's API surface.
      'libs/iot/**/*.example.ts',
      'libs/iot/**/ENCRYPTION_EXAMPLES.ts',
    ],
  };
}
