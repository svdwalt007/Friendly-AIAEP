# Encryption Utilities

AES-256-GCM encryption/decryption utilities for secure credential storage and handling in the auth-adapter library.

## Features

- **AES-256-GCM Encryption**: Industry-standard authenticated encryption
- **Key Derivation**: Secure key derivation using scrypt (CPU-hard, memory-hard)
- **No External Dependencies**: Uses only Node.js `crypto` module
- **Type Safety**: Full TypeScript support with comprehensive types
- **Credential Helpers**: Built-in functions for encrypting/decrypting credential objects
- **Error Handling**: Graceful error handling with custom error types
- **Environment Variable Support**: Automatic key loading from `ENCRYPTION_KEY` env var

## Installation

This library is part of the `@friendly-aiaep/auth-adapter` package.

```typescript
import { encrypt, decrypt, encryptCredential } from '@friendly-aiaep/auth-adapter';
```

## Quick Start

### Basic Encryption/Decryption

```typescript
import { encrypt, decrypt } from '@friendly-aiaep/auth-adapter';

// Set encryption key in environment
process.env.ENCRYPTION_KEY = 'your-master-key-here';

// Encrypt data
const plaintext = 'sensitive data';
const ciphertext = encrypt(plaintext);
console.log(ciphertext); // "iv:authTag:encrypted" (base64)

// Decrypt data
const decrypted = decrypt(ciphertext);
console.log(decrypted); // "sensitive data"
```

### Using Custom Key

```typescript
import { encrypt, decrypt } from '@friendly-aiaep/auth-adapter';

const masterKey = 'custom-encryption-key';

const ciphertext = encrypt('secret message', masterKey);
const plaintext = decrypt(ciphertext, masterKey);
```

### Credential Encryption

```typescript
import { encryptCredential, decryptCredential } from '@friendly-aiaep/auth-adapter';

// Original credential
const credential = {
  username: 'api-user',
  password: 'super-secret-password',
  apiKey: 'sk_live_1234567890',
};

// Encrypt sensitive fields (password, apiKey, token)
const encrypted = encryptCredential(credential);
console.log(encrypted);
// {
//   username: 'api-user',  // Not encrypted
//   password: 'iv:authTag:encrypted',  // Encrypted
//   apiKey: 'iv:authTag:encrypted'  // Encrypted
// }

// Decrypt sensitive fields
const decrypted = decryptCredential(encrypted);
console.log(decrypted); // Original credential restored
```

## API Reference

### Core Functions

#### `encrypt(plaintext, key?, options?)`

Encrypts plaintext using AES-256-GCM.

**Parameters:**
- `plaintext` (string): Text to encrypt
- `key` (string, optional): Encryption key (uses `ENCRYPTION_KEY` env var if not provided)
- `options` (EncryptionOptions, optional): Encryption options

**Returns:** Encrypted string in format `iv:authTag:encrypted` (all base64)

**Throws:** `EncryptionError` if encryption fails

```typescript
const ciphertext = encrypt('Hello, World!', 'my-key');
```

#### `decrypt(ciphertext, key?, options?)`

Decrypts ciphertext using AES-256-GCM.

**Parameters:**
- `ciphertext` (string): Encrypted text in format `iv:authTag:encrypted`
- `key` (string, optional): Decryption key (uses `ENCRYPTION_KEY` env var if not provided)
- `options` (EncryptionOptions, optional): Encryption options

**Returns:** Decrypted plaintext string

**Throws:** `DecryptionError` if decryption fails

```typescript
const plaintext = decrypt(ciphertext, 'my-key');
```

#### `deriveKey(masterKey, salt?)`

Derives a 256-bit encryption key from a master key using scrypt.

**Parameters:**
- `masterKey` (string): Master key to derive from
- `salt` (string, optional): Salt for derivation (uses default if not provided)

**Returns:** 32-byte Buffer containing derived key

**Throws:** `EncryptionError` if key derivation fails

```typescript
const derivedKey = deriveKey('my-master-key', 'custom-salt');
```

### Credential Functions

#### `encryptCredential(credential, key?, options?)`

Encrypts sensitive fields in a credential object (password, apiKey, token).

**Parameters:**
- `credential` (Credential): Credential object to encrypt
- `key` (string, optional): Encryption key
- `options` (EncryptionOptions, optional): Encryption options

**Returns:** `EncryptedCredential` with encrypted sensitive fields

**Throws:** `EncryptionError` if encryption fails

```typescript
const encrypted = encryptCredential({
  username: 'user',
  password: 'secret',
  apiKey: 'key123'
});
```

#### `decryptCredential(encryptedCredential, key?, options?)`

Decrypts encrypted fields in a credential object.

**Parameters:**
- `encryptedCredential` (EncryptedCredential): Encrypted credential object
- `key` (string, optional): Decryption key
- `options` (EncryptionOptions, optional): Encryption options

**Returns:** `Credential` with decrypted fields

**Throws:** `DecryptionError` if decryption fails

```typescript
const decrypted = decryptCredential(encrypted);
```

### Utility Functions

#### `isEncryptedFormat(value)`

Validates if a string is in valid encrypted format.

**Parameters:**
- `value` (string): String to validate

**Returns:** `true` if valid encrypted format, `false` otherwise

```typescript
if (isEncryptedFormat(someValue)) {
  const decrypted = decrypt(someValue);
}
```

#### `generateEncryptionKey(length?)`

Generates a random encryption key suitable for use as `ENCRYPTION_KEY`.

**Parameters:**
- `length` (number, optional): Key length in bytes (default: 32 for AES-256)

**Returns:** Random key as hex string

```typescript
const newKey = generateEncryptionKey();
console.log(newKey); // "a1b2c3d4e5f6..."
```

#### `parseEncryptedData(ciphertext)`

Parses encrypted data from string format.

**Parameters:**
- `ciphertext` (string): Encrypted string in format `iv:authTag:encrypted`

**Returns:** `EncryptedData` object with parsed components

**Throws:** `DecryptionError` if format is invalid

```typescript
const parsed = parseEncryptedData(ciphertext);
console.log(parsed); // { iv: '...', authTag: '...', encrypted: '...' }
```

#### `formatEncryptedData(data)`

Formats encrypted data into string format.

**Parameters:**
- `data` (EncryptedData): Encrypted data object

**Returns:** Formatted string `iv:authTag:encrypted`

```typescript
const formatted = formatEncryptedData({ iv: 'abc', authTag: 'def', encrypted: 'ghi' });
console.log(formatted); // "abc:def:ghi"
```

## Types

### `EncryptedData`

```typescript
interface EncryptedData {
  iv: string;           // Initialization vector (base64)
  authTag: string;      // Authentication tag for GCM mode (base64)
  encrypted: string;    // Encrypted content (base64)
}
```

### `EncryptionOptions`

```typescript
interface EncryptionOptions {
  masterKey?: string;   // Master key for encryption (defaults to ENCRYPTION_KEY env var)
  salt?: string;        // Salt for key derivation (defaults to random)
}
```

### `Credential`

```typescript
interface Credential {
  username?: string;
  password?: string;    // Encrypted by encryptCredential
  apiKey?: string;      // Encrypted by encryptCredential
  token?: string;       // Encrypted by encryptCredential
  [key: string]: string | undefined;
}
```

### `EncryptedCredential`

Same structure as `Credential`, but with encrypted sensitive fields.

## Error Handling

### `EncryptionError`

Thrown when encryption operations fail.

```typescript
try {
  encrypt('data', '');
} catch (error) {
  if (error instanceof EncryptionError) {
    console.error('Encryption failed:', error.message);
    console.error('Cause:', error.cause);
  }
}
```

### `DecryptionError`

Thrown when decryption operations fail.

```typescript
try {
  decrypt('invalid:data', 'key');
} catch (error) {
  if (error instanceof DecryptionError) {
    console.error('Decryption failed:', error.message);
    console.error('Cause:', error.cause);
  }
}
```

## Security Best Practices

### Key Management

1. **Use Environment Variables**: Store encryption keys in `ENCRYPTION_KEY` environment variable
2. **Never Commit Keys**: Add `.env` files to `.gitignore`
3. **Use Strong Keys**: Generate keys with `generateEncryptionKey()`
4. **Rotate Keys**: Implement key rotation for long-lived systems

```bash
# Generate a new encryption key
node -e "console.log(require('@friendly-aiaep/auth-adapter').generateEncryptionKey())"
```

### Key Rotation

```typescript
import { encrypt, decrypt, encryptCredential } from '@friendly-aiaep/auth-adapter';

const oldKey = process.env.OLD_ENCRYPTION_KEY!;
const newKey = process.env.NEW_ENCRYPTION_KEY!;

// Decrypt with old key
const credential = decryptCredential(encryptedData, oldKey);

// Re-encrypt with new key
const reencrypted = encryptCredential(credential, newKey);
```

### Custom Salt Usage

Using custom salts allows for additional security when storing encrypted data:

```typescript
const options = {
  salt: 'tenant-specific-salt-123'
};

const ciphertext = encrypt('data', 'master-key', options);
const plaintext = decrypt(ciphertext, 'master-key', options);
```

## Examples

### Example 1: Storing API Credentials

```typescript
import { encryptCredential, decryptCredential } from '@friendly-aiaep/auth-adapter';

// Before storing to database
const credential = {
  username: 'api-user',
  password: 'password123',
  apiKey: 'sk_live_abc123'
};

const encrypted = encryptCredential(credential);
await database.storeCredential(encrypted);

// When retrieving from database
const stored = await database.getCredential();
const decrypted = decryptCredential(stored);
// Use decrypted credentials
```

### Example 2: Encrypting Configuration

```typescript
import { encrypt, decrypt } from '@friendly-aiaep/auth-adapter';

// Encrypt sensitive config
const config = {
  apiUrl: 'https://api.example.com',
  apiSecret: encrypt('secret-value'),
  webhookUrl: 'https://webhook.example.com'
};

// Save config
fs.writeFileSync('config.json', JSON.stringify(config));

// Load and decrypt
const loadedConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const apiSecret = decrypt(loadedConfig.apiSecret);
```

### Example 3: Multi-Tenant Encryption

```typescript
import { encrypt, decrypt } from '@friendly-aiaep/auth-adapter';

function encryptForTenant(data: string, tenantId: string): string {
  const options = {
    salt: `tenant-${tenantId}`
  };
  return encrypt(data, undefined, options);
}

function decryptForTenant(data: string, tenantId: string): string {
  const options = {
    salt: `tenant-${tenantId}`
  };
  return decrypt(data, undefined, options);
}

// Usage
const encrypted = encryptForTenant('sensitive-data', 'tenant-123');
const decrypted = decryptForTenant(encrypted, 'tenant-123');
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
pnpm nx test auth-adapter

# Run with coverage
pnpm nx test auth-adapter --coverage

# Watch mode
pnpm nx test auth-adapter --watch
```

## Technical Details

### Algorithm: AES-256-GCM

- **Mode**: Galois/Counter Mode (GCM)
- **Key Size**: 256 bits
- **IV Size**: 128 bits (16 bytes)
- **Authentication**: Built-in authentication tag (GCM mode)

### Key Derivation: scrypt

- **Algorithm**: scrypt (RFC 7914)
- **Parameters**: N=16384, r=8, p=1
- **Output**: 256-bit key
- **Purpose**: CPU-hard and memory-hard derivation resistant to brute-force attacks

### Output Format

Encrypted data is returned as a colon-separated string:

```
<iv>:<authTag>:<encrypted>
```

All components are base64-encoded for safe storage and transmission.

## Troubleshooting

### "No encryption key provided" Error

**Cause**: `ENCRYPTION_KEY` environment variable is not set and no key was passed.

**Solution**: Set the environment variable or pass the key explicitly:

```typescript
// Option 1: Set environment variable
process.env.ENCRYPTION_KEY = 'your-key';
encrypt('data');

// Option 2: Pass key explicitly
encrypt('data', 'your-key');
```

### "Decryption failed" Error

**Causes:**
- Wrong encryption key
- Tampered/corrupted ciphertext
- Mismatched salt values

**Solutions:**
- Verify you're using the same key for encryption and decryption
- Check if data was corrupted during storage/transmission
- Ensure salt values match if using custom salts

### "Invalid ciphertext format" Error

**Cause**: Ciphertext is not in expected `iv:authTag:encrypted` format.

**Solution**: Ensure the data was encrypted using this library's `encrypt()` function.

## Performance Considerations

- **Key Derivation**: Expensive operation (intentionally). Cache derived keys when possible.
- **Encryption/Decryption**: Fast for typical data sizes (< 1MB)
- **Credential Operations**: Minimal overhead for typical credential objects

## License

Part of the Friendly AI AEP project.
