# API Gateway Plugins

This directory contains Fastify plugins that are automatically loaded via `@fastify/autoload`.

## Available Plugins

### 1. Helmet (Security Headers)
**File:** `helmet.ts`

Production-ready security headers including CSP, HSTS, and more.

**Auto-loaded:** Yes

### 2. Rate Limiting (Tiered)
**File:** `rate-limiting.ts`

Tiered rate limiting with Redis backend and graceful fallback.

**Auto-loaded:** Yes (if file is in plugins directory)
**Manual registration:** Required (currently not in plugins directory)

To enable, move the file to the plugins directory or register manually:

```typescript
// In app.ts
import rateLimiting from './plugins/rate-limiting';
fastify.register(rateLimiting);
```

### 3. Environment Validation
**File:** `env-validation.ts`

Validates required environment variables on startup.

**Auto-loaded:** Yes (if file exists)

### 4. Request Context
**File:** `request-context.ts`

Adds request context and correlation IDs.

**Auto-loaded:** Yes (if file exists)

### 5. Preview Runtime
**File:** `preview-runtime.ts`

Manages preview runtime for the builder.

**Auto-loaded:** Yes (if file exists)

### 6. WebSocket
**File:** `websocket.ts`

WebSocket support for real-time features.

**Auto-loaded:** Yes

## Plugin Order

Plugins are loaded in alphabetical order by default. For specific loading order:

1. Create numbered prefixes (e.g., `01-helmet.ts`, `02-cors.ts`)
2. Or register critical plugins manually before autoload

## Adding New Plugins

1. Create a new file in this directory
2. Export a fastify-plugin wrapped function:

```typescript
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export default fp(async function (fastify: FastifyInstance, options) {
  // Your plugin code here
});
```

3. Plugin will be automatically loaded on next server start

## Configuration

Plugins receive options from the parent registration:

```typescript
// In app.ts
fastify.register(AutoLoad, {
  dir: path.join(__dirname, 'plugins'),
  options: {
    // These options are passed to all plugins
    customOption: 'value',
  },
});
```

## See Also

- [Fastify Plugins Documentation](https://www.fastify.io/docs/latest/Reference/Plugins/)
- [fastify-plugin](https://github.com/fastify/fastify-plugin)
- [SECURITY-PERFORMANCE-ENHANCEMENTS.md](../../../../../SECURITY-PERFORMANCE-ENHANCEMENTS.md)
