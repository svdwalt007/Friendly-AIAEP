/**
 * License Service Types
 *
 * Type definitions for the license key generation and validation system.
 * Supports three tiers (Starter, Pro, Enterprise) and two deployment modes (SaaS, Dedicated).
 */

/**
 * License tier enumeration
 */
export enum LicenseTier {
  /** Starter tier: $499/mo - Basic features only */
  STARTER = 'STR',
  /** Professional tier: $2,499/mo - Git, 3rd-party ingestion, multi-env */
  PROFESSIONAL = 'PRO',
  /** Enterprise tier: $7,999/mo - All features including Ollama, air-gap */
  ENTERPRISE = 'ENT',
}

/**
 * Deployment mode enumeration
 */
export enum DeployMode {
  /** SaaS deployment: Multi-tenant cloud hosting */
  SAAS = 'S',
  /** Dedicated deployment: Single-tenant infrastructure */
  DEDICATED = 'D',
}

/**
 * Feature flags enumeration with bit positions
 */
export enum LicenseFeature {
  /** Bit 0: Helm chart output generation */
  HELM_OUTPUT = 0,
  /** Bit 1: Git push capability */
  GIT_PUSH = 1,
  /** Bit 2: Ollama LLM provider support */
  OLLAMA_LLM = 2,
  /** Bit 3: Air-gap disconnected mode */
  AIR_GAP_MODE = 3,
  /** Bit 4: Third-party IoT data ingestion */
  THIRD_PARTY_INGESTION = 4,
  /** Bit 5: Custom widget development */
  CUSTOM_WIDGETS = 5,
  /** Bit 6: Multi-environment promotion */
  MULTI_ENVIRONMENT = 6,
}

/**
 * Feature flags as a bitfield number
 */
export type FeatureFlags = number;

/**
 * Parsed license key structure
 */
export interface LicenseKey {
  /** Original raw license key string */
  raw: string;
  /** License tier (STR, PRO, ENT) */
  tier: LicenseTier;
  /** Deployment mode (S, D) */
  deployMode: DeployMode;
  /** First 8 characters of SHA-256(tenantId) */
  tenantHash: string;
  /** Unix epoch timestamp when license expires */
  expiresAt: number;
  /** Feature flags as bitfield */
  features: FeatureFlags;
  /** HMAC signature (first 12 chars) */
  hmac: string;
}

/**
 * License validation result
 */
export interface LicenseValidation {
  /** Whether the license key is valid */
  valid: boolean;
  /** Parsed license key (if valid) */
  license?: LicenseKey;
  /** Validation error message (if invalid) */
  error?: string;
  /** Whether the license has expired */
  expired?: boolean;
  /** Whether the license has been revoked */
  revoked?: boolean;
  /** Whether the HMAC signature is invalid */
  invalidSignature?: boolean;
}

/**
 * Tier preset configuration
 */
export interface TierPreset {
  /** Tier identifier */
  tier: LicenseTier;
  /** Feature flags bitfield */
  features: FeatureFlags;
  /** Monthly price in USD */
  priceUsd: number;
  /** Human-readable description */
  description: string;
}

/**
 * License generation options
 */
export interface LicenseGenerationOptions {
  /** Tenant ID (will be hashed) */
  tenantId: string;
  /** License tier */
  tier: LicenseTier;
  /** Deployment mode */
  deployMode: DeployMode;
  /** Feature flags bitfield (optional - defaults to tier preset) */
  features?: FeatureFlags;
  /** Expiry date (optional - defaults to 1 year from now) */
  expiryDate?: Date;
}
