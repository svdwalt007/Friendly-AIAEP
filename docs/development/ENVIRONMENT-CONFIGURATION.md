# Environment Configuration Guide

**Multi-Environment Configuration for Dev, Test, Pre-Prod, and Production**

This guide covers environment configuration management across all deployment stages.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Strategy](#environment-strategy)
3. [Development Environment](#development-environment)
4. [Test Environment](#test-environment)
5. [Pre-Production Environment](#pre-production-environment)
6. [Production Environment](#production-environment)
7. [Environment Variables](#environment-variables)
8. [Secrets Management](#secrets-management)
9. [Configuration Files](#configuration-files)
10. [Best Practices](#best-practices)

---

## Overview

### Environment Tiers

```
┌─────────────────────────────────────────────────────────┐
│                  Environment Pipeline                   │
└─────────────────────────────────────────────────────────┘
     │                 │               │              │
     ▼                 ▼               ▼              ▼
┌──────────┐    ┌──────────┐    ┌──────────┐   ┌──────────┐
│   Dev    │───▶│   Test   │───▶│ Pre-Prod │──▶│   Prod   │
│  Local   │    │   CI/CD  │    │ Staging  │   │   Live   │
└──────────┘    └──────────┘    └──────────┘   └──────────┘
```

| Environment | Purpose | Data | Stability | Access |
|------------|---------|------|-----------|--------|
| **Development** | Local development | Mock/Sample | Unstable | All developers |
| **Test** | Automated testing | Test fixtures | Stable | CI/CD only |
| **Pre-Production** | UAT & integration | Sanitized prod data | Stable | QA team |
| **Production** | Live system | Real data | Highly stable | Ops team only |

---

## Environment Strategy

### Configuration Principles

1. **Environment Parity**: Keep environments as similar as possible
2. **Secrets Separation**: Never commit secrets to version control
3. **Fail Safe**: Default to most restrictive settings
4. **Explicit Configuration**: No hidden defaults
5. **Validation**: Validate configuration at startup

### Configuration Sources (Priority Order)

```
1. Command-line arguments (highest priority)
2. Environment variables
3. .env files
4. Configuration files (config.json, config.yaml)
5. Default values (lowest priority)
```

---

## Development Environment

### Local Setup

**.env.development:**
```env
# ==============================================
# DEVELOPMENT ENVIRONMENT
# ==============================================
NODE_ENV=development
DEPLOYMENT_MODE=development

# Application Ports
AEP_API_GATEWAY_PORT=3001
AEP_BUILDER_PORT=4200
AEP_PREVIEW_HOST_PORT=3002

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-dev-key-here
ANTHROPIC_API_URL=https://api.anthropic.com/v1
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_MAX_TOKENS=4096

# Database (Local Docker)
DATABASE_URL=postgresql://friendly:friendly_dev_password@localhost:46100/friendly_aep
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=friendly
POSTGRES_PASSWORD=friendly_dev_password
POSTGRES_DB=friendly_aep

# Redis
REDIS_URL=redis://localhost:46102
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# InfluxDB
INFLUXDB_URL=http://localhost:46101
INFLUXDB_TOKEN=friendly-dev-token-12345
INFLUXDB_ORG=friendly
INFLUXDB_BUCKET=iot_data

# Grafana
GRAFANA_URL=http://localhost:45001
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=friendly_grafana_dev

# Security (Development - Not secure!)
JWT_SECRET=development-jwt-secret-not-secure
JWT_EXPIRATION=24h
REFRESH_TOKEN_SECRET=development-refresh-secret
REFRESH_TOKEN_EXPIRATION=7d
SESSION_SECRET=development-session-secret

# CORS
CORS_ORIGIN=http://localhost:45000
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
AUDIT_ENABLED=true

# Feature Flags
FEATURE_IOT_ENABLED=true
FEATURE_BUILDER_ENABLED=true
FEATURE_AI_AGENT_RUNTIME=true
FEATURE_GRAFANA_INTEGRATION=true

# Development Tools
DEV_MODE=true
DEV_DEBUG_ENABLED=true
DEV_MOCK_SERVICES=true
WATCH_MODE=true

# Docker Compose
COMPOSE_PROJECT_NAME=friendly-aep
COMPOSE_FILE=docker/docker-compose.dev.yml
```

### Docker Compose (Development)

**docker-compose.dev.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: friendly-postgres
    ports:
      - "5432:46100"
    environment:
      POSTGRES_USER: friendly
      POSTGRES_PASSWORD: friendly_dev_password
      POSTGRES_DB: friendly_aep
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U friendly"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: friendly-redis
    ports:
      - "6379:46102"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  influxdb:
    image: influxdb:2.7-alpine
    container_name: friendly-influxdb
    ports:
      - "8086:46101"
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: friendly_influx_dev
      DOCKER_INFLUXDB_INIT_ORG: friendly
      DOCKER_INFLUXDB_INIT_BUCKET: iot_data
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: friendly-dev-token-12345
    volumes:
      - influxdb-data:/var/lib/influxdb2

  grafana:
    image: grafana/grafana:11.3.0
    container_name: friendly-grafana
    ports:
      - "3000:45001"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: friendly_grafana_dev
      GF_SERVER_ROOT_URL: http://localhost:45001
    volumes:
      - grafana-data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning

volumes:
  postgres-data:
  redis-data:
  influxdb-data:
  grafana-data:
```

---

## Test Environment

### CI/CD Configuration

**.env.test:**
```env
# ==============================================
# TEST ENVIRONMENT (CI/CD)
# ==============================================
NODE_ENV=test
DEPLOYMENT_MODE=test

# In-memory/Ephemeral Services
DATABASE_URL=postgresql://test:test@localhost:46100/friendly_aep_test
REDIS_URL=redis://localhost:46102/1

# Anthropic API (Test Key)
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY_TEST}
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Logging
LOG_LEVEL=warn
LOG_FORMAT=json
AUDIT_ENABLED=false

# Feature Flags (All enabled for comprehensive testing)
FEATURE_IOT_ENABLED=true
FEATURE_BUILDER_ENABLED=true
FEATURE_AI_AGENT_RUNTIME=true
FEATURE_GRAFANA_INTEGRATION=true

# Test Configuration
TEST_TIMEOUT=30000
TEST_PARALLEL=3
TEST_COVERAGE_THRESHOLD=80
```

### GitHub Actions Test Environment

```yaml
# .github/workflows/ci.yml
test:
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: friendly_aep_test
      ports:
        - 5432:46100
    redis:
      image: redis:7-alpine
      ports:
        - 6379:46102

  env:
    DATABASE_URL: postgresql://test:test@localhost:46100/friendly_aep_test
    REDIS_URL: redis://localhost:46102
    NODE_ENV: test
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TEST }}
```

---

## Pre-Production Environment

### Staging Configuration

**.env.staging:**
```env
# ==============================================
# PRE-PRODUCTION (STAGING) ENVIRONMENT
# ==============================================
NODE_ENV=production
DEPLOYMENT_MODE=staging

# Application URLs
API_GATEWAY_URL=https://api-staging.friendly-aiaep.com
BUILDER_URL=https://staging.friendly-aiaep.com

# Database (Managed PostgreSQL)
DATABASE_URL=${DATABASE_URL_STAGING}
POSTGRES_HOST=staging-db.friendly-aiaep.com
POSTGRES_PORT=5432
POSTGRES_DB=friendly_aep_staging
POSTGRES_SSL=true
POSTGRES_MAX_CONNECTIONS=20

# Redis (Managed Redis)
REDIS_URL=${REDIS_URL_STAGING}
REDIS_TLS=true
REDIS_MAX_CONNECTIONS=50

# InfluxDB (Cloud)
INFLUXDB_URL=${INFLUXDB_URL_STAGING}
INFLUXDB_TOKEN=${INFLUXDB_TOKEN_STAGING}
INFLUXDB_ORG=friendly
INFLUXDB_BUCKET=iot_data_staging

# Security (Kubernetes Secrets)
JWT_SECRET=${JWT_SECRET_STAGING}
JWT_EXPIRATION=1h
REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET_STAGING}
REFRESH_TOKEN_EXPIRATION=7d

# Anthropic API
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY_STAGING}
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# CORS
CORS_ORIGIN=https://staging.friendly-aiaep.com
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
AUDIT_ENABLED=true

# Monitoring
GRAFANA_URL=https://grafana-staging.friendly-aiaep.com
PROMETHEUS_URL=http://prometheus:46300
JAEGER_URL=http://jaeger:45002

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Feature Flags
FEATURE_IOT_ENABLED=true
FEATURE_BUILDER_ENABLED=true
FEATURE_AI_AGENT_RUNTIME=true
FEATURE_GRAFANA_INTEGRATION=true
```

### Kubernetes ConfigMap (Staging)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: friendly-aep-config
  namespace: friendly-staging
data:
  NODE_ENV: "production"
  DEPLOYMENT_MODE: "staging"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  CORS_ORIGIN: "https://staging.friendly-aiaep.com"
  FEATURE_IOT_ENABLED: "true"
  FEATURE_BUILDER_ENABLED: "true"
```

### Kubernetes Secrets (Staging)

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: friendly-aep-secrets
  namespace: friendly-staging
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  REDIS_URL: "redis://..."
  ANTHROPIC_API_KEY: "sk-ant-..."
  JWT_SECRET: "..."
  REFRESH_TOKEN_SECRET: "..."
```

---

## Production Environment

### Production Configuration

**.env.production:**
```env
# ==============================================
# PRODUCTION ENVIRONMENT
# ==============================================
NODE_ENV=production
DEPLOYMENT_MODE=production

# Application URLs
API_GATEWAY_URL=https://api.friendly-aiaep.com
BUILDER_URL=https://friendly-aiaep.com

# Database (High Availability)
DATABASE_URL=${DATABASE_URL_PRODUCTION}
POSTGRES_HOST=prod-db-primary.friendly-aiaep.com
POSTGRES_PORT=5432
POSTGRES_DB=friendly_aep
POSTGRES_SSL=true
POSTGRES_MAX_CONNECTIONS=100
POSTGRES_POOL_MIN=10
POSTGRES_POOL_MAX=50
POSTGRES_IDLE_TIMEOUT=30000

# Redis (Cluster)
REDIS_URL=${REDIS_URL_PRODUCTION}
REDIS_CLUSTER_MODE=true
REDIS_TLS=true
REDIS_MAX_CONNECTIONS=200

# InfluxDB (Enterprise)
INFLUXDB_URL=${INFLUXDB_URL_PRODUCTION}
INFLUXDB_TOKEN=${INFLUXDB_TOKEN_PRODUCTION}
INFLUXDB_ORG=friendly
INFLUXDB_BUCKET=iot_data_production

# Security (Vault/Secrets Manager)
JWT_SECRET=${JWT_SECRET_PRODUCTION}
JWT_EXPIRATION=1h
JWT_ALGORITHM=HS256
REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET_PRODUCTION}
REFRESH_TOKEN_EXPIRATION=7d
SESSION_SECRET=${SESSION_SECRET_PRODUCTION}

# Anthropic API
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY_PRODUCTION}
ANTHROPIC_MODEL=claude-opus-4-5-20251101
ANTHROPIC_MAX_TOKENS=8192
ANTHROPIC_TIMEOUT=30000

# CORS (Strict)
CORS_ORIGIN=https://friendly-aiaep.com
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400

# Logging (Structured)
LOG_LEVEL=warn
LOG_FORMAT=json
AUDIT_ENABLED=true
AUDIT_LOG_PATH=/var/log/friendly-aep/audit.log

# Monitoring
GRAFANA_URL=https://grafana.friendly-aiaep.com
PROMETHEUS_URL=http://prometheus:46300
JAEGER_URL=http://jaeger:45002
SENTRY_DSN=${SENTRY_DSN}

# Rate Limiting (Strict)
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Feature Flags
FEATURE_IOT_ENABLED=true
FEATURE_BUILDER_ENABLED=true
FEATURE_AI_AGENT_RUNTIME=true
FEATURE_GRAFANA_INTEGRATION=true

# Performance
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
CACHE_TTL=3600

# High Availability
REPLICA_COUNT=3
ENABLE_AUTO_SCALING=true
MIN_REPLICAS=3
MAX_REPLICAS=10
```

### Production Kubernetes Configuration

**values.production.yaml:**
```yaml
replicaCount: 3

image:
  registry: ghcr.io/svdwalt007/friendly-aiaep
  tag: "v1.2.3"
  pullPolicy: IfNotPresent

service:
  type: LoadBalancer
  port: 443
  targetPort: 3001

resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: api.friendly-aiaep.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: friendly-aep-tls
      hosts:
        - api.friendly-aiaep.com

env:
  - name: NODE_ENV
    value: "production"
  - name: DEPLOYMENT_MODE
    value: "production"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: database-credentials
        key: url
  - name: ANTHROPIC_API_KEY
    valueFrom:
      secretKeyRef:
        name: anthropic-credentials
        key: api-key
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: jwt-credentials
        key: secret

healthCheck:
  enabled: true
  livenessProbe:
    httpGet:
      path: /health/live
      port: 3001
    initialDelaySeconds: 60
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /health/ready
      port: 3001
    initialDelaySeconds: 30
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 3

podDisruptionBudget:
  enabled: true
  minAvailable: 2
```

---

## Environment Variables

### Required Variables

**All Environments:**
```env
NODE_ENV=<environment>
DEPLOYMENT_MODE=<environment>
DATABASE_URL=<connection-string>
REDIS_URL=<connection-string>
ANTHROPIC_API_KEY=<api-key>
JWT_SECRET=<secret>
REFRESH_TOKEN_SECRET=<secret>
```

### Optional Variables

```env
# Feature Flags
FEATURE_IOT_ENABLED=true|false
FEATURE_BUILDER_ENABLED=true|false
FEATURE_AI_AGENT_RUNTIME=true|false

# Performance Tuning
MAX_WORKERS=<number>
CLUSTER_MODE=true|false
ENABLE_COMPRESSION=true|false
ENABLE_CACHING=true|false

# Observability
SENTRY_DSN=<dsn>
DATADOG_API_KEY=<key>
NEW_RELIC_LICENSE_KEY=<key>
```

### Variable Validation

**Validation Script:**
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DEPLOYMENT_MODE: z.enum(['development', 'test', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(20),
  JWT_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
});

export function validateEnvironment() {
  try {
    envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
}
```

---

## Secrets Management

### Development (Local)

**Use .env files (NOT committed):**
```bash
# .env (gitignored)
ANTHROPIC_API_KEY=sk-ant-dev-key
JWT_SECRET=development-secret
```

### Test (CI/CD)

**GitHub Secrets:**
```yaml
# Settings > Secrets and variables > Actions
ANTHROPIC_API_KEY_TEST
DATABASE_URL_TEST
CODECOV_TOKEN
```

### Staging & Production

**AWS Secrets Manager:**
```bash
# Store secret
aws secretsmanager create-secret \
  --name friendly-aep/production/anthropic-api-key \
  --secret-string "sk-ant-prod-key"

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id friendly-aep/production/anthropic-api-key
```

**Kubernetes Secrets:**
```bash
# Create secret
kubectl create secret generic anthropic-credentials \
  --from-literal=api-key="sk-ant-prod-key" \
  --namespace friendly-production

# Use in pod
env:
  - name: ANTHROPIC_API_KEY
    valueFrom:
      secretKeyRef:
        name: anthropic-credentials
        key: api-key
```

**HashiCorp Vault:**
```bash
# Write secret
vault kv put secret/friendly-aep/production \
  anthropic_api_key="sk-ant-prod-key" \
  jwt_secret="secure-secret"

# Read secret
vault kv get secret/friendly-aep/production
```

---

## Configuration Files

### Application Config

**config/default.json:**
```json
{
  "server": {
    "port": 3001,
    "host": "0.0.0.0",
    "trustProxy": false
  },
  "cors": {
    "credentials": true,
    "maxAge": 86400
  },
  "rateLimit": {
    "window": 60000,
    "max": 100
  },
  "cache": {
    "ttl": 3600,
    "max": 1000
  }
}
```

**config/production.json:**
```json
{
  "server": {
    "trustProxy": true
  },
  "cors": {
    "maxAge": 86400
  },
  "rateLimit": {
    "window": 60000,
    "max": 1000
  },
  "cache": {
    "ttl": 7200,
    "max": 10000
  }
}
```

### Database Config

**Prisma Schema:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x"]
  previewFeatures = ["multiSchema"]
}
```

---

## Best Practices

### Security Best Practices

1. **Never commit secrets** to version control
2. **Use different secrets** per environment
3. **Rotate secrets** regularly (90 days max)
4. **Minimum privilege** for service accounts
5. **Encrypt secrets** at rest and in transit

### Configuration Best Practices

1. **Environment parity** - Keep configs similar
2. **Explicit is better** - No hidden defaults
3. **Validate early** - Check config at startup
4. **Document everything** - Comment all non-obvious settings
5. **Version control** - Track config changes

### Migration Strategy

**Moving from Dev to Prod:**
```bash
# 1. Copy template
cp .env.staging .env.production

# 2. Update secrets (use secret manager)
# 3. Update URLs
# 4. Update resource limits
# 5. Enable strict security settings
# 6. Test in staging first
# 7. Deploy to production
```

---

## Related Documentation

- [Deployment Guide](../guides/DEPLOYMENT-GUIDE.md) - Deployment procedures
- [Multi-Environment Strategy](../deployment/MULTI-ENVIRONMENT.md) - Environment promotion
- [Security Best Practices](../security/BEST-PRACTICES.md) - Security hardening
- [Development Guide](../guides/DEVELOPMENT-GUIDE.md) - Development workflows

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology DevOps Team
