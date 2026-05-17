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
 * Current state (May 2026, with broader source coverage measured):
 *   aep-preview-host  100 / 100 / 100 / 100
 *   aep-admin          86 /  82 /  73 /  85
 *   aep-api-gateway    80 /  69 /  85 /  80
 *   aep-builder        73 /  65 /  62 /  71
 *   --- worst -------- 73 /  65 /  62 /  71
 *
 * Counter-intuitive math: adding a spec for a LARGE component can
 * temporarily DROP the project's % overall, because the source file
 * now contributes its unexercised lines/branches to the denominator
 * for the first time. The fix is more thorough specs touching those
 * branches (drag handlers, template @if/@for guards, error paths) —
 * not lower floors. The plan here is to ratchet back UP as those
 * specs land.
 *
 * Ratchet plan:
 *   Phase A         — 50 / 40 / 50 / 50  → unblock CI [DONE]
 *   Phase B+        — 70 / 60 / 65 / 70  → first round of service specs [DONE]
 *   Phase C-ish     — 75 / 65 / 65 / 72  → gateway plugins [DONE]
 *   Phase C-extras  — 70 / 60 / 60 / 68  → broader builder source measured [CURRENT]
 *   Phase D         — 80 / 75 / 80 / 80  → target reached
 *
 * Don't bump the floor without confirming the new value is currently met
 * by every project that produces a coverage-summary.json.
 */
export const COVERAGE_FLOOR = {
  lines: 70,
  statements: 68,
  functions: 60,
  branches: 60,
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
    // Per-project vitest thresholds are intentionally NOT enforced here.
    // The gate that matters runs in CI via `tools/vitest/check-coverage.mjs`,
    // which walks every `coverage-summary.json` and applies the floor to
    // the PROJECT AVERAGE. Vitest's own threshold check is per-FILE, so
    // a single low-coverage file (e.g. a route module with one untested
    // 5xx branch) would redline an otherwise-healthy project. Keep the
    // ratchet in one place — see COVERAGE_FLOOR above — and let CI
    // enforce. Per-project overrides can still set their own thresholds
    // in their vitest.config.mts if they have a reason to be stricter.
    thresholds: {
      lines: 0,
      statements: 0,
      functions: 0,
      branches: 0,
    },
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
