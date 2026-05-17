#!/usr/bin/env node
/**
 * One-shot migration: patch every vitest.config.mts under apps/ and libs/
 * to (1) import the shared coverageThresholds() preset and (2) spread it
 * into the `coverage` block.
 *
 * Idempotent — running again is a no-op if the import already exists.
 *
 * Usage:  node tools/vitest/apply-thresholds.mjs
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHARED = join(ROOT, 'tools', 'vitest', 'coverage-thresholds');

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.nx' || name === 'dist') continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (name === 'vitest.config.mts') acc.push(full);
  }
  return acc;
}

const configs = [
  ...walk(join(ROOT, 'apps')),
  ...walk(join(ROOT, 'libs')),
];

let patched = 0;
let skipped = 0;

for (const file of configs) {
  let src = readFileSync(file, 'utf8');

  if (src.includes('coverageThresholds(')) {
    skipped += 1;
    continue;
  }

  const rel = relative(dirname(file), SHARED).replaceAll('\\', '/');
  const importLine = `import { coverageThresholds } from '${rel}';\n`;

  // Insert the import after the last existing import line.
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('import ')) lastImport = i;
  }
  lines.splice(lastImport + 1, 0, importLine.trimEnd());
  src = lines.join('\n');

  // Spread the preset into the coverage block.
  src = src.replace(
    /(coverage:\s*\{[^}]*provider:\s*'v8' as const,)/,
    `$1\n      ...coverageThresholds(),`,
  );

  writeFileSync(file, src);
  patched += 1;
}

console.log(`patched ${patched} files, skipped ${skipped} already-patched.`);
