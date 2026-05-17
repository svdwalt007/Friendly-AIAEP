# Docker Guide

**Docker Best Practices, BuildKit, Multi-Stage Builds, and Security Hardening**

Complete guide for containerizing Friendly AI AEP applications with Docker.

---

## Table of Contents

1. [Docker Overview](#docker-overview)
2. [Multi-Stage Builds](#multi-stage-builds)
3. [BuildKit Features](#buildkit-features)
4. [Security Hardening](#security-hardening)
5. [Image Optimization](#image-optimization)
6. [Docker Compose](#docker-compose)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Docker Overview

### Why Docker?

- **Consistency**: Same environment across dev, test, and prod
- **Isolation**: Dependencies don't conflict
- **Portability**: Run anywhere Docker runs
- **Efficiency**: Faster than VMs
- **Scalability**: Easy horizontal scaling

### Dockerfile Structure

**Standard Dockerfile Pattern:**
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## Multi-Stage Builds

### API Gateway Dockerfile

**apps/aep-api-gateway/Dockerfile:**
```dockerfile
# Stage 1: Base
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
COPY apps/aep-api-gateway/project.json apps/aep-api-gateway/
COPY libs/ libs/
RUN pnpm install --frozen-lockfile --prod=false

# Stage 3: Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm nx build aep-api-gateway --configuration=production
RUN pnpm nx run aep-api-gateway:prune

# Stage 4: Production Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/dist/apps/aep-api-gateway ./
RUN corepack enable && corepack prepare pnpm@10 --activate \
    && pnpm install --frozen-lockfile --prod

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:46000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "main.js"]
```

### Builder UI Dockerfile (Angular)

**apps/aep-builder/Dockerfile:**
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
COPY apps/aep-builder/project.json apps/aep-builder/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm nx build aep-builder --configuration=production

# Stage 2: Production with Nginx
FROM nginx:1.25-alpine AS runner
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/aep-builder/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/aep-builder /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Nginx Configuration (apps/aep-builder/nginx.conf):**
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## BuildKit Features

### Enable BuildKit

**Method 1: Environment Variable**
```bash
export DOCKER_BUILDKIT=1
docker build -t myapp .
```

**Method 2: Docker Config**
```json
{
  "features": {
    "buildkit": true
  }
}
```

### BuildKit Syntax

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine

RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm install

RUN --mount=type=ssh \
    git clone git@github.com:private/repo.git
```

### Multi-Platform Builds

```bash
docker buildx create --name multiarch --use

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/svdwalt007/friendly-aep/api-gateway:latest \
  --push \
  .
```

---

## Security Hardening

### 1. Use Official Base Images

```dockerfile
FROM node:20-alpine
```

### 2. Run as Non-Root User

```dockerfile
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nodejs
USER nodejs
CMD ["node", "app.js"]
```

### 3. Minimize Attack Surface

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache dumb-init
RUN npm ci --only=production
```

### 4. Use .dockerignore

**.dockerignore:**
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.DS_Store
coverage
.nx
dist
*.log
```

### 5. Scan for Vulnerabilities

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image \
  --severity HIGH,CRITICAL \
  ghcr.io/svdwalt007/friendly-aep/api-gateway:latest

snyk container test ghcr.io/svdwalt007/friendly-aep/api-gateway:latest
```

---

## Image Optimization

### Layer Caching

```dockerfile
RUN apk add --no-cache dumb-init
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm build
```

### Reduce Image Size

```dockerfile
FROM node:20-alpine

FROM build AS runner
COPY --from=build /app/dist ./dist

RUN apk add --no-cache build-base python3 \
    && npm install \
    && apk del build-base python3
```

---

## Docker Compose

### Development Stack

**docker-compose.dev.yml:**
```yaml
version: '3.8'

services:
  api-gateway:
    build:
      context: .
      dockerfile: apps/aep-api-gateway/Dockerfile
      target: runner
    ports:
      - "3001:46000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://friendly:friendly_dev_password@postgres:46100/friendly_aep
      - REDIS_URL=redis://redis:46102
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/aep-api-gateway:/app
      - /app/node_modules
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: friendly
      POSTGRES_PASSWORD: friendly_dev_password
      POSTGRES_DB: friendly_aep
    ports:
      - "5432:46100"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U friendly"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:46102"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  postgres-data:
  redis-data:
```

---

## Best Practices

### Dockerfile Best Practices

1. **Use specific image tags** (not `latest`)
2. **Minimize layers** (combine RUN commands)
3. **Order commands** from least to most frequently changing
4. **Use `.dockerignore`** to exclude unnecessary files
5. **Run as non-root** user
6. **Use multi-stage builds** to reduce size
7. **Add health checks**
8. **Document with comments**

### Build Best Practices

```bash
docker build -t myapp:v1.0.0 .
docker build --no-cache -t myapp:v1.0.0 .
docker build --build-arg VERSION=1.0.0 -t myapp:v1.0.0 .
docker build --target runner -t myapp:v1.0.0 .
```

---

## Troubleshooting

### Common Issues

**1. Build fails at npm install:**
```bash
docker builder prune
docker build --no-cache .
```

**2. Image too large:**
```bash
docker history myapp:latest
dive myapp:latest
```

**3. Permission denied:**
```dockerfile
COPY --chown=nodejs:nodejs . .
```

---

## Related Documentation

- [Deployment Guide](../guides/DEPLOYMENT-GUIDE.md)
- [Kubernetes Guide](./KUBERNETES-GUIDE.md)
- [Security Best Practices](../security/BEST-PRACTICES.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology DevOps Team
