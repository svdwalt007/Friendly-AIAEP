# License Service Quick Start

## Installation

```bash
# Build the library
pnpm nx build license-service
```

## Environment Setup

```bash
# Required: Set the HMAC signing secret
export FRIENDLY_LICENSE_SECRET="your-secure-random-secret-min-32-chars"

# Optional: Redis connection (defaults to localhost:6379)
export REDIS_URL="redis://localhost:6379"
```

## Basic Usage

```typescript
import { LicenseService, LicenseTier, DeployMode } from '@friendly-aiaep/license-service';
import Redis from 'ioredis';

// Initialize
const redis = new Redis();
const service = new LicenseService(redis);

// Generate a license
const key = service.generateKey(
  'tenant-123',
  LicenseTier.PROFESSIONAL,
  DeployMode.SAAS
);

// Output: FTECH-AEP-PRO-S-A665A45B-1767225600-13-B4F5E8C9D2A1

// Validate
const result = await service.validateKey(key);
console.log(result.valid); // true

// Clean up
await service.close();
```

## Tier Feature Matrix

| Tier | Code | Price | Features |
|------|------|-------|----------|
| Starter | `STR` | $499/mo | Base features only |
| Professional | `PRO` | $2,499/mo | + Git, 3rd-party ingestion, multi-env |
| Enterprise | `ENT` | $7,999/mo | All features (Helm, Ollama, air-gap, custom widgets) |

## Key Format

```
FTECH-AEP-PRO-S-A665A45B-1767225600-13-B4F5E8C9D2A1
         │   │ │        │          │  │
         │   │ │        │          │  └─ HMAC (12 chars)
         │   │ │        │          └──── Feature flags (hex)
         │   │ │        └─────────────── Expiry (unix timestamp)
         │   │ └──────────────────────── Tenant hash (8 chars)
         │   └─────────────────────────── Deploy mode (S=SaaS, D=Dedicated)
         └─────────────────────────────── Tier (STR/PRO/ENT)
```

## Common Operations

### Check Feature Entitlement

```typescript
import { LicenseFeature } from '@friendly-aiaep/license-service';

const canUseGit = await service.isFeatureEnabled(
  licenseKey,
  LicenseFeature.GIT_PUSH
);

if (!canUseGit) {
  throw new Error('Git push not available in your tier');
}
```

### Revoke a Key

```typescript
await service.revokeKey(compromisedKey);

// Revoked keys fail validation
const result = await service.validateKey(compromisedKey);
console.log(result.revoked); // true
```

### Custom Expiry

```typescript
const expires2027 = new Date('2027-12-31');

const key = service.generateKey(
  'tenant-456',
  LicenseTier.ENTERPRISE,
  DeployMode.DEDICATED,
  undefined, // Use tier preset features
  expires2027
);
```

## Feature Flags (Bits 0-6)

```typescript
import { FEATURE_BITS } from '@friendly-aiaep/license-service';

const customFeatures =
  FEATURE_BITS.GIT_PUSH |
  FEATURE_BITS.OLLAMA_LLM |
  FEATURE_BITS.CUSTOM_WIDGETS;
// = 0b0100110 = 38

const key = service.generateKey(
  'tenant-789',
  LicenseTier.PROFESSIONAL,
  DeployMode.SAAS,
  customFeatures
);
```

## Integration with API Gateway

```typescript
// Fastify route guard
fastify.addHook('preHandler', async (request, reply) => {
  const licenseKey = request.headers['x-license-key'];

  const validation = await licenseService.validateKey(licenseKey);

  if (!validation.valid) {
    reply.code(401).send({ error: validation.error });
    return;
  }

  request.license = validation.license;
});

// Feature-gated endpoint
fastify.post('/api/publish/git', async (request, reply) => {
  const canUseGit = await licenseService.isFeatureEnabled(
    request.license.raw,
    LicenseFeature.GIT_PUSH
  );

  if (!canUseGit) {
    reply.code(403).send({ error: 'Git push requires Pro or Enterprise tier' });
    return;
  }

  // Proceed with Git push
});
```

## Validation Error Handling

```typescript
const validation = await service.validateKey(key);

if (!validation.valid) {
  if (validation.expired) {
    // License has expired - prompt for renewal
    console.error(`License expired: ${validation.error}`);
  } else if (validation.revoked) {
    // License was revoked - contact support
    console.error('License has been revoked');
  } else if (validation.invalidSignature) {
    // Key tampered with or wrong secret
    console.error('Invalid license signature');
  } else {
    // Other validation error
    console.error(`Invalid license: ${validation.error}`);
  }
}
```

## Testing

Tests are handled by a separate testing agent. The test suite covers:

- Key generation and format validation
- HMAC signature verification
- Tamper detection (modified keys fail)
- Expiry checking
- Revocation workflows
- Feature flag extraction
- Tier preset validation

```bash
# Run tests (when implemented)
pnpm nx test license-service
```

## Troubleshooting

### Error: "License secret not configured"

```bash
# Set the environment variable
export FRIENDLY_LICENSE_SECRET="your-secret-here"

# Or pass directly to constructor
const service = new LicenseService(redis, 'your-secret-here');
```

### Error: "Invalid HMAC signature"

This happens when:
1. Key was generated with a different secret
2. Key was modified/corrupted
3. Wrong secret is being used for validation

### Redis Connection Refused

```bash
# Start Redis with Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or verify Redis is running
redis-cli ping  # Should return: PONG
```

## Security Best Practices

1. **Never hardcode secrets** - Use environment variables or a secure vault
2. **Use strong secrets** - Minimum 32 random bytes
3. **Rotate secrets** - Periodically rotate and re-issue keys
4. **Log validation failures** - Monitor for tampering attempts
5. **Transmit over HTTPS** - Never send keys over unencrypted connections
6. **Validate tenant binding** - Check tenant hash matches current tenant

## Next Steps

- See [README.md](./README.md) for full API documentation
- Review tier presets in `src/lib/constants.ts`
- Check integration examples in README
- Implement license validation middleware for your API routes

## Support

For questions or issues:
- Review the Module Reference v2.2 Section 12.1
- Check the System Specification v2.2 Section 8.1
- Consult the architecture team
