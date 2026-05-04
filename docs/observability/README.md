# Observability Documentation

This folder contains comprehensive documentation for the observability infrastructure of the Friendly AI AEP platform.

## Contents

- **[Observability Implementation](./OBSERVABILITY-IMPLEMENTATION.md)** - Complete observability stack implementation including Prometheus, Grafana, Loki, and Tempo

## Quick Start

For a quick start guide, see:
- [Observability Quick Start](../guides/OBSERVABILITY-QUICKSTART.md) - Fast-track observability configuration

## Related Documentation

- [Monitoring Guide](../guides/MONITORING-GUIDE.md) - Monitoring setup and best practices
- [Docker Guide](../deployment/DOCKER-GUIDE.md) - Container configuration for observability services
- [Multi-Environment Strategy](../deployment/MULTI-ENVIRONMENT.md) - Environment-specific monitoring

## Observability Stack

The platform uses:
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Loki** - Log aggregation
- **Tempo** - Distributed tracing
- **Telegraf** - Metrics collection agent

## Port Allocations

Observability services use ports in the 49000-49999 range. See [PORT-ALLOCATION.md](../../PORT-ALLOCATION.md) for details.
