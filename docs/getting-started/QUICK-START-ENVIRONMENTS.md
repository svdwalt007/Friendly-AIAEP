# Quick Start: Environment Configuration

This guide helps you quickly set up and switch between environments.

## Quick Setup

### 1. Choose Your Environment

```bash
# Development (default)
cp .env.development .env

# Test
cp .env.test .env

# Pre-Production
cp .env.preprod .env

# Production
cp .env.production .env
```

### 2. Update Secrets

Edit `.env` and change all values marked with `CHANGE_ME`:

```bash
# Example: Required changes for production
JWT_SECRET=your_strong_secret_here
POSTGRES_PASSWORD=your_secure_password
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

### 3. Start Services

```bash
# Development
docker compose -f docker/docker-compose.dev.yml up -d

# Test
docker compose -f docker/docker-compose.test.yml up -d

# Pre-Production
docker compose -f docker/docker-compose.preprod.yml up -d

# Production
docker compose -f docker/docker-compose.prod.yml up -d
```

## Build Angular App

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

## Serve Angular App Locally

```bash
# Development (default)
pnpm nx serve aep-builder

# With specific configuration
pnpm nx serve aep-builder --configuration=test
pnpm nx serve aep-builder --configuration=preprod
pnpm nx serve aep-builder --configuration=production
```

## Common Commands

### Check Configuration

```bash
# View resolved docker-compose config
docker compose -f docker/docker-compose.prod.yml --env-file .env.production config

# Validate environment file
docker compose -f docker/docker-compose.prod.yml --env-file .env.production config --quiet
```

### View Logs

```bash
# All services
docker compose -f docker/docker-compose.dev.yml logs -f

# Specific service
docker compose -f docker/docker-compose.dev.yml logs -f aep-api-gateway

# Last 100 lines
docker compose -f docker/docker-compose.dev.yml logs --tail=100
```

### Health Checks

```bash
# API Gateway
curl http://localhost:46000/api/health

# Builder (development)
curl http://localhost:45000

# Builder (production)
curl http://localhost:80

# Grafana
curl http://localhost:45001/api/health
```

### Database Management

```bash
# Connect to PostgreSQL
docker exec -it friendly-aep-dev-postgres psql -U friendly -d friendly_aep_dev

# Backup database
docker exec friendly-aep-prod-postgres pg_dump -U friendly friendly_aep_prod > backup.sql

# Restore database
docker exec -i friendly-aep-prod-postgres psql -U friendly -d friendly_aep_prod < backup.sql
```

## Environment Variables Reference

### Essential Variables

| Variable | Development | Test | Pre-Prod | Production |
|----------|-------------|------|----------|------------|
| NODE_ENV | development | test | production | production |
| DEPLOYMENT_MODE | development | test | preprod | production |
| LOG_LEVEL | debug | info | info | error |
| DATABASE_URL | localhost | localhost | managed-db | managed-db |
| CORS_ORIGIN | localhost:45000 | localhost:45000 | domain | domain |

### Security Variables (MUST CHANGE in Production)

- `JWT_SECRET` - Minimum 64 characters
- `REFRESH_TOKEN_SECRET` - Minimum 64 characters
- `SESSION_SECRET` - Minimum 64 characters
- `POSTGRES_PASSWORD` - Strong password
- `REDIS_PASSWORD` - Strong password
- `ANTHROPIC_API_KEY` - Valid API key

## Switching Environments

### From Development to Test

```bash
# Stop dev services
docker compose -f docker/docker-compose.dev.yml down

# Copy test environment
cp .env.test .env

# Start test services
docker compose -f docker/docker-compose.test.yml up -d

# Build for test
pnpm nx build aep-builder --configuration=test
```

### From Pre-Prod to Production

```bash
# Stop pre-prod services
docker compose -f docker/docker-compose.preprod.yml down

# Copy production environment
cp .env.production .env

# UPDATE ALL SECRETS FIRST!
nano .env

# Start production services
docker compose -f docker/docker-compose.prod.yml up -d

# Build for production
pnpm nx build aep-builder --configuration=production
```

## Verification Checklist

### Development ✓
- [ ] Services start without errors
- [ ] Can access builder at http://localhost:45000
- [ ] Can access API at http://localhost:46000
- [ ] Hot reload works
- [ ] Debug logs visible

### Test ✓
- [ ] All tests pass
- [ ] Services isolated from dev
- [ ] Test database separate
- [ ] Mock services enabled

### Pre-Production ✓
- [ ] All secrets changed from defaults
- [ ] HTTPS configured
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Security headers enabled
- [ ] Rate limiting active

### Production ✓
- [ ] All secrets are strong and unique
- [ ] HTTPS enforced
- [ ] Monitoring and alerting configured
- [ ] Backups tested
- [ ] Security audit passed
- [ ] Load testing completed
- [ ] Disaster recovery plan documented
- [ ] Rollback plan documented

## Troubleshooting

### Services won't start

```bash
# Check logs
docker compose -f docker/docker-compose.dev.yml logs

# Check if ports are in use
netstat -an | grep 3001
netstat -an | grep 4200
netstat -an | grep 5432

# Remove old containers
docker compose -f docker/docker-compose.dev.yml down -v
```

### Wrong environment loaded

```bash
# Check loaded environment
docker compose -f docker/docker-compose.prod.yml config | grep NODE_ENV

# Verify .env file
cat .env | grep NODE_ENV
```

### Build fails

```bash
# Clear NX cache
pnpm nx reset

# Rebuild
pnpm nx build aep-builder --configuration=production --verbose
```

### Database connection fails

```bash
# Check database is running
docker ps | grep postgres

# Check connection
docker exec -it friendly-aep-dev-postgres pg_isready -U friendly

# View database logs
docker logs friendly-aep-dev-postgres
```

## Performance Tips

### Development
- Use `--parallel` for NX builds
- Enable watch mode for faster rebuilds
- Use Docker BuildKit for faster builds

### Production
- Enable all caching
- Use CDN for static assets
- Enable compression
- Monitor resource usage
- Set up autoscaling

## Security Reminders

1. **Never commit .env files** (except .env.example)
2. **Change all CHANGE_ME values**
3. **Use strong, random secrets** (minimum 64 chars)
4. **Rotate secrets regularly**
5. **Use HTTPS in production**
6. **Enable all security headers**
7. **Set up rate limiting**
8. **Monitor for security issues**
9. **Keep dependencies updated**
10. **Regular security audits**

## Next Steps

1. Read [ENVIRONMENT-CONFIG.md](./ENVIRONMENT-CONFIG.md) for detailed documentation
2. Review [GETTING-STARTED.md](./GETTING-STARTED.md) for general setup
3. Check [IMPLEMENTATION-COMPLETE.md](./IMPLEMENTATION-COMPLETE.md) for features
4. Set up monitoring and alerting
5. Configure backups
6. Test disaster recovery

## Support

For detailed documentation, see:
- [ENVIRONMENT-CONFIG.md](./ENVIRONMENT-CONFIG.md) - Complete environment guide
- [GETTING-STARTED.md](./GETTING-STARTED.md) - General getting started guide
- `.env.example` - All available configuration options
