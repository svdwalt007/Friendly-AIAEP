# Authentication Module - Quick Start Guide

Get up and running with the AEP API Gateway authentication in 5 minutes.

## Step 1: Generate JWT Keys (Development)

```bash
# Create keys directory
mkdir -p ./keys

# Generate RSA key pair using Node.js
node -e "
const crypto = require('crypto');
const fs = require('fs');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
fs.writeFileSync('./keys/jwt-private.pem', privateKey, { mode: 0o600 });
fs.writeFileSync('./keys/jwt-public.pem', publicKey, { mode: 0o644 });
console.log('Keys generated successfully!');
"
```

## Step 2: Configure Environment

Create `.env` file in the project root:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_PRIVATE_KEY_PATH=./keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=./keys/jwt-public.pem

# Encryption Key (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-32-character-hex-key-here

# Friendly API
FRIENDLY_NORTHBOUND_URL=https://dm.friendly.example.com

# Environment
NODE_ENV=development
```

## Step 3: Register Plugins in app.ts

```typescript
import { FastifyInstance } from 'fastify';
import authPlugin from './auth/auth-plugin';
import authMiddleware from './auth/auth-middleware';

export async function app(fastify: FastifyInstance, opts: any) {
  // 1. Register auth plugin
  await fastify.register(authPlugin, {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    encryptionKey: process.env.ENCRYPTION_KEY,
    friendlyNorthboundUrl: process.env.FRIENDLY_NORTHBOUND_URL!,
    jwt: {
      privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
      publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH,
      generateIfMissing: process.env.NODE_ENV === 'development',
    },
  });

  // 2. Register auth middleware
  await fastify.register(authMiddleware);

  // 3. Register other plugins and routes...
}
```

## Step 4: Create Your First Protected Route

```typescript
// routes/example.ts
import { FastifyInstance } from 'fastify';
import { getTenantId } from '../auth';

export default async function (fastify: FastifyInstance) {
  fastify.get('/api/v1/example', async (request, reply) => {
    const tenantId = getTenantId(request);
    return { message: `Hello from tenant ${tenantId}!` };
  });
}
```

## Step 5: Test the Authentication

```bash
# Start Redis (if not already running)
docker run -d -p 6379:6379 redis:7-alpine

# Start your Fastify server
npm run dev

# Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"uid":"user@tenant123","pw":"password123"}'

# Save the accessToken from response, then test protected route
curl http://localhost:3000/api/v1/example \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## Common Use Cases

### Add Role-Based Protection

```typescript
import { requireRole } from '../auth';

fastify.delete('/api/v1/admin/resource/:id', {
  onRequest: [requireRole(['admin'])]
}, async (request, reply) => {
  // Only admins can access
  return { deleted: true };
});
```

### Add Tier-Based Protection

```typescript
import { requireTier } from '../auth';

fastify.get('/api/v1/premium/features', {
  onRequest: [requireTier('professional')]
}, async (request, reply) => {
  // Only professional and enterprise users
  return { features: ['advanced-analytics'] };
});
```

### Extract User Context

```typescript
import { getTenantId, getUserId, hasRole } from '../auth';

fastify.get('/api/v1/data', async (request, reply) => {
  const tenantId = getTenantId(request);
  const userId = getUserId(request);
  const isAdmin = hasRole(request, 'admin');

  return { tenantId, userId, isAdmin };
});
```

## Troubleshooting

### "JWT keys not found"
- Make sure keys exist in `./keys/` directory
- Or set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` env vars
- Or enable `generateIfMissing: true` in development

### "Failed to initialize Redis connection"
- Check Redis is running: `redis-cli ping`
- Verify REDIS_HOST and REDIS_PORT in .env
- Check firewall/network connectivity

### "Authentication failed" on login
- Verify FRIENDLY_NORTHBOUND_URL is correct
- Check credentials are valid in Friendly API
- Review server logs for detailed error

### "Authentication required" on protected routes
- Include `Authorization: Bearer <token>` header
- Check token hasn't expired (15 min default)
- Verify token is valid (not refresh token)

## Next Steps

- Read [README.md](./README.md) for complete documentation
- See [EXAMPLE_USAGE.md](./EXAMPLE_USAGE.md) for advanced patterns
- Review [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture details

## Production Checklist

Before deploying to production:

- [ ] Generate strong RSA keys (2048+ bits)
- [ ] Store keys securely (Kubernetes secrets, AWS Secrets Manager, etc.)
- [ ] Set `NODE_ENV=production`
- [ ] Disable `generateIfMissing` for keys
- [ ] Configure proper Redis instance (not local)
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and alerting
- [ ] Configure rate limiting
- [ ] Review and test all exempt routes
- [ ] Implement audit logging
- [ ] Test token expiration and refresh flows
