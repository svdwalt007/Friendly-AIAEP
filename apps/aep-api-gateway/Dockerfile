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

# ------------------------------------------------------------------------------
# Build Stage: Build the application
# ------------------------------------------------------------------------------
FROM base AS build

# Copy dependencies from deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copy source code
COPY --chown=node:node . .

# Build the application
RUN pnpm nx build aep-api-gateway --configuration=production

# Prune for production deployment
RUN pnpm nx run aep-api-gateway:prune

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

# Copy built application from build stage
COPY --from=build --chown=node:node /app/dist/apps/aep-api-gateway ./

# Enable corepack and install production dependencies with cache mount
RUN corepack enable && corepack prepare pnpm@10 --activate && \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Security: Remove unnecessary packages and files
RUN rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.cache

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
