# syntax=docker/dockerfile:1.4

# ==============================================================================
# AEP API Gateway - Production-Ready Dockerfile
# ==============================================================================
# Features:
# - BuildKit optimization with cache mounts
# - Multi-stage builds for minimal image size
# - Security hardening with non-root user
# - Health checks and proper signal handling
# - Layer caching optimization
# ==============================================================================

# ------------------------------------------------------------------------------
# Base Stage: Common dependencies and setup
# ------------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install security updates
RUN apk upgrade --no-cache

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Set working directory
WORKDIR /app

# Security: Create app user/group (node user already exists in node:alpine)
# Set proper permissions
RUN chown -R node:node /app

# ------------------------------------------------------------------------------
# Dependencies Stage: Install all dependencies with cache mounting
# ------------------------------------------------------------------------------
FROM base AS deps

# Copy package files for dependency installation
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
COPY --chown=node:node apps/aep-api-gateway/project.json apps/aep-api-gateway/
COPY --chown=node:node libs/ libs/

# Install dependencies with BuildKit cache mount for faster rebuilds
# Cache mount persists across builds, significantly speeding up installs
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

# Generate Prisma client before building
RUN pnpm nx run prisma-schema:prisma:generate

# ------------------------------------------------------------------------------
# Build Stage: Build the application
# ------------------------------------------------------------------------------
FROM base AS build

# Copy dependencies from deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/libs/data/prisma-schema/src /app/libs/data/prisma-schema/src

# Copy source code
COPY --chown=node:node . .

# Build the application
RUN pnpm nx build aep-api-gateway --configuration=production

# ------------------------------------------------------------------------------
# Production Stage: Minimal runtime image
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install security updates and runtime dependencies
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    dumb-init \
    wget \
    ca-certificates \
    tzdata

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    TZ=UTC

# Set working directory
WORKDIR /app

# Copy built application AND node_modules from build stage
COPY --from=build --chown=node:node /app/dist/apps/aep-api-gateway ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# Create workspace symlinks for runtime imports
# These packages are imported at runtime via @friendly-tech/* aliases
COPY --from=build --chown=node:node /app/libs ./libs

RUN mkdir -p /app/node_modules/@friendly-tech/builder \
    /app/node_modules/@friendly-tech/iot \
    /app/node_modules/@friendly-tech/core \
    /app/node_modules/@friendly-tech/data \
    /app/node_modules/@friendly-tech/grafana \
    /app/node_modules/@friendly-tech/deploy \
    /app/node_modules/@friendly-tech/ui \
    /app/node_modules/@friendly-aep/shared \
  && ln -s /app/libs/builder/preview-runtime/src/index.js /app/node_modules/@friendly-tech/builder/preview-runtime \
  && ln -s /app/libs/iot/auth-adapter/src/index.js /app/node_modules/@friendly-tech/iot/auth-adapter \
  && ln -s /app/libs/core/agent-runtime/src/index.js /app/node_modules/@friendly-tech/core/agent-runtime \
  && ln -s /app/libs/core/llm-providers/src/index.js /app/node_modules/@friendly-tech/core/llm-providers \
  && ln -s /app/libs/core/builder-orchestrator/src/index.js /app/node_modules/@friendly-tech/core/builder-orchestrator \
  && ln -s /app/libs/core/project-registry/src/index.js /app/node_modules/@friendly-tech/core/project-registry \
  && ln -s /app/libs/core/policy-service/src/index.js /app/node_modules/@friendly-tech/core/policy-service \
  && ln -s /app/libs/core/license-service/src/index.js /app/node_modules/@friendly-tech/core/license-service \
  && ln -s /app/libs/core/billing-service/src/index.js /app/node_modules/@friendly-tech/core/billing-service \
  && ln -s /app/libs/core/audit-service/src/index.js /app/node_modules/@friendly-tech/core/audit-service \
  && ln -s /app/libs/data/prisma-schema/src/index.js /app/node_modules/@friendly-tech/data/prisma-schema \
  && ln -s /app/libs/data/influx-schemas/src/index.js /app/node_modules/@friendly-tech/data/influx-schemas \
  && ln -s /app/libs/data/telegraf-ingest-config/src/index.js /app/node_modules/@friendly-tech/data/telegraf-ingest-config \
  && ln -s /app/libs/grafana/provisioning/src/index.js /app/node_modules/@friendly-tech/grafana/provisioning \
  && ln -s /app/libs/grafana/dashboard-templates/src/index.js /app/node_modules/@friendly-tech/grafana/dashboard-templates \
  && ln -s /app/libs/grafana/theme/src/index.js /app/node_modules/@friendly-tech/grafana/theme \
  && ln -s /app/libs/deploy/docker-generator/src/index.js /app/node_modules/@friendly-tech/deploy/docker-generator \
  && ln -s /app/libs/deploy/helm-generator/src/index.js /app/node_modules/@friendly-tech/deploy/helm-generator \
  && ln -s /app/libs/ui/iot-ui/src/index.js /app/node_modules/@friendly-tech/ui/iot-ui \
  && ln -s /app/libs/shared/observability/src/index.js /app/node_modules/@friendly-aep/shared-observability \
  && ln -s /app/libs/shared/cache/src/index.js /app/node_modules/@friendly-aep/shared-cache \
  && ln -s /app/libs/shared/secrets/src/index.js /app/node_modules/@friendly-aep/shared-secrets \
  && ln -s /app/libs/iot/types-shared/src/index.js /app/node_modules/@friendly-tech/iot/types-shared \
  && ln -s /app/libs/iot/swagger-ingestion/src/index.js /app/node_modules/@friendly-tech/iot/swagger-ingestion \
  && ln -s /app/libs/iot/sdk-generator/src/index.js /app/node_modules/@friendly-tech/iot/sdk-generator \
  && ln -s /app/libs/iot/iot-tool-functions/src/index.js /app/node_modules/@friendly-tech/iot/iot-tool-functions \
  && ln -s /app/libs/iot/mock-api-server/src/index.js /app/node_modules/@friendly-tech/iot/mock-api-server \
  && ln -s /app/libs/builder/page-composer/src/index.js /app/node_modules/@friendly-tech/builder/page-composer \
  && ln -s /app/libs/builder/widget-registry/src/index.js /app/node_modules/@friendly-tech/builder/widget-registry \
  && ln -s /app/libs/builder/codegen/src/index.js /app/node_modules/@friendly-tech/builder/codegen \
  && ln -s /app/libs/builder/publish-service/src/index.js /app/node_modules/@friendly-tech/builder/publish-service \
  && ln -s /app/libs/builder/git-service/src/index.js /app/node_modules/@friendly-tech/builder/git-service \
  && ln -s /app/libs/builder/environment-service/src/index.js /app/node_modules/@friendly-tech/builder/environment-service \
  && ln -s /app/libs/builder/template-marketplace/src/index.js /app/node_modules/@friendly-tech/builder/template-marketplace

# Security: Remove unnecessary packages and files
RUN rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.cache

# Create docker group (GID 1001 on WSL) and add node user for Docker socket access
RUN addgroup -g 1001 dockeraccess 2>/dev/null || true \
    && addgroup node dockeraccess 2>/dev/null || true

# Security: Switch to non-root user
USER node

# Expose application port
EXPOSE 46000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:46000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "main.js"]

# ------------------------------------------------------------------------------
# Optional: Distroless Runtime (Uncomment for maximum security)
# ------------------------------------------------------------------------------
# FROM gcr.io/distroless/nodejs20-debian12:nonroot AS distroless
#
# ENV NODE_ENV=production
# WORKDIR /app
#
# COPY --from=build --chown=nonroot:nonroot /app/dist/apps/aep-api-gateway ./
#
# USER nonroot
# EXPOSE 46000
#
# CMD ["main.js"]

# ==============================================================================
# Build Instructions:
# ==============================================================================
# Development build:
#   docker build -f apps/aep-api-gateway/Dockerfile -t aep-api-gateway:dev .
#
# Production build with BuildKit:
#   DOCKER_BUILDKIT=1 docker build -f apps/aep-api-gateway/Dockerfile -t aep-api-gateway:prod .
#
# Build with specific stage:
#   docker build --target runner -f apps/aep-api-gateway/Dockerfile -t aep-api-gateway:latest .
#
# Security scan:
#   docker scan aep-api-gateway:latest
#   trivy image aep-api-gateway:latest
# ==============================================================================
