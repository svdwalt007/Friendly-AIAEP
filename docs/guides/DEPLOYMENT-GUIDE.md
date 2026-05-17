# Deployment Guide

**Step-by-Step Deployment Procedures for All Environments**

This guide provides comprehensive deployment procedures for Friendly AI AEP across development, staging, and production environments.

---

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Local Development Deployment](#local-development-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Staging Deployment](#staging-deployment)
7. [Production Deployment](#production-deployment)
8. [Blue-Green Deployment](#blue-green-deployment)
9. [Rollback Procedures](#rollback-procedures)
10. [Post-Deployment Verification](#post-deployment-verification)
11. [Troubleshooting](#troubleshooting)

---

## Deployment Overview

### Deployment Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Pipeline                      │
└─────────────────────────────────────────────────────────────┘
         │
         ├──> Development
         │    • Local Docker Compose
         │    • Hot-reload enabled
         │    • Mock services
         │
         ├──> Staging
         │    • Kubernetes cluster
         │    • Auto-deploy from main branch
         │    • Real services (staging tier)
         │
         └──> Production
              • Kubernetes cluster
              • Manual approval required
              • Blue-green deployment
              • Health checks
              • Automatic rollback on failure
```

### Deployment Targets

| Environment | Platform | Trigger | Approval | Health Checks |
|------------|----------|---------|----------|---------------|
| **Development** | Docker Compose | Manual | None | Basic |
| **Staging** | Kubernetes | Git push to `main` | None | Standard |
| **Production** | Kubernetes | Git tag `v*` | Required | Comprehensive |

---

## Pre-Deployment Checklist

### Code Quality Gates

**Before any deployment:**
```bash
# 1. Run linter
pnpm nx affected:lint
# Expected: 0 errors

# 2. Run tests with coverage
pnpm nx affected:test --coverage
# Expected: >80% coverage, all tests pass

# 3. Build all affected projects
pnpm nx affected:build
# Expected: Successful build

# 4. Type check
pnpm nx run-many -t build --parallel=3
# Expected: 0 type errors

# 5. Security audit
pnpm audit --audit-level=high
# Expected: 0 high/critical vulnerabilities
```

### Configuration Verification

**Environment Variables:**
```bash
# Check required variables are set
./scripts/check-env.sh

# Variables checklist:
# - ANTHROPIC_API_KEY (production key, not dev)
# - DATABASE_URL (production database)
# - JWT_SECRET (secure, unique per environment)
# - REDIS_URL (production Redis)
# - INFLUXDB_TOKEN (production token)
```

### Database Migrations

**Check pending migrations:**
```bash
# View migration status
pnpm nx run prisma-schema:migrate status

# Create migration if needed
pnpm nx run prisma-schema:migrate dev --name description

# Apply migrations (staging/prod)
pnpm nx run prisma-schema:migrate deploy
```

### Version Tagging

**For production releases:**
```bash
# Create version tag
git tag -a v1.2.3 -m "Release v1.2.3: Add device filtering feature"

# Push tag
git push origin v1.2.3

# Verify tag
git describe --tags
```

---

## Local Development Deployment

### Quick Start

**1. Initial Setup:**
```bash
# Clone and install
git clone https://github.com/svdwalt007/Friendly-AIAEP.git
cd Friendly-AIAEP
pnpm install

# Configure environment
cp .env.example .env
nano .env
```

**2. Start Infrastructure:**
```bash
# Start all services
docker compose -f docker/docker-compose.dev.yml up -d

# Wait for services to be healthy
docker compose -f docker/docker-compose.dev.yml ps

# Initialize database
pnpm nx run prisma-schema:migrate dev
pnpm nx run prisma-schema:seed
```

**3. Build and Serve:**
```bash
# Build all projects
pnpm nx run-many -t build

# Terminal 1: API Gateway
pnpm nx serve aep-api-gateway

# Terminal 2: Builder UI
pnpm nx serve aep-builder

# Terminal 3: Preview Host
pnpm nx serve aep-preview-host
```

**4. Verify:**
```bash
# Health checks
curl http://localhost:46000/health
curl http://localhost:46001/health

# Access UI
open http://localhost:45000

# View API docs
open http://localhost:46000/docs
```

---

## Docker Deployment

### Building Docker Images

**Build all application images:**
```bash
# Build API Gateway
docker build -f apps/aep-api-gateway/Dockerfile -t friendly-aep/api-gateway:latest .

# Build Builder UI
docker build -f apps/aep-builder/Dockerfile -t friendly-aep/builder:latest .

# Build Preview Host
docker build -f apps/aep-preview-host/Dockerfile -t friendly-aep/preview-host:latest .
```

**Multi-platform builds:**
```bash
# Create builder instance
docker buildx create --name multiarch --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f apps/aep-api-gateway/Dockerfile \
  -t friendly-aep/api-gateway:latest \
  --push \
  .
```

### Running with Docker Compose

**Production configuration (docker-compose.prod.yml):**
```yaml
services:
  api-gateway:
    image: friendly-aep/api-gateway:latest
    ports:
      - "3001:46000"
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:46000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  builder:
    image: friendly-aep/builder:latest
    ports:
      - "80:80"
    restart: unless-stopped

  preview-host:
    image: friendly-aep/preview-host:latest
    ports:
      - "3002:46001"
    environment:
      NODE_ENV: production
    restart: unless-stopped
```

**Deploy:**
```bash
# Start production stack
docker compose -f docker/docker-compose.prod.yml up -d

# View logs
docker compose -f docker/docker-compose.prod.yml logs -f

# Check status
docker compose -f docker/docker-compose.prod.yml ps
```

---

## Kubernetes Deployment

### Prerequisites

**Install tools:**
```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify installations
kubectl version --client
helm version
```

**Configure kubectl:**
```bash
# Set up kubeconfig
export KUBECONFIG=~/.kube/config

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Deploy with Helm

**1. Create namespace:**
```bash
# Production namespace
kubectl create namespace friendly-production

# Staging namespace
kubectl create namespace friendly-staging
```

**2. Create secrets:**
```bash
# Database credentials
kubectl create secret generic db-credentials \
  --from-literal=url="${DATABASE_URL}" \
  --namespace friendly-production

# Anthropic API key
kubectl create secret generic anthropic-api \
  --from-literal=key="${ANTHROPIC_API_KEY}" \
  --namespace friendly-production

# JWT secrets
kubectl create secret generic jwt-secrets \
  --from-literal=secret="${JWT_SECRET}" \
  --from-literal=refresh-secret="${REFRESH_TOKEN_SECRET}" \
  --namespace friendly-production
```

**3. Deploy with Helm:**
```bash
# Install release
helm install friendly-aep ./deploy/helm \
  --namespace friendly-production \
  --set image.tag=v1.2.3 \
  --set image.registry=ghcr.io/svdwalt007/friendly-aiaep \
  --set replicaCount=3 \
  --set resources.requests.memory=512Mi \
  --set resources.requests.cpu=250m \
  --values deploy/helm/values.production.yaml \
  --wait \
  --timeout 10m

# Verify deployment
kubectl get pods -n friendly-production
kubectl get services -n friendly-production
kubectl get ingress -n friendly-production
```

**4. Monitor rollout:**
```bash
# Watch deployment status
kubectl rollout status deployment/friendly-aep-api-gateway -n friendly-production

# View pod logs
kubectl logs -f deployment/friendly-aep-api-gateway -n friendly-production

# Check pod health
kubectl get pods -n friendly-production -w
```

### Helm Values Configuration

**values.production.yaml:**
```yaml
replicaCount: 3

image:
  registry: ghcr.io/svdwalt007/friendly-aiaep
  pullPolicy: IfNotPresent
  tag: "v1.2.3"

service:
  type: LoadBalancer
  port: 80
  targetPort: 3001

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 250m
    memory: 512Mi

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
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: url
  - name: ANTHROPIC_API_KEY
    valueFrom:
      secretKeyRef:
        name: anthropic-api
        key: key

healthCheck:
  enabled: true
  livenessProbe:
    httpGet:
      path: /health/live
      port: 3001
    initialDelaySeconds: 30
    periodSeconds: 10
  readinessProbe:
    httpGet:
      path: /health/ready
      port: 3001
    initialDelaySeconds: 10
    periodSeconds: 5
```

---

## Staging Deployment

### Automated Staging Deployment

**Triggered by push to main branch:**

**GitHub Actions workflow (.github/workflows/deploy.yml):**
```yaml
deploy-staging:
  name: Deploy to Staging
  runs-on: ubuntu-latest
  needs: ci-gate
  if: github.ref == 'refs/heads/main'
  environment:
    name: staging
    url: https://staging.friendly-aiaep.com

  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Configure kubectl
      run: |
        mkdir -p $HOME/.kube
        echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > $HOME/.kube/config

    - name: Deploy with Helm
      run: |
        helm upgrade --install friendly-aep ./deploy/helm \
          --namespace friendly-staging \
          --create-namespace \
          --set image.tag=${{ github.sha }} \
          --values deploy/helm/values.staging.yaml \
          --wait \
          --timeout 5m

    - name: Verify deployment
      run: kubectl rollout status deployment/friendly-aep -n friendly-staging
```

### Manual Staging Deployment

```bash
# Set context
kubectl config use-context staging-cluster

# Deploy
helm upgrade --install friendly-aep ./deploy/helm \
  --namespace friendly-staging \
  --create-namespace \
  --set image.tag=$(git rev-parse HEAD) \
  --values deploy/helm/values.staging.yaml \
  --wait

# Verify
kubectl get pods -n friendly-staging
```

---

## Production Deployment

### Production Deployment Checklist

**Before production deployment:**
- [ ] All tests passing in CI/CD
- [ ] Staging deployment successful
- [ ] Manual testing completed in staging
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Team notified of deployment window
- [ ] Monitoring alerts configured
- [ ] Backup completed

### Production Deployment Process

**1. Create release tag:**
```bash
# Tag release
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

**2. Trigger deployment:**

The deployment is automatically triggered by GitHub Actions when a tag is pushed.

**3. Monitor deployment:**
```bash
# Watch GitHub Actions
# https://github.com/svdwalt007/Friendly-AIAEP/actions

# Or monitor directly
kubectl config use-context production-cluster
kubectl get pods -n friendly-production -w
```

**4. Manual production deployment:**
```bash
# Set context
kubectl config use-context production-cluster

# Deploy with Helm
helm upgrade --install friendly-aep ./deploy/helm \
  --namespace friendly-production \
  --set image.tag=v1.2.3 \
  --values deploy/helm/values.production.yaml \
  --wait \
  --timeout 10m

# Verify
kubectl rollout status deployment/friendly-aep-api-gateway -n friendly-production
kubectl get pods -n friendly-production
```

---

## Blue-Green Deployment

### Blue-Green Strategy

**Concept:**
- **Blue**: Current production version
- **Green**: New version being deployed
- Traffic switches from blue to green after verification

**Implementation:**

**1. Deploy green environment:**
```bash
# Deploy new version with "green" label
helm install friendly-aep-green ./deploy/helm \
  --namespace friendly-production \
  --set image.tag=v1.2.3 \
  --set deployment.color=green \
  --values deploy/helm/values.production.yaml
```

**2. Verify green environment:**
```bash
# Test green pods
kubectl run -it --rm test --image=curlimages/curl -- sh
curl http://friendly-aep-green-service/health
```

**3. Switch traffic:**
```bash
# Update service selector
kubectl patch service friendly-aep-service \
  -p '{"spec":{"selector":{"color":"green"}}}'

# Verify traffic switch
curl https://api.friendly-aiaep.com/health
```

**4. Monitor and verify:**
```bash
# Watch logs
kubectl logs -f -l color=green -n friendly-production

# Check error rates in Grafana
open https://grafana.friendly-aiaep.com
```

**5. Remove blue environment:**
```bash
# After verification (e.g., 1 hour)
helm uninstall friendly-aep-blue --namespace friendly-production
```

---

## Rollback Procedures

### Helm Rollback

**List releases:**
```bash
# View release history
helm history friendly-aep -n friendly-production
```

**Rollback to previous version:**
```bash
# Rollback to previous release
helm rollback friendly-aep -n friendly-production

# Rollback to specific revision
helm rollback friendly-aep 5 -n friendly-production
```

### Kubernetes Rollback

**Rollback deployment:**
```bash
# Rollback to previous version
kubectl rollout undo deployment/friendly-aep-api-gateway -n friendly-production

# Rollback to specific revision
kubectl rollout undo deployment/friendly-aep-api-gateway --to-revision=3 -n friendly-production

# Check rollout status
kubectl rollout status deployment/friendly-aep-api-gateway -n friendly-production
```

### Database Rollback

**Rollback migrations:**
```bash
# View migration history
pnpm nx run prisma-schema:migrate status

# Rollback specific migration
pnpm nx run prisma-schema:migrate resolve --rolled-back "20260415_migration_name"

# Restore from backup
pg_restore -h localhost -U friendly -d friendly_aep backup.sql
```

### Emergency Rollback

**Immediate rollback procedure:**
```bash
#!/bin/bash
# emergency-rollback.sh

# 1. Rollback Kubernetes deployment
kubectl rollout undo deployment/friendly-aep-api-gateway -n friendly-production

# 2. Rollback Helm release
helm rollback friendly-aep -n friendly-production

# 3. Verify rollback
kubectl get pods -n friendly-production
kubectl rollout status deployment/friendly-aep-api-gateway -n friendly-production

# 4. Check health
curl https://api.friendly-aiaep.com/health

echo "Rollback complete. Monitor Grafana for metrics."
```

---

## Post-Deployment Verification

### Health Checks

**API Gateway:**
```bash
# Liveness check
curl https://api.friendly-aiaep.com/health/live
# Expected: {"status":"ok"}

# Readiness check
curl https://api.friendly-aiaep.com/health/ready
# Expected: {"status":"ok","database":"connected","redis":"connected"}

# Overall health
curl https://api.friendly-aiaep.com/health
# Expected: {"status":"healthy","version":"1.2.3","uptime":123}
```

**Database Connection:**
```bash
# Check Prisma connection
kubectl exec -it deployment/friendly-aep-api-gateway -n friendly-production -- \
  node -e "require('@prisma/client').PrismaClient().then(p => p.\$connect())"
```

**Redis Connection:**
```bash
# Check Redis
kubectl exec -it deployment/friendly-aep-api-gateway -n friendly-production -- \
  node -e "require('ioredis')('redis://friendly-redis:46102').ping()"
```

### Smoke Tests

**Run smoke test suite:**
```bash
# API smoke tests
./scripts/smoke-test.sh https://api.friendly-aiaep.com

# Test critical endpoints
curl -X POST https://api.friendly-aiaep.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'

# Test WebSocket
wscat -c "wss://api.friendly-aiaep.com/api/v1/agent/stream?sessionId=test&token=TOKEN"
```

### Performance Verification

**Check response times:**
```bash
# Average response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.friendly-aiaep.com/health

# Load test
ab -n 1000 -c 10 https://api.friendly-aiaep.com/health
```

### Monitoring Checks

**Verify metrics collection:**
- Open Grafana: https://grafana.friendly-aiaep.com
- Check "Platform Performance" dashboard
- Verify data is flowing
- Check error rates
- Monitor resource usage

---

## Troubleshooting

### Common Deployment Issues

**1. Image Pull Errors:**
```bash
# Check image exists
docker pull ghcr.io/svdwalt007/friendly-aiaep/api-gateway:v1.2.3

# Check image pull secret
kubectl get secret ghcr-secret -n friendly-production

# Recreate secret
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=$GITHUB_USERNAME \
  --docker-password=$GITHUB_TOKEN \
  --namespace friendly-production
```

**2. Pod Crash Loop:**
```bash
# View pod logs
kubectl logs -f POD_NAME -n friendly-production

# Describe pod
kubectl describe pod POD_NAME -n friendly-production

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Invalid configuration
```

**3. Service Unavailable:**
```bash
# Check service
kubectl get svc -n friendly-production

# Check endpoints
kubectl get endpoints -n friendly-production

# Test service internally
kubectl run -it --rm debug --image=curlimages/curl -- sh
curl http://friendly-aep-service:46000/health
```

**4. Database Migration Failures:**
```bash
# Check migration status
kubectl exec -it deployment/friendly-aep-api-gateway -n friendly-production -- \
  pnpm nx run prisma-schema:migrate status

# Manually run migrations
kubectl exec -it deployment/friendly-aep-api-gateway -n friendly-production -- \
  pnpm nx run prisma-schema:migrate deploy
```

---

## Related Documentation

- [Kubernetes Guide](../deployment/KUBERNETES-GUIDE.md) - K8s deployment details
- [Docker Guide](../deployment/DOCKER-GUIDE.md) - Docker best practices
- [CI/CD Pipeline](../deployment/CICD-PIPELINE.md) - Automated deployment
- [Multi-Environment Strategy](../deployment/MULTI-ENVIRONMENT.md) - Environment management
- [Monitoring Guide](./MONITORING-GUIDE.md) - Observability setup

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology DevOps Team
