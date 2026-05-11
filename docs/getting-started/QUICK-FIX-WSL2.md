# Quick Fix Guide - WSL2 Issues

**Date:** 2026-04-16
**Platform:** WSL2 (Windows Subsystem for Linux)

---

## Issue 1: ENOENT - Working Directory Error ✅

### Error:
```
Error: ENOENT: no such file or directory, uv_cwd
```

### Root Cause:
Your terminal's current working directory has been deleted or is no longer accessible. This commonly happens when:
- Files are created/deleted in the current directory
- The directory was renamed or moved
- WSL2 loses track of Windows filesystem mounts

### Fix:
```bash
# Step 1: Exit the directory
cd ~

# Step 2: Navigate back to the project
cd /mnt/d/Dev/Friendly-AIAEP

# Step 3: Verify you're in the right place
pwd
# Should output: /mnt/d/Dev/Friendly-AIAEP

# Step 4: List files to confirm
ls -la
```

### If that doesn't work:
```bash
# Close your terminal completely and reopen it
# Then navigate to the project:
cd /mnt/d/Dev/Friendly-AIAEP
```

---

## Issue 2: Docker Shared Mount Error ✅

### Error:
```
Error response from daemon: path / is mounted on / but it is not a shared mount
```

### Root Cause:
The Node Exporter service tries to mount the entire root filesystem (`/:/host:ro,rslave`), which is not allowed in WSL2 due to security restrictions and mount propagation limitations.

### Fix Option 1: Comment Out Node Exporter (Quick Fix)

Edit `docker/docker-compose.dev.yml` and comment out the Node Exporter service:

```yaml
# Temporarily disable for WSL2 compatibility
# node-exporter:
#   image: prom/node-exporter:v1.9.0
#   container_name: friendly-aep-dev-node-exporter
#   ...
```

Then update Prometheus configuration to remove Node Exporter from scrape targets.

### Fix Option 2: Use WSL2-Compatible Configuration (Recommended)

Replace the problematic mount with WSL2-compatible paths:

**Edit `docker/docker-compose.dev.yml` line 330:**

Change FROM:
```yaml
volumes:
  - /:/host:ro,rslave
```

TO:
```yaml
volumes:
  # WSL2-compatible: Only mount necessary paths
  - /proc:/host/proc:ro
  - /sys:/host/sys:ro
  # Don't mount root filesystem in WSL2
```

### Fix Option 3: Run Without Node Exporter (Development Only)

For development, system metrics from Node Exporter are optional. You can start services without it:

```bash
# Start all services except node-exporter
docker compose -f docker/docker-compose.dev.yml up -d postgres influxdb telegraf grafana redis minio jaeger prometheus loki promtail postgres-exporter redis-exporter
```

---

## Recommended Solution

I recommend **Fix Option 2** combined with fixing the working directory issue. Here's the complete solution:

### Step 1: Fix Working Directory
```bash
cd ~
cd /mnt/d/Dev/Friendly-AIAEP
```

### Step 2: Apply Node Exporter Fix

I'll update the docker-compose file for you with WSL2-compatible mounts.

### Step 3: Restart Docker Services
```bash
# Stop any running containers
docker compose -f docker/docker-compose.dev.yml down

# Start with fixed configuration
docker compose -f docker/docker-compose.dev.yml up -d
```

### Step 4: Verify Services
```bash
# Check all containers are running
docker compose -f docker/docker-compose.dev.yml ps

# You should see all services as "Up" or "Up (healthy)"
```

---

## Alternative: Use Docker Desktop WSL2 Backend

If you continue having issues, ensure Docker Desktop is configured correctly:

1. **Open Docker Desktop Settings**
2. **Go to Resources → WSL Integration**
3. **Enable integration with your WSL2 distro**
4. **Click "Apply & Restart"**

Then try again:
```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

---

## After Fixes - Build the Application

Once Docker is running, you can build:

```bash
# Make sure you're in the project directory
cd /mnt/d/Dev/Friendly-AIAEP

# Build development
pnpm nx build aep-builder --configuration=development

# Or serve with hot-reload
pnpm nx serve aep-builder
```

---

## Troubleshooting

### If you still get "uv_cwd" errors:

1. **Check if directory exists:**
   ```bash
   ls -la /mnt/d/Dev/Friendly-AIAEP
   ```

2. **Check WSL2 mount:**
   ```bash
   mount | grep "type drvfs"
   ```

3. **Restart WSL2 (Windows PowerShell as Admin):**
   ```powershell
   wsl --shutdown
   wsl
   ```

### If Docker services won't start:

1. **Check Docker daemon is running:**
   ```bash
   docker info
   ```

2. **Check Docker Desktop is running in Windows**

3. **Restart Docker Desktop**

4. **Check logs for specific service:**
   ```bash
   docker compose -f docker/docker-compose.dev.yml logs node-exporter
   ```

---

## Summary of Changes Needed

1. ✅ Navigate out and back into the directory
2. ✅ Update Node Exporter volume mounts for WSL2
3. ✅ Restart Docker services
4. ✅ Build application

**Let me know if you want me to automatically apply the Docker Compose fix!**
