# Usage Examples

This document provides practical examples for using the Prisma schema library.

## Table of Contents

- [Basic CRUD Operations](#basic-crud-operations)
- [Fastify Integration](#fastify-integration)
- [Express Integration](#express-integration)
- [Service Layer Pattern](#service-layer-pattern)
- [Repository Pattern](#repository-pattern)
- [Testing](#testing)
- [Advanced Patterns](#advanced-patterns)

## Basic CRUD Operations

### Creating Records

```typescript
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

const tenantClient = createTenantScopedClient('tenant-123');

// Create a single record
const user = await tenantClient.user.create({
  data: {
    email: 'john@example.com',
    name: 'John Doe',
    role: 'DEVELOPER',
  },
});

// Create with nested relations
const project = await tenantClient.project.create({
  data: {
    name: 'My Project',
    description: 'Project description',
    owner: {
      connect: { id: user.id },
    },
    members: {
      create: [
        { userId: user.id, role: 'ADMIN' },
      ],
    },
  },
  include: {
    owner: true,
    members: true,
  },
});

// Create many records
const users = await tenantClient.user.createMany({
  data: [
    { email: 'user1@example.com', name: 'User 1' },
    { email: 'user2@example.com', name: 'User 2' },
    { email: 'user3@example.com', name: 'User 3' },
  ],
});
```

### Reading Records

```typescript
// Find all
const projects = await tenantClient.project.findMany();

// Find with filtering
const activeProjects = await tenantClient.project.findMany({
  where: {
    status: 'ACTIVE',
  },
  orderBy: {
    createdAt: 'desc',
  },
});

// Find with pagination
const page = await tenantClient.project.findMany({
  skip: 20,
  take: 10,
  orderBy: {
    createdAt: 'desc',
  },
});

// Find first matching
const project = await tenantClient.project.findFirst({
  where: {
    name: { contains: 'AI' },
  },
});

// Find unique
const user = await tenantClient.user.findUnique({
  where: { id: 'user-123' },
  include: {
    projects: true,
    teams: true,
  },
});

// Count records
const projectCount = await tenantClient.project.count({
  where: { status: 'ACTIVE' },
});
```

### Updating Records

```typescript
// Update single record
const updatedProject = await tenantClient.project.update({
  where: { id: 'project-123' },
  data: {
    name: 'Updated Project Name',
    description: 'Updated description',
  },
});

// Update many records
const result = await tenantClient.project.updateMany({
  where: { status: 'DRAFT' },
  data: { status: 'PENDING_REVIEW' },
});

console.log(`Updated ${result.count} projects`);

// Upsert (update or create)
const project = await tenantClient.project.upsert({
  where: { id: 'project-123' },
  create: {
    id: 'project-123',
    name: 'New Project',
  },
  update: {
    name: 'Updated Project',
  },
});
```

### Deleting Records

```typescript
// Delete single record
const deleted = await tenantClient.project.delete({
  where: { id: 'project-123' },
});

// Delete many records
const result = await tenantClient.project.deleteMany({
  where: {
    status: 'ARCHIVED',
    createdAt: {
      lt: new Date('2024-01-01'),
    },
  },
});

console.log(`Deleted ${result.count} projects`);
```

## Fastify Integration

### Basic Setup

```typescript
import Fastify from 'fastify';
import { createTenantScopedClient, TenantScopingError } from '@friendly-tech/data/prisma-schema';

const app = Fastify({ logger: true });

// Middleware to extract tenantId and create scoped client
app.decorateRequest('tenantClient', null);

app.addHook('onRequest', async (request, reply) => {
  // Extract tenantId from authenticated user
  const tenantId = request.user?.tenantId;

  if (!tenantId) {
    reply.code(401).send({ error: 'Tenant ID not found' });
    return;
  }

  try {
    request.tenantClient = createTenantScopedClient(tenantId);
  } catch (error) {
    if (error instanceof TenantScopingError) {
      reply.code(400).send({ error: error.message });
      return;
    }
    throw error;
  }
});

// Cleanup hook
app.addHook('onResponse', async (request, reply) => {
  if (request.tenantClient) {
    await request.tenantClient.$disconnect();
  }
});

// Routes
app.get('/projects', async (request, reply) => {
  const projects = await request.tenantClient.project.findMany({
    include: {
      owner: true,
    },
  });

  return { projects };
});

app.post('/projects', async (request, reply) => {
  const { name, description } = request.body as any;

  const project = await request.tenantClient.project.create({
    data: {
      name,
      description,
      ownerId: request.user.id,
    },
  });

  return { project };
});

app.listen({ port: 3000 });
```

### With Fastify Plugin

```typescript
import fp from 'fastify-plugin';
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

export default fp(async function (fastify, opts) {
  fastify.decorateRequest('tenantClient', null);

  fastify.addHook('onRequest', async (request, reply) => {
    const tenantId = request.user?.tenantId;
    if (tenantId) {
      request.tenantClient = createTenantScopedClient(tenantId);
    }
  });

  fastify.addHook('onResponse', async (request) => {
    await request.tenantClient?.$disconnect();
  });
});
```

## Express Integration

```typescript
import express from 'express';
import { createTenantScopedClient, TenantScopingError } from '@friendly-tech/data/prisma-schema';

const app = express();
app.use(express.json());

// Middleware to create tenant-scoped client
app.use((req, res, next) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(401).json({ error: 'Tenant ID not found' });
  }

  try {
    req.tenantClient = createTenantScopedClient(tenantId);
    next();
  } catch (error) {
    if (error instanceof TenantScopingError) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Cleanup middleware
app.use((req, res, next) => {
  res.on('finish', async () => {
    await req.tenantClient?.$disconnect();
  });
  next();
});

// Routes
app.get('/projects', async (req, res) => {
  const projects = await req.tenantClient.project.findMany();
  res.json({ projects });
});

app.post('/projects', async (req, res) => {
  const { name, description } = req.body;
  const project = await req.tenantClient.project.create({
    data: { name, description, ownerId: req.user.id },
  });
  res.json({ project });
});

app.listen(3000);
```

## Service Layer Pattern

```typescript
import { createTenantScopedClient, type TenantScopedClient } from '@friendly-tech/data/prisma-schema';

// Base service class
abstract class BaseService {
  constructor(protected readonly client: TenantScopedClient) {}
}

// Project service
class ProjectService extends BaseService {
  async findAll(filters?: { status?: string; search?: string }) {
    return this.client.project.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        owner: true,
        members: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string) {
    return this.client.project.findUnique({
      where: { id },
      include: {
        owner: true,
        members: true,
        tasks: true,
      },
    });
  }

  async create(data: {
    name: string;
    description?: string;
    ownerId: string;
  }) {
    return this.client.project.create({
      data,
      include: {
        owner: true,
      },
    });
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    status?: string;
  }) {
    return this.client.project.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.client.project.delete({
      where: { id },
    });
  }

  async addMember(projectId: string, userId: string, role: string) {
    return this.client.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
    });
  }
}

// User service
class UserService extends BaseService {
  async findAll() {
    return this.client.user.findMany({
      include: {
        projects: true,
      },
    });
  }

  async findById(id: string) {
    return this.client.user.findUnique({
      where: { id },
      include: {
        projects: true,
        teams: true,
      },
    });
  }

  async create(data: { email: string; name: string; role?: string }) {
    return this.client.user.create({
      data,
    });
  }
}

// Usage in route handlers
app.get('/projects', async (request, reply) => {
  const tenantClient = createTenantScopedClient(request.user.tenantId);
  const projectService = new ProjectService(tenantClient);

  try {
    const projects = await projectService.findAll({
      status: request.query.status,
      search: request.query.search,
    });
    return { projects };
  } finally {
    await tenantClient.$disconnect();
  }
});
```

## Repository Pattern

```typescript
import type { TenantScopedClient } from '@friendly-tech/data/prisma-schema';

// Base repository
abstract class BaseRepository<T> {
  constructor(protected readonly client: TenantScopedClient) {}

  abstract get model(): any;

  async findAll(options?: { skip?: number; take?: number }) {
    return this.model.findMany({
      skip: options?.skip,
      take: options?.take,
    });
  }

  async findById(id: string) {
    return this.model.findUnique({ where: { id } });
  }

  async create(data: any) {
    return this.model.create({ data });
  }

  async update(id: string, data: any) {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.model.delete({ where: { id } });
  }

  async count() {
    return this.model.count();
  }
}

// Project repository
class ProjectRepository extends BaseRepository<any> {
  get model() {
    return this.client.project;
  }

  async findByStatus(status: string) {
    return this.model.findMany({
      where: { status },
    });
  }

  async findByOwner(ownerId: string) {
    return this.model.findMany({
      where: { ownerId },
      include: { members: true },
    });
  }
}

// User repository
class UserRepository extends BaseRepository<any> {
  get model() {
    return this.client.user;
  }

  async findByEmail(email: string) {
    return this.model.findUnique({
      where: { email },
    });
  }

  async findWithProjects(userId: string) {
    return this.model.findUnique({
      where: { id: userId },
      include: {
        projects: true,
        teams: true,
      },
    });
  }
}

// Usage
const tenantClient = createTenantScopedClient('tenant-123');
const projectRepo = new ProjectRepository(tenantClient);
const userRepo = new UserRepository(tenantClient);

const projects = await projectRepo.findByStatus('ACTIVE');
const user = await userRepo.findByEmail('user@example.com');
```

## Testing

### Unit Testing with Vitest

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';
import { ProjectService } from './project.service';

// Mock the Prisma client
vi.mock('@friendly-tech/data/prisma-schema', () => ({
  createTenantScopedClient: vi.fn(),
}));

describe('ProjectService', () => {
  let mockClient: any;
  let projectService: ProjectService;

  beforeEach(() => {
    mockClient = {
      project: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      $disconnect: vi.fn(),
    };

    vi.mocked(createTenantScopedClient).mockReturnValue(mockClient);
    projectService = new ProjectService(mockClient);
  });

  it('should find all projects', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];

    mockClient.project.findMany.mockResolvedValue(mockProjects);

    const result = await projectService.findAll();

    expect(result).toEqual(mockProjects);
    expect(mockClient.project.findMany).toHaveBeenCalledOnce();
  });

  it('should create a project', async () => {
    const projectData = {
      name: 'New Project',
      description: 'Test project',
      ownerId: 'user-123',
    };

    const mockProject = { id: '1', ...projectData };
    mockClient.project.create.mockResolvedValue(mockProject);

    const result = await projectService.create(projectData);

    expect(result).toEqual(mockProject);
    expect(mockClient.project.create).toHaveBeenCalledWith({
      data: projectData,
      include: { owner: true },
    });
  });
});
```

### Integration Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

describe('Project Integration Tests', () => {
  let tenantClient: any;
  const testTenantId = 'test-tenant-123';

  beforeAll(() => {
    tenantClient = createTenantScopedClient(testTenantId);
  });

  afterAll(async () => {
    await tenantClient.$disconnect();
  });

  it('should create and retrieve a project', async () => {
    const project = await tenantClient.project.create({
      data: {
        name: 'Test Project',
        description: 'Integration test',
      },
    });

    expect(project.id).toBeDefined();
    expect(project.tenantId).toBe(testTenantId);

    const retrieved = await tenantClient.project.findUnique({
      where: { id: project.id },
    });

    expect(retrieved).toEqual(project);
  });
});
```

## Advanced Patterns

### Transaction with Multiple Operations

```typescript
const result = await tenantClient.$transaction(async (tx) => {
  // Create user
  const user = await tx.user.create({
    data: {
      email: 'user@example.com',
      name: 'John Doe',
    },
  });

  // Create project owned by user
  const project = await tx.project.create({
    data: {
      name: 'User Project',
      ownerId: user.id,
    },
  });

  // Add user as project member
  const member = await tx.projectMember.create({
    data: {
      projectId: project.id,
      userId: user.id,
      role: 'ADMIN',
    },
  });

  return { user, project, member };
});

console.log('Created user, project, and membership:', result);
```

### Batch Operations with Error Handling

```typescript
async function batchCreateProjects(
  tenantClient: TenantScopedClient,
  projects: Array<{ name: string; description?: string }>
) {
  const results = {
    successful: [] as any[],
    failed: [] as Array<{ project: any; error: string }>,
  };

  for (const projectData of projects) {
    try {
      const project = await tenantClient.project.create({
        data: projectData,
      });
      results.successful.push(project);
    } catch (error) {
      results.failed.push({
        project: projectData,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
```

### Complex Queries with Aggregation

```typescript
// Get project statistics
const stats = await tenantClient.project.aggregate({
  _count: {
    id: true,
  },
  _max: {
    createdAt: true,
  },
  _min: {
    createdAt: true,
  },
  where: {
    status: 'ACTIVE',
  },
});

// Group by status
const grouped = await tenantClient.project.groupBy({
  by: ['status'],
  _count: {
    id: true,
  },
  orderBy: {
    status: 'asc',
  },
});
```

### Cursor-based Pagination

```typescript
async function getPaginatedProjects(
  tenantClient: TenantScopedClient,
  cursor?: string,
  limit = 10
) {
  const projects = await tenantClient.project.findMany({
    take: limit + 1,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
    orderBy: {
      createdAt: 'desc',
    },
  });

  const hasMore = projects.length > limit;
  const items = hasMore ? projects.slice(0, -1) : projects;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
```

### Soft Delete Pattern

```typescript
// Extend client with soft delete
const extendedClient = tenantClient.$extends({
  model: {
    $allModels: {
      async softDelete<T>(this: T, id: string): Promise<any> {
        const context = Prisma.getExtensionContext(this);

        return (context as any).update({
          where: { id },
          data: {
            deletedAt: new Date(),
          },
        });
      },
    },
  },
});

// Usage
await extendedClient.project.softDelete('project-123');
```

## More Examples

For more detailed information, see [TENANT_SCOPING.md](./TENANT_SCOPING.md).
