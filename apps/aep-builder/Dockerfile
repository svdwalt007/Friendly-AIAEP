# syntax=docker/dockerfile:1.4

# ==============================================================================
# AEP Builder - Production-Ready Dockerfile
# ==============================================================================
# Features:
# - BuildKit optimization with cache mounts
# - Multi-stage builds for minimal image size
# - Nginx with security hardening
# - Optimized compression and caching
# - Health checks and monitoring
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

# Security: Set proper permissions
RUN chown -R node:node /app

# ------------------------------------------------------------------------------
# Dependencies Stage: Install all dependencies with cache mounting
# ------------------------------------------------------------------------------
FROM base AS deps

# Copy package files for dependency installation
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
COPY --chown=node:node apps/aep-builder/project.json apps/aep-builder/
COPY --chown=node:node libs/ libs/

# Install dependencies with BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

# ------------------------------------------------------------------------------
# Build Stage: Build the Angular application
# ------------------------------------------------------------------------------
FROM base AS build

# Copy dependencies from deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copy source code
COPY --chown=node:node . .

# Build the application with production configuration
RUN pnpm nx build aep-builder --configuration=production

# Verify build output
RUN ls -la /app/dist/apps/aep-builder/browser || \
    (echo "Build output not found!" && exit 1)

# ------------------------------------------------------------------------------
# Production Stage: Nginx-based runtime
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Install security updates and required tools
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    wget \
    ca-certificates \
    tzdata

# Set timezone
ENV TZ=UTC

# Remove default nginx configurations
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy built application from build stage
COPY --from=build /app/dist/apps/aep-builder/browser /usr/share/nginx/html

# Copy optimized nginx configuration
COPY apps/aep-builder/nginx.conf /etc/nginx/conf.d/default.conf

# Create cache directories for nginx
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp \
             /tmp/nginx && \
    chown -R nginx:nginx /var/cache/nginx /tmp/nginx

# Fix nginx.conf to use /tmp for pid
RUN sed -i 's|pid /run/nginx.pid|pid /tmp/nginx/nginx.pid|' /etc/nginx/nginx.conf || \
    echo "pid /tmp/nginx/nginx.pid;" >> /etc/nginx/nginx.conf

# Security: Set proper file permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \; && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \;

# Security: Remove unnecessary packages and files
RUN rm -rf /tmp/* /var/cache/apk/*

# Security: Run as nginx user (nginx image default)
# Note: Using root temporarily for nginx master, then worker processes drop to nginx
USER root

CMD nginx -g 'daemon off;'

# Expose HTTP port
EXPOSE 80

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx in foreground
# CMD ["nginx", "-g", "daemon off;"]

# ==============================================================================
# Build Instructions:
# ==============================================================================
# Development build:
#   docker build -f apps/aep-builder/Dockerfile -t aep-builder:dev .
#
# Production build with BuildKit:
#   DOCKER_BUILDKIT=1 docker build -f apps/aep-builder/Dockerfile -t aep-builder:prod .
#
# Build with cache optimization:
#   DOCKER_BUILDKIT=1 docker build --cache-from=aep-builder:latest \
#     -f apps/aep-builder/Dockerfile -t aep-builder:latest .
#
# Security scan:
#   docker scan aep-builder:latest
#   trivy image aep-builder:latest
# ==============================================================================
