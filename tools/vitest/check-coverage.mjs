#!/usr/bin/env node
/**
 * Walks every `coverage/**\/coverage-summary.json` produced by Vitest's v8
 * reporter and fails the build if any project drops below the workspace
 * thresholds. Also writes a markdown aggregate to `coverage/aggregate-summary.md`
 * for the GitHub Actions job summary.
 *
 * Reads thresholds from env (so CI can override per-branch) and falls back to
 * the shared coverage-thresholds module.
 *
 * Usage:  node tools/vitest/check-coverage.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COVERAGE_DIR = join(ROOT, 'coverage');

const FLOORS = {
  lines: Number(process.env.MIN_LINE_COVERAGE ?? 80),
  branches: Number(process.env.MIN_BRANCH_COVERAGE ?? 75),
  functions: Number(process.env.MIN_FUNCTION_COVERAGE ?? 80),
  statements: Number(process.env.MIN_STATEMENT_COVERAGE ?? 80),
};

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, acc);
    } else if (name === 'coverage-summary.json') {
      acc.push(full);
    }
  }
  return acc;
}

const summaries = walk(COVERAGE_DIR);

if (summaries.length === 0) {
  console.error(
    `::warning::No coverage-summary.json found under ${COVERAGE_DIR}. ` +
      'Did affected projects actually run with --coverage?',
  );
  process.exit(0);
}

const rows = [];
let fails = 0;

for (const file of summaries) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const total = data.total ?? {};
  const project = relative(COVERAGE_DIR, dirname(file)).split(sep).join('/');

  const metrics = {
    lines: total.lines?.pct ?? 0,
    branches: total.branches?.pct ?? 0,
    functions: total.functions?.pct ?? 0,
    statements: total.statements?.pct ?? 0,
  };

  const breaches = Object.entries(FLOORS)
    .filter(([k, floor]) => metrics[k] < floor)
    .map(([k, floor]) => `${k}=${metrics[k].toFixed(1)}<${floor}`);

  if (breaches.length > 0) fails += 1;

  rows.push({
    project,
    metrics,
    breaches,
  });
}

const md = [
  '## Vitest coverage summary',
  '',
  `Thresholds: lines ≥ ${FLOORS.lines}, branches ≥ ${FLOORS.branches}, functions ≥ ${FLOORS.functions}, statements ≥ ${FLOORS.statements}.`,
  '',
  '| Project | Lines | Branches | Functions | Statements | Status |',
  '|---------|------:|---------:|----------:|-----------:|:------:|',
  ...rows.map(
    (r) =>
      `| ${r.project} | ${r.metrics.lines.toFixed(1)} | ${r.metrics.branches.toFixed(1)} | ` +
      `${r.metrics.functions.toFixed(1)} | ${r.metrics.statements.toFixed(1)} | ` +
      (r.breaches.length === 0 ? 'pass' : `fail (${r.breaches.join(', ')})`) +
      ' |',
  ),
].join('\n');

writeFileSync(join(COVERAGE_DIR, 'aggregate-summary.md'), md + '\n');
console.log(md);

if (fails > 0) {
  console.error(`::error::${fails} project(s) below coverage thresholds.`);
  process.exit(1);
}
