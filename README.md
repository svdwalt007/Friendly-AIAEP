"# Friendly AI AEP Tool

An Agent Execution Platform for building, deploying, and managing AI agents with integrated IoT capabilities.

## Overview

The Friendly AI AEP Tool is a comprehensive platform that combines AI agent orchestration with IoT data management and visualization. Built as an Nx monorepo, it provides a modular architecture for creating sophisticated AI-powered applications.

## Architecture

This is an Nx monorepo with the following structure:

### Applications (`apps/`)

- **aep-api-gateway** - Fastify-based API gateway (Node.js)
- **aep-builder** - Angular 17+ builder interface with standalone components
- **aep-preview-host** - Express-based preview server (Node.js)

### Libraries (`libs/`)

#### Core Services (`libs/core/`)
- `agent-runtime` - AI agent execution runtime
- `llm-providers` - LLM provider integrations (Anthropic, etc.)
- `builder-orchestrator` - Builder workflow orchestration
- `project-registry` - Project and workspace management
- `policy-service` - Policy and governance enforcement
- `license-service` - License management
- `billing-service` - Billing and subscription management
- `audit-service` - Audit logging and compliance

#### IoT Integration (`libs/iot/`)
- `swagger-ingestion` - OpenAPI/Swagger ingestion for IoT APIs
- `auth-adapter` - Authentication adapter for IoT endpoints
- `sdk-generator` - SDK generation for IoT integrations
- `iot-tool-functions` - Tool functions for IoT operations
- `mock-api-server` - Mock API server for testing

#### Builder Features (`libs/builder/`)
- `page-composer` - Visual page composition
- `widget-registry` - Widget/component registry
- `codegen` - Code generation engine
- `preview-runtime` - Live preview runtime
- `publish-service` - Project publishing service
- `git-service` - Git integration for version control
- `environment-service` - Environment configuration management
- `template-marketplace` - Template marketplace integration

#### UI Components (`libs/ui/`)
- `iot-ui` - Publishable Angular library for IoT UI components

#### Grafana Integration (`libs/grafana/`)
- `provisioning` - Grafana provisioning automation
- `dashboard-templates` - Dashboard template library
- `theme` - Custom Grafana themes

#### Data Management (`libs/data/`)
- `prisma-schema` - Prisma database schemas
- `influx-schemas` - InfluxDB time-series schemas
- `telegraf-ingest-config` - Telegraf configuration for IoT data ingestion

#### Deployment (`libs/deploy/`)
- `docker-generator` - Docker configuration generation
- `helm-generator` - Helm chart generation

## Tech Stack

- **Framework**: Nx 22+ monorepo
- **Package Manager**: pnpm 10.x
- **Language**: TypeScript 5.4+ (strict mode)
- **Backend**: Node.js with Fastify/Express
- **Frontend**: Angular 17+ with standalone components
- **Testing**: Vitest
- **Linting**: ESLint with @typescript-eslint
- **Database**: PostgreSQL (Prisma ORM)
- **Time-Series DB**: InfluxDB
- **Cache**: Redis
- **Object Storage**: MinIO (S3-compatible)
- **Visualization**: Grafana
- **IoT Data Ingestion**: Telegraf

## Getting Started

### Prerequisites

- Node.js 20.x or later
- pnpm 10.x or later
- Docker and Docker Compose (for local development infrastructure)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development infrastructure (PostgreSQL, InfluxDB, Grafana, etc.)
docker compose -f docker/docker-compose.dev.yml up -d
```

### Development

```bash
# Start API Gateway
pnpm exec nx serve aep-api-gateway

# Start Builder UI
pnpm exec nx serve aep-builder

# Start Preview Host
pnpm exec nx serve aep-preview-host

# Run tests for affected projects
pnpm exec nx affected --target=test

# Lint affected projects
pnpm exec nx affected --target=lint

# Build all projects
pnpm run build

# Visualize project dependencies
pnpm run graph
```

### Running Specific Projects

```bash
# Run a specific application
pnpm exec nx serve <app-name>

# Build a specific library
pnpm exec nx build <lib-name>

# Test a specific library
pnpm exec nx test <lib-name>
```

## Project Structure

```
friendly-aiaep/
├── apps/                    # Applications
│   ├── aep-api-gateway/    # Fastify API Gateway
│   ├── aep-builder/        # Angular Builder UI
│   └── aep-preview-host/   # Express Preview Server
├── libs/                    # Shared libraries
│   ├── core/               # Core services
│   ├── iot/                # IoT integration
│   ├── builder/            # Builder features
│   ├── ui/                 # UI components
│   ├── grafana/            # Grafana integration
│   ├── data/               # Data schemas
│   └── deploy/             # Deployment utilities
├── docker/                  # Docker configurations
│   └── docker-compose.dev.yml
├── docs/                    # Documentation (Docusaurus)
├── .github/                 # GitHub Actions CI/CD
│   └── workflows/
│       └── ci.yml
├── nx.json                  # Nx configuration
├── tsconfig.base.json       # TypeScript base config
├── package.json             # Root package.json
└── .env.example             # Environment variables template
```

## Path Aliases

All libraries are accessible via scoped imports:

```typescript
import { MODULE_NAME } from '@friendly-tech/core/agent-runtime';
import { MODULE_NAME } from '@friendly-tech/iot/swagger-ingestion';
import { MODULE_NAME } from '@friendly-tech/builder/page-composer';
import { MODULE_NAME } from '@friendly-tech/ui/iot-ui';
import { MODULE_NAME } from '@friendly-tech/grafana/provisioning';
import { MODULE_NAME } from '@friendly-tech/data/prisma-schema';
import { MODULE_NAME } from '@friendly-tech/deploy/docker-generator';
```

## CI/CD

GitHub Actions workflow runs on push and pull requests:

1. **Lint** - ESLint on affected projects
2. **Type Check** - TypeScript compilation on affected projects
3. **Test** - Vitest with coverage on affected projects

## Documentation

Documentation is located in the `docs/` directory and uses Docusaurus.

```bash
cd docs
pnpm install
pnpm start
```

See [docs/README.md](docs/README.md) for more information.

## License

UNLICENSED - Private/Proprietary

## Reference

- System Specification: `docs/Friendly_AI_AEP_System_Specification_v2.2.docx`
- Module Reference: `docs/Friendly_AI_AEP_Module_Reference_v2.2.docx`
- Phase 1 Playbook: `docs/Friendly_AI_AEP_Phase1_Prompt_Playbook.docx`" 
