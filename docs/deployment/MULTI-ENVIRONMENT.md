# Multi-Environment Strategy

**Multi-Environment Deployment Strategy and Promotion Workflow**

Complete guide for managing multiple environments in Friendly AI AEP.

---

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Environment Configuration](#environment-configuration)
3. [Promotion Workflow](#promotion-workflow)
4. [Database Management](#database-management)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Procedures](#rollback-procedures)
7. [Best Practices](#best-practices)

---

## Environment Overview

### Environment Hierarchy

```
Development (Local)
    ↓
Test (CI/CD)
    ↓
Staging (Pre-Production)
    ↓
Production (Live)
```

| Environment | Purpose | Data | Stability | Users |
|------------|---------|------|-----------|-------|
| **Development** | Local dev | Mock | Unstable | Developers |
| **Test** | Automated testing | Test fixtures | Stable | CI/CD |
| **Staging** | UAT | Sanitized prod | Stable | QA, Product |
| **Production** | Live system | Real | Highly stable | End users |

---

## Environment Configuration

### Development

```yaml
environment: development
replicas: 1
resources:
  limits:
    cpu: 500m
    memory: 512Mi
database:
  type: local
  replicas: 1
monitoring:
  enabled: false
```

### Test

```yaml
environment: test
replicas: 1
resources:
  limits:
    cpu: 250m
    memory: 256Mi
database:
  type: ephemeral
monitoring:
  enabled: false
```

### Staging

```yaml
environment: staging
replicas: 2
resources:
  limits:
    cpu: 1000m
    memory: 2Gi
database:
  type: managed
  replicas: 2
  backup: daily
monitoring:
  enabled: true
  retention: 7d
```

### Production

```yaml
environment: production
replicas: 3
resources:
  limits:
    cpu: 2000m
    memory: 4Gi
database:
  type: managed
  replicas: 3
  backup: hourly
  pointInTimeRecovery: true
monitoring:
  enabled: true
  retention: 90d
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
```

---

## Promotion Workflow

### Code Promotion

```
Developer commits
    ↓
Feature branch
    ↓
Pull Request (requires review)
    ↓
Merge to main
    ↓
Auto-deploy to Staging
    ↓
QA Testing & Approval
    ↓
Tag release (v1.2.3)
    ↓
Manual deploy to Production
```

### Promotion Checklist

**Staging to Production:**
- [ ] All tests passing
- [ ] QA sign-off
- [ ] Performance tests passed
- [ ] Security scan clean
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Stakeholders notified

---

## Database Management

### Migration Strategy

**Development:**
```bash
pnpm nx run prisma-schema:migrate dev --name add_user_preferences
```

**Staging:**
```bash
pnpm nx run prisma-schema:migrate deploy
```

**Production:**
```bash
# Dry run first
pnpm nx run prisma-schema:migrate deploy --dry-run

# Apply
pnpm nx run prisma-schema:migrate deploy
```

### Data Synchronization

**Staging Data Refresh:**
```bash
# Sanitize production data
pg_dump production_db | ./scripts/sanitize-data.sh > staging_backup.sql

# Restore to staging
pg_restore -h staging-db -U friendly staging_backup.sql
```

---

## Testing Strategy

### Environment-Specific Tests

**Development:**
- Unit tests
- Component tests
- Integration tests (mocked)

**Test:**
- All automated tests
- Code coverage checks

**Staging:**
- Smoke tests
- E2E tests
- Performance tests
- Security tests

**Production:**
- Smoke tests (post-deployment)
- Monitoring validation
- Synthetic transactions

---

## Rollback Procedures

### Quick Rollback

**Helm Rollback:**
```bash
helm rollback friendly-aep -n friendly-production
```

**Kubernetes Rollback:**
```bash
kubectl rollout undo deployment/friendly-aep -n friendly-production
```

### Database Rollback

```bash
# Rollback migration
pnpm nx run prisma-schema:migrate resolve --rolled-back migration_name

# Restore from backup
pg_restore -h prod-db backup_timestamp.sql
```

---

## Best Practices

1. **Environment Parity**: Keep environments similar
2. **Automated Promotion**: Use CI/CD
3. **Configuration as Code**: Version control configs
4. **Immutable Infrastructure**: Recreate, don't modify
5. **Testing in Production**: Canary deployments
6. **Gradual Rollout**: Blue-green, canary
7. **Monitoring**: Track key metrics
8. **Documentation**: Document all changes

---

## Related Documentation

- [Deployment Guide](../guides/DEPLOYMENT-GUIDE.md)
- [Environment Configuration](../development/ENVIRONMENT-CONFIGURATION.md)
- [CI/CD Pipeline](./CICD-PIPELINE.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology DevOps Team
