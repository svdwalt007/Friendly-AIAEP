/**
 * JWT Key Generation and Management for RS256 Algorithm
 *
 * This module provides utilities for generating and managing RSA key pairs
 * used for signing and verifying JWT tokens with the RS256 algorithm.
 */

import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * RSA key pair for JWT signing and verification
 */
export interface JwtKeyPair {
  /** Private key for signing tokens (PEM format) */
  privateKey: string;

  /** Public key for verifying tokens (PEM format) */
  publicKey: string;
}

/**
 * Configuration for JWT key generation
 */
export interface KeyGenerationConfig {
  /** RSA modulus length in bits (2048 or 4096 recommended) */
  modulusLength?: number;

  /** Public key encoding format */
  publicKeyEncoding?: {
    type: 'spki' | 'pkcs1';
    format: 'pem' | 'der';
  };

  /** Private key encoding format */
  privateKeyEncoding?: {
    type: 'pkcs8' | 'pkcs1';
    format: 'pem' | 'der';
    cipher?: string;
    passphrase?: string;
  };
}

/**
 * Default configuration for RSA key generation
 */
const DEFAULT_CONFIG: Required<Omit<KeyGenerationConfig, 'privateKeyEncoding'>> & {
  privateKeyEncoding: Required<Omit<KeyGenerationConfig['privateKeyEncoding'], 'cipher' | 'passphrase'>>;
} = {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
};

/**
 * Generates an RSA key pair for JWT RS256 signing
 *
 * @param config - Optional configuration for key generation
 * @returns RSA key pair with private and public keys in PEM format
 *
 * @example
 * ```typescript
 * const keyPair = generateJwtKeyPair();
 * console.log(keyPair.privateKey); // -----BEGIN PRIVATE KEY-----...
 * console.log(keyPair.publicKey);  // -----BEGIN PUBLIC KEY-----...
 * ```
 */
export function generateJwtKeyPair(config?: KeyGenerationConfig): JwtKeyPair {
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    publicKeyEncoding: {
      ...DEFAULT_CONFIG.publicKeyEncoding,
      ...config?.publicKeyEncoding,
    },
    privateKeyEncoding: {
      ...DEFAULT_CONFIG.privateKeyEncoding,
      ...config?.privateKeyEncoding,
    },
  };

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: finalConfig.modulusLength,
    publicKeyEncoding: finalConfig.publicKeyEncoding as any,
    privateKeyEncoding: finalConfig.privateKeyEncoding as any,
  });

  return {
    privateKey: privateKey as string,
    publicKey: publicKey as string,
  };
}

/**
 * Loads or generates JWT key pair from filesystem
 *
 * If keys don't exist at the specified paths, new keys are generated and saved.
 * If keys exist, they are loaded from the filesystem.
 *
 * @param privateKeyPath - Path to private key file
 * @param publicKeyPath - Path to public key file
 * @param config - Optional configuration for key generation (used only if generating new keys)
 * @returns RSA key pair
 *
 * @example
 * ```typescript
 * const keyPair = loadOrGenerateKeyPair(
 *   './keys/jwt-private.pem',
 *   './keys/jwt-public.pem'
 * );
 * ```
 */
export function loadOrGenerateKeyPair(
  privateKeyPath: string,
  publicKeyPath: string,
  config?: KeyGenerationConfig
): JwtKeyPair {
  const privateKeyExists = existsSync(privateKeyPath);
  const publicKeyExists = existsSync(publicKeyPath);

  // If both keys exist, load them
  if (privateKeyExists && publicKeyExists) {
    return {
      privateKey: readFileSync(privateKeyPath, 'utf-8'),
      publicKey: readFileSync(publicKeyPath, 'utf-8'),
    };
  }

  // If one key exists but not the other, throw an error
  if (privateKeyExists || publicKeyExists) {
    throw new Error(
      `Incomplete key pair: ${privateKeyExists ? 'private' : 'public'} key exists but ${
        privateKeyExists ? 'public' : 'private'
      } key is missing`
    );
  }

  // Generate new key pair
  const keyPair = generateJwtKeyPair(config);

  // Save keys to filesystem
  writeFileSync(privateKeyPath, keyPair.privateKey, { mode: 0o600 }); // Private key readable only by owner
  writeFileSync(publicKeyPath, keyPair.publicKey, { mode: 0o644 }); // Public key readable by all

  return keyPair;
}

/**
 * Loads JWT key pair from environment variables
 *
 * Expects the following environment variables:
 * - JWT_PRIVATE_KEY: Private key in PEM format (base64 encoded or raw)
 * - JWT_PUBLIC_KEY: Public key in PEM format (base64 encoded or raw)
 *
 * @returns RSA key pair from environment variables
 * @throws Error if environment variables are not set
 *
 * @example
 * ```typescript
 * // Set environment variables:
 * // JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
 * // JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
 *
 * const keyPair = loadKeyPairFromEnv();
 * ```
 */
export function loadKeyPairFromEnv(): JwtKeyPair {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    throw new Error(
      'JWT keys not found in environment variables. Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY.'
    );
  }

  // Decode from base64 if encoded
  const decodeIfBase64 = (key: string): string => {
    // Check if the key looks like base64 (doesn't start with -----)
    if (!key.startsWith('-----')) {
      try {
        return Buffer.from(key, 'base64').toString('utf-8');
      } catch {
        // If decoding fails, assume it's already in PEM format
        return key;
      }
    }
    return key;
  };

  return {
    privateKey: decodeIfBase64(privateKey),
    publicKey: decodeIfBase64(publicKey),
  };
}

/**
 * Gets JWT key pair from environment or filesystem, with fallback to generation
 *
 * Priority:
 * 1. Environment variables (JWT_PRIVATE_KEY, JWT_PUBLIC_KEY)
 * 2. Filesystem (if paths provided)
 * 3. Generate new keys (if paths provided and generateIfMissing is true)
 *
 * @param options - Configuration options
 * @returns RSA key pair
 *
 * @example
 * ```typescript
 * // Try env vars, fallback to filesystem, generate if missing
 * const keyPair = getJwtKeyPair({
 *   privateKeyPath: './keys/jwt-private.pem',
 *   publicKeyPath: './keys/jwt-public.pem',
 *   generateIfMissing: true
 * });
 * ```
 */
export function getJwtKeyPair(options?: {
  privateKeyPath?: string;
  publicKeyPath?: string;
  generateIfMissing?: boolean;
  keyGenConfig?: KeyGenerationConfig;
}): JwtKeyPair {
  // Try loading from environment first
  try {
    return loadKeyPairFromEnv();
  } catch {
    // Environment keys not available, try filesystem
  }

  // If paths are provided, try loading or generating from filesystem
  if (options?.privateKeyPath && options?.publicKeyPath) {
    if (options.generateIfMissing) {
      return loadOrGenerateKeyPair(
        options.privateKeyPath,
        options.publicKeyPath,
        options.keyGenConfig
      );
    }

    // Load existing keys without generating
    if (existsSync(options.privateKeyPath) && existsSync(options.publicKeyPath)) {
      return {
        privateKey: readFileSync(options.privateKeyPath, 'utf-8'),
        publicKey: readFileSync(options.publicKeyPath, 'utf-8'),
      };
    }
  }

  // No keys found and generation not allowed
  throw new Error(
    'JWT keys not found. Set JWT_PRIVATE_KEY/JWT_PUBLIC_KEY environment variables or provide key paths.'
  );
}

/**
 * Validates that a key pair is properly formatted for RS256
 *
 * @param keyPair - Key pair to validate
 * @returns true if valid, throws error otherwise
 */
export function validateKeyPair(keyPair: JwtKeyPair): boolean {
  // Check that keys are in PEM format
  if (!keyPair.privateKey.includes('-----BEGIN') || !keyPair.publicKey.includes('-----BEGIN')) {
    throw new Error('Keys must be in PEM format');
  }

  // Check for reasonable key length
  if (keyPair.privateKey.length < 100 || keyPair.publicKey.length < 100) {
    throw new Error('Keys appear to be too short to be valid RSA keys');
  }

  return true;
}
