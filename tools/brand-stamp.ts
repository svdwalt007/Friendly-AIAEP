/**
 * @file Brand-stamp tool — applies tenant brand kit to generated app bundles.
 * @license MIT
 * Copyright (c) 2026 Friendly Technologies
 *
 * Reads `BRAND_KIT` from `Tenant.metadata.brandKit` at build-time and rewrites
 * CSS custom-property values in the bundle's HTML/CSS output. The current
 * implementation is the identity function; the typed surface area is fixed so
 * downstream call sites can integrate before the rewrite logic lands.
 */

/**
 * Tenant-supplied brand kit consumed by the build pipeline.
 *
 * `primaryColor` becomes `--ft-primary`, `logoUrl` is injected into the
 * generated `<header>`, and `tenantName` populates the document `<title>`.
 */
export interface BrandKit {
  /** Hex (e.g. `#1e88e5`) used for `--ft-primary`. */
  readonly primaryColor: string;
  /** Absolute or relative URL to the tenant logo image. */
  readonly logoUrl: string;
  /** Tenant display name; used in titles and aria-labels. */
  readonly tenantName: string;
}

/**
 * Apply a brand kit to the supplied HTML/CSS bundle string.
 *
 * No-op identity transform pending the rewrite implementation. Returning the
 * input verbatim preserves caller behaviour while the typed contract is
 * stable.
 */
export function applyBrandKit(html: string, _kit: BrandKit): string {
  return html;
}
