# Docker Quick Start Guide

Quick reference for building and deploying Docker images in the Friendly-AIAEP project.

## Prerequisites

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Or add to your shell profile
echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc

# Verify BuildKit is available
docker buildx version
```

## Build Commands

### Build All Services

```bash
# Development build
./docker/scripts/build-optimized.sh all

# Production build with tag
./docker/scripts/build-optimized.sh -t v1.0.0 all

# Build and push to registry
./docker/scripts/build-optimized.sh -r ghcr.io/myorg -t latest -p all
```

### Build Individual Services

```bash
# API Gateway
./docker/scripts/build-optimized.sh api-gateway

# Builder (Frontend)
./docker/scripts/build-optimized.sh builder

# Preview Host
./docker/scripts/build-optimized.sh preview-host
```

### Advanced Builds

```bash
# Multi-platform build
./docker/scripts/build-optimized.sh --platform linux/amd64,linux/arm64 all

# Build with external cache
./docker/scripts/build-optimized.sh \
  --cache-from type=registry,ref=myregistry/cache:latest \
  --cache-to type=registry,ref=myregistry/cache:latest,mode=max \
  all

# No-cache build
./docker/scripts/build-optimized.sh --no-cache all
```

## Security Scanning

### Scan All Images

```bash
# Quick scan (table output)
./docker/scripts/security-scan.sh --all

# Detailed scan with reports
./docker/scripts/security-scan.sh -f json -o ./security-reports --all
```

### Scan Individual Images

```bash
# Scan single image
./docker/scripts/security-scan.sh aep-api-gateway:latest

# Scan with specific severity
./docker/scripts/security-scan.sh -s CRITICAL,HIGH aep-builder:latest

# Ignore unfixed vulnerabilities
./docker/scripts/security-scan.sh --ignore-unfixed aep-preview-host:latest
```

### CI/CD Scans

```bash
# Generate SARIF for GitHub
./docker/scripts/security-scan.sh -f sarif -o ./reports --all

# Generate JSON for GitLab
./docker/scripts/security-scan.sh -f json -o ./reports --all
```

## Running Containers

### Using Docker Compose

```bash
# Development
docker compose -f docker/docker-compose.dev.yml up

# Production
docker compose -f docker/docker-compose.prod.yml up -d

# Pre-production
docker compose -f docker/docker-compose.preprod.yml up -d
```

### Manual Container Runs

```bash
# API Gateway
docker run -d \
  -p 3001:46000 \
  --name aep-api-gateway \
  -e NODE_ENV=production \
  aep-api-gateway:latest

# Builder
docker run -d \
  -p 80:80 \
  --name aep-builder \
  aep-builder:latest

# Preview Host (requires Docker socket)
docker run -d \
  -p 3002:46001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --name aep-preview-host \
  aep-preview-host:latest
```

## Health Checks

```bash
# Check container health
docker inspect --format='{{json .State.Health}}' aep-api-gateway | jq

# All containers health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Manual health check
curl http://localhost:46000/health
```

## Image Management

### View Images

```bash
# List all AEP images
docker images | grep aep-

# Image sizes
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep aep-

# Detailed image info
docker inspect aep-api-gateway:latest | jq
```

### Tag Images

```bash
# Tag for registry
docker tag aep-api-gateway:latest ghcr.io/myorg/aep-api-gateway:v1.0.0

# Tag multiple versions
docker tag aep-api-gateway:latest aep-api-gateway:stable
docker tag aep-api-gateway:latest aep-api-gateway:v1.0.0
```

### Push to Registry

```bash
# Login to registry
docker login ghcr.io

# Push image
docker push ghcr.io/myorg/aep-api-gateway:latest

# Push all tags
docker push --all-tags ghcr.io/myorg/aep-api-gateway
```

## Troubleshooting

### Build Issues

```bash
# Clear build cache
docker buildx prune -af

# Rebuild without cache
./docker/scripts/build-optimized.sh --no-cache api-gateway

# View build logs
docker build --progress=plain -f apps/aep-api-gateway/Dockerfile .
```

### Container Issues

```bash
# View logs
docker logs -f aep-api-gateway

# Inspect container
docker inspect aep-api-gateway

# Execute shell in container
docker exec -it aep-api-gateway sh

# Check resource usage
docker stats aep-api-gateway
```

### Network Issues

```bash
# List networks
docker network ls

# Inspect network
docker network inspect aep-network

# Test connectivity
docker exec aep-builder ping -c 3 aep-api-gateway
```

## Maintenance

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove build cache
docker buildx prune -af

# Complete cleanup (careful!)
docker system prune -af
```

### Updates

```bash
# Pull latest base images
docker pull node:20-alpine
docker pull nginx:1.27-alpine

# Rebuild with latest updates
./docker/scripts/build-optimized.sh --no-cache all

# Scan for vulnerabilities
./docker/scripts/security-scan.sh --all
```

## Environment Variables

### Build-time

```bash
export DOCKER_BUILDKIT=1
export DOCKER_REGISTRY=ghcr.io/myorg
export DOCKER_TAG=latest
export DOCKER_PUSH=true
```

### Runtime

```bash
# API Gateway
docker run -e NODE_ENV=production \
           -e LOG_LEVEL=info \
           -e PORT=3001 \
           aep-api-gateway:latest

# Builder
docker run -e NGINX_WORKER_PROCESSES=auto \
           aep-builder:latest
```

## Monitoring

### Logs

```bash
# Follow logs
docker logs -f aep-api-gateway

# Last 100 lines
docker logs --tail 100 aep-api-gateway

# Logs with timestamps
docker logs -t aep-api-gateway
```

### Metrics

```bash
# Container stats
docker stats

# Specific container
docker stats aep-api-gateway

# Export to CSV
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" > stats.csv
```

### Health Status

```bash
# Check health
docker inspect --format='{{.State.Health.Status}}' aep-api-gateway

# Health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' aep-api-gateway
```

## Common Workflows

### Development Workflow

```bash
# 1. Build images
./docker/scripts/build-optimized.sh all

# 2. Start services
docker compose -f docker/docker-compose.dev.yml up -d

# 3. View logs
docker compose -f docker/docker-compose.dev.yml logs -f

# 4. Make changes and rebuild
./docker/scripts/build-optimized.sh api-gateway

# 5. Restart service
docker compose -f docker/docker-compose.dev.yml restart api-gateway
```

### Production Deployment

```bash
# 1. Build production images
./docker/scripts/build-optimized.sh -t v1.0.0 all

# 2. Security scan
./docker/scripts/security-scan.sh -s CRITICAL,HIGH --all

# 3. Tag for registry
docker tag aep-api-gateway:v1.0.0 ghcr.io/myorg/aep-api-gateway:v1.0.0
docker tag aep-builder:v1.0.0 ghcr.io/myorg/aep-builder:v1.0.0
docker tag aep-preview-host:v1.0.0 ghcr.io/myorg/aep-preview-host:v1.0.0

# 4. Push to registry
docker push ghcr.io/myorg/aep-api-gateway:v1.0.0
docker push ghcr.io/myorg/aep-builder:v1.0.0
docker push ghcr.io/myorg/aep-preview-host:v1.0.0

# 5. Deploy
docker compose -f docker/docker-compose.prod.yml up -d
```

### CI/CD Pipeline

```bash
# GitHub Actions
- name: Build
  run: ./docker/scripts/build-optimized.sh -t ${{ github.sha }} all

- name: Scan
  run: ./docker/scripts/security-scan.sh -f sarif --all

- name: Push
  run: ./docker/scripts/build-optimized.sh -r ghcr.io/${{ github.repository_owner }} -t latest -p all
```

## Help

### Script Help

```bash
# Build script
./docker/scripts/build-optimized.sh --help

# Security scan script
./docker/scripts/security-scan.sh --help
```

### Docker Help

```bash
# Docker commands
docker --help
docker build --help
docker run --help

# BuildKit
docker buildx --help
```

## Documentation

- **Comprehensive Guide:** `docker/DOCKER-BEST-PRACTICES.md`
- **Scripts Documentation:** `docker/scripts/README.md`
- **Enhancements Summary:** `DOCKER-ENHANCEMENTS.md`
- **Deployment Guide:** `docs/deployment/DOCKER-GUIDE.md`

## Quick Reference

### Image Tags

- `latest` - Latest development build
- `v1.0.0` - Specific version
- `stable` - Stable release
- `{git-sha}` - Specific commit

### Ports

- `3001` - API Gateway
- `80` - Builder (Frontend)
- `3002` - Preview Host

### Health Endpoints

- API Gateway: `http://localhost:46000/health`
- Builder: `http://localhost:80/health`
- Preview Host: `http://localhost:46001/health`

## Support

For issues or questions, refer to:
1. Documentation in `docker/` directory
2. Script help commands (`--help`)
3. Project README
4. Docker documentation

---

**Last Updated:** 2026-04-15
**Version:** 1.0
