import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Encrypted data format containing IV, authentication tag, and encrypted content
 */
export interface EncryptedData {
  /** Initialization vector (base64) */
  iv: string;
  /** Authentication tag for GCM mode (base64) */
  authTag: string;
  /** Encrypted content (base64) */
  encrypted: string;
}

/**
 * Options for encryption operations
 */
export interface EncryptionOptions {
  /** Master key for encryption (defaults to ENCRYPTION_KEY env var) */
  masterKey?: string;
  /** Salt for key derivation (defaults to random) */
  salt?: string;
}

/**
 * Credential structure for encryption/decryption helpers
 */
export interface Credential {
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  [key: string]: string | undefined;
}

/**
 * Encrypted credential structure
 */
export interface EncryptedCredential {
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  [key: string]: string | undefined;
}

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const DEFAULT_SALT = 'friendly-aiaep-salt-v1'; // Default salt for key derivation

/**
 * Error thrown when encryption operations fail
 */
export class EncryptionError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Error thrown when decryption operations fail
 */
export class DecryptionError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Derives a 256-bit encryption key from a master key using scrypt
 * @param masterKey - The master key to derive from
 * @param salt - Optional salt for derivation (defaults to constant)
 * @returns 32-byte derived key
 */
export function deriveKey(masterKey: string, salt: string = DEFAULT_SALT): Buffer {
  try {
    if (!masterKey || masterKey.length === 0) {
      throw new Error('Master key cannot be empty');
    }

    // Use scrypt for key derivation (CPU-hard, memory-hard)
    // N=16384, r=8, p=1 are recommended defaults
    return scryptSync(masterKey, salt, KEY_LENGTH, {
      N: 16384,
      r: 8,
      p: 1,
    });
  } catch (error) {
    throw new EncryptionError('Failed to derive encryption key', error);
  }
}

/**
 * Gets the master key from options or environment variable
 * @param options - Encryption options
 * @returns Master key string
 * @throws EncryptionError if no key is available
 */
function getMasterKey(options?: EncryptionOptions): string {
  const masterKey = options?.masterKey || process.env['ENCRYPTION_KEY'];

  if (!masterKey || masterKey.length === 0) {
    throw new EncryptionError(
      'No encryption key provided. Set ENCRYPTION_KEY environment variable or pass masterKey in options.'
    );
  }

  return masterKey;
}

/**
 * Parses encrypted data from string format (iv:authTag:encrypted)
 * @param ciphertext - Encrypted string in format iv:authTag:encrypted
 * @returns Parsed encrypted data object
 */
export function parseEncryptedData(ciphertext: string): EncryptedData {
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new DecryptionError(
      'Invalid ciphertext format. Expected format: iv:authTag:encrypted'
    );
  }

  const [iv, authTag, encrypted] = parts;

  // IV and authTag are required, but encrypted can be empty (for empty plaintext)
  if (!iv || !authTag || encrypted === undefined) {
    throw new DecryptionError('Invalid ciphertext: missing required components');
  }

  return { iv, authTag, encrypted };
}

/**
 * Formats encrypted data into string format (iv:authTag:encrypted)
 * @param data - Encrypted data object
 * @returns Formatted string
 */
export function formatEncryptedData(data: EncryptedData): string {
  return `${data.iv}:${data.authTag}:${data.encrypted}`;
}

/**
 * Encrypts plaintext using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @param key - The encryption key (or use ENCRYPTION_KEY env var)
 * @param options - Optional encryption options
 * @returns Encrypted string in format: iv:authTag:encrypted (all base64)
 * @throws EncryptionError if encryption fails
 */
export function encrypt(
  plaintext: string,
  key?: string,
  options?: EncryptionOptions
): string {
  try {
    if (plaintext === null || plaintext === undefined) {
      throw new Error('Plaintext cannot be null or undefined');
    }

    // Get master key and derive encryption key
    const masterKey = key || getMasterKey(options);
    const derivedKey = deriveKey(masterKey, options?.salt);

    // Generate random IV
    const iv = randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format encrypted data
    const encryptedData: EncryptedData = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encrypted,
    };

    return formatEncryptedData(encryptedData);
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError('Encryption failed', error);
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM
 * @param ciphertext - The encrypted text in format: iv:authTag:encrypted
 * @param key - The decryption key (or use ENCRYPTION_KEY env var)
 * @param options - Optional encryption options
 * @returns Decrypted plaintext
 * @throws DecryptionError if decryption fails
 */
export function decrypt(
  ciphertext: string,
  key?: string,
  options?: EncryptionOptions
): string {
  try {
    if (!ciphertext || ciphertext.length === 0) {
      throw new Error('Ciphertext cannot be empty');
    }

    // Parse encrypted data
    const encryptedData = parseEncryptedData(ciphertext);

    // Get master key and derive decryption key
    const masterKey = key || getMasterKey(options);
    const derivedKey = deriveKey(masterKey, options?.salt);

    // Convert from base64
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encrypted = encryptedData.encrypted;

    // Validate buffer sizes
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (error instanceof DecryptionError) {
      throw error;
    }
    throw new DecryptionError('Decryption failed', error);
  }
}

/**
 * Encrypts sensitive credential fields
 * @param credential - Credential object to encrypt
 * @param key - Optional encryption key
 * @param options - Optional encryption options
 * @returns Credential with encrypted sensitive fields
 * @throws EncryptionError if encryption fails
 */
export function encryptCredential(
  credential: Credential,
  key?: string,
  options?: EncryptionOptions
): EncryptedCredential {
  try {
    const encrypted: EncryptedCredential = {};

    // Fields that should be encrypted
    const sensitiveFields = ['password', 'apiKey', 'token'];

    for (const [fieldKey, value] of Object.entries(credential)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (sensitiveFields.includes(fieldKey) && typeof value === 'string') {
        // Encrypt sensitive fields
        encrypted[fieldKey] = encrypt(value, key, options);
      } else {
        // Keep non-sensitive fields as-is
        encrypted[fieldKey] = value;
      }
    }

    return encrypted;
  } catch (error) {
    throw new EncryptionError('Failed to encrypt credential', error);
  }
}

/**
 * Decrypts encrypted credential fields
 * @param encryptedCredential - Credential object with encrypted fields
 * @param key - Optional decryption key
 * @param options - Optional encryption options
 * @returns Credential with decrypted sensitive fields
 * @throws DecryptionError if decryption fails
 */
export function decryptCredential(
  encryptedCredential: EncryptedCredential,
  key?: string,
  options?: EncryptionOptions
): Credential {
  try {
    const decrypted: Credential = {};

    // Fields that should be decrypted
    const sensitiveFields = ['password', 'apiKey', 'token'];

    for (const [fieldKey, value] of Object.entries(encryptedCredential)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (sensitiveFields.includes(fieldKey) && typeof value === 'string') {
        // Decrypt sensitive fields
        try {
          decrypted[fieldKey] = decrypt(value, key, options);
        } catch (error) {
          // Wrap decryption errors with field context
          throw new DecryptionError(
            `Failed to decrypt field '${fieldKey}'`,
            error
          );
        }
      } else {
        // Keep non-sensitive fields as-is
        decrypted[fieldKey] = value;
      }
    }

    return decrypted;
  } catch (error) {
    if (error instanceof DecryptionError) {
      throw error;
    }
    throw new DecryptionError('Failed to decrypt credential', error);
  }
}

/**
 * Validates if a string is in valid encrypted format
 * @param value - String to validate
 * @returns true if valid encrypted format, false otherwise
 */
export function isEncryptedFormat(value: string): boolean {
  try {
    parseEncryptedData(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a random encryption key suitable for use as ENCRYPTION_KEY
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns Random key as hex string
 */
export function generateEncryptionKey(length: number = 32): string {
  return randomBytes(length).toString('hex');
}
