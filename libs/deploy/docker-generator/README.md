# Docker Generator — Dual-Mode Stack Generator

**Generates production-ready Docker Compose configurations for Friendly AI AEP Tool**

Version: 1.0.0 | Module Reference v2.2 Section 11.1 | Layer 3 — Deployment

---

## Overview

The `docker-generator` library provides automated generation of complete Docker Compose stacks with support for both **SaaS (multi-tenant)** and **Dedicated (single-tenant)** deployment modes. It generates all necessary configuration files, Dockerfiles, and environment templates with tier-based feature gating.

### Key Features

- ✅ **Dual Deployment Modes**: SaaS and Dedicated with mode-specific optimizations
- ✅ **9 Core Services**: Frontend, API Gateway, Grafana, InfluxDB, PostgreSQL, Redis, and more
- ✅ **Tier-Based Features**: Starter, Professional, Enterprise with feature gating
- ✅ **Template-Based Generation**: Handlebars templates for flexibility
- ✅ **YAML Validation**: Automatic validation of generated Docker Compose files
- ✅ **Production-Ready**: Resource limits, health checks, security best practices
- ✅ **Complete Documentation**: Generated README with deployment instructions
- ✅ **Type Safety**: Full TypeScript with strict mode

---

## Quick Start

### 1. Basic Usage

```typescript
import {
  createGenerator,
  TierType,
  DeploymentMode,
  LLMProvider,
} from '@friendly-tech/deploy/docker-generator';

// Create generator instance
const generator = createGenerator();

// Configure and generate
const stack = generator.generate(projectConfig, envConfig, licenseConfig);

// Write files
import * as fs from 'fs';
fs.writeFileSync('docker-compose.yml', stack.composeYml);
fs.writeFileSync('docker-compose.prod.yml', stack.composeProYml);
fs.writeFileSync('.env.template', stack.envTemplate);
```

See `QUICK_START.md` for complete tutorial.

---

## Generated Stack

```
output/
├── docker-compose.yml          # Base configuration (9 services)
├── docker-compose.prod.yml     # Production overrides
├── .env.template               # 50+ environment variables
├── nginx/default.conf          # Reverse proxy config
├── dockerfiles/
│   ├── frontend.Dockerfile
│   ├── iot-api-proxy.Dockerfile
│   └── telegraf.Dockerfile
└── README.md                   # Deployment guide
```

---

## Services

### Core Services (All Tiers)

| Service | Purpose | Image | Port |
|---------|---------|-------|------|
| **frontend** | Angular 17+ UI | Custom | 80 |
| **iot-api-proxy** | Fastify API Gateway | Custom | 3000 |
| **grafana** | Observability | grafana/grafana-oss:10.4.10 | 3000 |
| **influxdb** | Time-series DB | influxdb:2.7-alpine | 8086 |
| **postgres** | Relational DB | postgres:16-alpine | 5432 |
| **redis** | Caching | redis:7-alpine | 6379 |
| **license-agent** | License validation | Custom | 4000 |
| **nginx-proxy** | Reverse proxy | nginx:1.25-alpine | 80/443 |

### Conditional Services

| Service | Tier | Feature Flag | Purpose |
|---------|------|--------------|---------|
| **telegraf** | Pro/Enterprise | thirdPartyIngestion | API ingestion |
| **ollama** | Enterprise | ollamaLLM | Air-gapped LLM |

---

## Deployment Modes

### Multi-Tenant (SaaS)

```bash
DEPLOYMENT_MODE=multi-tenant
```

- Shared infrastructure
- Tenant-scoped queries
- Minimal exposed ports
- Cost-optimized resources

### Dedicated (Single-Tenant)

```bash
DEPLOYMENT_MODE=dedicated
```

- Isolated infrastructure
- All ports exposed
- Custom subnet (IPAM)
- Dedicated resources

---

## Tier-Based Features

### Starter ($499/mo)
- 6 core services
- 100 req/min
- 512M-1G limits
- Anthropic/OpenAI only

### Professional ($2,499/mo)
- 7 services (+ Telegraf)
- 500 req/min
- 1G-2G limits
- Git push, custom widgets

### Enterprise ($7,999/mo)
- 8 services (+ Ollama)
- 2000 req/min
- 2G-4G limits
- Helm output, air-gap support

---

## API Reference

### createGenerator(options?)

```typescript
function createGenerator(options?: GeneratorOptions): DockerStackGenerator;
```

### generator.generate(projectConfig, envConfig, licenseConfig)

```typescript
function generate(
  projectConfig: ProjectConfig,
  envConfig: EnvironmentConfig,
  licenseConfig: LicenseConfig
): DockerStack;
```

### validateDockerStack(stack)

```typescript
function validateDockerStack(stack: DockerStack): ValidationResult;
```

See comprehensive API documentation in source code JSDoc comments.

---

## Testing

```bash
# Run all tests
pnpm nx test docker-generator

# Coverage
pnpm nx test docker-generator --coverage

# Watch mode
pnpm nx test docker-generator --watch
```

**Test Coverage:** 75+ test cases covering:
- YAML validation
- Template rendering
- Tier-based features
- Deployment modes
- Service definitions
- Error handling

---

## Building

```bash
# Build library
pnpm nx build docker-generator

# Type check
pnpm nx run docker-generator:typecheck

# Lint
pnpm nx lint docker-generator
```

---

## Production Deployment

### 1. Generate Stack

```typescript
const stack = generator.generate(projectConfig, envConfig, licenseConfig);
// Write files to ./deploy directory
```

### 2. Configure Environment

```bash
cd deploy
cp .env.template .env
# Edit .env with production credentials
```

### 3. Deploy

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Documentation

| File | Purpose |
|------|---------|
| `README.md` | This file - overview and quick start |
| `QUICK_START.md` | 5-minute tutorial |
| `TEMPLATE_USAGE_EXAMPLE.md` | Template customization |
| `TEMPLATES_SUMMARY.md` | Template reference |
| `IMPLEMENTATION_SUMMARY.md` | Implementation details |
| `VERIFICATION_CHECKLIST.md` | Testing checklist |

---

## Module Reference Compliance

✅ **Module Reference v2.2 Section 11.1** — Fully Implemented

- ✅ Dual-mode Docker Compose (SaaS/Dedicated)
- ✅ 9 core services with conditional inclusion
- ✅ .env.template with three API credentials
- ✅ LLM provider configuration
- ✅ Tier-based feature flags
- ✅ Handlebars templates
- ✅ YAML validation

---

## Troubleshooting

### Templates Not Found

Ensure templates directory exists:
```bash
ls libs/deploy/docker-generator/src/lib/templates/
```

### YAML Validation Fails

Check validation errors:
```typescript
const validation = validateDockerStack(stack);
console.error(validation.errors);
```

### Service Won't Start

Check logs:
```bash
docker-compose logs <service-name>
```

---

## License

UNLICENSED - Proprietary Friendly Technologies Software

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Module Reference**: v2.2 Section 11.1
**Test Coverage**: 75+ test cases
