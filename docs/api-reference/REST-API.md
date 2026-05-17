# REST API Reference

**Complete REST API Documentation for Friendly AI AEP**

Comprehensive API reference with endpoints, request/response examples, and authentication.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Project Management](#project-management)
4. [Preview System](#preview-system)
5. [Billing & Usage](#billing--usage)
6. [Health & Monitoring](#health--monitoring)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## API Overview

### Base URL

```
Development: http://localhost:46000
Staging: https://api-staging.friendly-aiaep.com
Production: https://api.friendly-aiaep.com
```

### Swagger Documentation

Interactive API documentation available at:
```
http://localhost:46000/docs
```

### Response Format

**Success Response:**
```json
{
  "status": "success",
  "data": {
    ...
  }
}
```

**Error Response:**
```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

---

## Authentication

### POST /api/v1/auth/login

Authenticate user and receive JWT tokens.

**Request:**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "demo",
  "password": "demo"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user_001",
    "username": "demo",
    "email": "demo@friendly-tech.com",
    "tenantId": "tenant_001",
    "role": "admin"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:46000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
```

### POST /api/v1/auth/token/refresh

Refresh access token using refresh token.

**Request:**
```http
POST /api/v1/auth/token/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

### POST /api/v1/auth/logout

Invalidate current session.

**Request:**
```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

## Project Management

### GET /api/v1/projects

List all projects for authenticated user.

**Request:**
```http
GET /api/v1/projects?page=1&limit=20&sortBy=createdAt&order=desc
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `sortBy` (optional): Sort field (name, createdAt, updatedAt)
- `order` (optional): Sort order (asc, desc)
- `search` (optional): Search by project name

**Response:**
```json
{
  "data": [
    {
      "id": "proj_123456",
      "name": "My IoT Dashboard",
      "description": "Temperature monitoring dashboard",
      "deploymentMode": "saas",
      "status": "active",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T12:00:00Z",
      "tenantId": "tenant_001"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### POST /api/v1/projects

Create a new project.

**Request:**
```http
POST /api/v1/projects
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "My First Dashboard",
  "description": "Temperature and humidity monitoring",
  "deploymentMode": "saas"
}
```

**Response:**
```json
{
  "id": "proj_789012",
  "name": "My First Dashboard",
  "description": "Temperature and humidity monitoring",
  "deploymentMode": "saas",
  "status": "created",
  "createdAt": "2026-04-15T13:00:00Z",
  "tenantId": "tenant_001"
}
```

### GET /api/v1/projects/:id

Get project details.

**Request:**
```http
GET /api/v1/projects/proj_123456
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "proj_123456",
  "name": "My IoT Dashboard",
  "description": "Temperature monitoring dashboard",
  "deploymentMode": "saas",
  "status": "active",
  "pages": [
    {
      "id": "page_001",
      "name": "Dashboard",
      "path": "/dashboard",
      "widgets": [...]
    }
  ],
  "createdAt": "2026-04-15T10:00:00Z",
  "updatedAt": "2026-04-15T12:00:00Z"
}
```

### PUT /api/v1/projects/:id

Update project.

**Request:**
```http
PUT /api/v1/projects/proj_123456
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Dashboard Name",
  "description": "Updated description"
}
```

### DELETE /api/v1/projects/:id

Delete project.

**Request:**
```http
DELETE /api/v1/projects/proj_123456
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Project deleted successfully"
}
```

---

## Preview System

### POST /api/v1/projects/:id/preview

Launch preview for project.

**Request:**
```http
POST /api/v1/projects/proj_123456/preview
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "mode": "mock",
  "duration": 30,
  "hotReload": true
}
```

**Request Body:**
- `mode`: Preview mode ("mock", "live", "disconnected-sim")
- `duration`: Session duration in minutes (max per tier)
- `hotReload`: Enable hot-reload (default: true)

**Response:**
```json
{
  "previewId": "preview_abc123",
  "previewUrl": "http://localhost:4300",
  "mode": "mock",
  "expiresAt": "2026-04-15T14:30:00Z",
  "status": "starting",
  "container": {
    "id": "aep-preview-proj_123456",
    "port": 4300
  }
}
```

### GET /api/v1/projects/:id/preview/:previewId

Get preview status.

**Request:**
```http
GET /api/v1/projects/proj_123456/preview/preview_abc123
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "previewId": "preview_abc123",
  "status": "running",
  "previewUrl": "http://localhost:4300",
  "expiresAt": "2026-04-15T14:30:00Z",
  "uptime": 120,
  "container": {
    "status": "running",
    "memory": "256MB",
    "cpu": "10%"
  }
}
```

### DELETE /api/v1/projects/:id/preview/:previewId

Stop preview.

**Request:**
```http
DELETE /api/v1/projects/proj_123456/preview/preview_abc123
Authorization: Bearer <access_token>
```

---

## Billing & Usage

### GET /api/v1/billing/usage

Get current usage and billing information.

**Request:**
```http
GET /api/v1/billing/usage
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "tier": "PROFESSIONAL",
  "billingPeriod": {
    "start": "2026-04-01T00:00:00Z",
    "end": "2026-05-01T00:00:00Z"
  },
  "usage": {
    "apiRequests": {
      "used": 45230,
      "limit": 500000,
      "percentage": 9.05
    },
    "llmTokens": {
      "used": 2340000,
      "limit": 10000000,
      "percentage": 23.4
    },
    "previewSessions": {
      "active": 2,
      "limit": 10
    },
    "storage": {
      "used": "2.3GB",
      "limit": "50GB",
      "percentage": 4.6
    }
  },
  "cost": {
    "current": 2499.00,
    "projected": 2499.00,
    "currency": "USD"
  }
}
```

### GET /api/v1/billing/invoices

List invoices.

**Request:**
```http
GET /api/v1/billing/invoices?page=1&limit=10
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "inv_202604",
      "period": "2026-04",
      "amount": 2499.00,
      "status": "paid",
      "paidAt": "2026-04-01T00:00:00Z",
      "invoiceUrl": "https://..."
    }
  ],
  "pagination": {...}
}
```

---

## Health & Monitoring

### GET /health

Overall health check.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime": 86400,
  "timestamp": "2026-04-15T14:00:00Z"
}
```

### GET /health/live

Liveness probe.

**Request:**
```http
GET /health/live
```

**Response:**
```json
{
  "status": "ok"
}
```

### GET /health/ready

Readiness probe.

**Request:**
```http
GET /health/ready
```

**Response:**
```json
{
  "status": "ok",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "influxdb": "connected"
  }
}
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or expired token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Error Response Example

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "fields": {
        "name": "Project name is required",
        "deploymentMode": "Must be one of: saas, on-premise, hybrid"
      }
    }
  }
}
```

---

## Rate Limiting

### Limits by Tier

| Tier | Requests/Minute | Burst |
|------|----------------|-------|
| **FREE** | 10 | 20 |
| **STARTER** | 100 | 200 |
| **PROFESSIONAL** | 500 | 1000 |
| **ENTERPRISE** | 2000 | 4000 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1681568400
```

### Rate Limit Exceeded

**Response:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 60 seconds."
  }
}
```

---

## Related Documentation

- [WebSocket API Reference](./WEBSOCKET-API.md)
- [IoT Integration Guide](./IOT-INTEGRATION.md)
- [Authentication Guide](../security/AUTH-GUIDE.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology API Team
