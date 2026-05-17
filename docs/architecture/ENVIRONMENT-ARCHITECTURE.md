# Environment Architecture Overview

This document provides a visual overview of the multi-environment architecture.

## Environment Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Purpose: Local development with hot-reload and debugging           │
│  Security: Relaxed (weak secrets, no SSL)                           │
│  Performance: Fast rebuilds, debug tools enabled                    │
│  Infrastructure: docker/docker-compose.dev.yml                      │
│  Config: .env.development                                           │
│  Angular: environment.ts (default)                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                            TEST                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Purpose: CI/CD automated testing                                   │
│  Security: Test secrets, isolated databases                         │
│  Performance: Fast startup, minimal resources                       │
│  Infrastructure: docker/docker-compose.test.yml                     │
│  Config: .env.test                                                  │
│  Angular: environment.test.ts                                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        PRE-PRODUCTION                                │
├─────────────────────────────────────────────────────────────────────┤
│  Purpose: Final testing before production                           │
│  Security: Production-grade (strong secrets, SSL/TLS)               │
│  Performance: Production-like with source maps                      │
│  Infrastructure: docker/docker-compose.preprod.yml                  │
│  Config: .env.preprod                                               │
│  Angular: environment.preprod.ts                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Purpose: Live production deployment                                │
│  Security: Maximum hardening (strong secrets, SSL/TLS required)     │
│  Performance: Optimized, compressed, cached                         │
│  Infrastructure: docker/docker-compose.prod.yml                     │
│  Config: .env.production (or secrets manager)                       │
│  Angular: environment.prod.ts                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Configuration Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Angular Environment Files                        │
│  apps/aep-builder/src/environments/                                 │
│  ├── environment.ts (development)                                   │
│  ├── environment.test.ts                                            │
│  ├── environment.preprod.ts                                         │
│  └── environment.prod.ts                                            │
│                                                                      │
│  Controls: API URLs, feature flags, logging, security, performance  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Build Configurations                              │
│  apps/aep-builder/project.json                                      │
│  ├── development: optimization=off, sourcemaps=on, hashing=none     │
│  ├── test: optimization=off, sourcemaps=on, hashing=none            │
│  ├── preprod: optimization=on, sourcemaps=on, hashing=all           │
│  └── production: optimization=on, sourcemaps=off, hashing=all       │
│                                                                      │
│  Controls: Build process, file replacements, budgets                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Environment Variables                             │
│  Root directory                                                      │
│  ├── .env.development                                               │
│  ├── .env.test                                                      │
│  ├── .env.preprod                                                   │
│  ├── .env.production                                                │
│  └── .env.example (template)                                        │
│                                                                      │
│  Controls: Backend config, secrets, database, Redis, APIs           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Docker Compose Files                              │
│  docker/                                                             │
│  ├── docker-compose.dev.yml                                         │
│  ├── docker-compose.test.yml                                        │
│  ├── docker-compose.preprod.yml                                     │
│  └── docker-compose.prod.yml                                        │
│                                                                      │
│  Controls: Infrastructure, services, networks, volumes              │
└─────────────────────────────────────────────────────────────────────┘
```

## Service Architecture

### Development Environment

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (Port 4200)                           │
│  Angular Dev Server with Hot Reload                              │
│  Source Maps: Enabled                                            │
│  Debug Tools: Enabled                                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  API Gateway (Port 3001)                          │
│  Fastify with Hot Reload                                         │
│  Logging: Debug Level                                            │
│  CORS: Permissive (localhost)                                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Data Layer                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ PostgreSQL │  │  InfluxDB  │  │   Redis    │                 │
│  │ Port: 5432 │  │ Port: 8086 │  │ Port: 6379 │                 │
│  │ No password│  │ Dev token  │  │ No password│                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│              Monitoring & Visualization                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │  Grafana   │  │  Telegraf  │  │   MinIO    │                 │
│  │ Port: 3000 │  │ Port: 8094 │  │ Port: 9000 │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

### Production Environment

```
┌──────────────────────────────────────────────────────────────────┐
│                   Load Balancer / CDN                             │
│  SSL/TLS Termination                                             │
│  HTTPS Only                                                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (Port 80/443)                         │
│  Nginx serving static Angular build                              │
│  Compressed assets                                               │
│  Service Worker enabled                                          │
│  CDN for static assets                                           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  API Gateway (Port 3001)                          │
│  Production build with clustering                                │
│  Logging: Error level only                                       │
│  CORS: Strict (production domain only)                           │
│  Rate limiting: Enabled                                          │
│  Helmet security headers: Enabled                                │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Data Layer (Managed Services)                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ PostgreSQL │  │  InfluxDB  │  │Redis Cluster│                │
│  │ SSL: Yes   │  │ SSL: Yes   │  │ SSL: Yes   │                 │
│  │ Backups: On│  │ Backups: On│  │ HA: Yes    │                 │
│  │ 200 conns  │  │ Optimized  │  │ 1GB memory │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│              Monitoring & Logging                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │  Grafana   │  │   Sentry   │  │AWS S3/MinIO│                 │
│  │ Dashboards │  │Error Track │  │  Storage   │                 │
│  │ Alerting   │  │ APM        │  │  Backups   │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

## Security Progression

```
Development  →  Test  →  Pre-Prod  →  Production
───────────────────────────────────────────────────
Weak secrets    Test     Strong       Strong + Rotated
No SSL/TLS      No       Yes          Yes + Enforced
CORS: *         Local    Domain       Strict Domain
Debug: On       Off      Off          Off
Rate Limit: No  No       Yes          Yes + Strict
Monitoring: No  Logs     Sentry       Sentry + Alerts
Backups: No     No       Yes          Yes + Tested
```

## Build Process Flow

```
Source Code
    │
    ├─→ nx build aep-builder --configuration=development
    │       │
    │       ├─→ File Replacement: environment.ts (no change)
    │       ├─→ Optimization: OFF
    │       ├─→ Source Maps: ON
    │       └─→ Output: dist/ (dev build)
    │
    ├─→ nx build aep-builder --configuration=test
    │       │
    │       ├─→ File Replacement: environment.ts → environment.test.ts
    │       ├─→ Optimization: OFF
    │       ├─→ Source Maps: ON
    │       └─→ Output: dist/ (test build)
    │
    ├─→ nx build aep-builder --configuration=preprod
    │       │
    │       ├─→ File Replacement: environment.ts → environment.preprod.ts
    │       ├─→ Optimization: ON
    │       ├─→ Source Maps: ON (for debugging)
    │       └─→ Output: dist/ (preprod build)
    │
    └─→ nx build aep-builder --configuration=production
            │
            ├─→ File Replacement: environment.ts → environment.prod.ts
            ├─→ Optimization: ON
            ├─→ Source Maps: OFF
            ├─→ Output Hashing: ALL
            └─→ Output: dist/ (production build - optimized)
```

## Environment Variable Hierarchy

```
1. System Environment Variables (highest priority)
   │
   ├─→ 2. .env file (loaded by docker-compose)
   │      │
   │      ├─→ .env.development
   │      ├─→ .env.test
   │      ├─→ .env.preprod
   │      └─→ .env.production
   │
   └─→ 3. docker-compose.yml defaults (fallback values)
          │
          └─→ 4. Application defaults (lowest priority)
```

## Deployment Workflow

```
┌─────────────────┐
│  Development    │
│  - Local coding │
│  - Unit tests   │
└────────┬────────┘
         │ git push
         ↓
┌─────────────────┐
│  CI/CD Pipeline │
│  - Test env     │
│  - Run tests    │
│  - Build check  │
└────────┬────────┘
         │ tests pass
         ↓
┌─────────────────┐
│  Pre-Production │
│  - Staging test │
│  - QA review    │
│  - Load testing │
│  - Security scan│
└────────┬────────┘
         │ approval
         ↓
┌─────────────────┐
│  Production     │
│  - Blue/Green   │
│  - Monitoring   │
│  - Rollback plan│
└─────────────────┘
```

## Resource Allocation

```
                Dev      Test     Pre-Prod   Production
              ─────────────────────────────────────────
API Gateway   512MB    512MB     1GB        2GB
              0.5 CPU  0.5 CPU   1 CPU      1 CPU

Builder       256MB    128MB     256MB      256MB
              0.5 CPU  0.25 CPU  0.5 CPU    0.5 CPU

PostgreSQL    1GB      512MB     2GB        4GB
              1 CPU    0.5 CPU   1 CPU      2 CPU

Redis         256MB    256MB     512MB      1GB
              0.5 CPU  0.25 CPU  0.5 CPU    0.5 CPU

InfluxDB      1GB      512MB     2GB        4GB
              1 CPU    0.5 CPU   1 CPU      2 CPU

Grafana       512MB    N/A       768MB      1GB
              0.5 CPU  N/A       0.5 CPU    1 CPU
```

## Network Architecture

```
Development Network (friendly-aep-dev-network)
┌────────────────────────────────────────────────┐
│  All services communicate internally           │
│  Ports exposed to host for debugging           │
│  No SSL/TLS                                    │
└────────────────────────────────────────────────┘

Production Network (friendly-aep-production-network)
┌────────────────────────────────────────────────┐
│  Service-to-service communication isolated     │
│  Only necessary ports exposed                  │
│  SSL/TLS for external communication            │
│  Network segmentation                          │
└────────────────────────────────────────────────┘
```

## Summary

This architecture provides:

1. **Clear separation** between environments
2. **Progressive security** hardening
3. **Optimized performance** per environment
4. **Scalable infrastructure**
5. **Production-ready** configuration
6. **Easy switching** between environments
7. **Comprehensive monitoring** in higher environments
8. **Resource efficiency** in each environment

All configurations follow industry best practices and are ready for production deployment.
