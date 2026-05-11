# Encryption Utilities - Quick Reference

## Installation

```typescript
import {
  encrypt,
  decrypt,
  encryptCredential,
  decryptCredential,
  generateEncryptionKey
} from '@friendly-aiaep/auth-adapter';
```

## Setup

```bash
# Generate a new encryption key
node -e "console.log(require('@friendly-aiaep/auth-adapter').generateEncryptionKey())"

# Set environment variable
export ENCRYPTION_KEY="your-generated-key-here"
```

## Quick Start

### Basic Encryption

```typescript
// Encrypt
const ciphertext = encrypt('sensitive data');

// Decrypt
const plaintext = decrypt(ciphertext);
```

### Credential Encryption

```typescript
// Encrypt credentials
const encrypted = encryptCredential({
  username: 'user',
  password: 'secret',
  apiKey: 'key123'
});

// Decrypt credentials
const decrypted = decryptCredential(encrypted);
```

## API Reference

| Function | Description | Returns |
|----------|-------------|---------|
| `encrypt(text, key?, opts?)` | Encrypts plaintext | Encrypted string |
| `decrypt(cipher, key?, opts?)` | Decrypts ciphertext | Plaintext string |
| `encryptCredential(cred, key?)` | Encrypts credential fields | EncryptedCredential |
| `decryptCredential(cred, key?)` | Decrypts credential fields | Credential |
| `generateEncryptionKey(len?)` | Generates random key | Hex string |
| `isEncryptedFormat(value)` | Validates format | Boolean |
| `deriveKey(master, salt?)` | Derives encryption key | Buffer |

## Error Handling

```typescript
try {
  const decrypted = decrypt(ciphertext);
} catch (error) {
  if (error instanceof DecryptionError) {
    console.error('Decryption failed:', error.message);
  }
}
```

## Common Patterns

### Store in Database

```typescript
const credential = { username: 'user', password: 'secret' };
const encrypted = encryptCredential(credential);
await db.insert('credentials', encrypted);
```

### Retrieve from Database

```typescript
const encrypted = await db.find('credentials', { id });
const credential = decryptCredential(encrypted);
```

### Custom Key

```typescript
const key = 'my-custom-key';
const encrypted = encrypt('data', key);
const decrypted = decrypt(encrypted, key);
```

### Multi-Tenant

```typescript
const opts = { salt: `tenant-${tenantId}` };
const encrypted = encrypt('data', undefined, opts);
const decrypted = decrypt(encrypted, undefined, opts);
```

## Security Checklist

- ✅ Never commit encryption keys to git
- ✅ Use environment variables for keys
- ✅ Generate strong keys with `generateEncryptionKey()`
- ✅ Rotate keys periodically
- ✅ Use HTTPS for data transmission
- ✅ Store encrypted data in TEXT/VARCHAR fields
- ✅ Implement proper error handling

## Output Format

```
iv:authTag:encrypted
│  │       └─ Encrypted data (base64)
│  └─────────── Authentication tag (base64)
└────────────── Initialization vector (base64)
```

## Environment Variables

```bash
# Required
ENCRYPTION_KEY=your-master-key-here
```

## TypeScript Types

```typescript
interface Credential {
  username?: string;
  password?: string;  // Encrypted
  apiKey?: string;    // Encrypted
  token?: string;     // Encrypted
}

interface EncryptionOptions {
  masterKey?: string;
  salt?: string;
}
```

## Performance

| Operation | Duration |
|-----------|----------|
| Encrypt small string | <1ms |
| Decrypt small string | <1ms |
| Key derivation | ~50ms |
| Encrypt 1MB | ~100ms |

## Testing

```bash
# Run tests
pnpm nx test auth-adapter -- encryption

# With coverage
pnpm nx test auth-adapter --coverage
```

## Documentation

- **Full Guide**: See `ENCRYPTION.md`
- **Examples**: See `ENCRYPTION_EXAMPLES.ts`
- **Implementation**: See `ENCRYPTION_IMPLEMENTATION_SUMMARY.md`

## Support

For issues or questions, see the troubleshooting section in `ENCRYPTION.md`.
