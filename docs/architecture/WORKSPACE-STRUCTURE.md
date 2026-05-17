# Friendly AI AEP Tool - Workspace Structure

This document provides a complete overview of the Nx monorepo structure created for the Friendly AI AEP Tool.

## Project Summary

- **Nx Version**: 22.6.4
- **Package Manager**: pnpm 10.33.0
- **TypeScript**: 5.4.5 (strict mode enabled)
- **Node.js**: 20.x
- **Test Runner**: Vitest
- **Linter**: ESLint with @typescript-eslint

## Applications (3)

Located in `apps/` directory:

| Application | Type | Framework | Bundler | Port |
|------------|------|-----------|---------|------|
| `aep-api-gateway` | Node.js | Fastify | esbuild | 3001 |
| `aep-builder` | Angular 17+ | Standalone Components | esbuild | 4200 |
| `aep-preview-host` | Node.js | Express | esbuild | 3002 |

## Libraries (29)

All libraries are configured with:
- TypeScript strict mode
- Vitest for testing (Node.js libraries)
- ESLint for linting
- Proper build targets

### Core Services (8 libraries)

Path: `libs/core/`

| Library | Import Path | Description |
|---------|-------------|-------------|
| `agent-runtime` | `@friendly-tech/core/agent-runtime` | AI agent execution runtime |
| `llm-providers` | `@friendly-tech/core/llm-providers` | LLM provider integrations |
| `builder-orchestrator` | `@friendly-tech/core/builder-orchestrator` | Builder workflow orchestration |
| `project-registry` | `@friendly-tech/core/project-registry` | Project and workspace management |
| `policy-service` | `@friendly-tech/core/policy-service` | Policy and governance enforcement |
| `license-service` | `@friendly-tech/core/license-service` | License management |
| `billing-service` | `@friendly-tech/core/billing-service` | Billing and subscription management |
| `audit-service` | `@friendly-tech/core/audit-service` | Audit logging and compliance |

### IoT Integration (5 libraries)

Path: `libs/iot/`

| Library | Import Path | Description |
|---------|-------------|-------------|
| `swagger-ingestion` | `@friendly-tech/iot/swagger-ingestion` | OpenAPI/Swagger ingestion for IoT APIs |
| `auth-adapter` | `@friendly-tech/iot/auth-adapter` | Authentication adapter for IoT endpoints |
| `sdk-generator` | `@friendly-tech/iot/sdk-generator` | SDK generation for IoT integrations |
| `iot-tool-functions` | `@friendly-tech/iot/iot-tool-functions` | Tool functions for IoT operations |
| `mock-api-server` | `@friendly-tech/iot/mock-api-server` | Mock API server for testing |

### Builder Features (8 libraries)

Path: `libs/builder/`

| Library | Import Path | Description |
|---------|-------------|-------------|
| `page-composer` | `@friendly-tech/builder/page-composer` | Visual page composition |
| `widget-registry` | `@friendly-tech/builder/widget-registry` | Widget/component registry |
| `codegen` | `@friendly-tech/builder/codegen` | Code generation engine |
| `preview-runtime` | `@friendly-tech/builder/preview-runtime` | Live preview runtime |
| `publish-service` | `@friendly-tech/builder/publish-service` | Project publishing service |
| `git-service` | `@friendly-tech/builder/git-service` | Git integration for version control |
| `environment-service` | `@friendly-tech/builder/environment-service` | Environment configuration management |
| `template-marketplace` | `@friendly-tech/builder/template-marketplace` | Template marketplace integration |

### UI Components (1 library)

Path: `libs/ui/`

| Library | Import Path | Description | Type |
|---------|-------------|-------------|------|
| `iot-ui` | `@friendly-tech/iot-ui` | IoT UI components | Publishable Angular library |

### Grafana Integration (3 libraries)

Path: `libs/grafana/`

| Library | Import Path | Description |
|---------|-------------|-------------|
| `provisioning` | `@friendly-tech/grafana/provisioning` | Grafana provisioning automation |
| `dashboard-templates` | `@friendly-tech/grafana/dashboard-templates` | Dashboard template library |
| `theme` | `@friendly-tech/grafana/theme` | Custom Grafana themes |

### Data Management (3 libraries)

Path: `libs/data/`

| Library | Import Path | Description |
|---------|-------------|-------------|
| `prisma-schema` | `@friendly-tech/data/prisma-schema` | Prisma database schemas |
| `influx-schemas` | `@friendly-tech/data/influx-schemas` | InfluxDB time-series schemas |
| `telegraf-ingest-config` | `@friendly-tech/data/telegraf-ingest-config` | Telegraf configuration for IoT data ingestion |

### Deployment (2 libraries)

Path: `libs/deploy/`

| Library | Import Path | Description |
|---------|-------------|-------------|
| `docker-generator` | `@friendly-tech/deploy/docker-generator` | Docker configuration generation |
| `helm-generator` | `@friendly-tech/deploy/helm-generator` | Helm chart generation |

## Configuration Files

### TypeScript Configuration

- `tsconfig.base.json` - Base TypeScript configuration with strict mode enabled
  - All path aliases configured with `@friendly-tech/*` scope
  - Strict type checking enabled
  - ES2022 target

### Package Management

- `package.json` - Root package configuration
  - Scripts: build, test, lint, affected:*, graph
  - Private: true
  - License: UNLICENSED

### Nx Configuration

- `nx.json` - Nx workspace configuration
  - Target defaults for build, test, lint with caching enabled
  - Vitest workspace configuration in `vitest.workspace.ts`

### Linting

- `eslint.config.mjs` - Root ESLint configuration
- Each project has its own `eslint.config.mjs`
- Uses @typescript-eslint for TypeScript linting

### Testing

- Vitest configured for all Node.js libraries
- Each library has `vitest.config.mts`
- Test files: `*.spec.ts`

## Infrastructure

### Docker Development Environment

Path: `docker/docker-compose.dev.yml`

Services configured:
- PostgreSQL 16 (port 5432)
- InfluxDB 2.7 (port 8086)
- Telegraf 1.31 (ports 8125, 8092, 8094)
- Grafana 11.3 (port 3000)
- Redis 7 (port 6379)
- MinIO (ports 9000, 9001)

### CI/CD

Path: `.github/workflows/ci.yml`

Pipeline stages:
1. Lint (ESLint on affected projects)
2. Type Check (TypeScript build on affected projects)
3. Test (Vitest with coverage on affected projects)

Uses Nx affected commands for efficient CI runs.

### Environment Variables

Path: `.env.example`

Configured sections:
- Deployment mode
- Friendly API endpoints (3 environments)
- Anthropic API configuration
- Application ports
- Database configuration (PostgreSQL)
- Time-series database (InfluxDB)
- Grafana configuration
- Redis configuration
- Object storage (MinIO/S3)
- Authentication & security
- IoT configuration
- Builder configuration
- Licensing & billing
- Audit & logging
- Feature flags
- Development tools

## Documentation

Path: `docs/`

- `docusaurus.config.js` - Docusaurus configuration
- `package.json` - Docs dependencies
- `README.md` - Documentation setup guide
- Reference documents (Word format):
  - System Specification v2.2
  - Module Reference v2.2
  - Phase 1 Prompt Playbook

## Library Exports

All libraries export a placeholder constant:

```typescript
export const MODULE_NAME = 'library-name';
```

This serves as a stub for future business logic implementation.

## Build Targets

Each project has the following targets configured:

- `build` - Compile TypeScript to JavaScript
- `test` - Run Vitest tests
- `lint` - Run ESLint
- `serve` - Start development server (apps only)

## Nx Commands Reference

```bash
# View all projects
pnpm exec nx show projects

# View project details
pnpm exec nx show project <project-name>

# Build a project
pnpm exec nx build <project-name>

# Test a project
pnpm exec nx test <project-name>

# Lint a project
pnpm exec nx lint <project-name>

# Serve an app
pnpm exec nx serve <app-name>

# Run affected projects
pnpm exec nx affected --target=build
pnpm exec nx affected --target=test
pnpm exec nx affected --target=lint

# Visualize project graph
pnpm exec nx graph
```

## Next Steps

This scaffold provides the foundation for the Friendly AI AEP Tool. The next steps are:

1. Implement business logic in each library
2. Define data schemas (Prisma, InfluxDB)
3. Implement API endpoints in the gateway
4. Build out the Angular builder UI
5. Integrate Anthropic LLM capabilities
6. Implement IoT data ingestion pipeline
7. Create Grafana dashboards and provisioning
8. Implement authentication and authorization
9. Add comprehensive tests
10. Set up deployment pipelines

## Architecture Compliance

This scaffold follows the System Specification v2.2, Section 3.2 requirements:
- ✅ Nx 19+ (using 22.6.4)
- ✅ TypeScript 5.4+ strict mode
- ✅ pnpm as package manager
- ✅ All required applications created
- ✅ All required libraries created as stubs
- ✅ Path aliases configured with @friendly-tech scope
- ✅ Vitest as default test runner
- ✅ ESLint with TypeScript configuration
- ✅ GitHub Actions CI workflow
- ✅ Docker Compose development environment
- ✅ Environment variable configuration
- ✅ Documentation structure
