# Contributing to Friendly-AIAEP

Thank you for your interest in contributing to Friendly-AIAEP!

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 10.x or higher  
- Git, Docker, PostgreSQL 16.x

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Set up environment: `cp .env.example .env`
4. Start services: `docker-compose up -d`
5. Run migrations: `pnpm prisma migrate dev`

## Development Workflow

### Branch Naming
- feature/ - New features
- fix/ - Bug fixes
- docs/ - Documentation
- refactor/ - Code refactoring

### Commit Messages
Follow Conventional Commits:
```
type(scope): description

Fixes #123
```

## Testing
```bash
pnpm nx affected -t test
pnpm nx affected -t lint
pnpm nx affected -t build
```

## Pull Requests

1. Update your branch from upstream/main
2. Run all checks locally
3. Fill out PR template
4. Request review

See full guidelines in project documentation.
