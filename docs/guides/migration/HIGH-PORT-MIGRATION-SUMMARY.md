# High Port Migration Summary - Security-Focused Port Allocation

## Overview

All services have been migrated to **high-port allocation (45000+)** for enhanced security and operational benefits.

### New Port Scheme

- **UI Applications**: 45000-45099
- **APIs**: 46000-46099
- **Databases**: 46100-46199
- **Storage**: 46200-46249
- **Observability**: 46300-46499

---

## Complete Port Migration Map

### UI Applications (45000-45099)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| Builder App | 6000 | **45000** | +39000 |
| Grafana | 6001 | **45001** | +39000 |
| Jaeger UI | 6002 | **45002** | +39000 |
| MinIO Console | 6003 | **45003** | +39000 |
| pgAdmin4 | 6004 | **45004** | +39000 |
| Verdaccio | 6005 | **45005** | +39000 |

### APIs (46000-46099)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| API Gateway | 7500 | **46000** | +38500 |
| Preview Host | 7501 | **46001** | +38500 |
| IoT Mock API | 7502 | **46002** | +38500 |

### Databases (46100-46199)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| PostgreSQL | 7600 | **46100** | +38500 |
| InfluxDB | 7601 | **46101** | +38500 |
| Redis | 7602 | **46102** | +38500 |

### Storage (46200-46249)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| MinIO API | 7650 | **46200** | +38550 |

### Observability - Metrics (46300-46349)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| Prometheus | 7700 | **46300** | +38600 |
| Node Exporter | 7701 | **46301** | +38600 |
| Redis Exporter | 7702 | **46302** | +38600 |
| Postgres Exporter | 7703 | **46303** | +38600 |

### Observability - Logs (46350-46399)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| Loki | 7750 | **46350** | +38600 |
| Promtail | 7751 | **46351** | +38600 |

### Observability - Tracing (46400-46449)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| Jaeger Agent (Zipkin) | 7770 | **46400** | +38630 |
| Jaeger Agent Config | 7771 | **46401** | +38630 |
| Jaeger Agent (Compact) | 7772 | **46402** | +38630 |
| Jaeger Agent (Binary) | 7773 | **46403** | +38630 |
| Jaeger Collector gRPC | 7774 | **46404** | +38630 |
| Jaeger Collector HTTP | 7775 | **46405** | +38630 |
| Jaeger Collector Metrics | 7776 | **46406** | +38630 |

### OpenTelemetry (46450-46469)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| OTLP gRPC | 7800 | **46450** | +38650 |
| OTLP HTTP | 7801 | **46451** | +38650 |

### Data Ingestion (46470-46499)

| Service | Old Port | New Port | Change |
|---------|----------|----------|--------|
| Telegraf HTTP | 7820 | **46470** | +38650 |
| Telegraf UDP | 7821 | **46471** | +38650 |
| Telegraf StatsD | 7822 | **46472** | +38650 |

---

## Files Updated

### Infrastructure Configuration

✅ `docker/docker-compose.dev.yml` - All ports migrated to 45000+/46000+
✅ `docker/docker-compose.test.yml` - All ports migrated
✅ `docker/docker-compose.preprod.yml` - All ports migrated
✅ `docker/docker-compose.prod.yml` - All ports migrated

### Environment Files

✅ `.env.example` - Port variables updated to high ports
✅ `.env.development` - All URLs updated to high ports
✅ `.env.preprod` - All URLs updated to high ports

### Application Code

✅ `apps/aep-builder/project.json` - Port: 6000 → 45000
✅ `apps/aep-builder/src/environments/environment.ts` - API URLs updated
✅ `apps/aep-builder/src/environments/environment.test.ts` - API URLs updated
✅ `apps/aep-builder/nginx.conf` - Reverse proxy updated
✅ `apps/aep-api-gateway/src/main.ts` - Default: 7500 → 46000
✅ `apps/aep-api-gateway/src/main-with-telemetry.ts` - Default updated
✅ `apps/aep-api-gateway/src/app/plugins/env-validation.ts` - Default updated
✅ `apps/aep-api-gateway/src/app/plugins/cors.ts` - CORS origins updated
✅ `apps/aep-api-gateway/src/app/plugins/preview-runtime.ts` - URLs updated
✅ `apps/aep-api-gateway/Dockerfile` - EXPOSE: 7500 → 46000
✅ `apps/aep-api-gateway/README.md` - Documentation updated
✅ `apps/aep-preview-host/src/main.ts` - Default: 7501 → 46001
✅ `apps/aep-preview-host/Dockerfile` - EXPOSE: 7501 → 46001

### Documentation

✅ `README.md` - All port references updated
✅ `PORT-ALLOCATION.md` - **REWRITTEN** with high-port scheme and security guidance
✅ `PORT-MIGRATION-SUMMARY.md` - Updated with new allocation
✅ All `*.md` files - Port references updated throughout project

### Scripts

✅ `docker/scripts/start-dev.sh` - All port references updated
✅ `docker/scripts/start-preprod.sh` - All port references updated
✅ `docker/scripts/start-prod.sh` - All port references updated
✅ `docker/scripts/README.md` - Documentation updated

---

## Security Benefits

### Why High Ports (45000+)?

#### 1. **Stealth Security**
- Automated port scanners typically scan 0-10000
- High ports (45000+) are rarely scanned
- Reduces exposure to automated attacks

#### 2. **Non-Privileged Operation**
- Ports <1024 require root/admin privileges
- High ports allow services to run as non-root users
- Improves container security posture

#### 3. **Conflict Avoidance**
- No conflicts with system services (0-1023)
- No conflicts with common apps:
  - MySQL: 3306
  - PostgreSQL: 5432
  - SQL Server: 1433
  - RDP: 3389
  - HTTP Alt: 8080, 8443
  - Development servers: 3000-5000

#### 4. **Firewall-Friendly**
- Easy to create blanket deny rules: `45000-46999`
- Simple allow rules for specific IPs
- Clear security boundaries

#### 5. **Professional Best Practice**
- Enterprise applications use high ports
- Easier to audit and monitor
- Better security compliance

---

## Production Security Configuration

### ⚠️ CRITICAL: Never Expose High Ports Directly

**Always use a reverse proxy** (Nginx, Traefik, Caddy) to map standard ports (80/443) to high ports.

### Example: Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/friendly-aep

# Frontend Application
server {
    listen 443 ssl http2;
    server_name app.friendly-aep.com;

    ssl_certificate /etc/letsencrypt/live/app.friendly-aep.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.friendly-aep.com/privkey.pem;

    location / {
        proxy_pass http://localhost:45000;  # Builder UI
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API Gateway
server {
    listen 443 ssl http2;
    server_name api.friendly-aep.com;

    ssl_certificate /etc/letsencrypt/live/api.friendly-aep.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.friendly-aep.com/privkey.pem;

    location / {
        proxy_pass http://localhost:46000;  # API Gateway
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Monitoring (Internal Access Only)
server {
    listen 443 ssl http2;
    server_name monitoring.friendly-aep.internal;

    ssl_certificate /etc/letsencrypt/live/monitoring.friendly-aep.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitoring.friendly-aep.internal/privkey.pem;

    # IP whitelist
    allow 10.0.0.0/8;      # Internal network
    allow 192.168.0.0/16;  # Private network
    deny all;

    location / {
        proxy_pass http://localhost:45001;  # Grafana
        proxy_set_header Host $host;
    }
}
```

### Firewall Configuration

#### Linux (UFW)

```bash
#!/bin/bash
# Friendly AIAEP Firewall Setup

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if using non-standard)
sudo ufw allow 22/tcp

# Allow HTTPS/HTTP for reverse proxy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# DENY all high ports from external access
sudo ufw deny 45000:46999/tcp
sudo ufw deny 45000:46999/udp

# Allow high ports ONLY from localhost
sudo ufw allow from 127.0.0.1 to any port 45000:46999

# Allow high ports from internal network (optional)
# sudo ufw allow from 10.0.0.0/8 to any port 45000:46999
# sudo ufw allow from 192.168.0.0/16 to any port 45000:46999

# Enable firewall
sudo ufw enable

echo "Firewall configured for high-port security"
```

#### Windows Firewall (PowerShell - Run as Administrator)

```powershell
# Friendly AIAEP Firewall Setup for Windows

# Block all external access to high ports
New-NetFirewallRule `
  -DisplayName "Block Friendly AIAEP High Ports External" `
  -Direction Inbound `
  -LocalPort 45000-46999 `
  -Protocol TCP `
  -Action Block `
  -RemoteAddress Any `
  -Enabled True

# Allow localhost access to high ports
New-NetFirewallRule `
  -DisplayName "Allow Friendly AIAEP High Ports Localhost" `
  -Direction Inbound `
  -LocalPort 45000-46999 `
  -Protocol TCP `
  -Action Allow `
  -RemoteAddress 127.0.0.1 `
  -Enabled True

# Optional: Allow from specific IP range (internal network)
# New-NetFirewallRule `
#   -DisplayName "Allow Friendly AIAEP High Ports Internal Network" `
#   -Direction Inbound `
#   -LocalPort 45000-46999 `
#   -Protocol TCP `
#   -Action Allow `
#   -RemoteAddress 192.168.0.0/16 `
#   -Enabled True

Write-Host "Firewall configured for high-port security" -ForegroundColor Green
```

---

## Migration Checklist

### For Developers

- [ ] **Update browser bookmarks:**
  - Builder: `localhost:6000` → `localhost:45000`
  - Grafana: `localhost:6001` → `localhost:45001`
  - Jaeger: `localhost:6002` → `localhost:45002`
  - API Gateway: `localhost:7500` → `localhost:46000`

- [ ] **Update database tools:**
  - PostgreSQL: `localhost:7600` → `localhost:46100`
  - InfluxDB: `localhost:7601` → `localhost:46101`
  - Redis: `localhost:7602` → `localhost:46102`

- [ ] **Update external tools:**
  - Postman collections
  - Database clients (DBeaver, pgAdmin, TablePlus, etc.)
  - API testing tools
  - Monitoring dashboards

- [ ] **Clear browser cache:**
  ```
  Ctrl+Shift+Delete (Windows/Linux)
  Cmd+Shift+Delete (Mac)
  ```

- [ ] **Restart Docker services:**
  ```bash
  cd docker
  docker-compose -f docker-compose.dev.yml down
  ./scripts/start-dev.sh
  ```

### For DevOps/SysAdmins

- [ ] **Configure firewall rules** (see examples above)
- [ ] **Set up reverse proxy** (Nginx/Traefik/Caddy)
- [ ] **Update CI/CD pipelines**
- [ ] **Update monitoring and alerting**
- [ ] **Update load balancer configuration**
- [ ] **Test all service endpoints**
- [ ] **Update runbooks and documentation**

### For Production Deployment

- [ ] **Review and apply firewall rules**
- [ ] **Configure reverse proxy with SSL**
- [ ] **Update DNS/CDN configuration**
- [ ] **Test reverse proxy routing**
- [ ] **Verify all services accessible via proxy**
- [ ] **Test health endpoints**
- [ ] **Update monitoring dashboards**
- [ ] **Document new port allocation**
- [ ] **Train team on new configuration**

---

## Quick Start with New Ports

### Development Environment

```bash
cd docker/scripts
./start-dev.sh
```

**Access services:**
```
Builder:         http://localhost:45000
Grafana:         http://localhost:45001
Jaeger:          http://localhost:45002
API Gateway:     http://localhost:46000
API Docs:        http://localhost:46000/documentation
Health Check:    http://localhost:46000/health
```

### Pre-Production Environment

```bash
cd docker/scripts
./start-preprod.sh
```

### Production Environment

```bash
# Ensure .env.production is configured
cd docker/scripts
./start-prod.sh
```

**IMPORTANT:** In production, access via reverse proxy URLs:
```
https://app.friendly-aep.com       # Builder (proxied to 45000)
https://api.friendly-aep.com       # API Gateway (proxied to 46000)
https://monitoring.internal        # Grafana (proxied to 45001, internal only)
```

---

## Testing the Migration

### Verify All Services Are Accessible

```bash
#!/bin/bash
# Test all service endpoints

echo "Testing UI services..."
curl -f http://localhost:45001/api/health  # Grafana
curl -f http://localhost:45002/            # Jaeger

echo "Testing APIs..."
curl -f http://localhost:46000/health      # API Gateway
curl -f http://localhost:46001/health      # Preview Host

echo "Testing databases..."
pg_isready -h localhost -p 46100           # PostgreSQL
curl -f http://localhost:46101/health      # InfluxDB
redis-cli -p 46102 ping                    # Redis

echo "Testing storage..."
curl -f http://localhost:46200/minio/health/live  # MinIO

echo "All services responding ✓"
```

### Verify Docker Port Mappings

```bash
# Check all running containers and their ports
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Should show mappings like:
# 0.0.0.0:45000->4200/tcp
# 0.0.0.0:46000->3001/tcp
# 0.0.0.0:46100->5432/tcp
```

---

## Troubleshooting

### Port Already in Use (Unlikely)

```bash
# Linux - Find what's using the port
sudo lsof -i :45000

# Windows - Find what's using the port
netstat -ano | findstr :45000

# If needed, kill the process
kill -9 <PID>           # Linux
taskkill /PID <PID> /F  # Windows
```

### Cannot Access Service

1. **Verify container is running:**
   ```bash
   docker ps | grep friendly-aep
   ```

2. **Check port mapping:**
   ```bash
   docker port friendly-aep-dev-api-gateway
   ```

3. **Test from inside container:**
   ```bash
   docker exec friendly-aep-dev-api-gateway curl http://localhost:3001/health
   ```

4. **Check firewall:**
   ```bash
   # Linux
   sudo ufw status

   # Windows
   Get-NetFirewallRule | Where-Object {$_.LocalPort -match "45000|46000"}
   ```

### Service Health Check Fails

```bash
# Check container logs
docker logs friendly-aep-dev-api-gateway

# Check if service is listening on correct port
docker exec friendly-aep-dev-api-gateway netstat -tlnp | grep 3001
```

---

## Additional Resources

- [PORT-ALLOCATION.md](PORT-ALLOCATION.md) - Complete port mapping with security guidance
- [docker/scripts/README.md](docker/scripts/README.md) - Startup script documentation
- [QUICK-START-ENVIRONMENTS.md](QUICK-START-ENVIRONMENTS.md) - Environment setup
- [SECURITY-PERFORMANCE-ENHANCEMENTS.md](SECURITY-PERFORMANCE-ENHANCEMENTS.md) - Security best practices

---

## Summary

✅ All services migrated to high ports (45000+/46000+)
✅ Enhanced security through stealth and non-privileged operation
✅ Eliminated port conflicts with common services
✅ Firewall-friendly configuration
✅ Reverse proxy examples provided
✅ Comprehensive security guidance included

**The Friendly AIAEP platform now uses enterprise-grade high-port allocation for maximum security and operational flexibility!**

---

## Important Security Reminders

1. ⚠️ **NEVER expose high ports (45000+) directly to the internet**
2. ✅ **ALWAYS use a reverse proxy** (Nginx/Traefik/Caddy)
3. ✅ **ALWAYS configure firewall rules** to block external access
4. ✅ **ALWAYS use SSL/TLS** in production (via reverse proxy)
5. ✅ **ALWAYS restrict monitoring ports** (Grafana, Prometheus) to internal networks only

**Security is not optional - it's mandatory!**
