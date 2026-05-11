/**
 * License Service Module
 *
 * Provides license key generation, validation, and feature gating for the
 * Friendly AI AEP Tool. Supports three tiers (Starter, Pro, Enterprise) and
 * two deployment modes (SaaS, Dedicated).
 *
 * @module @friendly-aiaep/license-service
 *
 * @example
 * ```typescript
 * import { LicenseService, LicenseTier, DeployMode } from '@friendly-aiaep/license-service';
 * import Redis from 'ioredis';
 *
 * const redis = new Redis();
 * const service = new LicenseService(redis, process.env.FRIENDLY_LICENSE_SECRET);
 *
 * // Generate a key
 * const key = service.generateKey(
 *   'tenant-123',
 *   LicenseTier.PROFESSIONAL,
 *   DeployMode.SAAS
 * );
 *
 * // Validate a key
 * const result = await service.validateKey(key);
 * if (result.valid) {
 *   console.log(`Valid ${result.license.tier} license`);
 * }
 *
 * // Check feature entitlement
 * const canUseGit = await service.isFeatureEnabled(key, LicenseFeature.GIT_PUSH);
 * ```
 */

// Export main service class
export { LicenseService } from './lib/license-service';

// Export types
export type {
  LicenseKey,
  LicenseValidation,
  TierPreset,
  FeatureFlags,
  LicenseGenerationOptions,
} from './lib/types';

export { LicenseTier, DeployMode, LicenseFeature } from './lib/types';

// Export constants
export {
  FEATURE_BITS,
  TIER_PRESETS,
  LICENSE_KEY_PREFIX,
  LICENSE_KEY_SEPARATOR,
  TENANT_HASH_LENGTH,
  HMAC_LENGTH,
  DEFAULT_VALIDITY_PERIOD_MS,
  REDIS_REVOCATION_PREFIX,
  REDIS_REVOCATION_TTL,
} from './lib/constants';
