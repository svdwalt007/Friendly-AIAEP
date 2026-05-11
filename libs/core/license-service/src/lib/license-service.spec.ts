/**
 * Comprehensive Vitest tests for LicenseService
 *
 * Test coverage includes:
 * - Key generation (all tiers, deploy modes, tenant hashing, expiry, flags)
 * - Key validation (valid/invalid, expiry, tamper detection, revocation)
 * - Feature flags (bitfield operations, tier presets)
 * - Revocation (Redis storage)
 * - Edge cases (long tenantId, far future expiry, all/no features)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LicenseService } from './license-service';
import {
  LicenseTier,
  DeployMode,
  LicenseFeature,
  LicenseValidation,
} from './types';
import {
  TIER_PRESETS,
  LICENSE_KEY_SEPARATOR,
  TENANT_HASH_LENGTH,
  HMAC_LENGTH,
} from './constants';

/**
 * Mock Redis client implementation
 */
class MockRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async setex(key: string, ttl: number, value: string): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiresAt });
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return 0;
    }

    return 1;
  }

  async quit(): Promise<void> {
    this.store.clear();
  }

  // Helper method for testing
  clear(): void {
    this.store.clear();
  }
}

describe('LicenseService', () => {
  let service: LicenseService;
  let mockRedis: MockRedis;
  const testSecret = 'test-secret-key-for-hmac-signing-do-not-use-in-production';

  beforeEach(() => {
    mockRedis = new MockRedis();
    service = new LicenseService(mockRedis as any, testSecret);
  });

  afterEach(() => {
    mockRedis.clear();
  });

  // ============================================================================
  // CONSTRUCTOR TESTS
  // ============================================================================

  describe('Constructor', () => {
    it('should throw error if no secret is provided', () => {
      expect(() => {
        new LicenseService(mockRedis as any, '');
      }).toThrow('License secret not configured');
    });

    it('should use environment variable if secret not provided', () => {
      const originalEnv = process.env['FRIENDLY_LICENSE_SECRET'];
      process.env['FRIENDLY_LICENSE_SECRET'] = 'env-secret';

      const envService = new LicenseService(mockRedis as any);
      const key = envService.generateKey(
        'tenant-123',
        LicenseTier.STARTER,
        DeployMode.SAAS
      );

      expect(key).toBeTruthy();

      // Restore original env
      if (originalEnv) {
        process.env['FRIENDLY_LICENSE_SECRET'] = originalEnv;
      } else {
        delete process.env['FRIENDLY_LICENSE_SECRET'];
      }
    });
  });

  // ============================================================================
  // KEY GENERATION TESTS
  // ============================================================================

  describe('Key Generation', () => {
    describe('Valid key generation for all tiers', () => {
      it('should generate valid STARTER tier key', () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const parts = key.split(LICENSE_KEY_SEPARATOR);
        expect(parts).toHaveLength(8);
        expect(parts[0]).toBe('FTECH');
        expect(parts[1]).toBe('AEP');
        expect(parts[2]).toBe(LicenseTier.STARTER);
        expect(parts[3]).toBe(DeployMode.SAAS);
        expect(parts[4]).toHaveLength(TENANT_HASH_LENGTH);
        expect(parts[7]).toHaveLength(HMAC_LENGTH);
      });

      it('should generate valid PROFESSIONAL tier key', () => {
        const key = service.generateKey(
          'tenant-456',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );

        const parts = key.split(LICENSE_KEY_SEPARATOR);
        expect(parts[2]).toBe(LicenseTier.PROFESSIONAL);
        expect(parts[5]).toBe('13'); // 0b0010011 = 19 in decimal, 13 in hex
      });

      it('should generate valid ENTERPRISE tier key', () => {
        const key = service.generateKey(
          'tenant-789',
          LicenseTier.ENTERPRISE,
          DeployMode.DEDICATED
        );

        const parts = key.split(LICENSE_KEY_SEPARATOR);
        expect(parts[2]).toBe(LicenseTier.ENTERPRISE);
        expect(parts[3]).toBe(DeployMode.DEDICATED);
        expect(parts[5]).toBe('7F'); // 0b1111111 = 127 in decimal, 7F in hex
      });
    });

    describe('Valid key generation for both deploy modes', () => {
      it('should generate valid SaaS deployment key', () => {
        const key = service.generateKey(
          'tenant-saas',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );

        const parts = key.split(LICENSE_KEY_SEPARATOR);
        expect(parts[3]).toBe(DeployMode.SAAS);
      });

      it('should generate valid Dedicated deployment key', () => {
        const key = service.generateKey(
          'tenant-dedicated',
          LicenseTier.PROFESSIONAL,
          DeployMode.DEDICATED
        );

        const parts = key.split(LICENSE_KEY_SEPARATOR);
        expect(parts[3]).toBe(DeployMode.DEDICATED);
      });
    });

    describe('Tenant hash generation', () => {
      it('should generate consistent hash for same tenantId', () => {
        const key1 = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );
        const key2 = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const hash1 = key1.split(LICENSE_KEY_SEPARATOR)[4];
        const hash2 = key2.split(LICENSE_KEY_SEPARATOR)[4];

        expect(hash1).toBe(hash2);
      });

      it('should generate different hashes for different tenantIds', () => {
        const key1 = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );
        const key2 = service.generateKey(
          'tenant-456',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const hash1 = key1.split(LICENSE_KEY_SEPARATOR)[4];
        const hash2 = key2.split(LICENSE_KEY_SEPARATOR)[4];

        expect(hash1).not.toBe(hash2);
      });

      it('should generate 8-character uppercase hex hash', () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const hash = key.split(LICENSE_KEY_SEPARATOR)[4];
        expect(hash).toHaveLength(TENANT_HASH_LENGTH);
        expect(hash).toMatch(/^[0-9A-F]{8}$/);
      });
    });

    describe('Expiry timestamp encoding', () => {
      it('should use default 1 year expiry if not specified', () => {
        const beforeGeneration = Date.now();
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );
        const afterGeneration = Date.now();

        const expiryStr = key.split(LICENSE_KEY_SEPARATOR)[5];
        const expiryTimestamp = parseInt(expiryStr, 10);
        const expiryMs = expiryTimestamp * 1000;

        // Should be approximately 1 year from now
        const oneYearFromNow = beforeGeneration + 365 * 24 * 60 * 60 * 1000;
        const tolerance = 10000; // 10 seconds tolerance

        expect(expiryMs).toBeGreaterThanOrEqual(oneYearFromNow - tolerance);
        expect(expiryMs).toBeLessThanOrEqual(
          afterGeneration + 365 * 24 * 60 * 60 * 1000 + tolerance
        );
      });

      it('should use custom expiry date if provided', () => {
        const customExpiry = new Date('2030-12-31T23:59:59Z');
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS,
          undefined,
          customExpiry
        );

        const expiryStr = key.split(LICENSE_KEY_SEPARATOR)[5];
        const expiryTimestamp = parseInt(expiryStr, 10);

        expect(expiryTimestamp).toBe(Math.floor(customExpiry.getTime() / 1000));
      });

      it('should encode expiry as unix epoch seconds', () => {
        const expiry = new Date('2025-06-15T12:00:00Z');
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS,
          undefined,
          expiry
        );

        const expiryStr = key.split(LICENSE_KEY_SEPARATOR)[5];
        expect(expiryStr).toBe('1750089600'); // Unix timestamp for that date
      });
    });

    describe('Feature flags encoding', () => {
      it('should use tier preset features if not specified', () => {
        const starterKey = service.generateKey(
          'tenant-str',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );
        const starterFlags = starterKey.split(LICENSE_KEY_SEPARATOR)[5];
        expect(starterFlags).toBe('0'); // No features

        const proKey = service.generateKey(
          'tenant-pro',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const proFlags = proKey.split(LICENSE_KEY_SEPARATOR)[5];
        expect(proFlags).toBe('13'); // 0b0010011 = 19 = 0x13

        const entKey = service.generateKey(
          'tenant-ent',
          LicenseTier.ENTERPRISE,
          DeployMode.SAAS
        );
        const entFlags = entKey.split(LICENSE_KEY_SEPARATOR)[5];
        expect(entFlags).toBe('7F'); // 0b1111111 = 127 = 0x7F
      });

      it('should use custom feature flags if provided', () => {
        const customFeatures = 0b0000101; // Bits 0 and 2
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS,
          customFeatures
        );

        const flags = key.split(LICENSE_KEY_SEPARATOR)[5];
        expect(flags).toBe('5'); // 0b0000101 = 5
      });

      it('should encode features as uppercase hex string', () => {
        const features = 0b1010101; // 85 decimal = 0x55
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS,
          features
        );

        const flags = key.split(LICENSE_KEY_SEPARATOR)[5];
        expect(flags).toBe('55');
      });
    });

    describe('HMAC signature generation', () => {
      it('should generate 12-character uppercase hex HMAC', () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const hmac = key.split(LICENSE_KEY_SEPARATOR)[7];
        expect(hmac).toHaveLength(HMAC_LENGTH);
        expect(hmac).toMatch(/^[0-9A-F]{12}$/);
      });

      it('should generate different HMACs for different secrets', () => {
        const service1 = new LicenseService(mockRedis as any, 'secret1');
        const service2 = new LicenseService(mockRedis as any, 'secret2');

        const key1 = service1.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );
        const key2 = service2.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const hmac1 = key1.split(LICENSE_KEY_SEPARATOR)[7];
        const hmac2 = key2.split(LICENSE_KEY_SEPARATOR)[7];

        expect(hmac1).not.toBe(hmac2);
      });

      it('should generate same HMAC for identical key components', () => {
        const key1 = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS,
          0,
          new Date('2030-01-01')
        );
        const key2 = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS,
          0,
          new Date('2030-01-01')
        );

        expect(key1).toBe(key2);
      });
    });
  });

  // ============================================================================
  // KEY VALIDATION TESTS
  // ============================================================================

  describe('Key Validation', () => {
    describe('Valid key validation', () => {
      it('should validate a valid key successfully', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );

        const result = await service.validateKey(key);

        expect(result.valid).toBe(true);
        expect(result.license).toBeDefined();
        expect(result.license?.tier).toBe(LicenseTier.PROFESSIONAL);
        expect(result.license?.deployMode).toBe(DeployMode.SAAS);
        expect(result.error).toBeUndefined();
      });

      it('should parse all license components correctly', async () => {
        const expiry = new Date('2030-12-31T23:59:59Z');
        const features = 0b0101010;
        const key = service.generateKey(
          'tenant-test',
          LicenseTier.ENTERPRISE,
          DeployMode.DEDICATED,
          features,
          expiry
        );

        const result = await service.validateKey(key);

        expect(result.valid).toBe(true);
        expect(result.license?.tier).toBe(LicenseTier.ENTERPRISE);
        expect(result.license?.deployMode).toBe(DeployMode.DEDICATED);
        expect(result.license?.features).toBe(features);
        expect(result.license?.expiresAt).toBe(
          Math.floor(expiry.getTime() / 1000)
        );
        expect(result.license?.raw).toBe(key);
      });
    });

    describe('Invalid format rejection', () => {
      it('should reject key with wrong number of components', async () => {
        const result = await service.validateKey('FTECH-AEP-PRO-S-HASH');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid key format');
        expect(result.error).toContain('expected 8 components');
      });

      it('should reject key with invalid prefix', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const tampered = key.replace('FTECH', 'WRONG');

        const result = await service.validateKey(tampered);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid key prefix');
      });

      it('should reject key with invalid product identifier', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const tampered = key.replace('AEP', 'XXX');

        const result = await service.validateKey(tampered);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid key prefix');
      });
    });

    describe('Invalid tier rejection', () => {
      it('should reject key with invalid tier', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const tampered = key.replace('-PRO-', '-XXX-');

        const result = await service.validateKey(tampered);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid tier');
      });
    });

    describe('Invalid deploy mode rejection', () => {
      it('should reject key with invalid deploy mode', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const parts = key.split(LICENSE_KEY_SEPARATOR);
        parts[3] = 'X'; // Invalid deploy mode
        const tampered = parts.join(LICENSE_KEY_SEPARATOR);

        const result = await service.validateKey(tampered);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid deployment mode');
      });
    });

    describe('Expired key detection', () => {
      it('should reject expired key', async () => {
        const pastDate = new Date('2020-01-01T00:00:00Z');
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS,
          undefined,
          pastDate
        );

        const result = await service.validateKey(key);

        expect(result.valid).toBe(false);
        expect(result.expired).toBe(true);
        expect(result.error).toContain('License expired');
        expect(result.license).toBeDefined(); // License still parsed
      });

      it('should accept key expiring in future', async () => {
        const futureDate = new Date('2030-01-01T00:00:00Z');
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS,
          undefined,
          futureDate
        );

        const result = await service.validateKey(key);

        expect(result.valid).toBe(true);
        expect(result.expired).toBeUndefined();
      });
    });

    describe('Missing components rejection', () => {
      it('should reject key with invalid tenant hash length', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const parts = key.split(LICENSE_KEY_SEPARATOR);
        parts[4] = 'TOOSHORT'; // Wrong length (8 chars but might not match exact validation)
        const tampered = parts.join(LICENSE_KEY_SEPARATOR);

        // This should still pass length check, so modify to actually be wrong length
        parts[4] = 'SHORT';
        const tamperedWrongLength = parts.join(LICENSE_KEY_SEPARATOR);

        const result = await service.validateKey(tamperedWrongLength);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid tenant hash length');
      });

      it('should reject key with invalid expiry timestamp', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const parts = key.split(LICENSE_KEY_SEPARATOR);
        parts[5] = 'NOTANUMBER';
        const tampered = parts.join(LICENSE_KEY_SEPARATOR);

        const result = await service.validateKey(tampered);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid expiry timestamp');
      });

      it('should reject key with invalid feature flags hex', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );
        const parts = key.split(LICENSE_KEY_SEPARATOR);
        parts[6] = 'NOTAHEX';
        const tampered = parts.join(LICENSE_KEY_SEPARATOR);

        const result = await service.validateKey(tampered);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid feature flags hex');
      });
    });
  });

  // ============================================================================
  // TAMPER DETECTION TESTS
  // ============================================================================

  describe('Tamper Detection', () => {
    it('should detect modified TIER', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.STARTER,
        DeployMode.SAAS
      );
      const tampered = key.replace('-STR-', '-PRO-');

      const result = await service.validateKey(tampered);

      expect(result.valid).toBe(false);
      expect(result.invalidSignature).toBe(true);
      expect(result.error).toContain('Invalid HMAC signature');
    });

    it('should detect modified DEPLOY mode', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );
      const parts = key.split(LICENSE_KEY_SEPARATOR);
      parts[3] = DeployMode.DEDICATED;
      const tampered = parts.join(LICENSE_KEY_SEPARATOR);

      const result = await service.validateKey(tampered);

      expect(result.valid).toBe(false);
      expect(result.invalidSignature).toBe(true);
    });

    it('should detect modified TENANT_HASH', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );
      const parts = key.split(LICENSE_KEY_SEPARATOR);
      parts[4] = 'FFFFFFFF'; // Change hash
      const tampered = parts.join(LICENSE_KEY_SEPARATOR);

      const result = await service.validateKey(tampered);

      expect(result.valid).toBe(false);
      expect(result.invalidSignature).toBe(true);
    });

    it('should detect modified EXPIRY', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );
      const parts = key.split(LICENSE_KEY_SEPARATOR);
      parts[5] = '9999999999'; // Change expiry
      const tampered = parts.join(LICENSE_KEY_SEPARATOR);

      const result = await service.validateKey(tampered);

      expect(result.valid).toBe(false);
      expect(result.invalidSignature).toBe(true);
    });

    it('should detect modified FLAGS', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );
      const parts = key.split(LICENSE_KEY_SEPARATOR);
      parts[6] = '7F'; // Change to all features
      const tampered = parts.join(LICENSE_KEY_SEPARATOR);

      const result = await service.validateKey(tampered);

      expect(result.valid).toBe(false);
      expect(result.invalidSignature).toBe(true);
    });

    it('should detect modified HMAC', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );
      const parts = key.split(LICENSE_KEY_SEPARATOR);
      parts[7] = 'BADBADBADBAD'; // Replace HMAC
      const tampered = parts.join(LICENSE_KEY_SEPARATOR);

      const result = await service.validateKey(tampered);

      expect(result.valid).toBe(false);
      expect(result.invalidSignature).toBe(true);
    });

    it('should detect reordered components', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );
      const parts = key.split(LICENSE_KEY_SEPARATOR);
      // Swap tier and deploy mode
      [parts[2], parts[3]] = [parts[3], parts[2]];
      const tampered = parts.join(LICENSE_KEY_SEPARATOR);

      const result = await service.validateKey(tampered);

      expect(result.valid).toBe(false);
      // Will fail on invalid tier format first
    });
  });

  // ============================================================================
  // FEATURE FLAG TESTS
  // ============================================================================

  describe('Feature Flags', () => {
    describe('Feature extraction from bitfield', () => {
      it('should extract HELM_OUTPUT feature correctly', async () => {
        const features = 1 << LicenseFeature.HELM_OUTPUT; // Bit 0
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS,
          features
        );

        const hasHelm = await service.isFeatureEnabled(
          key,
          LicenseFeature.HELM_OUTPUT
        );
        const hasGit = await service.isFeatureEnabled(
          key,
          LicenseFeature.GIT_PUSH
        );

        expect(hasHelm).toBe(true);
        expect(hasGit).toBe(false);
      });

      it('should extract GIT_PUSH feature correctly', async () => {
        const features = 1 << LicenseFeature.GIT_PUSH; // Bit 1
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS,
          features
        );

        const hasGit = await service.isFeatureEnabled(
          key,
          LicenseFeature.GIT_PUSH
        );
        expect(hasGit).toBe(true);
      });

      it('should extract OLLAMA_LLM feature correctly', async () => {
        const features = 1 << LicenseFeature.OLLAMA_LLM; // Bit 2
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.ENTERPRISE,
          DeployMode.SAAS,
          features
        );

        const hasOllama = await service.isFeatureEnabled(
          key,
          LicenseFeature.OLLAMA_LLM
        );
        expect(hasOllama).toBe(true);
      });

      it('should extract multiple features correctly', async () => {
        const features =
          (1 << LicenseFeature.GIT_PUSH) |
          (1 << LicenseFeature.THIRD_PARTY_INGESTION) |
          (1 << LicenseFeature.MULTI_ENVIRONMENT);

        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS,
          features
        );

        const hasGit = await service.isFeatureEnabled(
          key,
          LicenseFeature.GIT_PUSH
        );
        const hasThirdParty = await service.isFeatureEnabled(
          key,
          LicenseFeature.THIRD_PARTY_INGESTION
        );
        const hasMultiEnv = await service.isFeatureEnabled(
          key,
          LicenseFeature.MULTI_ENVIRONMENT
        );
        const hasOllama = await service.isFeatureEnabled(
          key,
          LicenseFeature.OLLAMA_LLM
        );

        expect(hasGit).toBe(true);
        expect(hasThirdParty).toBe(true);
        expect(hasMultiEnv).toBe(true);
        expect(hasOllama).toBe(false);
      });
    });

    describe('isFeatureEnabled returns correct boolean', () => {
      it('should return true for enabled feature', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.ENTERPRISE,
          DeployMode.SAAS
        );

        const hasGit = await service.isFeatureEnabled(
          key,
          LicenseFeature.GIT_PUSH
        );
        expect(hasGit).toBe(true);
      });

      it('should return false for disabled feature', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const hasGit = await service.isFeatureEnabled(
          key,
          LicenseFeature.GIT_PUSH
        );
        expect(hasGit).toBe(false);
      });

      it('should return false for invalid key', async () => {
        const result = await service.isFeatureEnabled(
          'INVALID-KEY',
          LicenseFeature.GIT_PUSH
        );
        expect(result).toBe(false);
      });

      it('should return false for expired key', async () => {
        const pastDate = new Date('2020-01-01');
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.ENTERPRISE,
          DeployMode.SAAS,
          undefined,
          pastDate
        );

        const result = await service.isFeatureEnabled(
          key,
          LicenseFeature.GIT_PUSH
        );
        expect(result).toBe(false);
      });
    });

    describe('Starter tier features', () => {
      it('should have no optional features', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.STARTER,
          DeployMode.SAAS
        );

        const validation = await service.validateKey(key);
        expect(validation.license?.features).toBe(0);

        // Check all features are disabled
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.HELM_OUTPUT)
        ).toBe(false);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.GIT_PUSH)
        ).toBe(false);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.OLLAMA_LLM)
        ).toBe(false);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.AIR_GAP_MODE)
        ).toBe(false);
        expect(
          await service.isFeatureEnabled(
            key,
            LicenseFeature.THIRD_PARTY_INGESTION
          )
        ).toBe(false);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.CUSTOM_WIDGETS)
        ).toBe(false);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.MULTI_ENVIRONMENT)
        ).toBe(false);
      });
    });

    describe('Pro tier features', () => {
      it('should have Git + 3rd-party + multi-env', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.PROFESSIONAL,
          DeployMode.SAAS
        );

        const expectedFeatures =
          (1 << LicenseFeature.GIT_PUSH) |
          (1 << LicenseFeature.THIRD_PARTY_INGESTION) |
          (1 << LicenseFeature.MULTI_ENVIRONMENT);

        const validation = await service.validateKey(key);
        expect(validation.license?.features).toBe(expectedFeatures);

        expect(
          await service.isFeatureEnabled(key, LicenseFeature.GIT_PUSH)
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(
            key,
            LicenseFeature.THIRD_PARTY_INGESTION
          )
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.MULTI_ENVIRONMENT)
        ).toBe(true);

        // These should be disabled
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.OLLAMA_LLM)
        ).toBe(false);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.AIR_GAP_MODE)
        ).toBe(false);
      });
    });

    describe('Enterprise tier features', () => {
      it('should have all features', async () => {
        const key = service.generateKey(
          'tenant-123',
          LicenseTier.ENTERPRISE,
          DeployMode.SAAS
        );

        const validation = await service.validateKey(key);
        expect(validation.license?.features).toBe(0b1111111); // All 7 features

        // Check all features are enabled
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.HELM_OUTPUT)
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.GIT_PUSH)
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.OLLAMA_LLM)
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.AIR_GAP_MODE)
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(
            key,
            LicenseFeature.THIRD_PARTY_INGESTION
          )
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.CUSTOM_WIDGETS)
        ).toBe(true);
        expect(
          await service.isFeatureEnabled(key, LicenseFeature.MULTI_ENVIRONMENT)
        ).toBe(true);
      });
    });
  });

  // ============================================================================
  // REVOCATION TESTS
  // ============================================================================

  describe('Revocation', () => {
    it('should revoke a key successfully', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      // Key should be valid initially
      let result = await service.validateKey(key);
      expect(result.valid).toBe(true);

      // Revoke the key
      await service.revokeKey(key);

      // Key should now be invalid
      result = await service.validateKey(key);
      expect(result.valid).toBe(false);
      expect(result.revoked).toBe(true);
      expect(result.error).toContain('License has been revoked');
    });

    it('should store revocation in Redis with correct key format', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      await service.revokeKey(key);

      // Check Redis directly
      const exists = await mockRedis.exists(`license:revoked:${key}`);
      expect(exists).toBe(1);
    });

    it('should allow non-revoked keys to pass validation', async () => {
      const key1 = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );
      const key2 = service.generateKey(
        'tenant-456',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      // Revoke only key1
      await service.revokeKey(key1);

      // key1 should fail
      const result1 = await service.validateKey(key1);
      expect(result1.valid).toBe(false);
      expect(result1.revoked).toBe(true);

      // key2 should pass
      const result2 = await service.validateKey(key2);
      expect(result2.valid).toBe(true);
      expect(result2.revoked).toBeUndefined();
    });

    it('should include license details even for revoked key', async () => {
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      await service.revokeKey(key);

      const result = await service.validateKey(key);
      expect(result.valid).toBe(false);
      expect(result.revoked).toBe(true);
      expect(result.license).toBeDefined();
      expect(result.license?.tier).toBe(LicenseTier.PROFESSIONAL);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very long tenantId', async () => {
      const longTenantId = 'a'.repeat(1000);
      const key = service.generateKey(
        longTenantId,
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);

      // Hash should still be 8 characters
      const hash = key.split(LICENSE_KEY_SEPARATOR)[4];
      expect(hash).toHaveLength(TENANT_HASH_LENGTH);
    });

    it('should handle expiry in past', async () => {
      const pastDate = new Date('1990-01-01');
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS,
        undefined,
        pastDate
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('should handle expiry far in future (year 2100)', async () => {
      const futureDate = new Date('2100-12-31T23:59:59Z');
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS,
        undefined,
        futureDate
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);
      expect(result.license?.expiresAt).toBe(
        Math.floor(futureDate.getTime() / 1000)
      );
    });

    it('should handle all features enabled (0b1111111)', async () => {
      const allFeatures = 0b1111111; // 127
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.ENTERPRISE,
        DeployMode.SAAS,
        allFeatures
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);
      expect(result.license?.features).toBe(allFeatures);

      const flags = key.split(LICENSE_KEY_SEPARATOR)[6];
      expect(flags).toBe('7F'); // 127 in hex
    });

    it('should handle no features enabled (0b0000000)', async () => {
      const noFeatures = 0b0000000;
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.STARTER,
        DeployMode.SAAS,
        noFeatures
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);
      expect(result.license?.features).toBe(noFeatures);

      const flags = key.split(LICENSE_KEY_SEPARATOR)[6];
      expect(flags).toBe('0');
    });

    it('should handle single feature enabled', async () => {
      const singleFeature = 1 << LicenseFeature.CUSTOM_WIDGETS; // Bit 5 = 32
      const key = service.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS,
        singleFeature
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);
      expect(result.license?.features).toBe(singleFeature);

      const hasCustomWidgets = await service.isFeatureEnabled(
        key,
        LicenseFeature.CUSTOM_WIDGETS
      );
      const hasGit = await service.isFeatureEnabled(
        key,
        LicenseFeature.GIT_PUSH
      );

      expect(hasCustomWidgets).toBe(true);
      expect(hasGit).toBe(false);
    });

    it('should handle special characters in tenantId', async () => {
      const specialTenantId = 'tenant-!@#$%^&*()_+{}[]|\\:;"<>?,./';
      const key = service.generateKey(
        specialTenantId,
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);
    });

    it('should handle Unicode characters in tenantId', async () => {
      const unicodeTenantId = 'tenant-测试-🚀-مرحبا';
      const key = service.generateKey(
        unicodeTenantId,
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);
    });

    it('should handle empty string tenantId', async () => {
      const key = service.generateKey(
        '',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      const result = await service.validateKey(key);
      expect(result.valid).toBe(true);

      // Hash should still be generated
      const hash = key.split(LICENSE_KEY_SEPARATOR)[4];
      expect(hash).toHaveLength(TENANT_HASH_LENGTH);
    });
  });

  // ============================================================================
  // ADDITIONAL UTILITY METHODS
  // ============================================================================

  describe('Utility Methods', () => {
    it('should generate key with options object', () => {
      const expiry = new Date('2030-12-31');
      const key = service.generateKeyWithOptions({
        tenantId: 'tenant-123',
        tier: LicenseTier.ENTERPRISE,
        deployMode: DeployMode.DEDICATED,
        features: 0b0101010,
        expiryDate: expiry,
      });

      const parts = key.split(LICENSE_KEY_SEPARATOR);
      expect(parts[2]).toBe(LicenseTier.ENTERPRISE);
      expect(parts[3]).toBe(DeployMode.DEDICATED);
      expect(parts[6]).toBe('2A'); // 0b0101010 = 42 = 0x2A
    });

    it('should get tier preset for STARTER', () => {
      const preset = LicenseService.getTierPreset(LicenseTier.STARTER);
      expect(preset.tier).toBe(LicenseTier.STARTER);
      expect(preset.features).toBe(0);
      expect(preset.priceUsd).toBe(499);
    });

    it('should get tier preset for PROFESSIONAL', () => {
      const preset = LicenseService.getTierPreset(LicenseTier.PROFESSIONAL);
      expect(preset.tier).toBe(LicenseTier.PROFESSIONAL);
      expect(preset.features).toBe(0b0010011); // Git + 3rd-party + multi-env
      expect(preset.priceUsd).toBe(2499);
    });

    it('should get tier preset for ENTERPRISE', () => {
      const preset = LicenseService.getTierPreset(LicenseTier.ENTERPRISE);
      expect(preset.tier).toBe(LicenseTier.ENTERPRISE);
      expect(preset.features).toBe(0b1111111);
      expect(preset.priceUsd).toBe(7999);
    });

    it('should close Redis connection', async () => {
      const closeSpy = vi.spyOn(mockRedis, 'quit');
      await service.close();
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Create a mock that throws an error
      const errorRedis = {
        exists: vi.fn().mockRejectedValue(new Error('Redis connection error')),
        quit: vi.fn(),
      };

      const errorService = new LicenseService(errorRedis as any, testSecret);
      const key = errorService.generateKey(
        'tenant-123',
        LicenseTier.PROFESSIONAL,
        DeployMode.SAAS
      );

      const result = await errorService.validateKey(key);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(result.error).toContain('Redis connection error');
    });

    it('should handle malformed key gracefully', async () => {
      const result = await service.validateKey('completely-invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null key gracefully', async () => {
      const result = await service.validateKey(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle undefined key gracefully', async () => {
      const result = await service.validateKey(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
