# Documentation Guide

This project maintains comprehensive documentation in the [`docs/`](./docs/) folder.

## Quick Links

- **[Full Documentation Index](./docs/README.md)** - Complete documentation structure
- **[Getting Started](./docs/getting-started/GETTING-STARTED.md)** - New user guide
- **[Quick Start - Environments](./docs/getting-started/QUICK-START-ENVIRONMENTS.md)** - Fast environment setup
- **[Port Allocation](./PORT-ALLOCATION.md)** - Service port assignments (root-level reference)

## Documentation Structure

```
docs/
├── getting-started/       # Setup guides, quick starts, troubleshooting
├── architecture/          # System design, specifications, structure
├── guides/                # How-to guides, workflows, migration docs
├── development/           # Implementation details, build fixes, UI/UX
├── deployment/            # Docker, K8s, CI/CD, environment configs
├── testing/               # Test strategies, coverage, infrastructure
├── security/              # Security policies, performance, best practices
├── api-reference/         # API docs, module references, integrations
├── contributing/          # Contribution guidelines, code of conduct
└── observability/         # Monitoring, metrics, logging, tracing
```

## Root-Level Files

The following files remain in the project root for quick access:

- **[README.md](./README.md)** - Project overview and main entry point
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant configuration
- **[PORT-ALLOCATION.md](./PORT-ALLOCATION.md)** - Critical port reference

## Common Tasks

### Setting Up Development Environment
1. [Quick Start - Environments](./docs/getting-started/QUICK-START-ENVIRONMENTS.md)
2. [Environment Setup Summary](./docs/getting-started/ENVIRONMENT-SETUP-SUMMARY.md)
3. [Setup Checklist](./docs/getting-started/SETUP-CHECKLIST.md)

### Understanding the Architecture
1. [System Specification](./docs/architecture/SYSTEM-SPECIFICATION.md)
2. [Architecture Workflow](./docs/architecture/ARCHITECTURE-WORKFLOW.md)
3. [Environment Architecture](./docs/architecture/ENVIRONMENT-ARCHITECTURE.md)

### Deployment
1. [Deployment Guide](./docs/guides/DEPLOYMENT-GUIDE.md)
2. [Docker Guide](./docs/deployment/DOCKER-GUIDE.md)
3. [Multi-Environment Strategy](./docs/deployment/MULTI-ENVIRONMENT.md)

### Security & Performance
1. [Quick Start - Security & Performance](./docs/security/QUICK-START-SECURITY-PERFORMANCE.md)
2. [Security Best Practices](./docs/security/BEST-PRACTICES.md)
3. [Security & Performance Enhancements](./docs/security/SECURITY-PERFORMANCE-ENHANCEMENTS.md)

### Testing
1. [Testing Strategy](./docs/testing/TESTING-STRATEGY.md)
2. [E2E Testing Guide](./docs/testing/E2E-TESTING.md)
3. [Testing Infrastructure](./docs/testing/TESTING-INFRASTRUCTURE.md)

### Observability
1. [Observability Quick Start](./docs/guides/OBSERVABILITY-QUICKSTART.md)
2. [Observability Implementation](./docs/observability/OBSERVABILITY-IMPLEMENTATION.md)
3. [Monitoring Guide](./docs/guides/MONITORING-GUIDE.md)

## Finding Documentation

### By Topic
See the [Full Documentation Index](./docs/README.md) for a complete categorized listing.

### By Search
Use your IDE's search or `grep` to find specific topics:
```bash
# Search all documentation
grep -r "your search term" docs/

# Find files by name
find docs/ -name "*keyword*.md"
```

## Contributing to Documentation

Documentation follows these standards:
- GitHub-flavored Markdown
- Clear hierarchical structure
- Code examples with syntax highlighting
- Cross-references to related docs

See [Contributing Guide](./docs/contributing/CONTRIBUTING.md) for details.

---

**Need help?** Start with the [Getting Started Guide](./docs/getting-started/GETTING-STARTED.md)
