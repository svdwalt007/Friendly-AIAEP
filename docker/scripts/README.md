# Docker Scripts for Friendly AIAEP

This directory contains utility scripts for managing the Friendly AIAEP platform across different environments.

## Available Scripts

See full documentation at: https://github.com/friendly-ai/aep

### Environment Startup Scripts

- **start-dev.sh** - Development environment (full observability stack)
- **start-preprod.sh** - Pre-production environment
- **start-prod.sh** - Production environment

### Port Configuration

All services now use the new port allocation:
- **UI Apps**: 6000-6999
- **APIs/Services**: 7500-8999

See [PORT-ALLOCATION.md](../../PORT-ALLOCATION.md) for complete details.

## Quick Start

```bash
# Development
./start-dev.sh

# Pre-production
./start-preprod.sh

# Production (requires .env.production)
./start-prod.sh
```

## Features

All startup scripts:
- ✅ Build Docker images
- ✅ Start services in correct order
- ✅ Open service logs in separate WSL windows
- ✅ Auto-open monitoring dashboards in browser
- ✅ Display all service URLs and credentials
- ✅ Perform health checks

## Documentation

See individual script files for detailed documentation and usage.
