/**
 * License Service Constants
 *
 * Feature flag definitions, tier presets, and configuration constants.
 */

import { LicenseTier, LicenseFeature, TierPreset } from './types';

/**
 * Feature flag bit positions
 */
export const FEATURE_BITS = {
  /** Bit 0: Helm chart output generation */
  HELM_OUTPUT: 1 << LicenseFeature.HELM_OUTPUT, // 0b0000001
  /** Bit 1: Git push capability */
  GIT_PUSH: 1 << LicenseFeature.GIT_PUSH, // 0b0000010
  /** Bit 2: Ollama LLM provider support */
  OLLAMA_LLM: 1 << LicenseFeature.OLLAMA_LLM, // 0b0000100
  /** Bit 3: Air-gap disconnected mode */
  AIR_GAP_MODE: 1 << LicenseFeature.AIR_GAP_MODE, // 0b0001000
  /** Bit 4: Third-party IoT data ingestion */
  THIRD_PARTY_INGESTION: 1 << LicenseFeature.THIRD_PARTY_INGESTION, // 0b0010000
  /** Bit 5: Custom widget development */
  CUSTOM_WIDGETS: 1 << LicenseFeature.CUSTOM_WIDGETS, // 0b0100000
  /** Bit 6: Multi-environment promotion */
  MULTI_ENVIRONMENT: 1 << LicenseFeature.MULTI_ENVIRONMENT, // 0b1000000
} as const;

/**
 * Tier preset configurations
 *
 * Defines the default feature flags for each tier:
 * - Starter: No optional features (0b0000000)
 * - Pro: Git + 3rd-party + multi-env (0b0010011 = 19)
 * - Enterprise: All features (0b1111111 = 127)
 */
export const TIER_PRESETS: Record<LicenseTier, TierPreset> = {
  [LicenseTier.STARTER]: {
    tier: LicenseTier.STARTER,
    features: 0b0000000, // No optional features
    priceUsd: 499,
    description: 'Starter tier - Basic features only',
  },
  [LicenseTier.PROFESSIONAL]: {
    tier: LicenseTier.PROFESSIONAL,
    features:
      FEATURE_BITS.GIT_PUSH | // Bit 1
      FEATURE_BITS.THIRD_PARTY_INGESTION | // Bit 4
      FEATURE_BITS.MULTI_ENVIRONMENT, // Bit 6
    // 0b0010011 = 19
    priceUsd: 2499,
    description: 'Professional tier - Git, 3rd-party ingestion, multi-env',
  },
  [LicenseTier.ENTERPRISE]: {
    tier: LicenseTier.ENTERPRISE,
    features: 0b1111111, // All features enabled (127)
    priceUsd: 7999,
    description: 'Enterprise tier - All features including Ollama and air-gap',
  },
};

/**
 * License key prefix
 */
export const LICENSE_KEY_PREFIX = 'FTECH-AEP';

/**
 * License key component separator
 */
export const LICENSE_KEY_SEPARATOR = '-';

/**
 * Number of characters in tenant hash (from SHA-256)
 */
export const TENANT_HASH_LENGTH = 8;

/**
 * Number of characters in HMAC signature
 */
export const HMAC_LENGTH = 12;

/**
 * Default license validity period (1 year in milliseconds)
 */
export const DEFAULT_VALIDITY_PERIOD_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Redis key prefix for revocation list
 */
export const REDIS_REVOCATION_PREFIX = 'license:revoked:';

/**
 * Redis TTL for revoked keys (10 years in seconds)
 */
export const REDIS_REVOCATION_TTL = 10 * 365 * 24 * 60 * 60; // 10 years
