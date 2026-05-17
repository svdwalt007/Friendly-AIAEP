# Docker Logs Error Resolution Summary

**Date:** 2026-04-16
**Status:** ✅ All Critical Issues Resolved

## Issues Fixed

### 1. ✅ Loki Configuration Errors (CRITICAL)
**Problem:** Loki 3.3.2 was crash-looping due to deprecated configuration fields incompatible with v3.x

**Errors:**
- `max_transfer_retries` field removed from ingester config
- `shared_store` field removed from boltdb_shipper and compactor
- `fifocache` deprecated in favor of `embedded_cache`
- Missing compactor delete-request-store configuration
- Schema v11/boltdb-shipper incompatible with structured metadata

**Fix Applied:**
- Removed deprecated `max_transfer_retries` from ingester configuration
- Removed `shared_store` from storage_config.boltdb_shipper
- Removed `shared_store` from compactor configuration
- Updated cache configuration to use `embedded_cache` instead of `fifocache`
- Added `delete_request_store: filesystem` to compactor
- Added `allow_structured_metadata: false` to limits_config for legacy schema compatibility

**Files Modified:**
- `docker/observability/loki-config.yml`

**Result:** Loki is now running successfully and accepting log ingestion

---

### 2. ✅ PostgreSQL Database Missing (HIGH)
**Problem:** postgres-exporter failing with "database 'friendly_aep_dev' does not exist"

**Root Cause:**
- Database was created as `friendly_aep` instead of `friendly_aep_dev`
- Environment configuration expected `friendly_aep_dev`

**Fix Applied:**
```sql
CREATE DATABASE friendly_aep_dev WITH OWNER friendly ENCODING 'UTF8';
```

**Result:** postgres-exporter now successfully connects and exports metrics

---

### 3. ✅ Node Exporter WSL2 Compatibility (MEDIUM)
**Problem:** Repeated errors due to WSL2-incompatible filesystem collectors

**Errors:**
- Missing `/host/proc/net/netstat` (netstat collector)
- Missing `/host/proc/net/softnet_stat` (softnet collector)
- Duplicate metrics for `/run/user` tmpfs mount

**Fix Applied:**
- Disabled `netstat` collector: `--no-collector.netstat`
- Disabled `softnet` collector: `--no-collector.softnet`
- Excluded `/run/user` from filesystem monitoring: `--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc|run/user)($$|/)`

**Files Modified:**
- `docker/docker-compose.dev.yml` (node-exporter service)

**Result:** Node exporter runs cleanly without WSL2-specific errors

---

### 4. ✅ Promtail Connection to Loki (CASCADING)
**Problem:** Promtail couldn't send logs due to Loki being down

**Result:** Automatically resolved after Loki configuration was fixed. Promtail now successfully sends logs to Loki.

---

## Remaining Non-Critical Warnings

### Telegraf InfluxDB Write Errors (LOW PRIORITY)
**Status:** Not blocking core functionality
**Errors:** `Error writing to outputs.influxdb_v2: failed to send metrics to any configured server(s)`
**Impact:** IoT metrics collection may not be working - needs separate investigation
**Recommendation:** Check Telegraf configuration and InfluxDB connectivity

### Grafana Dashboard Provisioning (LOW PRIORITY)
**Status:** Not blocking core functionality
**Errors:** `failed to load dashboard from platform-overview.json: Dashboard title cannot be empty`
**Impact:** One dashboard not loading properly
**Recommendation:** Fix or remove the malformed dashboard JSON file at `docker/grafana/provisioning/dashboards/json/platform-overview.json`

---

## Verification Results

All services are now running successfully:

```
✅ friendly-aep-dev-postgres         (healthy)
✅ friendly-aep-dev-influxdb         (healthy)
✅ friendly-aep-dev-redis            (healthy)
✅ friendly-aep-dev-minio            (healthy)
✅ friendly-aep-dev-grafana          (running)
✅ friendly-aep-dev-jaeger           (running)
✅ friendly-aep-dev-loki             (running) ← FIXED
✅ friendly-aep-dev-promtail         (running) ← FIXED
✅ friendly-aep-dev-prometheus       (running)
✅ friendly-aep-dev-node-exporter    (running) ← FIXED
✅ friendly-aep-dev-postgres-exporter (running) ← FIXED
✅ friendly-aep-dev-redis-exporter   (running)
✅ friendly-aep-dev-telegraf         (running)
```

---

## Commands to Verify

```bash
# Check all service status
docker compose -f docker/docker-compose.dev.yml ps

# Check for recent errors (should be minimal)
docker compose -f docker/docker-compose.dev.yml logs --since 5m | grep -i error

# Test Loki health
curl http://localhost:46350/ready

# Test Prometheus targets
curl http://localhost:46300/api/v1/targets
```

---

## Migration Notes for Future

**Loki Schema Upgrade Path:**
The current configuration uses legacy schema v11 with boltdb-shipper. For long-term support, consider upgrading to:
- Schema v13 with TSDB index store
- This will enable structured metadata and native OTLP ingestion
- See [Loki Storage Schema docs](https://grafana.com/docs/loki/latest/operations/storage/schema/) for migration procedure

**Reference:**
- [Loki 3.0 Release Notes](https://grafana.com/docs/loki/latest/release-notes/v3-0/)
- [Loki v2 to v3 Upgrade Guide](https://blog.ayjc.net/posts/loki-3-upgrade/)
