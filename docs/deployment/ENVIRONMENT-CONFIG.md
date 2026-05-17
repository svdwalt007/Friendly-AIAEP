# Environment Configuration Guide

This document describes the multi-environment configuration setup for the Friendly AI AEP Tool.

## Environments

The project supports four distinct environments:

1. **Development** - Local development with hot-reload and debugging
2. **Test** - CI/CD testing and automated test suites
3. **Pre-Production** - Final testing before production release
4. **Production** - Live production deployment

## Angular Environment Files

### Location: `apps/aep-builder/src/environments/`

- `environment.ts` - Development (default)
- `environment.test.ts` - Test
- `environment.preprod.ts` - Pre-production
- `environment.prod.ts` - Production

### Structure

Each environment file contains:

```typescript
export const environment = {
  production: boolean,
  name: string,
  apiUrl: string,
  previewUrl: string,
  grafanaUrl: string,
  features: {
    iotEnabled: boolean,
    builderEnabled: boolean,
    grafanaIntegration: boolean,
    aiAgentRuntime: boolean,
    templateMarketplace: boolean,
    debugMode: boolean,
  },
  logging: {
    level: string,
    enableConsole: boolean,
    enableRemote: boolean,
  },
  security: {
    enableCSP: boolean,
    strictMode: boolean,
  },
  performance: {
    enableServiceWorker: boolean,
    enableCaching: boolean,
  },
};
```

## Build Configurations

### Building for Different Environments

```bash
# Development
pnpm nx build aep-builder --configuration=development

# Test
pnpm nx build aep-builder --configuration=test

# Pre-Production
pnpm nx build aep-builder --configuration=preprod

# Production
pnpm nx build aep-builder --configuration=production
```

### Serving Locally

```bash
# Development
pnpm nx serve aep-builder --configuration=development

# Test
pnpm nx serve aep-builder --configuration=test

# Pre-Production
pnpm nx serve aep-builder --configuration=preprod

# Production
pnpm nx serve aep-builder --configuration=production
```

## Environment Variables

### .env Files

Each environment has its own `.env` file:

- `.env.development` - Development settings
- `.env.test` - Test settings
- `.env.preprod` - Pre-production settings
- `.env.production` - Production settings

### Loading Environment Variables

To use a specific environment file:

```bash
# Development (default)
docker compose -f docker/docker-compose.dev.yml --env-file .env.development up

# Test
docker compose -f docker/docker-compose.test.yml --env-file .env.test up

# Pre-Production
docker compose -f docker/docker-compose.preprod.yml --env-file .env.preprod up

# Production
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up
```

## Docker Compose Files

### Location: `docker/`

- `docker-compose.dev.yml` - Development infrastructure
- `docker-compose.test.yml` - Test infrastructure
- `docker-compose.preprod.yml` - Pre-production infrastructure
- `docker-compose.prod.yml` - Production infrastructure

### Key Differences

#### Development
- No authentication on Redis
- Debug logging enabled
- No resource limits enforced strictly
- Mock services enabled
- Source maps enabled

#### Test
- Isolated test database
- Minimal services
- Faster health checks
- Optimized for CI/CD

#### Pre-Production
- Production-like configuration
- Monitoring enabled
- Source maps included for debugging
- Resource limits enforced
- Security hardening enabled

#### Production
- Maximum security hardening
- Compressed logging
- Strict resource limits
- No debug features
- Performance optimizations
- Backup volumes configured

## Security Configuration

### Development
- Weak secrets (safe for dev)
- CORS allows localhost
- CSP disabled
- Debug mode enabled

### Test
- Test-specific secrets
- Restricted CORS
- CSP enabled
- Debug mode disabled

### Pre-Production
- Production-grade secrets (must change)
- Domain-specific CORS
- Full security hardening
- Rate limiting enabled
- Sentry monitoring

### Production
- Strong secrets (must change)
- Strict CORS
- Full security hardening
- Rate limiting enforced
- Helmet security headers
- Sentry monitoring
- Audit logging

## Database Configuration

### Development
- Database: `friendly_aep_dev`
- Weak password
- No SSL/TLS
- Connection pooling: minimal

### Test
- Database: `friendly_aep_test`
- Isolated from dev/prod
- Auto-reset between tests
- Minimal connections

### Pre-Production
- Database: `friendly_aep_preprod`
- Strong password
- SSL/TLS recommended
- Connection pooling: moderate
- Backup volumes

### Production
- Database: `friendly_aep_prod`
- Strong password (required)
- SSL/TLS required
- Connection pooling: optimized
- Backup volumes configured
- Performance tuning enabled

## Secrets Management

### Development
All secrets are in `.env.development` and are safe for source control (weak, development-only values).

### Test
Test secrets in `.env.test` - can be committed if using mock services.

### Pre-Production & Production

**CRITICAL**: Never commit `.env.preprod` or `.env.production` to source control!

Use a secrets management solution:
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- Kubernetes Secrets

### Required Secret Changes for Production

All values marked with `CHANGE_ME` in `.env.production` **MUST** be changed:

1. Database credentials
2. Redis password
3. JWT secrets (minimum 64 characters)
4. API keys (Anthropic, Friendly, etc.)
5. InfluxDB tokens
6. Grafana passwords
7. MinIO/S3 credentials

## Feature Flags

Feature flags allow enabling/disabling features per environment:

```bash
# Development - All features enabled
FEATURE_IOT_ENABLED=true
FEATURE_BUILDER_ENABLED=true
FEATURE_GRAFANA_INTEGRATION=true
FEATURE_AI_AGENT_RUNTIME=true

# Production - Control feature rollout
FEATURE_IOT_ENABLED=true
FEATURE_BUILDER_ENABLED=true
FEATURE_GRAFANA_INTEGRATION=true
FEATURE_AI_AGENT_RUNTIME=false  # Gradual rollout
```

## Logging Configuration

### Development
- Level: `debug`
- Format: `pretty` (human-readable)
- Console: enabled
- File: optional

### Test
- Level: `info`
- Format: `json` (structured)
- Console: enabled
- File: optional

### Pre-Production
- Level: `info`
- Format: `json`
- Console: disabled
- File: enabled
- Remote: Sentry

### Production
- Level: `error`
- Format: `json`
- Console: disabled
- File: enabled (compressed, rotated)
- Remote: Sentry (required)

## Monitoring & Observability

### Development
- Basic health checks
- No external monitoring

### Test
- Health checks for CI/CD
- No external monitoring

### Pre-Production
- Full health checks
- Sentry error tracking
- Grafana metrics
- Sample rate: 0.5

### Production
- Comprehensive health checks
- Sentry error tracking (required)
- Grafana metrics and dashboards
- Alerting configured
- Sample rate: 0.1 (optimized for cost)

## Resource Limits

### Development
- Generous limits
- Allows debugging overhead
- Not strictly enforced

### Test
- Minimal resources
- Fast startup
- CI/CD optimized

### Pre-Production
- Production-like limits
- Realistic performance testing

### Production
- Optimized limits
- Prevents resource exhaustion
- Based on actual load testing

## Migration Checklist

### Moving from Dev to Test
- [ ] Change database name
- [ ] Update API endpoints
- [ ] Enable test-specific features
- [ ] Disable mock services

### Moving from Test to Pre-Prod
- [ ] Update all API endpoints
- [ ] Change all secrets
- [ ] Enable monitoring
- [ ] Configure backups
- [ ] Test SSL/TLS

### Moving from Pre-Prod to Production
- [ ] Change all secrets to production values
- [ ] Update domain names
- [ ] Configure CDN
- [ ] Enable all monitoring
- [ ] Configure alerting
- [ ] Test backup/restore
- [ ] Load testing
- [ ] Security audit
- [ ] Performance testing

## Best Practices

1. **Never use development secrets in production**
2. **Always use environment-specific .env files**
3. **Rotate secrets regularly in production**
4. **Test backup/restore procedures**
5. **Monitor resource usage**
6. **Set up alerting before going live**
7. **Use managed services for databases in production**
8. **Enable SSL/TLS in pre-prod and production**
9. **Review security settings regularly**
10. **Document any environment-specific changes**

## Troubleshooting

### Wrong environment loaded

Check the file replacement in `project.json`:
```json
"fileReplacements": [
  {
    "replace": "apps/aep-builder/src/environments/environment.ts",
    "with": "apps/aep-builder/src/environments/environment.prod.ts"
  }
]
```

### Environment variables not loading

Verify you're using the correct .env file:
```bash
docker compose --env-file .env.production -f docker/docker-compose.prod.yml config
```

### Build optimization issues

Check the configuration in `project.json`:
- `optimization`: true/false
- `sourceMap`: true/false
- `outputHashing`: all/none

## Support

For issues or questions about environment configuration:
1. Check this documentation
2. Review `.env.example` for all available variables
3. Check `project.json` for build configurations
4. Review docker-compose files for service configurations
