# Port Migration Summary

## Overview

All ports in the Friendly AIAEP project have been migrated to the new allocation scheme:
- **UI Applications**: 6000-6999
- **APIs/DBs/Services**: 7500-8999

## Changes Applied

### 1. Port Allocations

#### UI Applications (6000-6999)

| Service | Old Port | New Port | Access URL |
|---------|----------|----------|------------|
| Builder App | 4200 | **6000** | http://localhost:45000 |
| Grafana | 3000 | **6001** | http://localhost:45001 |
| Jaeger UI | 16686 | **6002** | http://localhost:45002 |
| MinIO Console | 9001 | **6003** | http://localhost:45003 |
| pgAdmin4 | 5050 | **6004** | http://localhost:45004 |
| Verdaccio | 4873 | **6005** | http://localhost:45005 |

#### APIs (7500-7599)

| Service | Old Port | New Port | Access URL |
|---------|----------|----------|------------|
| API Gateway | 3001 | **7500** | http://localhost:46000 |
| Preview Host | 3002 | **7501** | http://localhost:46001 |
| IoT Mock API | 3003 | **7502** | http://localhost:46002 |

#### Databases (7600-7649)

| Service | Old Port | New Port | Connection String |
|---------|----------|----------|-------------------|
| PostgreSQL | 5432 | **7600** | localhost:46100 |
| InfluxDB | 8086 | **7601** | http://localhost:46101 |
| Redis | 6379 | **7602** | localhost:46102 |

#### Storage (7650-7669)

| Service | Old Port | New Port | Access URL |
|---------|----------|----------|------------|
| MinIO API | 9000 | **7650** | http://localhost:46200 |

#### Observability - Metrics (7700-7749)

| Service | Old Port | New Port | Access URL |
|---------|----------|----------|------------|
| Prometheus | 9090 | **7700** | http://localhost:46300 |
| Node Exporter | 9100 | **7701** | http://localhost:7701 |
| Redis Exporter | 9121 | **7702** | http://localhost:7702 |
| Postgres Exporter | 9187 | **7703** | http://localhost:7703 |

#### Observability - Logs (7750-7769)

| Service | Old Port | New Port | Access URL |
|---------|----------|----------|------------|
| Loki | 3100 | **7750** | http://localhost:46350 |
| Promtail | 9080 | **7751** | - |

#### Observability - Tracing (7770-7799)

| Service | Old Port | New Port | Protocol |
|---------|----------|----------|----------|
| Jaeger Agent (Zipkin) | 5775 | **7770** | UDP |
| Jaeger Agent Config | 5778 | **7771** | TCP |
| Jaeger Agent (Compact) | 6831 | **7772** | UDP |
| Jaeger Agent (Binary) | 6832 | **7773** | UDP |
| Jaeger Collector gRPC | 14250 | **7774** | TCP |
| Jaeger Collector HTTP | 14268 | **7775** | TCP |
| Jaeger Collector Metrics | 14269 | **7776** | TCP |

#### OpenTelemetry (7800-7819)

| Service | Old Port | New Port | Protocol |
|---------|----------|----------|----------|
| OTLP gRPC | 4317 | **7800** | gRPC |
| OTLP HTTP | 4318 | **7801** | HTTP |

#### Data Ingestion (7820-7849)

| Service | Old Port | New Port | Protocol |
|---------|----------|----------|----------|
| Telegraf HTTP | 8094 | **7820** | HTTP |
| Telegraf UDP | 8092 | **7821** | UDP |
| Telegraf StatsD | 8125 | **7822** | UDP |

---

## Files Updated

### Docker Compose Files

✅ `docker/docker-compose.dev.yml` - All ports updated
✅ `docker/docker-compose.test.yml` - All ports updated
✅ `docker/docker-compose.preprod.yml` - All ports updated
✅ `docker/docker-compose.prod.yml` - All ports updated

### Environment Files

✅ `.env.example` - Port variables and URLs updated
✅ `.env.development` - Port variables and URLs updated
✅ `.env.preprod` - Port variables and URLs updated

### Application Code

✅ `apps/aep-builder/project.json` - Builder port: 4200 → 6000
✅ `apps/aep-builder/src/environments/environment.ts` - API URLs updated
✅ `apps/aep-builder/src/environments/environment.test.ts` - API URLs updated
✅ `apps/aep-builder/nginx.conf` - Reverse proxy config updated
✅ `apps/aep-api-gateway/src/main.ts` - Default port: 3001 → 7500
✅ `apps/aep-api-gateway/src/main-with-telemetry.ts` - Default port updated
✅ `apps/aep-api-gateway/src/app/plugins/env-validation.ts` - Default port updated
✅ `apps/aep-api-gateway/src/app/plugins/cors.ts` - CORS origins updated
✅ `apps/aep-api-gateway/src/app/plugins/preview-runtime.ts` - Preview URL updated
✅ `apps/aep-api-gateway/Dockerfile` - Exposed port: 3001 → 7500
✅ `apps/aep-api-gateway/README.md` - Documentation updated
✅ `apps/aep-preview-host/src/main.ts` - Default port: 3002 → 7501
✅ `apps/aep-preview-host/Dockerfile` - Exposed port: 3002 → 7501

### Documentation

✅ `README.md` - All port references updated
✅ All `.md` files in project - Port references updated
✅ `PORT-ALLOCATION.md` - **NEW** - Complete port mapping reference
✅ `docker/scripts/README.md` - **NEW** - Script documentation

---

## New Scripts Created

### Startup Scripts

✅ `docker/scripts/start-dev.sh` - Development environment startup
✅ `docker/scripts/start-preprod.sh` - Pre-production environment startup
✅ `docker/scripts/start-prod.sh` - Production environment startup

**Features:**
- Auto-build Docker images
- Start services in correct order
- Open service logs in separate WSL terminal windows
- Auto-open monitoring dashboards in browser
- Display all service URLs and credentials
- Perform automated health checks

### Migration Scripts

✅ `docker/scripts/update-ports.sh` - Bash port migration script
✅ `docker/scripts/Update-Ports.ps1` - PowerShell port migration script

---

## Quick Start

### Using the New Ports

#### Development Environment

```bash
# Start all services
cd docker/scripts
./start-dev.sh

# Access services
Builder:     http://localhost:45000
Grafana:     http://localhost:45001
API Gateway: http://localhost:46000
API Docs:    http://localhost:46000/documentation
```

#### Pre-Production Environment

```bash
# Start all services
cd docker/scripts
./start-preprod.sh

# Access services
Builder:     http://localhost:45000
Grafana:     http://localhost:45001
API Gateway: http://localhost:46000
```

#### Production Environment

```bash
# Ensure .env.production is configured
# Start all services
cd docker/scripts
./start-prod.sh

# Access monitoring
Grafana:     http://localhost:45001
```

---

## Migration Checklist

For users migrating from old ports:

- [ ] Update bookmarks in your browser
  - Builder: `localhost:4200` → `localhost:45000`
  - Grafana: `localhost:3000` → `localhost:45001`
  - API Gateway: `localhost:3001` → `localhost:46000`

- [ ] Update database connection strings
  - PostgreSQL: `localhost:5432` → `localhost:46100`
  - InfluxDB: `localhost:8086` → `localhost:46101`
  - Redis: `localhost:6379` → `localhost:46102`

- [ ] Update any external tools or scripts
  - Postman collections
  - Database clients (DBeaver, pgAdmin, etc.)
  - Monitoring tools
  - CI/CD pipelines

- [ ] Clear browser cache
  ```
  Ctrl+Shift+Delete (Windows/Linux)
  Cmd+Shift+Delete (Mac)
  ```

- [ ] Restart all services
  ```bash
  cd docker
  docker-compose -f docker-compose.dev.yml down
  docker-compose -f docker-compose.dev.yml up -d
  ```

- [ ] Verify all services are accessible
  ```bash
  # Check health endpoints
  curl http://localhost:46000/health
  curl http://localhost:46001/health
  curl http://localhost:45001/api/health
  ```

---

## Troubleshooting

### Port Conflicts

If you encounter port conflicts:

```bash
# Windows - Find process using port
netstat -ano | findstr :45000

# Linux/WSL - Find process using port
sudo lsof -i :45000

# Kill process (Windows)
taskkill /PID <PID> /F

# Kill process (Linux)
kill -9 <PID>
```

### Services Not Accessible

1. Check if containers are running:
   ```bash
   docker ps
   ```

2. Check container logs:
   ```bash
   docker logs friendly-aep-dev-api-gateway
   ```

3. Verify port mappings:
   ```bash
   docker port friendly-aep-dev-api-gateway
   ```

### Database Connection Issues

Update your connection strings:

**Old:**
```
postgresql://localhost:5432/friendly_aep_dev
http://localhost:8086
localhost:6379
```

**New:**
```
postgresql://localhost:46100/friendly_aep_dev
http://localhost:46101
localhost:46102
```

---

## Benefits of New Port Allocation

### Organized Port Ranges

- **6000-6999**: User-facing UIs - Easy to remember for developers
- **7500-8999**: Backend services - Clearly separated from UIs

### Avoids Common Conflicts

- No more conflicts with common development tools
- 3000 (Create React App), 4200 (Angular), 5432 (PostgreSQL) are frequently used
- New allocation reduces port collision probability

### Better Organization

- Easier to identify service type by port number
- Grouped by function (UI, API, DB, Monitoring)
- Scales better as project grows

### Firewall-Friendly

- Can create simple firewall rules for port ranges
- `6000-6999`: UI access only
- `7500-8999`: Backend services

---

## Additional Resources

- [PORT-ALLOCATION.md](PORT-ALLOCATION.md) - Complete port mapping reference
- [docker/scripts/README.md](docker/scripts/README.md) - Script documentation
- [QUICK-START-ENVIRONMENTS.md](QUICK-START-ENVIRONMENTS.md) - Environment setup guide

---

## Summary

✅ All ports successfully migrated to new allocation scheme
✅ All code, configs, and documentation updated
✅ Automated startup scripts created for all environments
✅ Complete port mapping documentation provided
✅ Migration and troubleshooting guides included

The Friendly AIAEP platform is now using the new standardized port allocation!
