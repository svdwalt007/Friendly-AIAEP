# Security Best Practices

**Security Best Practices and Hardening Guide for Friendly AI AEP**

Comprehensive security guidelines for building, deploying, and operating secure applications.

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Application Security](#application-security)
3. [API Security](#api-security)
4. [Database Security](#database-security)
5. [Infrastructure Security](#infrastructure-security)
6. [Docker Security](#docker-security)
7. [Kubernetes Security](#kubernetes-security)
8. [Secrets Management](#secrets-management)
9. [Monitoring & Incident Response](#monitoring--incident-response)
10. [Compliance & Auditing](#compliance--auditing)

---

## Security Overview

### Security Principles

1. **Defense in Depth**: Multiple layers of security
2. **Least Privilege**: Minimum necessary permissions
3. **Fail Secure**: Default to deny
4. **Security by Design**: Security from the start
5. **Regular Updates**: Keep dependencies current
6. **Audit Everything**: Log all security events

### Security Layers

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  • Input validation                     │
│  • Output encoding                      │
│  • Authentication & Authorization       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         API Layer                       │
│  • Rate limiting                        │
│  • CORS policies                        │
│  • Security headers                     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Infrastructure Layer            │
│  • Network segmentation                 │
│  • Firewall rules                       │
│  • TLS/SSL encryption                   │
└─────────────────────────────────────────┘
```

---

## Application Security

### 1. Input Validation

**Always validate and sanitize user input:**

```typescript
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Name contains invalid characters'),
  description: z.string()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  deploymentMode: z.enum(['saas', 'on-premise', 'hybrid'])
});

// Usage
try {
  const validatedData = createProjectSchema.parse(request.body);
  // Process validated data
} catch (error) {
  return reply.code(400).send({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: error.errors
    }
  });
}
```

### 2. SQL Injection Prevention

**Use parameterized queries (Prisma does this automatically):**

```typescript
// Good: Parameterized query (Prisma)
const user = await prisma.user.findUnique({
  where: { username: userInput }
});

// Bad: String concatenation (NEVER DO THIS)
// const query = `SELECT * FROM users WHERE username = '${userInput}'`;
```

### 3. XSS Prevention

**Sanitize output and use Content Security Policy:**

```typescript
import helmet from '@fastify/helmet';

fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.friendly-aiaep.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: 'nosniff',
  xXssProtection: true
});
```

### 4. CSRF Protection

```typescript
import csrf from '@fastify/csrf-protection';

fastify.register(csrf, {
  sessionPlugin: '@fastify/session'
});

// Generate token
const token = reply.generateCsrf();

// Verify token
fastify.post('/api/v1/projects', {
  preHandler: fastify.csrfProtection
}, async (request, reply) => {
  // Handle request
});
```

### 5. Secure Dependencies

```bash
# Audit dependencies regularly
pnpm audit

# Fix vulnerabilities
pnpm audit --fix

# Use Snyk for continuous monitoring
snyk test
snyk monitor
```

**Update dependencies:**
```bash
# Check for outdated packages
pnpm outdated

# Update packages
pnpm update --latest

# Update Nx
pnpm nx migrate latest
```

---

## API Security

### 1. Authentication

**Require authentication for all protected endpoints:**

```typescript
const publicRoutes = [
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register'
];

fastify.addHook('onRequest', async (request, reply) => {
  if (publicRoutes.includes(request.url)) {
    return;
  }

  await authenticate(request, reply);
});
```

### 2. Rate Limiting

**Prevent abuse with rate limiting:**

```typescript
import rateLimit from '@fastify/rate-limit';

// Global rate limit
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

// Endpoint-specific rate limit
fastify.post('/api/v1/auth/login', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '5 minutes'
    }
  }
}, loginHandler);
```

### 3. API Versioning

**Use API versioning for backwards compatibility:**

```typescript
// v1 routes
fastify.register(async (fastify) => {
  fastify.get('/api/v1/projects', handlerV1);
}, { prefix: '/api/v1' });

// v2 routes
fastify.register(async (fastify) => {
  fastify.get('/api/v2/projects', handlerV2);
}, { prefix: '/api/v2' });
```

### 4. Request Size Limits

**Limit request body size:**

```typescript
fastify.register(fastifyExpress, {
  bodyLimit: 1024 * 1024 // 1MB
});

// Per-route limit
fastify.post('/api/v1/upload', {
  bodyLimit: 10 * 1024 * 1024 // 10MB
}, uploadHandler);
```

---

## Database Security

### 1. Encryption at Rest

**Enable encryption for database:**

```sql
-- PostgreSQL encryption
ALTER DATABASE friendly_aep SET encryption = 'on';

-- Enable SSL connections
ALTER SYSTEM SET ssl = on;
```

### 2. Encryption in Transit

**Require SSL connections:**

```typescript
// DATABASE_URL with SSL
const databaseUrl = 'postgresql://user:password@host:46100/db?sslmode=require';

// Prisma client with SSL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});
```

### 3. Password Hashing

**Use strong password hashing:**

```typescript
import * as bcrypt from 'bcrypt';

// Hash password (cost factor 12)
const hashedPassword = await bcrypt.hash(password, 12);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 4. Database User Permissions

**Use least privilege principle:**

```sql
-- Create application user with limited permissions
CREATE USER friendly_app WITH PASSWORD 'secure_password';

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE ON TABLE projects TO friendly_app;
GRANT SELECT, INSERT, UPDATE ON TABLE users TO friendly_app;

-- Revoke dangerous permissions
REVOKE DELETE ON ALL TABLES FROM friendly_app;
REVOKE DROP ON DATABASE FROM friendly_app;
```

### 5. Row-Level Security

**Implement tenant isolation:**

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## Infrastructure Security

### 1. Network Segmentation

**Isolate network layers:**

```
┌──────────────────────────────────────┐
│         Public Subnet                │
│  • Load Balancer                     │
│  • CDN                               │
└──────────────┬───────────────────────┘
               │
┌──────────────┴───────────────────────┐
│         Application Subnet           │
│  • API Gateway                       │
│  • Application Servers               │
└──────────────┬───────────────────────┘
               │
┌──────────────┴───────────────────────┐
│         Database Subnet              │
│  • PostgreSQL                        │
│  • Redis                             │
│  • InfluxDB                          │
└──────────────────────────────────────┘
```

### 2. Firewall Rules

**Configure strict firewall rules:**

```bash
# Allow only necessary ports
# HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# SSH (from specific IP)
ufw allow from 203.0.113.0/24 to any port 22

# Database (internal only)
ufw allow from 10.0.1.0/24 to any port 5432

# Deny all other traffic
ufw default deny incoming
ufw default allow outgoing
```

### 3. TLS/SSL Configuration

**Use strong TLS configuration:**

```nginx
# Nginx SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## Docker Security

### 1. Use Official Images

```dockerfile
# Good: Official Node.js image
FROM node:20-alpine

# Bad: Unknown source
FROM random-user/node:latest
```

### 2. Run as Non-Root

```dockerfile
# Create non-root user
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nodejs

# Switch to non-root user
USER nodejs

# Application runs as nodejs, not root
CMD ["node", "app.js"]
```

### 3. Minimize Attack Surface

```dockerfile
# Use minimal base image
FROM node:20-alpine

# Install only required packages
RUN apk add --no-cache dumb-init

# Remove unnecessary files
RUN rm -rf /tmp/* /var/cache/apk/*
```

### 4. Scan for Vulnerabilities

```bash
# Scan with Trivy
trivy image ghcr.io/svdwalt007/friendly-aep/api-gateway:latest

# Scan with Snyk
snyk container test ghcr.io/svdwalt007/friendly-aep/api-gateway:latest

# Scan with Docker Scout
docker scout cves ghcr.io/svdwalt007/friendly-aep/api-gateway:latest
```

---

## Kubernetes Security

### 1. Pod Security Standards

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: friendly-aep-api
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: api-gateway
      image: friendly-aep/api-gateway:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
```

### 2. Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-policy
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: ingress-nginx
      ports:
        - protocol: TCP
          port: 3001
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
```

### 3. RBAC Policies

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
subjects:
  - kind: ServiceAccount
    name: friendly-aep-sa
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### 4. Secrets Management

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
type: Opaque
stringData:
  url: "postgresql://..."
  password: "secure-password"

---
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: api-gateway
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
```

---

## Secrets Management

### 1. Never Commit Secrets

**.gitignore:**
```
.env
.env.local
.env.production
*.pem
*.key
secrets/
credentials.json
```

### 2. Use Environment Variables

```typescript
// Good: Environment variables
const apiKey = process.env.ANTHROPIC_API_KEY;

// Bad: Hardcoded
// const apiKey = 'sk-ant-hardcoded-key';
```

### 3. Use Secret Management Tools

**AWS Secrets Manager:**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getSecret(secretName: string) {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return JSON.parse(response.SecretString!);
}
```

**HashiCorp Vault:**
```typescript
import Vault from 'node-vault';

const vault = Vault({
  endpoint: 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN
});

const secret = await vault.read('secret/data/friendly-aep');
```

### 4. Rotate Secrets Regularly

```bash
# Rotate database password every 90 days
# Rotate API keys every 180 days
# Rotate JWT secrets every 365 days
```

---

## Monitoring & Incident Response

### 1. Security Monitoring

**Log security events:**
```typescript
async function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any
) {
  await prisma.securityLog.create({
    data: {
      event,
      severity,
      details: JSON.stringify(details),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date()
    }
  });

  if (severity === 'critical') {
    await notifySecurityTeam(event, details);
  }
}

// Usage
await logSecurityEvent('FAILED_LOGIN_ATTEMPT', 'medium', {
  username: username,
  attempts: attempts
});
```

### 2. Intrusion Detection

**Monitor for suspicious activity:**
```typescript
// Failed login attempts
if (failedAttempts >= 5) {
  await logSecurityEvent('BRUTE_FORCE_ATTEMPT', 'high', {
    username,
    ipAddress
  });
  await blockIPAddress(ipAddress, '1 hour');
}

// Unusual API usage
if (requestsPerMinute > threshold) {
  await logSecurityEvent('RATE_LIMIT_ABUSE', 'medium', {
    userId,
    requestCount: requestsPerMinute
  });
}
```

### 3. Incident Response Plan

**Response procedure:**
1. **Detect**: Automated alerts
2. **Assess**: Determine severity
3. **Contain**: Isolate affected systems
4. **Eradicate**: Remove threat
5. **Recover**: Restore normal operations
6. **Review**: Post-incident analysis

---

## Compliance & Auditing

### 1. Audit Logging

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

// Log all sensitive operations
await auditLog('USER_CREATED', adminId, 'user', { newUserId });
await auditLog('PROJECT_DELETED', userId, 'project', { projectId });
await auditLog('SETTINGS_CHANGED', userId, 'settings', { changes });
```

### 2. Data Privacy

**GDPR Compliance:**
```typescript
// Right to erasure
async function deleteUserData(userId: string) {
  // Anonymize user data
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@example.com`,
      username: `deleted-${userId}`,
      deletedAt: new Date()
    }
  });

  // Delete related data
  await prisma.project.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
}

// Data export
async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      projects: true,
      sessions: true
    }
  });

  return JSON.stringify(user, null, 2);
}
```

### 3. Regular Security Audits

**Schedule:**
- **Weekly**: Dependency scans
- **Monthly**: Security code reviews
- **Quarterly**: Penetration testing
- **Annually**: Third-party security audit

---

## Security Checklist

### Development
- [ ] Input validation implemented
- [ ] Output encoding applied
- [ ] Dependencies up to date
- [ ] No secrets in code
- [ ] Security tests passing

### Deployment
- [ ] TLS/SSL configured
- [ ] Firewall rules set
- [ ] Secrets encrypted
- [ ] Monitoring enabled
- [ ] Backups configured

### Operations
- [ ] Logs reviewed daily
- [ ] Alerts configured
- [ ] Incident response plan
- [ ] Security updates applied
- [ ] Audit logs maintained

---

## Related Documentation

- [Authentication Guide](./AUTH-GUIDE.md)
- [Deployment Guide](../guides/DEPLOYMENT-GUIDE.md)
- [Environment Configuration](../development/ENVIRONMENT-CONFIGURATION.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology Security Team
