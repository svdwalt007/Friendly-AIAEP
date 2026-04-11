# License Service

Enterprise-grade license key generation, validation, and feature gating for the Friendly AI AEP Tool.

## Overview

The License Service implements cryptographically secure license key management with:

- **Three-tier licensing**: Starter ($499/mo), Professional ($2,499/mo), Enterprise ($7,999/mo)
- **Dual deployment modes**: SaaS (multi-tenant) and Dedicated (single-tenant)
- **Feature gating**: 7 feature flags controlling optional capabilities
- **Tamper-proof keys**: HMAC-SHA256 signatures prevent key modification
- **Revocation support**: Redis-backed revocation list

## License Key Format

```
FTECH-AEP-{TIER}-{DEPLOY}-{TENANT_HASH}-{EXPIRY}-{FLAGS}-{HMAC}
```

### Components

| Component | Description | Example |
|-----------|-------------|---------|
| `FTECH-AEP` | Static prefix | `FTECH-AEP` |
| `TIER` | License tier | `STR`, `PRO`, `ENT` |
| `DEPLOY` | Deployment mode | `S` (SaaS), `D` (Dedicated) |
| `TENANT_HASH` | First 8 chars of SHA-256(tenantId) | `A1B2C3D4` |
| `EXPIRY` | Unix epoch timestamp | `1735689600` |
| `FLAGS` | Hex-encoded feature bitfield | `13` (0b0010011) |
| `HMAC` | First 12 chars of HMAC-SHA256 | `9F8E7D6C5B4A` |

### Example

```
FTECH-AEP-PRO-S-A1B2C3D4-1735689600-13-9F8E7D6C5B4A
```

This represents a Professional tier SaaS license for tenant hash `A1B2C3D4`, expiring January 1, 2025, with features `0x13` (Git, 3rd-party ingestion, multi-env).

## Feature Flags

| Bit | Feature | Starter | Pro | Enterprise |
|-----|---------|---------|-----|------------|
| 0 | Helm chart output | ❌ | ❌ | ✅ |
| 1 | Git push | ❌ | ✅ | ✅ |
| 2 | Ollama LLM | ❌ | ❌ | ✅ |
| 3 | Air-gap disconnected mode | ❌ | ❌ | ✅ |
| 4 | Third-party data ingestion | ❌ | ✅ | ✅ |
| 5 | Custom widgets | ❌ | ❌ | ✅ |
| 6 | Multi-environment promotion | ❌ | ✅ | ✅ |

### Tier Presets

- **Starter**: `0b0000000` (0) - No optional features
- **Professional**: `0b0010011` (19) - Git + 3rd-party + multi-env
- **Enterprise**: `0b1111111` (127) - All features

## Usage

### Installation

The service is part of the Nx monorepo. Ensure Redis is available:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or configure existing Redis instance
export REDIS_URL=redis://localhost:6379
```

### Basic Usage

```typescript
import { LicenseService, LicenseTier, DeployMode, LicenseFeature } from '@friendly-aiaep/license-service';
import Redis from 'ioredis';

// Initialize service
const redis = new Redis();
const secret = process.env.FRIENDLY_LICENSE_SECRET;
const service = new LicenseService(redis, secret);

// Generate a license key
const key = service.generateKey(
  'tenant-123',           // Tenant ID
  LicenseTier.PROFESSIONAL, // Tier
  DeployMode.SAAS         // Deployment mode
);

console.log(key);
// FTECH-AEP-PRO-S-A665A45B-1767225600-13-B4F5E8C9D2A1

// Validate a license key
const result = await service.validateKey(key);

if (result.valid) {
  console.log(`Valid ${result.license.tier} license`);
  console.log(`Expires: ${new Date(result.license.expiresAt * 1000)}`);
} else {
  console.error(`Invalid: ${result.error}`);
}

// Check feature entitlement
const canUseGit = await service.isFeatureEnabled(
  key,
  LicenseFeature.GIT_PUSH
);

if (canUseGit) {
  // Enable Git push functionality
}

// Revoke a compromised key
await service.revokeKey(key);

// Cleanup
await service.close();
```

### Advanced Usage

#### Custom Expiry and Features

```typescript
// Generate with custom expiry (2 years from now)
const expiryDate = new Date();
expiryDate.setFullYear(expiryDate.getFullYear() + 2);

const customKey = service.generateKey(
  'tenant-456',
  LicenseTier.ENTERPRISE,
  DeployMode.DEDICATED,
  0b1111111, // Custom features (all enabled)
  expiryDate
);
```

#### Using the Options Interface

```typescript
const key = service.generateKeyWithOptions({
  tenantId: 'tenant-789',
  tier: LicenseTier.STARTER,
  deployMode: DeployMode.SAAS,
  expiryDate: new Date('2027-12-31'),
  features: 0b0000001 // Enable only Helm output
});
```

#### Feature Flag Utilities

```typescript
import { FEATURE_BITS, TIER_PRESETS } from '@friendly-aiaep/license-service';

// Check tier preset features
const proPrese = TIER_PRESETS[LicenseTier.PROFESSIONAL];
console.log(proPrese.features); // 19 (0b0010011)

// Build custom feature set
const customFeatures =
  FEATURE_BITS.GIT_PUSH |
  FEATURE_BITS.OLLAMA_LLM |
  FEATURE_BITS.CUSTOM_WIDGETS;
```

## API Reference

### `LicenseService`

#### Constructor

```typescript
constructor(redis: Redis, secret?: string)
```

- `redis`: ioredis client instance
- `secret`: HMAC signing secret (defaults to `FRIENDLY_LICENSE_SECRET` env var)

#### Methods

##### `generateKey(tenantId, tier, deployMode, features?, expiryDate?): string`

Generates a signed license key.

- **tenantId**: Unique tenant identifier (will be hashed)
- **tier**: `LicenseTier.STARTER | PROFESSIONAL | ENTERPRISE`
- **deployMode**: `DeployMode.SAAS | DEDICATED`
- **features**: Optional feature flags bitfield (defaults to tier preset)
- **expiryDate**: Optional expiry date (defaults to 1 year from now)
- **Returns**: Signed license key string

##### `validateKey(key): Promise<LicenseValidation>`

Validates a license key and returns parsed components.

- **key**: License key string
- **Returns**: Promise resolving to validation result

```typescript
interface LicenseValidation {
  valid: boolean;
  license?: LicenseKey;
  error?: string;
  expired?: boolean;
  revoked?: boolean;
  invalidSignature?: boolean;
}
```

##### `isFeatureEnabled(key, feature): Promise<boolean>`

Checks if a specific feature is enabled.

- **key**: License key string
- **feature**: `LicenseFeature` enum value
- **Returns**: Promise resolving to `true` if feature is enabled

##### `revokeKey(key): Promise<void>`

Revokes a license key.

- **key**: License key to revoke
- **Returns**: Promise resolving when revocation is complete

Revoked keys are stored in Redis with a 10-year TTL.

##### `close(): Promise<void>`

Closes the Redis connection. Call during shutdown.

### Types

#### `LicenseTier`

```typescript
enum LicenseTier {
  STARTER = 'STR',
  PROFESSIONAL = 'PRO',
  ENTERPRISE = 'ENT'
}
```

#### `DeployMode`

```typescript
enum DeployMode {
  SAAS = 'S',
  DEDICATED = 'D'
}
```

#### `LicenseFeature`

```typescript
enum LicenseFeature {
  HELM_OUTPUT = 0,
  GIT_PUSH = 1,
  OLLAMA_LLM = 2,
  AIR_GAP_MODE = 3,
  THIRD_PARTY_INGESTION = 4,
  CUSTOM_WIDGETS = 5,
  MULTI_ENVIRONMENT = 6
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FRIENDLY_LICENSE_SECRET` | Yes | HMAC signing secret (min 32 chars recommended) |
| `REDIS_URL` | No | Redis connection URL (defaults to `redis://localhost:6379`) |

## Security Considerations

### HMAC Secret Management

- Store `FRIENDLY_LICENSE_SECRET` in a secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
- Use a cryptographically random secret (minimum 32 bytes)
- Rotate secrets periodically and re-issue keys
- Never commit secrets to version control

### Key Distribution

- Transmit keys over HTTPS only
- Consider encrypting keys at rest in the database
- Log key generation and revocation events for audit trails

### Validation Best Practices

```typescript
// Always validate before granting access
const validation = await service.validateKey(userProvidedKey);

if (!validation.valid) {
  // Log the failure reason
  logger.warn('License validation failed', {
    error: validation.error,
    expired: validation.expired,
    revoked: validation.revoked,
    invalidSignature: validation.invalidSignature
  });

  // Return appropriate error to client
  throw new UnauthorizedException('Invalid license');
}

// Validate tenant binding if required
const tenantHash = hashTenant(currentTenantId);
if (validation.license.tenantHash !== tenantHash) {
  throw new UnauthorizedException('License not valid for this tenant');
}
```

## Redis Schema

### Revocation List

Keys are stored with the following pattern:

```
license:revoked:{FULL_LICENSE_KEY}
```

Example:
```
license:revoked:FTECH-AEP-PRO-S-A1B2C3D4-1735689600-13-9F8E7D6C5B4A
```

**Value**: ISO timestamp of revocation
**TTL**: 10 years (315360000 seconds)

## Integration Examples

### Fastify Route Guard

```typescript
import { LicenseService, LicenseFeature } from '@friendly-aiaep/license-service';

// Decorator for feature gating
fastify.decorateRequest('requireFeature', async function(feature: LicenseFeature) {
  const licenseKey = this.headers['x-license-key'];

  const hasFeature = await licenseService.isFeatureEnabled(licenseKey, feature);
  if (!hasFeature) {
    throw new UnauthorizedException(`Feature not available in your license tier`);
  }
});

// Protected route
fastify.post('/api/publish/git', {
  preHandler: async (request, reply) => {
    await request.requireFeature(LicenseFeature.GIT_PUSH);
  }
}, async (request, reply) => {
  // Git push logic
});
```

### Express Middleware

```typescript
import { LicenseService, LicenseFeature } from '@friendly-aiaep/license-service';

function requireFeature(feature: LicenseFeature) {
  return async (req, res, next) => {
    const licenseKey = req.headers['x-license-key'];

    const hasFeature = await licenseService.isFeatureEnabled(licenseKey, feature);
    if (!hasFeature) {
      return res.status(403).json({
        error: 'Feature not available in your license tier'
      });
    }

    next();
  };
}

// Protected route
app.post('/api/widgets/custom',
  requireFeature(LicenseFeature.CUSTOM_WIDGETS),
  async (req, res) => {
    // Custom widget logic
  }
);
```

## Building

Run `nx build license-service` to build the library.

## Running unit tests

Run `nx test license-service` to execute the unit tests via [Vitest](https://vitest.dev/).

Tests are handled by a separate agent and include comprehensive coverage of:

- Key generation and parsing
- HMAC signature verification
- Tamper detection
- Expiry validation
- Revocation workflows
- Feature flag extraction
- Tier preset validation

## Dependencies

- **ioredis** (^5.10.1): Redis client for revocation list
- **crypto** (Node.js built-in): HMAC-SHA256 and SHA-256 operations
- **tslib** (^2.3.0): TypeScript runtime helpers

## Module Dependencies

As per Module Reference v2.2 Section 15:

- **Depends on**: policy-service (for policy enforcement integration)
- **Used by**:
  - aep-api-gateway (license validation middleware)
  - docker-generator (license embedding in containers)
  - publish-service (tier-based publishing limits)
  - iot-api-proxy (API call rate limits per tier)

## Architecture Notes

- License keys are **stateless** except for revocation checks
- HMAC signature prevents tampering without database lookup
- Tenant hash binding prevents key sharing between tenants
- Redis revocation provides immediate key invalidation
- Feature flags use bit operations for efficient storage and checking

## Troubleshooting

### "License secret not configured"

Set the `FRIENDLY_LICENSE_SECRET` environment variable:

```bash
export FRIENDLY_LICENSE_SECRET="your-secret-here"
```

### "Invalid HMAC signature"

This indicates:
- Key has been tampered with, OR
- Different signing secret was used, OR
- Key was corrupted during transmission

### Redis Connection Errors

Ensure Redis is running and accessible:

```bash
redis-cli ping
# Should return: PONG
```

## License

Proprietary - Friendly Technologies
Part of the Friendly AI AEP Tool
Internal Engineering - Confidential
