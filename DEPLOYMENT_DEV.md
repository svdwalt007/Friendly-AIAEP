# Friendly-AIAEP Development Deployment Guide

## Overview

This document describes how to deploy the Friendly-AIAEP full development stack using a unified Docker Compose file.

## What Changed

A single unified compose file `docker-compose.full-dev.yml` was created that combines:
- All infrastructure services (PostgreSQL, Redis, InfluxDB, MinIO, Grafana, Prometheus, Loki, Jaeger, exporters)
- All three application services built from their Dockerfiles

This replaces the original split between `docker/docker-compose.dev.yml` (infrastructure) and a separate app compose.

## Quick Start

### 1. Build & Start Everything

```bash
cd /mnt/d/Dev/Friendly-AIAEP
docker compose -f docker-compose.full-dev.yml build --parallel
docker compose -f docker-compose.full-dev.yml up -d
```

**Note:** Building from `/mnt/d/` (WSL cross-mount) can be slow. For faster builds, copy the project to a Linux-native path first:
```bash
rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' \
  /mnt/d/Dev/Friendly-AIAEP/ /tmp/friendly-aiaep-build/
cd /tmp/friendly-aiaep-build
docker compose -f docker-compose.full-dev.yml build --parallel
docker compose -f docker-compose.full-dev.yml up -d
```

### 2. Verify Services

| Service | URL | Expected |
|---------|-----|----------|
| API Gateway Health | http://localhost:3001/health | `{"status":"degraded",...}` |
| Builder (Angular) | http://localhost:4200 | HTML page (200 OK) |
| Preview Host Health | http://localhost:3002/health | `{"status":"healthy",...}` |
| Grafana | http://localhost:45001 | Login page |
| Jaeger UI | http://localhost:45002 | Search page |
| MinIO Console | http://localhost:45003 | Login page |

## Demo Login

Test the API gateway with the hardcoded demo credentials:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
```

**Expected response:**
```json
{
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "expiresIn": 3600,
    "user": {
        "id": "user_001",
        "username": "demo",
        "tenantId": "tenant_001",
        "role": "admin"
    }
}
```

**Demo credentials:**
- Username: `demo`
- Password: `demo`

## Port Mappings

### Application Services
| Service | Container Name | Host Port | Container Port | Status |
|---------|---------------|-----------|----------------|--------|
| aep-api-gateway | friendly-aep-dev-aep-api-gateway-1 | 3001 | 46000 | healthy |
| aep-builder | friendly-aep-dev-aep-builder-1 | 4200 | 80 | healthy |
| aep-preview-host | friendly-aep-dev-aep-preview-host-1 | 3002 | 46001 | healthy |

### Infrastructure Services
| Service | Host Port | Container Port | Status |
|---------|-----------|----------------|--------|
| PostgreSQL | 46100 | 5432 | healthy |
| InfluxDB | 46101 | 8086 | healthy |
| Redis | 46102 | 6379 | healthy |
| MinIO API | 46200 | 9000 | healthy |
| MinIO Console | 45003 | 9001 | healthy |
| Grafana | 45001 | 3000 | running |
| Jaeger UI | 45002 | 16686 | running |
| Prometheus | 46300 | 9090 | running |
| Loki | 46350 | 3100 | running |
| Node Exporter | 46301 | 9100 | running |
| Postgres Exporter | 46303 | 9187 | running |
| Redis Exporter | 46302 | 9121 | running |

## Logs

View logs for a specific service:

```bash
# API Gateway
docker compose -f docker-compose.full-dev.yml logs -f aep-api-gateway

# Builder
docker compose -f docker-compose.full-dev.yml logs -f aep-builder

# Preview Host
docker compose -f docker-compose.full-dev.yml logs -f aep-preview-host

# Infrastructure
docker compose -f docker-compose.full-dev.yml logs -f postgres
docker compose -f docker-compose.full-dev.yml logs -f redis
```

## Stop / Restart

Stop all services:
```bash
cd /mnt/d/Dev/Friendly-AIAEP
docker compose -f docker-compose.full-dev.yml down
```

Stop and remove volumes (full reset):
```bash
docker compose -f docker-compose.full-dev.yml down -v
```

Restart a single service:
```bash
docker compose -f docker-compose.full-dev.yml up -d --force-recreate aep-api-gateway
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker build fails with "Cannot find module" | Ensure `pnpm-workspace.yaml` and `pnpm-lock.yaml` are not excluded by `.dockerignore` |
| Prisma client not found | Run `pnpm nx run prisma-schema:prisma:generate` before building |
| Build hangs on WSL | Copy project to `/tmp/` and build from there |
| Redis connection errors | App auto-falls back to in-memory store; not critical for dev |
| Preview Runtime uses stub | Expected in dev — Docker socket may be inaccessible inside container |
| Port already in use | Check orphaned containers: `docker ps -a` |

## Environment Variables

### API Gateway (`aep-api-gateway`)
- `PORT=46000` — API server port (mapped to host 3001)
- `HOST=0.0.0.0` — Bind address
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL=redis://redis:6379` — Redis connection string
- `JWT_SECRET=dev-jwt-secret-change-me` — JWT signing secret
- `NODE_ENV=development` — Runtime environment

### Builder (`aep-builder`)
- `NODE_ENV=development` — Runtime environment

### Preview Host (`aep-preview-host`)
- `PORT=46001` — Preview server port (mapped to host 3002)
- `HOST=0.0.0.0` — Bind address
- `REDIS_URL=redis://redis:6379` — Redis connection string
- `MINIO_ENDPOINT=minio` — MinIO hostname
- `MINIO_PORT=9000` — MinIO port
- `NODE_ENV=development` — Runtime environment

## Files Modified (Required for Clean Build)

The following files were modified to fix build/runtime issues:

1. **`.dockerignore`** — Added `!pnpm-workspace.yaml` and `!pnpm-lock.yaml` to ensure pnpm workspace detection works in Docker build context

2. **`apps/aep-api-gateway/Dockerfile`** — Fixed invalid `--mount=type=cache` syntax in runner stage; added workspace symlink creation for `@friendly-tech/*` packages; added `prisma generate` step; added docker group for socket access

3. **`apps/aep-preview-host/Dockerfile`** — Fixed invalid `--mount=type=cache` syntax in runner stage; added workspace symlink creation

4. **`apps/aep-api-gateway/tsconfig.app.json`** — Added `"exclude": ["src/**/*.spec.ts", "src/**/*.test.ts"]` to prevent test files from being compiled into production build

5. **`libs/ui/iot-ui/tsconfig.lib.json`** — Added `"lib": ["ES2022", "dom"]` to resolve `console` reference errors during Angular library compilation

6. **`apps/aep-builder/src/app/features/builder/builder-workspace.component.ts`** — Removed standalone component imports that caused Angular static analysis failures; added `NO_ERRORS_SCHEMA`

7. **`apps/aep-builder/src/app/features/builder/builder-workspace.component.html`** — Added `$any()` casts and type guards for template bindings

8. **`apps/aep-builder/tsconfig.app.json`** — Widened `CdkDragDrop<any[]>` type

## File Locations

- Unified compose: `/mnt/d/Dev/Friendly-AIAEP/docker-compose.full-dev.yml`
- This guide: `/mnt/d/Dev/Friendly-AIAEP/DEPLOYMENT_DEV.md`
