import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encrypt,
  decrypt,
  deriveKey,
  encryptCredential,
  decryptCredential,
  parseEncryptedData,
  formatEncryptedData,
  isEncryptedFormat,
  generateEncryptionKey,
  EncryptionError,
  DecryptionError,
  type EncryptedData,
  type Credential,
} from './encryption';

describe('encryption utilities', () => {
  const TEST_KEY = 'test-master-key-for-encryption-operations';
  const TEST_PLAINTEXT = 'Hello, World! This is a secret message.';

  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env['ENCRYPTION_KEY'];
    // Set test key
    process.env['ENCRYPTION_KEY'] = TEST_KEY;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env['ENCRYPTION_KEY'] = originalEnv;
    } else {
      delete process.env['ENCRYPTION_KEY'];
    }
  });

  describe('deriveKey', () => {
    it('should derive a 32-byte key from master key', () => {
      const key = deriveKey(TEST_KEY);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should derive different keys with different salts', () => {
      const key1 = deriveKey(TEST_KEY, 'salt1');
      const key2 = deriveKey(TEST_KEY, 'salt2');
      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive same key with same salt', () => {
      const key1 = deriveKey(TEST_KEY, 'salt1');
      const key2 = deriveKey(TEST_KEY, 'salt1');
      expect(key1.equals(key2)).toBe(true);
    });

    it('should throw error for empty master key', () => {
      expect(() => deriveKey('')).toThrow(EncryptionError);
    });

    it('should use default salt when not provided', () => {
      const key1 = deriveKey(TEST_KEY);
      const key2 = deriveKey(TEST_KEY);
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('parseEncryptedData', () => {
    it('should parse valid encrypted data format', () => {
      const ciphertext = 'aGVsbG8=:d29ybGQ=:dGVzdA==';
      const parsed = parseEncryptedData(ciphertext);
      expect(parsed).toEqual({
        iv: 'aGVsbG8=',
        authTag: 'd29ybGQ=',
        encrypted: 'dGVzdA==',
      });
    });

    it('should throw error for invalid format (missing parts)', () => {
      expect(() => parseEncryptedData('invalid:format')).toThrow(DecryptionError);
      expect(() => parseEncryptedData('invalid:format')).toThrow(
        'Invalid ciphertext format'
      );
    });

    it('should throw error for empty components', () => {
      expect(() => parseEncryptedData('::test')).toThrow(DecryptionError);
      expect(() => parseEncryptedData('::test')).toThrow('missing required components');
    });
  });

  describe('formatEncryptedData', () => {
    it('should format encrypted data correctly', () => {
      const data: EncryptedData = {
        iv: 'aGVsbG8=',
        authTag: 'd29ybGQ=',
        encrypted: 'dGVzdA==',
      };
      const formatted = formatEncryptedData(data);
      expect(formatted).toBe('aGVsbG8=:d29ybGQ=:dGVzdA==');
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      expect(ciphertext).toBeTruthy();
      expect(typeof ciphertext).toBe('string');
    });

    it('should produce different ciphertext on each call (random IV)', () => {
      const ciphertext1 = encrypt(TEST_PLAINTEXT, TEST_KEY);
      const ciphertext2 = encrypt(TEST_PLAINTEXT, TEST_KEY);
      expect(ciphertext1).not.toBe(ciphertext2);
    });

    it('should return ciphertext in correct format (iv:authTag:encrypted)', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      const parts = ciphertext.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBeTruthy(); // iv
      expect(parts[1]).toBeTruthy(); // authTag
      expect(parts[2]).toBeTruthy(); // encrypted
    });

    it('should use environment variable when key not provided', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT);
      expect(ciphertext).toBeTruthy();
    });

    it('should throw error when no key available', () => {
      delete process.env['ENCRYPTION_KEY'];
      expect(() => encrypt(TEST_PLAINTEXT)).toThrow(EncryptionError);
      expect(() => encrypt(TEST_PLAINTEXT)).toThrow('No encryption key provided');
    });

    it('should throw error for null plaintext', () => {
      expect(() => encrypt(null as any, TEST_KEY)).toThrow(EncryptionError);
    });

    it('should throw error for undefined plaintext', () => {
      expect(() => encrypt(undefined as any, TEST_KEY)).toThrow(EncryptionError);
    });

    it('should encrypt empty string', () => {
      const ciphertext = encrypt('', TEST_KEY);
      expect(ciphertext).toBeTruthy();
    });

    it('should encrypt unicode characters', () => {
      const unicode = '你好世界 🌍 مرحبا';
      const ciphertext = encrypt(unicode, TEST_KEY);
      expect(ciphertext).toBeTruthy();
    });

    it('should use custom salt when provided', () => {
      const ciphertext1 = encrypt(TEST_PLAINTEXT, TEST_KEY, { salt: 'custom1' });
      const ciphertext2 = encrypt(TEST_PLAINTEXT, TEST_KEY, { salt: 'custom2' });
      expect(ciphertext1).not.toBe(ciphertext2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext successfully', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      const plaintext = decrypt(ciphertext, TEST_KEY);
      expect(plaintext).toBe(TEST_PLAINTEXT);
    });

    it('should decrypt using environment variable key', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT);
      const plaintext = decrypt(ciphertext);
      expect(plaintext).toBe(TEST_PLAINTEXT);
    });

    it('should throw error when no key available', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      delete process.env['ENCRYPTION_KEY'];
      expect(() => decrypt(ciphertext)).toThrow(DecryptionError);
    });

    it('should throw error for invalid format', () => {
      expect(() => decrypt('invalid', TEST_KEY)).toThrow(DecryptionError);
    });

    it('should throw error for empty ciphertext', () => {
      expect(() => decrypt('', TEST_KEY)).toThrow(DecryptionError);
    });

    it('should throw error for wrong key', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      expect(() => decrypt(ciphertext, 'wrong-key')).toThrow(DecryptionError);
    });

    it('should throw error for tampered ciphertext', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      const parts = ciphertext.split(':');
      const tampered = `${parts[0]}:${parts[1]}:TAMPERED`;
      expect(() => decrypt(tampered, TEST_KEY)).toThrow(DecryptionError);
    });

    it('should throw error for tampered auth tag', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      const parts = ciphertext.split(':');
      const tampered = `${parts[0]}:TAMPERED:${parts[2]}`;
      expect(() => decrypt(tampered, TEST_KEY)).toThrow(DecryptionError);
    });

    it('should decrypt unicode characters', () => {
      const unicode = '你好世界 🌍 مرحبا';
      const ciphertext = encrypt(unicode, TEST_KEY);
      const plaintext = decrypt(ciphertext, TEST_KEY);
      expect(plaintext).toBe(unicode);
    });

    it('should decrypt empty string', () => {
      const emptyText = '';
      const ciphertext = encrypt(emptyText, TEST_KEY);
      expect(ciphertext).toBeTruthy();
      expect(ciphertext.split(':').length).toBe(3);
      const plaintext = decrypt(ciphertext, TEST_KEY);
      expect(plaintext).toBe(emptyText);
    });

    it('should decrypt with matching salt', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY, { salt: 'custom' });
      const plaintext = decrypt(ciphertext, TEST_KEY, { salt: 'custom' });
      expect(plaintext).toBe(TEST_PLAINTEXT);
    });

    it('should fail to decrypt with wrong salt', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY, { salt: 'custom1' });
      expect(() => decrypt(ciphertext, TEST_KEY, { salt: 'custom2' })).toThrow(
        DecryptionError
      );
    });

    it('should throw error for invalid IV length', () => {
      // Create invalid ciphertext with wrong IV length
      const invalidCiphertext = 'aGVs:d29ybGQ=:dGVzdA=='; // Short IV
      expect(() => decrypt(invalidCiphertext, TEST_KEY)).toThrow(DecryptionError);
    });
  });

  describe('encryptCredential', () => {
    it('should encrypt sensitive credential fields', () => {
      const credential: Credential = {
        username: 'testuser',
        password: 'secret123',
        apiKey: 'api-key-value',
        token: 'auth-token',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);

      expect(encrypted.username).toBe('testuser'); // Not encrypted
      expect(encrypted.password).not.toBe('secret123'); // Encrypted
      expect(encrypted.apiKey).not.toBe('api-key-value'); // Encrypted
      expect(encrypted.token).not.toBe('auth-token'); // Encrypted

      // Verify encrypted fields are in valid format
      expect(isEncryptedFormat(encrypted.password!)).toBe(true);
      expect(isEncryptedFormat(encrypted.apiKey!)).toBe(true);
      expect(isEncryptedFormat(encrypted.token!)).toBe(true);
    });

    it('should handle credential with only some fields', () => {
      const credential: Credential = {
        username: 'testuser',
        password: 'secret123',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);

      expect(encrypted.username).toBe('testuser');
      expect(encrypted.password).not.toBe('secret123');
      expect(encrypted.apiKey).toBeUndefined();
      expect(encrypted.token).toBeUndefined();
    });

    it('should handle credential with undefined values', () => {
      const credential: Credential = {
        username: 'testuser',
        password: undefined,
        apiKey: 'api-key',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);

      expect(encrypted.username).toBe('testuser');
      expect(encrypted.password).toBeUndefined();
      expect(encrypted.apiKey).not.toBe('api-key');
    });

    it('should handle credential with custom fields', () => {
      const credential: Credential = {
        username: 'testuser',
        password: 'secret',
        customField: 'custom-value',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);

      expect(encrypted.username).toBe('testuser');
      expect(encrypted.password).not.toBe('secret');
      expect(encrypted.customField).toBe('custom-value'); // Not in sensitive list
    });

    it('should use environment variable key', () => {
      const credential: Credential = { password: 'secret' };
      const encrypted = encryptCredential(credential);
      expect(encrypted.password).not.toBe('secret');
    });

    it('should throw error when encryption fails', () => {
      delete process.env['ENCRYPTION_KEY'];
      const credential: Credential = { password: 'secret' };
      expect(() => encryptCredential(credential)).toThrow(EncryptionError);
    });
  });

  describe('decryptCredential', () => {
    it('should decrypt encrypted credential fields', () => {
      const credential: Credential = {
        username: 'testuser',
        password: 'secret123',
        apiKey: 'api-key-value',
        token: 'auth-token',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);
      const decrypted = decryptCredential(encrypted, TEST_KEY);

      expect(decrypted).toEqual(credential);
    });

    it('should handle credential with only some fields', () => {
      const credential: Credential = {
        username: 'testuser',
        password: 'secret123',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);
      const decrypted = decryptCredential(encrypted, TEST_KEY);

      expect(decrypted).toEqual(credential);
    });

    it('should handle credential with undefined values', () => {
      const credential: Credential = {
        username: 'testuser',
        password: undefined,
        apiKey: 'api-key',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);
      const decrypted = decryptCredential(encrypted, TEST_KEY);

      expect(decrypted.username).toBe('testuser');
      expect(decrypted.password).toBeUndefined();
      expect(decrypted.apiKey).toBe('api-key');
    });

    it('should use environment variable key', () => {
      const credential: Credential = { password: 'secret' };
      const encrypted = encryptCredential(credential);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted.password).toBe('secret');
    });

    it('should throw error for wrong key', () => {
      const credential: Credential = { password: 'secret' };
      const encrypted = encryptCredential(credential, TEST_KEY);
      expect(() => decryptCredential(encrypted, 'wrong-key')).toThrow(
        DecryptionError
      );
    });

    it('should throw error with field context when decryption fails', () => {
      const encrypted = {
        username: 'testuser',
        password: 'invalid:encrypted:data',
      };

      try {
        decryptCredential(encrypted, TEST_KEY);
        expect.fail('Should have thrown DecryptionError');
      } catch (error) {
        expect(error).toBeInstanceOf(DecryptionError);
        expect((error as DecryptionError).message).toContain('password');
      }
    });

    it('should roundtrip complex credentials', () => {
      const credential: Credential = {
        username: 'admin@example.com',
        password: 'P@ssw0rd!123',
        apiKey: 'ak_live_1234567890abcdef',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        customField: 'not-encrypted',
      };

      const encrypted = encryptCredential(credential, TEST_KEY);
      const decrypted = decryptCredential(encrypted, TEST_KEY);

      expect(decrypted).toEqual(credential);
    });
  });

  describe('isEncryptedFormat', () => {
    it('should return true for valid encrypted format', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      expect(isEncryptedFormat(ciphertext)).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(isEncryptedFormat('invalid')).toBe(false);
      expect(isEncryptedFormat('invalid:format')).toBe(false);
      expect(isEncryptedFormat('')).toBe(false);
    });

    it('should return false for plaintext', () => {
      expect(isEncryptedFormat('plaintext-value')).toBe(false);
    });

    it('should return true for properly formatted string', () => {
      expect(isEncryptedFormat('abc:def:ghi')).toBe(true);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate key of default length (32 bytes)', () => {
      const key = generateEncryptionKey();
      expect(key).toBeTruthy();
      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate key of custom length', () => {
      const key = generateEncryptionKey(16);
      expect(key.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });

    it('should generate valid hex string', () => {
      const key = generateEncryptionKey();
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it('should work as encryption key', () => {
      const key = generateEncryptionKey();
      const ciphertext = encrypt(TEST_PLAINTEXT, key);
      const plaintext = decrypt(ciphertext, key);
      expect(plaintext).toBe(TEST_PLAINTEXT);
    });
  });

  describe('integration tests', () => {
    it('should handle long plaintext', () => {
      const longText = 'A'.repeat(10000);
      const ciphertext = encrypt(longText, TEST_KEY);
      const plaintext = decrypt(ciphertext, TEST_KEY);
      expect(plaintext).toBe(longText);
    });

    it('should handle special characters', () => {
      const special = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const ciphertext = encrypt(special, TEST_KEY);
      const plaintext = decrypt(ciphertext, TEST_KEY);
      expect(plaintext).toBe(special);
    });

    it('should handle multiline text', () => {
      const multiline = 'Line 1\nLine 2\r\nLine 3\rLine 4';
      const ciphertext = encrypt(multiline, TEST_KEY);
      const plaintext = decrypt(ciphertext, TEST_KEY);
      expect(plaintext).toBe(multiline);
    });

    it('should handle JSON data', () => {
      const jsonData = JSON.stringify({
        user: 'test',
        password: 'secret',
        nested: { key: 'value' },
      });
      const ciphertext = encrypt(jsonData, TEST_KEY);
      const plaintext = decrypt(ciphertext, TEST_KEY);
      expect(plaintext).toBe(jsonData);
      expect(JSON.parse(plaintext)).toEqual(JSON.parse(jsonData));
    });

    it('should handle credential encryption workflow', () => {
      // Original credential
      const original: Credential = {
        username: 'api-user',
        password: 'super-secret-password',
        apiKey: 'sk_live_1234567890',
      };

      // Encrypt for storage
      const encrypted = encryptCredential(original, TEST_KEY);

      // Verify sensitive data is encrypted
      expect(encrypted.username).toBe('api-user');
      expect(encrypted.password).not.toBe('super-secret-password');
      expect(encrypted.apiKey).not.toBe('sk_live_1234567890');

      // Decrypt for use
      const decrypted = decryptCredential(encrypted, TEST_KEY);

      // Verify we got original back
      expect(decrypted).toEqual(original);
    });

    it('should fail gracefully with corrupted data', () => {
      const ciphertext = encrypt(TEST_PLAINTEXT, TEST_KEY);
      const corrupted = ciphertext.substring(0, ciphertext.length - 5) + 'XXXXX';

      expect(() => decrypt(corrupted, TEST_KEY)).toThrow(DecryptionError);
    });

    it('should support key rotation scenario', () => {
      const oldKey = 'old-encryption-key';
      const newKey = 'new-encryption-key';

      // Encrypt with old key
      const ciphertext = encrypt(TEST_PLAINTEXT, oldKey);

      // Decrypt with old key
      const decrypted = decrypt(ciphertext, oldKey);

      // Re-encrypt with new key
      const newCiphertext = encrypt(decrypted, newKey);

      // Verify can decrypt with new key
      const final = decrypt(newCiphertext, newKey);
      expect(final).toBe(TEST_PLAINTEXT);

      // Verify old ciphertext can't be decrypted with new key
      expect(() => decrypt(ciphertext, newKey)).toThrow(DecryptionError);
    });
  });

  describe('error handling', () => {
    it('should throw EncryptionError with proper error chain', () => {
      delete process.env['ENCRYPTION_KEY'];

      try {
        encrypt(TEST_PLAINTEXT);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).name).toBe('EncryptionError');
      }
    });

    it('should throw DecryptionError with proper error chain', () => {
      try {
        decrypt('invalid:format:data', TEST_KEY);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DecryptionError);
        expect((error as DecryptionError).name).toBe('DecryptionError');
      }
    });

    it('should preserve error cause in EncryptionError', () => {
      try {
        deriveKey('');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).cause).toBeDefined();
      }
    });
  });
});
