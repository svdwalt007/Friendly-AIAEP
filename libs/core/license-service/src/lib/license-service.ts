/**
 * License Service
 *
 * Handles license key generation, validation, feature gating, and revocation.
 *
 * License key format:
 * FTECH-AEP-{TIER}-{DEPLOY}-{TENANT_HASH}-{EXPIRY}-{FLAGS}-{HMAC}
 *
 * Example:
 * FTECH-AEP-PRO-S-A1B2C3D4-1735689600-13-9F8E7D6C5B4A
 *
 * @module LicenseService
 */

import { createHmac, createHash } from 'crypto';
import Redis from 'ioredis';
import {
  LicenseTier,
  DeployMode,
  LicenseKey,
  LicenseValidation,
  LicenseGenerationOptions,
  FeatureFlags,
  LicenseFeature,
} from './types';
import {
  TIER_PRESETS,
  LICENSE_KEY_PREFIX,
  LICENSE_KEY_SEPARATOR,
  TENANT_HASH_LENGTH,
  HMAC_LENGTH,
  DEFAULT_VALIDITY_PERIOD_MS,
  REDIS_REVOCATION_PREFIX,
  REDIS_REVOCATION_TTL,
} from './constants';

/**
 * LicenseService class
 *
 * Provides methods for license key lifecycle management:
 * - Generate cryptographically signed license keys
 * - Validate keys and parse their components
 * - Check feature entitlements
 * - Revoke keys via Redis
 */
export class LicenseService {
  private readonly secret: string;
  private readonly redis: Redis;

  /**
   * Creates a new LicenseService instance
   *
   * @param redis - Redis client for revocation list
   * @param secret - HMAC signing secret (loaded from FRIENDLY_LICENSE_SECRET env var)
   * @throws {Error} If secret is not provided
   */
  constructor(redis: Redis, secret?: string) {
    this.redis = redis;
    this.secret = secret || process.env['FRIENDLY_LICENSE_SECRET'] || '';

    if (!this.secret) {
      throw new Error(
        'License secret not configured. Set FRIENDLY_LICENSE_SECRET environment variable.'
      );
    }
  }

  /**
   * Generates a license key with HMAC signature
   *
   * @param tenantId - Unique tenant identifier (will be hashed)
   * @param tier - License tier (STR, PRO, ENT)
   * @param deployMode - Deployment mode (S=SaaS, D=Dedicated)
   * @param features - Feature flags bitfield (optional - defaults to tier preset)
   * @param expiryDate - License expiry date (optional - defaults to 1 year from now)
   * @returns Signed license key string
   *
   * @example
   * const key = service.generateKey(
   *   'tenant-123',
   *   LicenseTier.PROFESSIONAL,
   *   DeployMode.SAAS
   * );
   * // Returns: FTECH-AEP-PRO-S-A1B2C3D4-1735689600-13-9F8E7D6C5B4A
   */
  generateKey(
    tenantId: string,
    tier: LicenseTier,
    deployMode: DeployMode,
    features?: FeatureFlags,
    expiryDate?: Date
  ): string {
    // Use tier preset features if not specified
    const featureFlags =
      features !== undefined ? features : TIER_PRESETS[tier].features;

    // Default to 1 year from now if no expiry date specified
    const expiry = expiryDate
      ? Math.floor(expiryDate.getTime() / 1000)
      : Math.floor((Date.now() + DEFAULT_VALIDITY_PERIOD_MS) / 1000);

    // Generate tenant hash (first 8 chars of SHA-256)
    const tenantHash = this.hashTenant(tenantId);

    // Convert feature flags to hex string
    const flagsHex = featureFlags.toString(16).toUpperCase();

    // Build key components (without HMAC)
    const keyComponents = [
      LICENSE_KEY_PREFIX,
      tier,
      deployMode,
      tenantHash,
      expiry.toString(),
      flagsHex,
    ];

    // Generate HMAC signature
    const hmac = this.generateHmac(keyComponents.join(LICENSE_KEY_SEPARATOR));

    // Append HMAC and return complete key
    keyComponents.push(hmac);
    return keyComponents.join(LICENSE_KEY_SEPARATOR);
  }

  /**
   * Validates a license key and returns parsed components
   *
   * Performs the following checks:
   * - Correct format and component count
   * - Valid tier and deployment mode
   * - HMAC signature verification
   * - Expiry date validation
   * - Revocation status check
   *
   * @param key - License key string to validate
   * @returns Validation result with parsed license details
   *
   * @example
   * const result = await service.validateKey(licenseKey);
   * if (result.valid) {
   *   console.log(`Valid ${result.license.tier} license`);
   * } else {
   *   console.error(result.error);
   * }
   */
  async validateKey(key: string): Promise<LicenseValidation> {
    try {
      // Parse key components
      const parts = key.split(LICENSE_KEY_SEPARATOR);

      // Check format: FTECH-AEP-{TIER}-{DEPLOY}-{HASH}-{EXPIRY}-{FLAGS}-{HMAC}
      if (parts.length !== 8) {
        return {
          valid: false,
          error: `Invalid key format: expected 8 components, got ${parts.length}`,
        };
      }

      const [prefix, product, tier, deployMode, tenantHash, expiryStr, flagsHex, hmac] = parts;

      // Validate prefix
      if (prefix !== 'FTECH' || product !== 'AEP') {
        return {
          valid: false,
          error: 'Invalid key prefix: must start with FTECH-AEP',
        };
      }

      // Validate tier
      if (!Object.values(LicenseTier).includes(tier as LicenseTier)) {
        return {
          valid: false,
          error: `Invalid tier: ${tier}. Must be STR, PRO, or ENT`,
        };
      }

      // Validate deployment mode
      if (!Object.values(DeployMode).includes(deployMode as DeployMode)) {
        return {
          valid: false,
          error: `Invalid deployment mode: ${deployMode}. Must be S or D`,
        };
      }

      // Validate tenant hash length
      if (tenantHash.length !== TENANT_HASH_LENGTH) {
        return {
          valid: false,
          error: `Invalid tenant hash length: expected ${TENANT_HASH_LENGTH}, got ${tenantHash.length}`,
        };
      }

      // Parse expiry timestamp
      const expiresAt = parseInt(expiryStr, 10);
      if (isNaN(expiresAt)) {
        return {
          valid: false,
          error: `Invalid expiry timestamp: ${expiryStr}`,
        };
      }

      // Parse feature flags
      const features = parseInt(flagsHex, 16);
      if (isNaN(features)) {
        return {
          valid: false,
          error: `Invalid feature flags hex: ${flagsHex}`,
        };
      }

      // Verify HMAC signature
      const keyWithoutHmac = parts.slice(0, -1).join(LICENSE_KEY_SEPARATOR);
      const expectedHmac = this.generateHmac(keyWithoutHmac);

      if (hmac !== expectedHmac) {
        return {
          valid: false,
          error: 'Invalid HMAC signature: key has been tampered with',
          invalidSignature: true,
        };
      }

      // Build parsed license object
      const license: LicenseKey = {
        raw: key,
        tier: tier as LicenseTier,
        deployMode: deployMode as DeployMode,
        tenantHash,
        expiresAt,
        features,
        hmac,
      };

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt < now) {
        return {
          valid: false,
          license,
          error: `License expired on ${new Date(expiresAt * 1000).toISOString()}`,
          expired: true,
        };
      }

      // Check revocation status
      const isRevoked = await this.isKeyRevoked(key);
      if (isRevoked) {
        return {
          valid: false,
          license,
          error: 'License has been revoked',
          revoked: true,
        };
      }

      // All checks passed
      return {
        valid: true,
        license,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Checks if a specific feature is enabled in a license key
   *
   * @param key - License key string
   * @param feature - Feature flag to check
   * @returns True if feature is enabled, false otherwise
   *
   * @example
   * const canUseGit = await service.isFeatureEnabled(
   *   licenseKey,
   *   LicenseFeature.GIT_PUSH
   * );
   */
  async isFeatureEnabled(
    key: string,
    feature: LicenseFeature
  ): Promise<boolean> {
    const validation = await this.validateKey(key);

    if (!validation.valid || !validation.license) {
      return false;
    }

    // Check if the specific bit is set
    const featureBit = 1 << feature;
    return (validation.license.features & featureBit) !== 0;
  }

  /**
   * Revokes a license key by adding it to the Redis revocation list
   *
   * Revoked keys will fail validation with revoked=true.
   * The revocation entry expires after 10 years.
   *
   * @param key - License key to revoke
   * @returns Promise that resolves when revocation is complete
   *
   * @example
   * await service.revokeKey(compromisedKey);
   */
  async revokeKey(key: string): Promise<void> {
    const redisKey = `${REDIS_REVOCATION_PREFIX}${key}`;
    await this.redis.setex(
      redisKey,
      REDIS_REVOCATION_TTL,
      new Date().toISOString()
    );
  }

  /**
   * Checks if a license key has been revoked
   *
   * @param key - License key to check
   * @returns True if key is revoked, false otherwise
   */
  private async isKeyRevoked(key: string): Promise<boolean> {
    const redisKey = `${REDIS_REVOCATION_PREFIX}${key}`;
    const result = await this.redis.exists(redisKey);
    return result === 1;
  }

  /**
   * Generates SHA-256 hash of tenant ID and returns first 8 characters
   *
   * @param tenantId - Tenant identifier
   * @returns First 8 characters of SHA-256 hash in uppercase hex
   */
  private hashTenant(tenantId: string): string {
    const hash = createHash('sha256').update(tenantId).digest('hex');
    return hash.substring(0, TENANT_HASH_LENGTH).toUpperCase();
  }

  /**
   * Generates HMAC-SHA256 signature and returns first 12 characters
   *
   * @param data - Data to sign
   * @returns First 12 characters of HMAC in uppercase hex
   */
  private generateHmac(data: string): string {
    const hmac = createHmac('sha256', this.secret)
      .update(data)
      .digest('hex')
      .toUpperCase();
    return hmac.substring(0, HMAC_LENGTH);
  }

  /**
   * Generates a license key using the fluent options interface
   *
   * @param options - License generation options
   * @returns Signed license key string
   *
   * @example
   * const key = service.generateKeyWithOptions({
   *   tenantId: 'tenant-123',
   *   tier: LicenseTier.ENTERPRISE,
   *   deployMode: DeployMode.DEDICATED,
   *   expiryDate: new Date('2026-12-31')
   * });
   */
  generateKeyWithOptions(options: LicenseGenerationOptions): string {
    return this.generateKey(
      options.tenantId,
      options.tier,
      options.deployMode,
      options.features,
      options.expiryDate
    );
  }

  /**
   * Gets the tier preset configuration for a given tier
   *
   * @param tier - License tier
   * @returns Tier preset configuration
   */
  static getTierPreset(tier: LicenseTier) {
    return TIER_PRESETS[tier];
  }

  /**
   * Closes the Redis connection
   *
   * Should be called when shutting down the service
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
