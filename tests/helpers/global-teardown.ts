/**
 * Playwright global teardown — runs once after the entire test suite.
 *
 * Currently a no-op; reserved for cleaning seed data, closing pooled
 * connections, or pushing artefacts to S3 in CI.
 */
export default async function globalTeardown(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[playwright] global-teardown complete');
}
