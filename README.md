# Friendly-AIAEP

**AI-Powered IoT Application Builder Platform**

[![CI](https://github.com/svdwalt007/Friendly-AIAEP/actions/workflows/ci.yml/badge.svg)](https://github.com/svdwalt007/Friendly-AIAEP/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.4.0-blue.svg)](https://www.typescriptlang.org/)

---

## Overview

Friendly-AIAEP is an **AI-Powered Application Execution Platform** that enables developers to rapidly build, deploy, and manage IoT applications using conversational AI. Built on LangGraph and Claude AI, the platform transforms natural language requirements into production-ready Angular applications with real-time data visualization, device management, and monitoring capabilities.

**Key Features:**

✅ **AI-Driven Development** - Build apps through conversation with Claude AI agents
✅ **IoT Integration** - Connect to 10,000+ devices via OpenAPI/Swagger ingestion
✅ **Real-Time Dashboards** - Auto-generated Angular apps with live telemetry
✅ **Multi-Tenant SaaS** - Tenant isolation, RBAC, and tier-based billing
✅ **One-Click Deployment** - Docker + Kubernetes with Helm charts
✅ **Complete Monitoring** - Grafana dashboards for apps and platform metrics

**From Concept to Production in ~15 Minutes**

Traditional development: 2-3 weeks → **With Friendly-AIAEP: ~15 minutes**

---

## Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **pnpm** 10.x or higher
- **Docker** and Docker Compose
- **PostgreSQL** 16.x (via Docker)

### Installation

```bash
# Clone the repository
git clone https://github.com/svdwalt007/Friendly-AIAEP.git
cd Friendly-AIAEP

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development infrastructure
docker compose -f docker/docker-compose.dev.yml up -d

# Run database migrations
pnpm prisma migrate dev
```

### Running the Platform

```bash
# Start API Gateway (port 3001)
pnpm nx serve aep-api-gateway

# Start Builder UI (port 4200)
pnpm nx serve aep-builder

# Start Preview Host (port 3002)
pnpm nx serve aep-preview-host
```

Access the builder at: **http://localhost:45000**

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│           Client Layer (Browser/Mobile)             │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │  aep-builder     │    │  Generated IoT Apps  │  │
│  │  (Angular 17+)   │    │  (Published Apps)    │  │
│  └──────────────────┘    └──────────────────────┘  │
└─────────────────┬────────────────┬──────────────────┘
                  │                │
                  ▼                ▼
        ┌─────────────────────────────────┐
        │   aep-api-gateway (Fastify)     │
        │   • JWT Auth, Rate Limiting     │
        │   • WebSocket Agent Streaming   │
        │   • OpenAPI /docs               │
        └───────────┬─────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌──────────┐   ┌──────────┐
│ Core    │   │ Builder  │   │   IoT    │
│ Services│   │ Services │   │ Services │
│         │   │          │   │          │
│• Agents │   │• Page    │   │• Swagger │
│• LLM    │   │  Composer│   │  Ingest  │
│• Billing│   │• Codegen │   │• IoT     │
│• Audit  │   │• Preview │   │  Tools   │
└─────────┘   └──────────┘   └──────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌──────────┐   ┌──────────┐
│PostgreSQL   │ InfluxDB │   │  Redis   │
│ (App Data)  │(Time-Series)│ (Cache)   │
└─────────┘   └──────────┘   └──────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Nx 22+ Monorepo |
| **Language** | TypeScript 5.4+ (strict) |
| **Backend** | Node.js 20+ (Fastify, Express) |
| **Frontend** | Angular 17+ (standalone) |
| **AI/LLM** | LangGraph + Claude Opus 4.6 |
| **Database** | PostgreSQL 16 (Prisma ORM) |
| **Time-Series** | InfluxDB 2.7 |
| **Cache** | Redis 7 |
| **Storage** | MinIO (S3-compatible) |
| **Monitoring** | Grafana 11.3 + Telegraf |
| **Testing** | Vitest 4.1+ |
| **Package Manager** | pnpm 10.x |

---

## Project Structure

```
Friendly-AIAEP/
├── apps/                          # Applications
│   ├── aep-api-gateway/          # Fastify API Gateway
│   ├── aep-builder/              # Angular Builder UI
│   └── aep-preview-host/         # Express Preview Server
├── libs/                          # Libraries
│   ├── core/                     # Core Services
│   │   ├── agent-runtime/        # LangGraph AI Agents
│   │   ├── llm-providers/        # Anthropic + Ollama
│   │   ├── billing-service/      # Stripe Billing
│   │   └── audit-service/        # Compliance Logging
│   ├── iot/                      # IoT Integration
│   │   ├── swagger-ingestion/    # OpenAPI Parser
│   │   ├── iot-tool-functions/   # LangGraph IoT Tools
│   │   └── sdk-generator/        # API Client Gen
│   ├── builder/                  # Builder Features
│   │   ├── page-composer/        # Visual Page Builder
│   │   ├── widget-registry/      # Component Library
│   │   ├── codegen/              # Code Generation
│   │   └── preview-runtime/      # Live Preview
│   ├── data/                     # Data Layer
│   │   ├── prisma-schema/        # PostgreSQL Schemas
│   │   └── influx-schemas/       # Time-Series Schemas
│   ├── grafana/                  # Monitoring
│   │   ├── provisioning/         # Auto-provisioning
│   │   └── dashboard-templates/  # Pre-built Dashboards
│   └── deploy/                   # Deployment
│       ├── docker-generator/     # Dockerfile Gen
│       └── helm-generator/       # K8s Helm Charts
├── .github/                       # CI/CD
│   └── workflows/
│       ├── ci.yml                # Build, Test, Lint
│       └── deploy.yml            # Deploy to K8s
└── docs/                          # Complete Documentation
    ├── getting-started/           # Setup and installation guides
    ├── architecture/              # System design and specifications
    ├── guides/                    # How-to guides and workflows
    ├── development/               # Development processes
    ├── deployment/                # Docker, K8s, CI/CD guides
    ├── testing/                   # Testing strategies
    ├── api-reference/             # API documentation
    ├── security/                  # Security policies
    └── contributing/              # Contribution guidelines
```

---

## Development

### Nx Commands

```bash
# Build all projects
pnpm nx run-many -t build

# Build affected projects only
pnpm nx affected -t build

# Run tests
pnpm nx affected -t test --coverage

# Lint code
pnpm nx affected -t lint

# Visualize project graph
pnpm nx graph

# Clear Nx cache
pnpm nx reset
```

### Path Aliases

Libraries use scoped imports:

```typescript
import { createAgentGraph } from '@friendly-tech/core/agent-runtime';
import { LLMProviderFactory } from '@friendly-tech/core/llm-providers';
import { ingestSwaggerSpec } from '@friendly-tech/iot/swagger-ingestion';
import { GetDeviceListTool } from '@friendly-tech/iot/iot-tool-functions';
import { generateCode } from '@friendly-tech/builder/codegen';
import { PrismaService } from '@friendly-tech/data/prisma-schema';
```

### Running Tests

```bash
# Run all tests
pnpm nx run-many -t test

# Run specific library tests
pnpm nx test llm-providers

# Run with coverage
pnpm nx test llm-providers --coverage

# Watch mode
pnpm nx test llm-providers --watch
```

---

## Key Features

### 1. AI Agent Orchestration (LangGraph)

Three specialized agents work together:

- **Supervisor Agent** - Routes user requests to specialists
- **Planning Agent** - Generates structured build plans with dependencies
- **IoT Domain Agent** - Provides IoT expertise and device queries

**Example Interaction:**

```
User: "Build a dashboard for 10,000 smart meters showing real-time power consumption"

AI Response:
✓ Found 10,234 smart meters
✓ Available metrics: power, voltage, current
✓ Generated build plan with 6 tasks
✓ Ready to execute
```

### 2. IoT Integration

**Swagger/OpenAPI Ingestion:**
- Automatically parse IoT platform APIs
- Support for Basic, Bearer, OAuth2 authentication
- Multi-source spec merging
- Breaking change detection

**LangGraph IoT Tools:**
- `GetDeviceListTool` - Query 10,000+ devices
- `GetDeviceDetailsTool` - Device metadata + LwM2M objects
- `GetDeviceTelemetryTool` - Time-series telemetry data
- `RegisterWebhookTool` - Event webhook registration
- `GetKPIMetricsTool` - Fleet-wide analytics

### 3. Visual Builder + Code Generation

- Drag-and-drop page composer
- Widget library (charts, tables, alerts, maps)
- AI-powered code generation (TypeScript + Angular)
- Live preview with hot-reload
- Docker-based preview runtime

### 4. Multi-Tenant SaaS

**Tenant Isolation:**
- Row-level security in PostgreSQL
- Automatic tenant scoping via Prisma
- JWT-based authentication with tenant claims

**Billing Tiers:**
- **Starter** ($499/mo): 100 req/min, 1M tokens
- **Professional** ($2,499/mo): 500 req/min, 10M tokens
- **Enterprise** ($7,999/mo): 2000 req/min, unlimited tokens

### 5. Production Deployment

**Automated Generation:**
- Dockerfile (multi-stage builds)
- Helm charts (K8s manifests, ConfigMaps, Secrets)
- GitHub Actions CI/CD
- Blue-Green deployment strategy

---

## API Documentation

The API Gateway exposes OpenAPI 3.0 documentation at:

**http://localhost:46000/docs**

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/login` | POST | User authentication |
| `/api/v1/auth/token/refresh` | POST | Refresh JWT token |
| `/api/v1/projects` | GET, POST | Project management |
| `/api/v1/projects/:id/agent` | POST | AI agent interaction |
| `/api/v1/agent/stream` | WebSocket | Real-time agent streaming |
| `/api/v1/projects/:id/preview` | POST | Trigger live preview |
| `/api/v1/projects/:id/publish` | POST | Publish to production |
| `/api/v1/billing/usage` | GET | Usage and billing stats |

---

## Monitoring

### Grafana Dashboards

Access Grafana at: **http://localhost:45001**

**Pre-configured Dashboards:**
- Platform Performance (API Gateway metrics)
- LLM Usage & Costs (token tracking, cost analysis)
- IoT Device Health (10,000+ device monitoring)
- Application Metrics (generated app performance)
- System Resources (CPU, memory, disk, network)

### Telegraf Ingestion

Telegraf automatically collects:
- Device telemetry from IoT APIs
- System metrics (CPU, memory, disk)
- Application metrics (response times, error rates)

Data is stored in InfluxDB and visualized in Grafana.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `pnpm nx affected -t test`
5. Commit using Conventional Commits
6. Push and create a Pull Request

### Conventional Commits

```
feat(agent-runtime): add Claude Opus 4.6 support
fix(swagger-ingestion): handle missing version field
docs(readme): update installation instructions
```

---

## Security

For security vulnerabilities, please see [SECURITY.md](SECURITY.md).

**Report vulnerabilities to:** security@friendly-tech.com

---

## License

UNLICENSED - Proprietary Software

© 2026 Friendly Technologies. All rights reserved.

---

## Documentation

**Complete documentation is now available in the [`/docs`](./docs/) directory**, organized into logical sections:

### 📚 Quick Links

- **[📖 Documentation Home](./docs/README.md)** - Complete documentation index
- **[🚀 Getting Started Guide](./docs/getting-started/GETTING-STARTED.md)** - Setup, debugging, and monitoring
- **[💻 Development Guide](./docs/guides/DEVELOPMENT-GUIDE.md)** - Developer workflows and best practices
- **[🚢 Deployment Guide](./docs/guides/DEPLOYMENT-GUIDE.md)** - Multi-environment deployment
- **[🔒 Security Guide](./docs/security/SECURITY.md)** - Security policies and best practices

### 📂 Documentation Sections

- **[Getting Started](./docs/getting-started/)** - Installation, setup, and quick start guides
- **[Architecture](./docs/architecture/)** - System design and technical specifications
- **[Guides](./docs/guides/)** - How-to guides for common tasks
- **[Development](./docs/development/)** - Development processes and environment setup
- **[Deployment](./docs/deployment/)** - Docker, Kubernetes, CI/CD, and multi-environment strategy
- **[Testing](./docs/testing/)** - Testing strategies, E2E, and coverage reports
- **[API Reference](./docs/api-reference/)** - REST API, WebSocket, and IoT integration
- **[Security](./docs/security/)** - Authentication, authorization, and security best practices
- **[Contributing](./docs/contributing/)** - Contribution guidelines and code of conduct

---

## Support

- **Issues**: [GitHub Issues](https://github.com/svdwalt007/Friendly-AIAEP/issues)
- **Discussions**: [GitHub Discussions](https://github.com/svdwalt007/Friendly-AIAEP/discussions)
- **Email**: support@friendly-tech.com
- **Documentation**: https://docs.friendly-aiaep.com

---

## Environment Support

Friendly AI AEP supports four distinct environments for the complete SDLC:

- **Development (Dev)** - Local development with hot-reload and debug tools
- **Test** - Automated testing and CI/CD integration
- **Pre-Production (Pre-Prod)** - Production-like environment for final validation
- **Production (Prod)** - Live deployment with monitoring and high availability

See [Multi-Environment Strategy](./docs/deployment/MULTI-ENVIRONMENT.md) for details.

---

**Built with ❤️ using Nx, TypeScript, Angular, LangGraph, and Claude AI**
