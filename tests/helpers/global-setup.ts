/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Today this only logs the resolved base URL and ensures `test-results/` exists
 * so JUnit/HTML reporters do not race on first write. Add seed data, auth
 * priming, or DB resets here as the suite grows.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4200';
  const apiURL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3000';

  mkdirSync(resolve('test-results'), { recursive: true });

  // eslint-disable-next-line no-console
  console.log(`[playwright] global-setup: baseURL=${baseURL} apiURL=${apiURL}`);
}
