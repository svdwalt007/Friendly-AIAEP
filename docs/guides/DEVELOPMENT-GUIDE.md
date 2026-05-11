# Development Guide

**Complete Developer Workflows, Coding Standards, and Best Practices**

Welcome to the Friendly AI AEP development guide. This document provides comprehensive guidance for developers contributing to the platform.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Guidelines](#testing-guidelines)
6. [Debugging](#debugging)
7. [Git Workflow](#git-workflow)
8. [Code Review Process](#code-review-process)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

---

## Development Environment Setup

### Prerequisites

**Required Software:**
- **Node.js** 20.x or higher
- **pnpm** 10.33.0 (managed via Corepack)
- **Docker Desktop** 24.x or higher
- **Git** 2.40.x or higher
- **Visual Studio Code** (recommended)

**Optional Tools:**
- **wscat** - WebSocket testing (`npm install -g wscat`)
- **Postman** or **Insomnia** - API testing
- **pgAdmin** or **DBeaver** - Database management
- **Redis Commander** - Redis GUI (`npm install -g redis-commander`)

### IDE Configuration

**Visual Studio Code Extensions:**
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "nrwl.angular-console",
    "angular.ng-template",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**VSCode Settings (.vscode/settings.json):**
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.associations": {
    "*.ts": "typescript"
  }
}
```

### Initial Setup

**1. Clone and Install:**
```bash
# Clone repository
git clone https://github.com/svdwalt007/Friendly-AIAEP.git
cd Friendly-AIAEP

# Install dependencies
pnpm install

# Verify installation
pnpm nx --version
```

**2. Configure Environment:**
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**Critical Environment Variables:**
```env
# Development mode
NODE_ENV=development
DEPLOYMENT_MODE=development

# Anthropic API (required for AI features)
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Database
DATABASE_URL=postgresql://friendly:friendly_dev_password@localhost:46100/friendly_aep

# JWT Secrets (generate secure values)
JWT_SECRET=your-32-character-secret-here
REFRESH_TOKEN_SECRET=your-32-character-refresh-secret
SESSION_SECRET=your-32-character-session-secret
```

**Generate Secure Secrets:**
```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**3. Start Infrastructure:**
```bash
# Start all services
docker compose -f docker/docker-compose.dev.yml up -d

# Verify services are healthy
docker compose -f docker/docker-compose.dev.yml ps

# Check logs
docker compose -f docker/docker-compose.dev.yml logs -f
```

**4. Initialize Database:**
```bash
# Run Prisma migrations
pnpm nx run prisma-schema:migrate

# Seed development data
pnpm nx run prisma-schema:seed
```

**5. Build All Projects:**
```bash
# Full build
pnpm nx run-many -t build

# Watch for changes during development
pnpm nx watch --all -- nx build
```

---

## Project Structure

### Monorepo Organization

```
Friendly-AIAEP/
├── apps/                          # Deployable applications
│   ├── aep-api-gateway/          # Fastify API Gateway
│   ├── aep-builder/              # Angular Builder UI
│   └── aep-preview-host/         # Express Preview Server
│
├── libs/                          # Shared libraries
│   ├── core/                     # Core business logic
│   │   ├── agent-runtime/        # LangGraph AI agents
│   │   ├── llm-providers/        # Claude API integration
│   │   ├── billing-service/      # Stripe billing
│   │   └── audit-service/        # Audit logging
│   │
│   ├── iot/                      # IoT integration
│   │   ├── swagger-ingestion/    # OpenAPI parser
│   │   ├── iot-tool-functions/   # LangGraph IoT tools
│   │   ├── auth-adapter/         # Multi-auth support
│   │   └── sdk-generator/        # API client generation
│   │
│   ├── builder/                  # Builder features
│   │   ├── page-composer/        # Visual page builder
│   │   ├── widget-registry/      # Component library
│   │   ├── codegen/              # Code generation
│   │   └── preview-runtime/      # Live preview
│   │
│   ├── data/                     # Data layer
│   │   ├── prisma-schema/        # PostgreSQL schemas
│   │   └── influx-schemas/       # Time-series schemas
│   │
│   └── deploy/                   # Deployment tools
│       ├── docker-generator/     # Dockerfile generation
│       └── helm-generator/       # K8s Helm charts
│
├── docker/                        # Docker configurations
│   ├── docker-compose.dev.yml    # Development services
│   └── docker-compose.prod.yml   # Production services
│
└── docs/                          # Documentation
```

### Import Path Aliases

**TypeScript Path Mapping (tsconfig.base.json):**
```typescript
// Core services
import { createAgentGraph } from '@friendly-tech/core/agent-runtime';
import { LLMProviderFactory } from '@friendly-tech/core/llm-providers';
import { BillingService } from '@friendly-tech/core/billing-service';

// IoT integration
import { ingestSwaggerSpec } from '@friendly-tech/iot/swagger-ingestion';
import { GetDeviceListTool } from '@friendly-tech/iot/iot-tool-functions';
import { AuthAdapter } from '@friendly-tech/iot/auth-adapter';

// Builder features
import { generateCode } from '@friendly-tech/builder/codegen';
import { WidgetRegistry } from '@friendly-tech/builder/widget-registry';

// Data access
import { PrismaService } from '@friendly-tech/data/prisma-schema';
```

---

## Development Workflow

### Daily Development Workflow

**1. Start of Day:**
```bash
# Pull latest changes
git pull origin main

# Update dependencies
pnpm install

# Start infrastructure
docker compose -f docker/docker-compose.dev.yml up -d

# Build changed projects
pnpm nx affected:build
```

**2. During Development:**
```bash
# Serve application with hot reload
pnpm nx serve aep-api-gateway
pnpm nx serve aep-builder
pnpm nx serve aep-preview-host

# Run tests in watch mode
pnpm nx test [library-name] --watch

# Check affected projects
pnpm nx affected:graph
```

**3. Before Committing:**
```bash
# Lint affected projects
pnpm nx affected:lint

# Run affected tests
pnpm nx affected:test

# Build affected projects
pnpm nx affected:build

# Format code
pnpm nx format:write
```

### Creating New Libraries

**Generate a new library:**
```bash
# TypeScript library
pnpm nx g @nx/node:library my-library --directory=libs/core/my-library

# Angular library
pnpm nx g @nx/angular:library my-library --directory=libs/ui/my-library
```

**Library Structure:**
```
libs/core/my-library/
├── src/
│   ├── lib/
│   │   ├── my-library.ts
│   │   └── my-library.spec.ts
│   └── index.ts
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── tsconfig.spec.json
```

**Update project.json:**
```json
{
  "name": "my-library",
  "tags": ["scope:core", "type:feature"],
  "targets": {
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "options": {
        "outputPath": "dist/libs/core/my-library"
      }
    },
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "config": "libs/core/my-library/vitest.config.ts"
      }
    }
  }
}
```

### Creating New Applications

**Generate a new application:**
```bash
# Node.js application
pnpm nx g @nx/node:application my-app --directory=apps/my-app

# Angular application
pnpm nx g @nx/angular:application my-app --directory=apps/my-app
```

---

## Coding Standards

### TypeScript Guidelines

**1. Strict Type Safety:**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**2. Type Definitions:**
```typescript
// Good: Explicit types
interface User {
  id: string;
  username: string;
  email: string;
  tenantId: string;
  role: UserRole;
}

type UserRole = 'admin' | 'user' | 'viewer';

// Good: Function signatures
async function createUser(
  data: CreateUserDto
): Promise<User> {
  // Implementation
}

// Avoid: Any types
// Bad
function processData(data: any) { }

// Good
function processData<T>(data: T): T {
  return data;
}
```

**3. Naming Conventions:**
```typescript
// Classes: PascalCase
class UserService { }
class AuthAdapter { }

// Interfaces: PascalCase with 'I' prefix (optional)
interface IUserRepository { }
interface User { }

// Functions: camelCase
function getUserById(id: string) { }
async function createProject(data: CreateProjectDto) { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;

// Enums: PascalCase for enum, SCREAMING_SNAKE_CASE for values
enum DeploymentMode {
  DEVELOPMENT = 'DEVELOPMENT',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION'
}
```

**4. File Organization:**
```typescript
// Import order
// 1. External dependencies
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// 2. Internal dependencies (same package)
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

// 3. Types and interfaces
import type { User, UserRole } from './types';

// Class structure
@Injectable()
export class ExampleService {
  // 1. Private fields
  private readonly logger = new Logger(ExampleService.name);

  // 2. Constructor
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  // 3. Public methods
  async publicMethod() { }

  // 4. Private methods
  private privateMethod() { }
}
```

### Code Documentation

**JSDoc Comments:**
```typescript
/**
 * Retrieves a user by their unique identifier.
 *
 * @param userId - The unique identifier of the user
 * @returns Promise resolving to the user object
 * @throws {NotFoundException} When user is not found
 * @throws {DatabaseException} When database connection fails
 *
 * @example
 * ```typescript
 * const user = await userService.getUserById('user_123');
 * console.log(user.username);
 * ```
 */
async getUserById(userId: string): Promise<User> {
  // Implementation
}
```

**Complex Logic Comments:**
```typescript
// Good: Explain WHY, not WHAT
// Calculate expiration using sliding window to prevent session hijacking
const expiresAt = new Date(Date.now() + SESSION_DURATION);

// Bad: Obvious comments
// Set the expires at variable to a new date
const expiresAt = new Date();
```

### Error Handling

**Structured Error Handling:**
```typescript
// Custom error classes
export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

// Usage
try {
  const user = await this.findUser(userId);
  if (!user) {
    throw new UserNotFoundError(userId);
  }
  return user;
} catch (error) {
  if (error instanceof UserNotFoundError) {
    this.logger.warn(error.message);
    throw new NotFoundException(error.message);
  }

  this.logger.error('Unexpected error', error);
  throw new InternalServerErrorException('Failed to retrieve user');
}
```

### Async/Await Best Practices

```typescript
// Good: Parallel execution when possible
const [users, projects, devices] = await Promise.all([
  this.userService.findAll(),
  this.projectService.findAll(),
  this.deviceService.findAll(),
]);

// Good: Error handling
async function fetchData() {
  try {
    const data = await api.getData();
    return data;
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw error;
  }
}

// Avoid: Unnecessary await
// Bad
async function getData() {
  return await fetchFromDb();
}

// Good
async function getData() {
  return fetchFromDb();
}
```

---

## Testing Guidelines

### Test Structure

**Vitest Test Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let mockPrisma: MockPrismaService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new UserService(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const mockUser = { id: 'user_1', username: 'test' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserById('user_1');

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_1' }
      });
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getUserById('invalid_id')
      ).rejects.toThrow(UserNotFoundError);
    });
  });
});
```

### Testing Patterns

**1. Unit Tests:**
```typescript
// Test individual functions in isolation
describe('calculateBillingAmount', () => {
  it('should calculate correct amount for starter tier', () => {
    const result = calculateBillingAmount('STARTER', 100);
    expect(result).toBe(499);
  });

  it('should apply discount for annual billing', () => {
    const result = calculateBillingAmount('STARTER', 100, 'annual');
    expect(result).toBe(4990 * 0.8); // 20% discount
  });
});
```

**2. Integration Tests:**
```typescript
// Test multiple components together
describe('User Registration Flow', () => {
  it('should create user and send welcome email', async () => {
    const userData = { username: 'test', email: 'test@example.com' };

    const user = await userService.create(userData);
    expect(user).toBeDefined();

    expect(emailService.sendWelcome).toHaveBeenCalledWith(
      user.email,
      user.username
    );
  });
});
```

**3. E2E Tests:**
```typescript
// Test complete user journeys
describe('Project Creation E2E', () => {
  it('should create project and launch preview', async () => {
    // Login
    const { token } = await auth.login('demo', 'demo');

    // Create project
    const project = await api.createProject(token, {
      name: 'Test Project'
    });

    // Launch preview
    const preview = await api.launchPreview(token, project.id);
    expect(preview.url).toContain('localhost');

    // Cleanup
    await api.deleteProject(token, project.id);
  });
});
```

### Coverage Goals

**Minimum Coverage Requirements:**
- **Statements**: 80%
- **Branches**: 70%
- **Functions**: 85%
- **Lines**: 80%

**Run coverage:**
```bash
# All projects
pnpm nx run-many -t test --coverage

# Specific library
pnpm nx test swagger-ingestion --coverage

# Generate HTML report
pnpm nx test swagger-ingestion --coverage --coverageReporters=html
```

---

## Debugging

### Debug Configuration

**VSCode Launch Configuration (.vscode/launch.json):**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Gateway",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["nx", "serve", "aep-api-gateway", "--", "--inspect"],
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector",
      "sourceMaps": true
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["nx", "test", "${input:library}", "--watch"],
      "console": "integratedTerminal"
    }
  ],
  "inputs": [
    {
      "id": "library",
      "type": "promptString",
      "description": "Library name to test"
    }
  ]
}
```

### Logging Best Practices

**Structured Logging:**
```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);

  async processData(data: any) {
    this.logger.log('Processing data', { dataId: data.id });

    try {
      const result = await this.process(data);
      this.logger.log('Processing complete', {
        dataId: data.id,
        resultSize: result.length
      });
      return result;
    } catch (error) {
      this.logger.error('Processing failed', error.stack, {
        dataId: data.id,
        errorType: error.name
      });
      throw error;
    }
  }
}
```

### Common Debugging Scenarios

**1. Database Connection Issues:**
```bash
# Check PostgreSQL connection
docker exec -it friendly-postgres psql -U friendly -d friendly_aep

# View connection pool status
SELECT * FROM pg_stat_activity;

# Check Prisma generated client
pnpm nx run prisma-schema:generate
```

**2. WebSocket Connection Issues:**
```bash
# Test WebSocket endpoint
wscat -c "ws://localhost:46000/api/v1/agent/stream?sessionId=test&token=TOKEN"

# Check Redis connection
docker exec -it friendly-redis redis-cli
> PING
PONG
```

**3. Docker Container Issues:**
```bash
# View container logs
docker logs -f friendly-preview-proj_123

# Inspect container
docker inspect friendly-preview-proj_123

# Execute command in container
docker exec -it friendly-preview-proj_123 sh
```

---

## Git Workflow

### Branch Strategy

**Branch Types:**
- **main** - Production-ready code
- **develop** - Integration branch (optional)
- **feature/\*** - New features
- **fix/\*** - Bug fixes
- **chore/\*** - Maintenance tasks
- **docs/\*** - Documentation updates

**Workflow:**
```bash
# Create feature branch
git checkout -b feature/add-device-filter

# Make changes and commit
git add .
git commit -m "feat(iot): add device filtering to GetDeviceListTool"

# Push to remote
git push origin feature/add-device-filter

# Create pull request on GitHub
```

### Commit Message Format

**Conventional Commits:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- **feat** - New feature
- **fix** - Bug fix
- **docs** - Documentation changes
- **style** - Code formatting (no logic change)
- **refactor** - Code restructuring (no behavior change)
- **test** - Adding or updating tests
- **chore** - Build process, dependencies, tooling

**Examples:**
```bash
# Feature
git commit -m "feat(agent-runtime): add retry logic for LLM calls"

# Bug fix
git commit -m "fix(preview-runtime): prevent memory leak in session cleanup"

# Breaking change
git commit -m "feat(auth)!: migrate to JWT from session-based auth

BREAKING CHANGE: All existing sessions will be invalidated"

# Multiple changes
git commit -m "chore: update dependencies

- Update Nx to 22.6.4
- Update Angular to 21.2.0
- Update Fastify to 5.2.1"
```

---

## Code Review Process

### Before Requesting Review

**Checklist:**
- [ ] All tests pass (`pnpm nx affected:test`)
- [ ] Code is linted (`pnpm nx affected:lint`)
- [ ] Code is formatted (`pnpm nx format:check`)
- [ ] Changes are documented
- [ ] Commit messages follow conventions
- [ ] No unnecessary files committed
- [ ] Branch is up to date with main

**Self-Review:**
```bash
# View your changes
git diff main...HEAD

# Check for sensitive data
git diff main...HEAD | grep -i "password\|secret\|token\|key"

# Review affected projects
pnpm nx affected:graph
```

### Creating Pull Requests

**PR Template:**
```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
- [ ] No new warnings
```

### Reviewing Code

**Review Checklist:**
- [ ] Code is clear and maintainable
- [ ] Logic is correct
- [ ] Tests are comprehensive
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Error handling is robust
- [ ] Documentation is complete

---

## Performance Optimization

### Build Performance

**Nx Caching:**
```bash
# Clear cache
pnpm nx reset

# View cache status
pnpm nx show cache

# Disable cache for debugging
NX_SKIP_CACHE=true pnpm nx build my-app
```

**Parallel Execution:**
```bash
# Run tests in parallel
pnpm nx run-many -t test --parallel=5

# Build with parallel execution
pnpm nx run-many -t build --parallel=3
```

### Runtime Performance

**Database Optimization:**
```typescript
// Use select to limit fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    email: true
  }
});

// Use pagination
const users = await prisma.user.findMany({
  take: 20,
  skip: page * 20
});

// Use indexes (in schema.prisma)
model User {
  id String @id
  email String @unique
  tenantId String

  @@index([tenantId])
  @@index([email, tenantId])
}
```

**Caching Strategies:**
```typescript
import { Cache } from '@nestjs/cache-manager';

@Injectable()
export class DeviceService {
  constructor(private cacheManager: Cache) {}

  async getDeviceList(): Promise<Device[]> {
    const cacheKey = 'device:list';

    // Check cache
    const cached = await this.cacheManager.get<Device[]>(cacheKey);
    if (cached) return cached;

    // Fetch from database
    const devices = await this.fetchDevices();

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, devices, 300);

    return devices;
  }
}
```

---

## Troubleshooting

### Common Issues

**1. Module Resolution Errors:**
```bash
# Symptom: Cannot find module '@friendly-tech/...'
# Solution: Rebuild and reset cache
pnpm nx reset
pnpm install
pnpm nx run-many -t build
```

**2. Port Conflicts:**
```bash
# Find process using port
# Linux/macOS
lsof -i :46000

# Windows
netstat -ano | findstr :46000

# Kill process
# Linux/macOS
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

**3. Docker Issues:**
```bash
# Clean up containers
docker compose -f docker/docker-compose.dev.yml down -v

# Remove dangling images
docker image prune -f

# Reset Docker Desktop (last resort)
```

**4. Prisma Issues:**
```bash
# Regenerate Prisma client
pnpm nx run prisma-schema:generate

# Reset database
pnpm nx run prisma-schema:reset

# View database schema
pnpm nx run prisma-schema:studio
```

### Getting Help

**Resources:**
- **Documentation**: `/docs` directory
- **GitHub Issues**: Report bugs and request features
- **Team Chat**: Internal Slack/Teams channel
- **Code Review**: Ask during PR review

---

## Related Documentation

- [Testing Strategy](../testing/TESTING-STRATEGY.md) - Comprehensive testing guide
- [Deployment Guide](./DEPLOYMENT-GUIDE.md) - Deployment procedures
- [Environment Configuration](../development/ENVIRONMENT-CONFIGURATION.md) - Multi-environment setup
- [API Reference](../api-reference/REST-API.md) - Complete API documentation

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology Development Team
