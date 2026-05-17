# Docker Generator Templates Summary

## Created Templates

All Handlebars templates have been successfully created in `libs/deploy/docker-generator/src/lib/templates/`:

### 1. docker-compose.yml.hbs (11KB)
Complete Docker Compose v3.9 configuration with:
- **9 Core Services**: frontend, grafana, influxdb, postgres, redis, iot-api-proxy, license-agent, nginx-proxy
- **Conditional Services**:
  - `telegraf` (Professional+ only) - controlled by `{{#if hasThirdPartyIngestion}}`
  - `ollama` (Enterprise only) - controlled by `{{#if isEnterprise}}`
- **Networks**: aep-network with conditional IPAM for dedicated deployments
- **Volumes**: All persistent volumes for services
- **Environment Variables**: Using ${VAR} syntax for runtime substitution
- **Dependencies**: Proper depends_on for service startup order
- **Health Checks**: All services have healthcheck definitions

### 2. docker-compose.prod.yml.hbs (9.2KB)
Production overrides with:
- **restart: always** for all services
- **Tier-based resource limits**:
  - Starter: 512M-1G memory, 0.5-1.0 CPUs
  - Professional: 1G-2G memory, 1.0-2.0 CPUs
  - Enterprise: 2G-4G memory, 2.0-4.0 CPUs
- **Logging configuration**: json-file driver with rotation (10M max, 3 files)
- **Enhanced healthchecks**: Stricter intervals and timeouts
- **PostgreSQL tuning**: Production-optimized configuration parameters
- **Conditional overrides**: Tier-specific settings using Handlebars conditionals

### 3. env.template.hbs (9.7KB)
Comprehensive environment configuration with 50+ variables:
- **Project Configuration**: Deployment mode, project ID, version, domain
- **Three Friendly APIs**: 
  - Northbound REST API (device management)
  - Events/Webhook REST API (real-time events)
  - QoE/Monitoring REST API (time-series KPIs)
- **LLM Provider Configuration**:
  - Anthropic (all tiers) with API key
  - Ollama (Enterprise only) with URL and model - `{{#if isEnterprise}}`
  - Fallback provider configuration
- **License Configuration**: Key, tenant ID, heartbeat, grace period
- **Database Configuration**: PostgreSQL, InfluxDB, Redis
- **Grafana Configuration**: Admin credentials and theme
- **Third-Party Ingestion**: MQTT and HTTP settings (Professional+) - `{{#if hasThirdPartyIngestion}}`
- **Advanced Settings**: SSL, logging, feature flags, rate limits, CORS
- **Extensive comments**: Each section and variable documented

### 4. nginx-default.conf.hbs (10KB)
Nginx reverse proxy configuration with:
- **Upstream Definitions**:
  - frontend:80
  - grafana:45001
  - iot-api-proxy:8080
  - license-agent:8080
  - ollama:11434 (Enterprise only) - `{{#if isEnterprise}}`
- **Location Blocks**:
  - `/health` - Health check endpoint
  - `/api/*` -> iot-api-proxy:8080 (with WebSocket support)
  - `/grafana/*` -> grafana:45001 (with WebSocket support)
  - `/license/*` -> license-agent:8080 (internal only)
  - `/ollama/*` -> ollama:11434 (Enterprise, internal only)
  - `/ws/*` -> WebSocket routes for agent streaming
  - `/assets/*` -> Static assets with caching
  - `/*` -> frontend:80 (default route with Angular routing support)
- **WebSocket Support**: Upgrade headers for streaming connections
- **Proxy Headers**: X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, etc.
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **CORS Configuration**: Conditional for SaaS mode - `{{#if isSaas}}`
- **HTTPS Server**: Conditional SSL configuration for dedicated mode - `{{#if isDedicated}}`
- **Timeouts & Buffers**: Optimized for production use

## Handlebars Features Used

### Variables
- `{{project.projectName}}`, `{{project.version}}`, `{{project.tier}}`
- `{{environment.deploymentMode}}`, `{{environment.baseDomain}}`
- `{{metadata.generatedAt}}`
- `{{license.tenantId}}`, `{{license.heartbeatInterval}}`

### Conditionals
- `{{#if isDedicated}}...{{/if}}` - Dedicated deployment mode
- `{{#if isSaas}}...{{/if}}` - SaaS deployment mode
- `{{#if isStarter}}...{{/if}}` - Starter tier
- `{{#if isProfessional}}...{{/if}}` - Professional tier
- `{{#if isEnterprise}}...{{/if}}` - Enterprise tier
- `{{#if hasThirdPartyIngestion}}...{{/if}}` - Professional+ feature
- `{{#if hasAirgap}}...{{/if}}` - Air-gap mode
- `{{#if environment.redis.password}}...{{/if}}` - Redis authentication
- Nested conditionals for tier-based resource allocation

### Helpers (Available)
The docker-generator.ts file registers these Handlebars helpers:
- `eq` - Equality comparison
- `ne` - Not equal comparison
- `gt` - Greater than
- `lt` - Less than
- `and` - Logical AND
- `or` - Logical OR
- `json` - JSON stringify
- `upper` - Uppercase
- `lower` - Lowercase

## Docker Compose Best Practices

✅ Version pinning for images (e.g., grafana:10.2.0, postgres:15-alpine)
✅ Named volumes for data persistence
✅ Health checks for all services
✅ Restart policies (unless-stopped for dev, always for prod)
✅ Resource limits to prevent resource starvation
✅ Security: read-only volumes where appropriate (:ro)
✅ Network isolation with custom bridge network
✅ Proper dependency ordering with depends_on
✅ Environment variable templating with ${VAR} syntax
✅ Logging configuration for production
✅ Container naming for easy identification
✅ Separate production override file

## Template Integration

The templates are designed to work with the `DockerStackGenerator` class in `docker-generator.ts`:

1. Templates use Handlebars syntax compatible with the registered helpers
2. Context object provides all necessary variables and flags
3. Templates can be loaded via `loadTemplate()` method
4. Production overrides extend base compose file
5. Environment template documents all configuration options

## Notes

- **NO Dockerfiles created** - As requested, only Docker Compose and configuration templates
- **Tier-based feature gating** - Templates respect license tier restrictions
- **Deployment mode aware** - Different configurations for SaaS vs. Dedicated
- **Security focused** - Internal-only routes, CORS, SSL support
- **Production ready** - Resource limits, logging, health checks
- **Well documented** - Extensive comments in all templates

## Usage

The generator will use these templates to create:
1. `docker-compose.yml` - Base configuration
2. `docker-compose.prod.yml` - Production overrides
3. `.env.template` - Environment variable template
4. `nginx/default.conf` - Nginx reverse proxy config

Deployment command:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
