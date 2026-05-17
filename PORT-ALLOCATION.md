# Friendly AIAEP Port Allocation

## Security-Focused High Port Allocation

All services use high ports (45000+) to:
- ✅ Avoid conflicts with system services (0-1023)
- ✅ Avoid conflicts with common applications (1024-32767)
- ✅ Reduce attack surface from automated port scanners
- ✅ Allow non-root service operation
- ✅ Enable flexible firewall rules

## Port Ranges

- **45000-45999**: Application UIs
- **46000-46999**: APIs, Databases, and Services

## Port Allocations

### UI Applications (45000-45099)

| Service | Port | Purpose |
|---------|------|---------|
| **aep-builder** | **45000** | Angular web UI for application builder |
| **Grafana** | **45001** | Data visualization and monitoring dashboard |
| **Jaeger UI** | **45002** | Distributed tracing UI |
| **MinIO Console** | **45003** | MinIO web console for bucket management |
| **pgAdmin4** | **45004** | PostgreSQL management UI (optional) |
| **Verdaccio** | **45005** | Local npm registry UI (optional) |

### APIs (46000-46099)

| Service | Port | Purpose |
|---------|------|---------|
| **aep-api-gateway** | **46000** | Fastify-based REST API with WebSocket |
| **aep-preview-host** | **46001** | Preview rendering service API |
| **IOT Mock API** | **46002** | Mock IoT device API (dev only) |

### Databases (46100-46199)

| Service | Port | Purpose |
|---------|------|---------|
| **PostgreSQL** | **46100** | Primary relational database |
| **InfluxDB** | **46101** | Time-series database for IoT metrics |
| **Redis** | **46102** | In-memory cache and session store |

### Object Storage (46200-46249)

| Service | Port | Purpose |
|---------|------|---------|
| **MinIO API** | **46200** | S3-compatible object storage API |

### Observability - Metrics Collection (46300-46349)

| Service | Port | Purpose |
|---------|------|---------|
| **Prometheus** | **46300** | Metrics collection and storage |
| **Node Exporter** | **46301** | System and host metrics |
| **Redis Exporter** | **46302** | Redis cache metrics |
| **Postgres Exporter** | **46303** | PostgreSQL database metrics |

### Observability - Logs (46350-46399)

| Service | Port | Purpose |
|---------|------|---------|
| **Loki** | **46350** | Log aggregation and storage |
| **Promtail** | **46351** | Log shipping agent for Loki |

### Observability - Tracing (46400-46449)

| Service | Port | Purpose |
|---------|------|---------|
| **Jaeger Agent (Zipkin)** | **46400**/udp | Agent UDP endpoint (Zipkin thrift compact) |
| **Jaeger Agent Config** | **46401** | Agent configuration endpoint |
| **Jaeger Agent (Thrift Compact)** | **46402**/udp | Agent UDP endpoint (Jaeger thrift compact) |
| **Jaeger Agent (Thrift Binary)** | **46403**/udp | Agent UDP endpoint (Jaeger thrift binary) |
| **Jaeger Collector gRPC** | **46404** | Collector gRPC endpoint for traces |
| **Jaeger Collector HTTP** | **46405** | Collector HTTP endpoint for traces |
| **Jaeger Collector Metrics** | **46406** | Collector metrics endpoint |

### OpenTelemetry (46450-46469)

| Service | Port | Purpose |
|---------|------|---------|
| **OTLP gRPC** | **46450** | OpenTelemetry Protocol gRPC endpoint |
| **OTLP HTTP** | **46451** | OpenTelemetry Protocol HTTP endpoint |

### Data Ingestion (46470-46499)

| Service | Port | Purpose |
|---------|------|---------|
| **Telegraf HTTP** | **46470** | HTTP endpoint for Telegraf collection |
| **Telegraf UDP** | **46471**/udp | UDP endpoint for metrics |
| **Telegraf StatsD** | **46472**/udp | StatsD metrics endpoint |

## Quick Reference by Environment

### Development Environment

**UI Access:**
- Builder: http://localhost:45000
- Grafana: http://localhost:45001
- Jaeger: http://localhost:45002
- MinIO Console: http://localhost:45003
- Verdaccio: http://localhost:45005

**API Access:**
- API Gateway: http://localhost:46000
- Preview Host: http://localhost:46001
- Mock IoT API: http://localhost:46002

**Database Access:**
- PostgreSQL: localhost:46100
- InfluxDB: http://localhost:46101
- Redis: localhost:46102

**Storage:**
- MinIO API: http://localhost:46200

**Monitoring:**
- Prometheus: http://localhost:46300
- Loki: http://localhost:46350

### Production/Preprod Environment

**UI Access:**
- Builder: http://localhost:45000 (via reverse proxy)
- Grafana: http://localhost:45001

**API Access:**
- API Gateway: http://localhost:46000
- Preview Host: http://localhost:46001

**Database Access:**
- PostgreSQL: localhost:46100 (internal only)
- InfluxDB: http://localhost:46101
- Redis: localhost:46102

## Environment Variables

Update your `.env` files with the new high ports:

```env
# UI Ports (45000+)
AEP_BUILDER_PORT=45000
GRAFANA_PORT=45001
JAEGER_UI_PORT=45002
MINIO_CONSOLE_PORT=45003

# API Ports (46000+)
AEP_API_GATEWAY_PORT=46000
AEP_PREVIEW_HOST_PORT=46001
IOT_MOCK_API_PORT=46002

# Database Ports (46100+)
POSTGRES_PORT=46100
INFLUXDB_PORT=46101
REDIS_PORT=46102

# Storage Ports (46200+)
MINIO_PORT=46200

# Observability Ports (46300+)
PROMETHEUS_PORT=46300
LOKI_PORT=46350
JAEGER_COLLECTOR_PORT=46405
OTLP_HTTP_PORT=46451
TELEGRAF_HTTP_PORT=46470
```

## Security Best Practices

### Reverse Proxy Configuration

**Do NOT expose high ports directly to the internet.** Use a reverse proxy:

```nginx
# Nginx example - map HTTPS 443 to internal high ports
server {
    listen 443 ssl http2;
    server_name app.example.com;

    location / {
        proxy_pass http://localhost:45000;  # Builder UI
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:46000;  # API Gateway
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Firewall Rules

**Restrict access to high ports:**

```bash
# Allow only localhost access (recommended for development)
sudo ufw deny 45000:46999/tcp
sudo ufw deny 45000:46999/udp

# OR allow specific IP ranges (for internal networks)
sudo ufw allow from 192.168.1.0/24 to any port 45000:46999
```

### Docker Network Isolation

Services communicate internally using Docker networks, not exposed ports:

```yaml
# Internal communication uses service names, not ports
services:
  api-gateway:
    networks:
      - backend
  postgres:
    networks:
      - backend
    # Port not exposed to host, only to Docker network
```

## Migration Notes

When updating from old ports to high ports:

1. Update all docker-compose files
2. Update all environment variable files
3. Update application configuration files
4. Update all documentation
5. Update firewall rules
6. Update reverse proxy configuration
7. Clear browser cache and bookmarks
8. Restart all services

## Advantages of High Port Allocation

### Security Benefits

- **Stealth**: High ports (45000+) are less frequently scanned by automated tools
- **Non-privileged**: Services run without root access (ports <1024 require root)
- **Isolation**: Separated from common development tools and services
- **Firewall-friendly**: Easy to create blanket deny rules and allow only specific IPs

### Operational Benefits

- **No conflicts**: Extremely unlikely to conflict with other software
- **Future-proof**: Ample room for expansion (1000+ ports available)
- **Organized**: Clear separation by service type
- **Portable**: Same ports work across all environments

### Performance Benefits

- **No port translation overhead**: Direct mapping when needed
- **Flexible routing**: Easy to change backend without changing frontend
- **Load balancing ready**: High ports work well with load balancers

## Port Mapping Examples

### Development (Exposed Ports)

```
Browser → localhost:45000 → Container:4200 (Builder internal)
Browser → localhost:46000 → Container:3001 (API internal)
```

### Production (Via Reverse Proxy)

```
Internet → 443 (Nginx) → localhost:45000 → Container:4200
Internet → 443 (Nginx) → localhost:46000 → Container:3001
```

## Firewall Configuration Examples

### Linux (UFW)

```bash
# Default deny all high ports
sudo ufw deny 45000:46999/tcp
sudo ufw deny 45000:46999/udp

# Allow only from specific IP (your dev machine)
sudo ufw allow from 192.168.1.100 to any port 45000:46999

# Allow from entire subnet (internal network)
sudo ufw allow from 10.0.0.0/8 to any port 45000:46999
```

### Windows Firewall

```powershell
# Block all high ports from external access
New-NetFirewallRule -DisplayName "Block High Ports External" `
  -Direction Inbound `
  -LocalPort 45000-46999 `
  -Protocol TCP `
  -Action Block `
  -RemoteAddress "Any"

# Allow only localhost
New-NetFirewallRule -DisplayName "Allow High Ports Localhost" `
  -Direction Inbound `
  -LocalPort 45000-46999 `
  -Protocol TCP `
  -Action Allow `
  -RemoteAddress "127.0.0.1"
```

## Troubleshooting

### Port Already in Use

Highly unlikely with 45000+ range, but if it happens:

```bash
# Find process using port (Linux)
sudo lsof -i :45000

# Find process using port (Windows)
netstat -ano | findstr :45000

# Kill process if needed
kill -9 <PID>  # Linux
taskkill /PID <PID> /F  # Windows
```

### Cannot Access Services

1. **Check firewall rules** - Ensure high ports aren't blocked
2. **Verify container is running** - `docker ps`
3. **Check port mapping** - `docker port <container-name>`
4. **Test locally first** - `curl http://localhost:45000`
5. **Check reverse proxy config** - Nginx/Traefik logs

### Service Won't Start

```bash
# Check if port is actually available
nc -zv localhost 45000

# Check Docker port mappings
docker-compose ps
```

## Additional Resources

- [Docker Network Security Best Practices](https://docs.docker.com/network/network-tutorial-standalone/)
- [Nginx Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [UFW Firewall Tutorial](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-firewall-with-ufw)

---

**Security First**: Remember to always use a reverse proxy for production deployments and never expose high ports directly to the internet!
