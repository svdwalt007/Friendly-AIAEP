# syntax=docker/dockerfile:1.4

# ==============================================================================
# AEP Preview Host - Production-Ready Dockerfile
# ==============================================================================
# Features:
# - BuildKit optimization with cache mounts
# - Multi-stage builds for minimal image size
# - Security hardening with non-root user
# - Docker-in-Docker capability for preview containers
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
COPY --chown=node:node apps/aep-preview-host/project.json apps/aep-preview-host/
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
RUN pnpm nx build aep-preview-host --configuration=production

# ------------------------------------------------------------------------------
# Production Stage: Minimal runtime image with Docker CLI
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install security updates and runtime dependencies
# Note: docker-cli is required for managing preview containers
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    dumb-init \
    wget \
    ca-certificates \
    tzdata \
    docker-cli

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    TZ=UTC

# Set working directory
WORKDIR /app

# Copy built application AND node_modules from build stage
COPY --from=build --chown=node:node /app/dist/apps/aep-preview-host ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# Security: Create docker group with specific GID for socket access
# This GID should match the host's docker group GID
RUN addgroup -g 999 docker || true && \
    addgroup node docker || true

# Create necessary directories for preview host operations
RUN mkdir -p /app/tmp /app/logs && \
    chown -R node:node /app/tmp /app/logs

# Security: Remove unnecessary packages and files
RUN rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.cache

# Security: Switch to non-root user
# Note: User needs docker group membership for Docker socket access
USER node

# Expose application port
EXPOSE 46001

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:46001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "main.js"]

# ==============================================================================
# Build Instructions:
# ==============================================================================
# Development build:
#   docker build -f apps/aep-preview-host/Dockerfile -t aep-preview-host:dev .
#
# Production build with BuildKit:
#   DOCKER_BUILDKIT=1 docker build -f apps/aep-preview-host/Dockerfile -t aep-preview-host:prod .
#
# Build with specific stage:
#   docker build --target runner -f apps/aep-preview-host/Dockerfile -t aep-preview-host:latest .
#
# Run with Docker socket access:
#   docker run -v /var/run/docker.sock:/var/run/docker.sock aep-preview-host:latest
#
# Security scan:
#   docker scan aep-preview-host:latest
#   trivy image aep-preview-host:latest
#
# ==============================================================================
# Security Notes:
# ==============================================================================
# - This container requires access to Docker socket for preview container management
# - Ensure proper GID mapping for docker group (default: 999)
# - Run with appropriate security contexts in production
# - Consider using Docker rootless mode for enhanced security
# - Monitor container resource usage and implement appropriate limits
# ==============================================================================
