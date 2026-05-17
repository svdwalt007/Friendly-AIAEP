# Authentication & Authorization Guide

**Complete Authentication and Authorization Implementation Guide**

Comprehensive guide for implementing authentication and authorization in Friendly AI AEP.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [JWT Tokens](#jwt-tokens)
4. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
5. [Multi-Tenant Security](#multi-tenant-security)
6. [API Security](#api-security)
7. [Session Management](#session-management)
8. [Best Practices](#best-practices)

---

## Overview

### Authentication vs Authorization

**Authentication**: Who are you?
**Authorization**: What can you do?

### Security Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Client                            │
└───────────────┬──────────────────────────────────────┘
                │ 1. Login Request
                ▼
┌──────────────────────────────────────────────────────┐
│              API Gateway                             │
│  ┌────────────────────────────────────────────────┐  │
│  │  Authentication Service                        │  │
│  │  • Validate credentials                        │  │
│  │  • Generate JWT tokens                         │  │
│  │  • Refresh tokens                              │  │
│  └────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────────┘
                │ 2. JWT Token
                ▼
┌──────────────────────────────────────────────────────┐
│              Protected Resource                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Authorization Middleware                      │  │
│  │  • Verify JWT                                  │  │
│  │  • Check permissions (RBAC)                    │  │
│  │  • Validate tenant context                     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Login Flow

```
User enters credentials
        ↓
Validate username/password
        ↓
Generate Access Token (JWT)
        ↓
Generate Refresh Token
        ↓
Return tokens to client
        ↓
Client stores tokens securely
```

### Implementation

**Login Endpoint:**
```typescript
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

export async function authRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  fastify.post('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body as {
      username: string;
      password: string;
    };

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      include: { tenant: true }
    });

    if (!user) {
      return reply.code(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return reply.code(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        tenantId: user.tenantId,
        role: user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: '7d' }
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role
      }
    };
  });
}
```

### Token Refresh Flow

```typescript
fastify.post('/api/v1/auth/token/refresh', async (request, reply) => {
  const { refreshToken } = request.body as { refreshToken: string };

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as { userId: string };

    // Check if refresh token exists and is valid
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: decoded.userId,
        expiresAt: { gt: new Date() },
        revoked: false
      },
      include: { user: true }
    });

    if (!storedToken) {
      return reply.code(401).send({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: storedToken.user.id,
        username: storedToken.user.username,
        tenantId: storedToken.user.tenantId,
        role: storedToken.user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    return {
      accessToken,
      expiresIn: 3600
    };
  } catch (error) {
    return reply.code(401).send({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token'
      }
    });
  }
});
```

---

## JWT Tokens

### Token Structure

**Access Token Payload:**
```json
{
  "userId": "user_001",
  "username": "demo",
  "tenantId": "tenant_001",
  "role": "admin",
  "iat": 1681568400,
  "exp": 1681572000
}
```

### Token Verification

**Authentication Middleware:**
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header'
        }
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as {
      userId: string;
      username: string;
      tenantId: string;
      role: string;
    };

    // Attach user info to request
    request.user = decoded;
  } catch (error) {
    return reply.code(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token'
      }
    });
  }
}
```

**Usage:**
```typescript
fastify.get('/api/v1/projects', {
  preHandler: authenticate
}, async (request, reply) => {
  const { tenantId } = request.user;

  const projects = await prisma.project.findMany({
    where: { tenantId }
  });

  return { data: projects };
});
```

---

## Role-Based Access Control (RBAC)

### Roles & Permissions

```typescript
enum Role {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer'
}

const permissions = {
  admin: [
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete',
    'users:manage',
    'billing:view',
    'settings:manage'
  ],
  user: [
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete'
  ],
  viewer: [
    'projects:read'
  ]
};
```

### Authorization Middleware

```typescript
function authorize(...requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user;

    const userPermissions = permissions[role] || [];

    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
  };
}

// Usage
fastify.delete('/api/v1/projects/:id', {
  preHandler: [authenticate, authorize('projects:delete')]
}, async (request, reply) => {
  // Delete project
});
```

### Resource-Based Authorization

```typescript
async function canAccessProject(
  userId: string,
  projectId: string,
  tenantId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      tenantId: tenantId
    }
  });

  return !!project;
}

// Usage
fastify.get('/api/v1/projects/:id', {
  preHandler: authenticate
}, async (request, reply) => {
  const { id } = request.params as { id: string };
  const { userId, tenantId } = request.user;

  const hasAccess = await canAccessProject(userId, id, tenantId);

  if (!hasAccess) {
    return reply.code(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied'
      }
    });
  }

  const project = await prisma.project.findUnique({
    where: { id }
  });

  return { data: project };
});
```

---

## Multi-Tenant Security

### Tenant Isolation

**Row-Level Security (RLS):**
```sql
-- PostgreSQL RLS example
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Prisma Middleware:**
```typescript
prisma.$use(async (params, next) => {
  const tenantId = getCurrentTenantId(); // From request context

  if (params.model === 'Project') {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        tenantId
      };
    }
  }

  return next(params);
});
```

### Tenant Context

```typescript
import { AsyncLocalStorage } from 'async_hooks';

const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

export function setTenantContext(tenantId: string) {
  tenantContext.enterWith({ tenantId });
}

export function getTenantContext() {
  return tenantContext.getStore()?.tenantId;
}

// Middleware
fastify.addHook('onRequest', async (request) => {
  if (request.user) {
    setTenantContext(request.user.tenantId);
  }
});
```

---

## API Security

### Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.user?.tenantId || request.ip
});
```

### CORS Configuration

```typescript
import cors from '@fastify/cors';

fastify.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = [
      'http://localhost:45000',
      'https://friendly-aiaep.com'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
});
```

### Security Headers

```typescript
import helmet from '@fastify/helmet';

fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
});
```

---

## Session Management

### Session Store

```typescript
import session from '@fastify/session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

fastify.register(session, {
  secret: process.env.SESSION_SECRET!,
  store: new RedisStore({ client: redisClient }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});
```

### Logout

```typescript
fastify.post('/api/v1/auth/logout', {
  preHandler: authenticate
}, async (request, reply) => {
  const { userId } = request.user;

  // Revoke all refresh tokens for user
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true }
  });

  // Destroy session
  request.session.destroy();

  return {
    status: 'success',
    message: 'Logged out successfully'
  };
});
```

---

## Best Practices

### 1. Password Security

```typescript
import * as bcrypt from 'bcrypt';

// Hash password
const hashedPassword = await bcrypt.hash(password, 12);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 2. Secure Token Storage

**Client-side (Browser):**
```javascript
// Store in HttpOnly cookie (preferred)
// Set by server: Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict

// Or in memory (for SPAs)
let accessToken: string | null = null;

function setAccessToken(token: string) {
  accessToken = token;
}

function getAccessToken() {
  return accessToken;
}

// Never store in localStorage for sensitive tokens
```

### 3. Token Rotation

```typescript
// Rotate refresh token on use
async function rotateRefreshToken(oldToken: string) {
  // Revoke old token
  await prisma.refreshToken.update({
    where: { token: oldToken },
    data: { revoked: true }
  });

  // Generate new token
  const newToken = jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  );

  await prisma.refreshToken.create({
    data: {
      token: newToken,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return newToken;
}
```

### 4. Audit Logging

```typescript
async function auditLog(
  action: string,
  userId: string,
  resource: string,
  details?: any
) {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      resource,
      details: JSON.stringify(details),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date()
    }
  });
}

// Usage
await auditLog('USER_LOGIN', user.id, 'auth');
await auditLog('PROJECT_DELETED', user.id, 'project', { projectId });
```

---

## Related Documentation

- [Security Best Practices](./BEST-PRACTICES.md)
- [REST API Reference](../api-reference/REST-API.md)
- [Development Guide](../guides/DEVELOPMENT-GUIDE.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology Security Team
