# Docker Best Practices - AEP Implementation

This document outlines the Docker best practices implemented in the Friendly-AIAEP project.

## Table of Contents

1. [BuildKit Optimization](#buildkit-optimization)
2. [Security Hardening](#security-hardening)
3. [Multi-Stage Builds](#multi-stage-builds)
4. [Image Size Optimization](#image-size-optimization)
5. [Health Checks](#health-checks)
6. [Caching Strategies](#caching-strategies)
7. [Production Considerations](#production-considerations)

---

## BuildKit Optimization

### Syntax Declaration

All Dockerfiles start with BuildKit syntax declaration:

```dockerfile
# syntax=docker/dockerfile:1.4
```

**Benefits:**
- Access to latest Dockerfile features
- Better error messages
- Improved build performance
- Support for advanced features (cache mounts, secrets, etc.)

### Cache Mounts

Dependencies are installed with cache mounts to speed up rebuilds:

```dockerfile
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false
```

**Benefits:**
- 50-90% faster dependency installation on rebuilds
- Shared cache across builds
- Persistent package manager cache

### Build Example

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with cache
docker build -f apps/aep-api-gateway/Dockerfile -t aep-api-gateway:latest .

# Build with external cache
docker buildx build \
  --cache-from type=registry,ref=myregistry/app:cache \
  --cache-to type=registry,ref=myregistry/app:cache,mode=max \
  -f apps/aep-api-gateway/Dockerfile \
  -t aep-api-gateway:latest .
```

---

## Security Hardening

### Non-Root User

All production images run as non-root user:

```dockerfile
# API Gateway & Preview Host
USER node

# Builder (Nginx)
USER nginx
```

**Security Benefits:**
- Reduced attack surface
- Container escape protection
- Privilege escalation prevention

### Security Updates

Base images receive security updates:

```dockerfile
# Install security updates
RUN apk upgrade --no-cache
```

### Minimal Runtime Dependencies

Only necessary packages are installed:

```dockerfile
RUN apk add --no-cache \
    dumb-init \
    wget \
    ca-certificates \
    tzdata
```

### Distroless Option

For maximum security, commented distroless option available:

```dockerfile
# Optional: Distroless Runtime
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS distroless

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=nonroot:nonroot /app/dist/apps/aep-api-gateway ./

USER nonroot
EXPOSE 3001

CMD ["main.js"]
```

**Distroless Benefits:**
- Minimal attack surface (no shell, package manager)
- Smaller image size
- Only application and runtime dependencies
- Better security posture

### Secrets Management

Sensitive files are excluded via `.dockerignore`:

```dockerignore
.env
.env.*
!.env.example
*.pem
*.key
secrets/
credentials/
```

---

## Multi-Stage Builds

All Dockerfiles use multi-stage builds for optimization:

### Stage Structure

```dockerfile
# 1. Base stage - Common dependencies
FROM node:20-alpine AS base

# 2. Dependencies stage - Install all deps
FROM base AS deps

# 3. Build stage - Build application
FROM base AS build

# 4. Production stage - Minimal runtime
FROM node:20-alpine AS runner
```

### Benefits

- **Smaller images:** Build tools excluded from final image
- **Better caching:** Each stage cached independently
- **Security:** Build-time secrets never in final image
- **Flexibility:** Different stages for different purposes

### Example: API Gateway Build Stages

```dockerfile
# Base: 50MB
# Deps: 500MB (with node_modules)
# Build: 600MB (with source + build artifacts)
# Runner: 150MB (only runtime + app)
```

---

## Image Size Optimization

### Alpine Linux Base

All images use Alpine Linux for minimal size:

```dockerfile
FROM node:20-alpine
FROM nginx:1.27-alpine
```

**Size Comparison:**
- `node:20` - 1.1GB
- `node:20-alpine` - 180MB
- **Savings:** 85% smaller

### Layer Optimization

Related commands are combined to reduce layers:

```dockerfile
# Good: Single layer
RUN apk upgrade --no-cache && \
    apk add --no-cache dumb-init wget ca-certificates

# Bad: Multiple layers
RUN apk upgrade --no-cache
RUN apk add --no-cache dumb-init
RUN apk add --no-cache wget
```

### Cleanup

Temporary files and caches are removed:

```dockerfile
RUN rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.cache
```

### Production Dependencies Only

Final stage only installs production dependencies:

```dockerfile
RUN pnpm install --frozen-lockfile --prod
```

---

## Health Checks

All services include health checks:

### API Gateway & Preview Host

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:46000/health || exit 1
```

### Builder (Nginx)

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
```

### Parameters Explained

- `--interval=30s` - Check every 30 seconds
- `--timeout=5s` - Fail if check takes >5s
- `--start-period=10s` - Grace period on startup
- `--retries=3` - Mark unhealthy after 3 failures

### Kubernetes Integration

Docker health checks automatically integrate with Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 30
```

---

## Caching Strategies

### Dependency Caching

Package files copied before source code:

```dockerfile
# Copy package files first (changes rarely)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies (cached unless package files change)
RUN pnpm install --frozen-lockfile

# Copy source code last (changes frequently)
COPY . .
```

### BuildKit Cache Mounts

```dockerfile
# Cache package manager store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Cache Nx build artifacts
RUN --mount=type=cache,id=nx,target=/app/.nx/cache \
    pnpm nx build app-name
```

### External Cache

```bash
# Use registry as cache
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/myorg/cache:latest \
  --cache-to type=registry,ref=ghcr.io/myorg/cache:latest,mode=max \
  .
```

**Cache Modes:**
- `mode=min` - Only inline cache (default)
- `mode=max` - All layers and build cache

---

## Production Considerations

### Environment Variables

```dockerfile
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    TZ=UTC
```

### Signal Handling

Use `dumb-init` for proper signal handling:

```dockerfile
RUN apk add --no-cache dumb-init

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "main.js"]
```

**Why dumb-init?**
- Proper signal forwarding (SIGTERM, SIGINT)
- Zombie process reaping
- Graceful shutdown support

### File Permissions

```dockerfile
# Set ownership
COPY --from=build --chown=node:node /app/dist/apps/app-name ./

# Set file permissions
RUN find /usr/share/nginx/html -type f -exec chmod 644 {} \; && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \;
```

### Resource Limits

Set appropriate resource limits in docker-compose or Kubernetes:

```yaml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## Nginx Optimization (Builder)

### Compression

```nginx
# Gzip compression
gzip on;
gzip_comp_level 6;
gzip_min_length 1000;
gzip_types text/plain text/css application/json application/javascript;
```

### Security Headers

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'..." always;
```

### Caching Strategy

```nginx
# Static assets - long cache
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Index.html - no cache
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

### Buffer Optimization

```nginx
client_body_buffer_size 128k;
client_max_body_size 10m;
client_header_buffer_size 1k;
large_client_header_buffers 4 8k;
```

---

## Preview Host Considerations

### Docker Socket Access

Preview host requires Docker socket access:

```dockerfile
# Add user to docker group
RUN addgroup -g 999 docker || true && \
    addgroup node docker || true
```

**Running:**

```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock aep-preview-host
```

**Security Note:**
- Docker socket access grants root privileges
- Run with appropriate security contexts
- Consider Docker rootless mode
- Implement resource limits
- Monitor container resource usage

### Volume Permissions

```dockerfile
# Create necessary directories
RUN mkdir -p /app/tmp /app/logs && \
    chown -R node:node /app/tmp /app/logs
```

---

## Security Scanning

### Trivy Integration

Scan images for vulnerabilities:

```bash
# Scan for vulnerabilities
trivy image aep-api-gateway:latest

# Scan for secrets
trivy image --scanners secret aep-api-gateway:latest

# Generate SBOM
trivy image --format cyclonedx -o sbom.json aep-api-gateway:latest
```

### CI/CD Integration

```yaml
- name: Security Scan
  run: |
    docker run --rm \
      -v /var/run/docker.sock:/var/run/docker.sock \
      aquasec/trivy image \
      --severity CRITICAL,HIGH \
      --exit-code 1 \
      aep-api-gateway:latest
```

---

## Monitoring

### Container Metrics

All containers expose standard metrics:

```bash
# View container stats
docker stats aep-api-gateway

# View logs
docker logs -f aep-api-gateway

# Inspect health
docker inspect --format='{{json .State.Health}}' aep-api-gateway
```

### Prometheus Integration

Health endpoints compatible with Prometheus:

```yaml
scrape_configs:
  - job_name: 'aep-api-gateway'
    static_configs:
      - targets: ['aep-api-gateway:46000']
    metrics_path: /metrics
```

---

## Additional Resources

- [Docker BuildKit Documentation](https://docs.docker.com/build/buildkit/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Best practices for writing Dockerfiles](https://docs.docker.com/develop/dev-best-practices/)
- [Security best practices](https://docs.docker.com/engine/security/)
- [Distroless images](https://github.com/GoogleContainerTools/distroless)
- [Trivy Security Scanner](https://aquasecurity.github.io/trivy/)

---

## Summary Checklist

- ✅ BuildKit syntax and cache mounts
- ✅ Multi-stage builds
- ✅ Alpine base images
- ✅ Non-root user
- ✅ Security updates
- ✅ Health checks
- ✅ Signal handling (dumb-init)
- ✅ Layer optimization
- ✅ Proper file permissions
- ✅ Comprehensive .dockerignore
- ✅ Production environment variables
- ✅ Cleanup of temporary files
- ✅ Security scanning integration
- ✅ Documentation and comments
