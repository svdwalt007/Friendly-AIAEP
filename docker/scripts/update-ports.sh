#!/bin/bash
# Port Migration Script for Friendly AIAEP
# Updates all ports from old allocation to new allocation
# UI Apps: 6000+, APIs/DBs/Services: 7500+

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "===================================================================="
echo "Friendly AIAEP Port Migration Script"
echo "===================================================================="
echo "This script will update all port allocations to the new scheme:"
echo "  - UI Applications: 6000-6999"
echo "  - APIs/DBs/Services: 7500-8999"
echo ""
echo "Project root: $PROJECT_ROOT"
echo ""

# Backup function
backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        cp "$file" "$file.bak-$(date +%Y%m%d-%H%M%S)"
        echo "  ✓ Backed up: $file"
    fi
}

# Port replacement function
replace_ports() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "  ⚠ File not found: $file"
        return
    fi

    backup_file "$file"

    # UI Ports (6000-6999)
    sed -i "s/'4200:4200'/'6000:4200'/g" "$file"  # aep-builder external
    sed -i "s/- '4200:4200'/- '6000:4200'/g" "$file"
    sed -i "s/'3000:3000'/'6001:3000'/g" "$file"  # Grafana
    sed -i "s/- '3000:3000'/- '6001:3000'/g" "$file"
    sed -i "s/'16686:16686'/'6002:16686'/g" "$file"  # Jaeger UI
    sed -i "s/- '16686:16686'/- '6002:16686'/g" "$file"
    sed -i "s/'9001:9001'/'6003:9001'/g" "$file"  # MinIO Console
    sed -i "s/- '9001:9001'/- '6003:9001'/g" "$file"
    sed -i "s/'5050:80'/'6004:80'/g" "$file"  # pgAdmin
    sed -i "s/- '5050:80'/- '6004:80'/g" "$file"
    sed -i "s/'4873:4873'/'6005:4873'/g" "$file"  # Verdaccio
    sed -i "s/- '4873:4873'/- '6005:4873'/g" "$file"

    # API Ports (7500-7599)
    sed -i "s/'3001:3001'/'7500:3001'/g" "$file"  # aep-api-gateway
    sed -i "s/- '3001:3001'/- '7500:3001'/g" "$file"
    sed -i "s/'3002:3002'/'7501:3002'/g" "$file"  # aep-preview-host
    sed -i "s/- '3002:3002'/- '7501:3002'/g" "$file"
    sed -i "s/'3003:3003'/'7502:3003'/g" "$file"  # IOT Mock API
    sed -i "s/- '3003:3003'/- '7502:3003'/g" "$file"

    # Database Ports (7600-7649)
    sed -i "s/'5432:5432'/'7600:5432'/g" "$file"  # PostgreSQL
    sed -i "s/- '5432:5432'/- '7600:5432'/g" "$file"
    sed -i "s/'8086:8086'/'7601:8086'/g" "$file"  # InfluxDB
    sed -i "s/- '8086:8086'/- '7601:8086'/g" "$file"
    sed -i "s/'6379:6379'/'7602:6379'/g" "$file"  # Redis
    sed -i "s/- '6379:6379'/- '7602:6379'/g" "$file"

    # Object Storage (7650-7669)
    sed -i "s/'9000:9000'/'7650:9000'/g" "$file"  # MinIO API
    sed -i "s/- '9000:9000'/- '7650:9000'/g" "$file"

    # Metrics Collection (7700-7749)
    sed -i "s/'9090:9090'/'7700:9090'/g" "$file"  # Prometheus
    sed -i "s/- '9090:9090'/- '7700:9090'/g" "$file"
    sed -i "s/'9100:9100'/'7701:9100'/g" "$file"  # Node Exporter
    sed -i "s/- '9100:9100'/- '7701:9100'/g" "$file"
    sed -i "s/'9121:9121'/'7702:9121'/g" "$file"  # Redis Exporter
    sed -i "s/- '9121:9121'/- '7702:9121'/g" "$file"
    sed -i "s/'9187:9187'/'7703:9187'/g" "$file"  # Postgres Exporter
    sed -i "s/- '9187:9187'/- '7703:9187'/g" "$file"

    # Logs (7750-7769)
    sed -i "s/'3100:3100'/'7750:3100'/g" "$file"  # Loki
    sed -i "s/- '3100:3100'/- '7750:3100'/g" "$file"
    sed -i "s/'9080:9080'/'7751:9080'/g" "$file"  # Promtail
    sed -i "s/- '9080:9080'/- '7751:9080'/g" "$file"

    # Tracing (7770-7799)
    sed -i "s/'5775:5775\\/udp'/'7770:5775\\/udp'/g" "$file"  # Jaeger Agent Zipkin
    sed -i "s/- '5775:5775\\/udp'/- '7770:5775\\/udp'/g" "$file"
    sed -i "s/'5778:5778'/'7771:5778'/g" "$file"  # Jaeger Agent Config
    sed -i "s/- '5778:5778'/- '7771:5778'/g" "$file"
    sed -i "s/'6831:6831\\/udp'/'7772:6831\\/udp'/g" "$file"  # Jaeger Thrift Compact
    sed -i "s/- '6831:6831\\/udp'/- '7772:6831\\/udp'/g" "$file"
    sed -i "s/'6832:6832\\/udp'/'7773:6832\\/udp'/g" "$file"  # Jaeger Thrift Binary
    sed -i "s/- '6832:6832\\/udp'/- '7773:6832\\/udp'/g" "$file"
    sed -i "s/'14250:14250'/'7774:14250'/g" "$file"  # Jaeger Collector gRPC
    sed -i "s/- '14250:14250'/- '7774:14250'/g" "$file"
    sed -i "s/'14268:14268'/'7775:14268'/g" "$file"  # Jaeger Collector HTTP
    sed -i "s/- '14268:14268'/- '7775:14268'/g" "$file"
    sed -i "s/'14269:14269'/'7776:14269'/g" "$file"  # Jaeger Collector Metrics
    sed -i "s/- '14269:14269'/- '7776:14269'/g" "$file"

    # OpenTelemetry (7800-7819)
    sed -i "s/'4317:4317'/'7800:4317'/g" "$file"  # OTLP gRPC
    sed -i "s/- '4317:4317'/- '7800:4317'/g" "$file"
    sed -i "s/'4318:4318'/'7801:4318'/g" "$file"  # OTLP HTTP
    sed -i "s/- '4318:4318'/- '7801:4318'/g" "$file"

    # Data Ingestion (7820-7849)
    sed -i "s/'8094:8094'/'7820:8094'/g" "$file"  # Telegraf HTTP
    sed -i "s/- '8094:8094'/- '7820:8094'/g" "$file"
    sed -i "s/'8092:8092\\/udp'/'7821:8092\\/udp'/g" "$file"  # Telegraf UDP
    sed -i "s/- '8092:8092\\/udp'/- '7821:8092\\/udp'/g" "$file"
    sed -i "s/'8125:8125\\/udp'/'7822:8125\\/udp'/g" "$file"  # Telegraf StatsD
    sed -i "s/- '8125:8125\\/udp'/- '7822:8125\\/udp'/g" "$file"

    echo "  ✓ Updated: $file"
}

echo "Step 1: Updating Docker Compose files..."
echo "--------------------------------------------------------------------"
replace_ports "$PROJECT_ROOT/docker/docker-compose.dev.yml"
replace_ports "$PROJECT_ROOT/docker/docker-compose.test.yml"
replace_ports "$PROJECT_ROOT/docker/docker-compose.preprod.yml"
replace_ports "$PROJECT_ROOT/docker/docker-compose.prod.yml"

echo ""
echo "Step 2: Updating environment files..."
echo "--------------------------------------------------------------------"
for env_file in "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.development" "$PROJECT_ROOT/.env.preprod" "$PROJECT_ROOT/docker/.env.example"; do
    if [ -f "$env_file" ]; then
        backup_file "$env_file"

        # UI Ports
        sed -i "s/AEP_BUILDER_PORT=4200/AEP_BUILDER_PORT=6000/g" "$env_file"
        sed -i "s/GRAFANA_PORT=3000/GRAFANA_PORT=6001/g" "$env_file"
        sed -i "s/JAEGER_UI_PORT=16686/JAEGER_UI_PORT=6002/g" "$env_file"
        sed -i "s/MINIO_CONSOLE_PORT=9001/MINIO_CONSOLE_PORT=6003/g" "$env_file"

        # API Ports
        sed -i "s/AEP_API_GATEWAY_PORT=3001/AEP_API_GATEWAY_PORT=7500/g" "$env_file"
        sed -i "s/AEP_PREVIEW_HOST_PORT=3002/AEP_PREVIEW_HOST_PORT=7501/g" "$env_file"
        sed -i "s/IOT_MOCK_API_PORT=3003/IOT_MOCK_API_PORT=7502/g" "$env_file"

        # Database Ports
        sed -i "s/POSTGRES_PORT=5432/POSTGRES_PORT=7600/g" "$env_file"
        sed -i "s/INFLUXDB_PORT=8086/INFLUXDB_PORT=7601/g" "$env_file"
        sed -i "s/REDIS_PORT=6379/REDIS_PORT=7602/g" "$env_file"

        # Storage
        sed -i "s/MINIO_PORT=9000/MINIO_PORT=7650/g" "$env_file"

        # Observability
        sed -i "s/PROMETHEUS_PORT=9090/PROMETHEUS_PORT=7700/g" "$env_file"
        sed -i "s/LOKI_PORT=3100/LOKI_PORT=7750/g" "$env_file"
        sed -i "s/JAEGER_COLLECTOR_PORT=14268/JAEGER_COLLECTOR_PORT=7775/g" "$env_file"
        sed -i "s/OTLP_HTTP_PORT=4318/OTLP_HTTP_PORT=7801/g" "$env_file"
        sed -i "s/TELEGRAF_HTTP_PORT=8094/TELEGRAF_HTTP_PORT=7820/g" "$env_file"

        # URL updates
        sed -i "s/:4200/:6000/g" "$env_file"
        sed -i "s/:3000/:6001/g" "$env_file"
        sed -i "s/:3001/:7500/g" "$env_file"
        sed -i "s/:3002/:7501/g" "$env_file"
        sed -i "s/:5432/:7600/g" "$env_file"
        sed -i "s/:8086/:7601/g" "$env_file"
        sed -i "s/:6379/:7602/g" "$env_file"
        sed -i "s/:9000/:7650/g" "$env_file"

        echo "  ✓ Updated: $env_file"
    fi
done

echo ""
echo "===================================================================="
echo "✓ Port migration completed successfully!"
echo "===================================================================="
echo ""
echo "Next steps:"
echo "  1. Review the PORT-ALLOCATION.md file for the complete port mapping"
echo "  2. Update your bookmarks and browser cache"
echo "  3. Restart all services to apply the new port configuration"
echo ""
echo "Backups created with timestamp suffix (.bak-YYYYMMDD-HHMMSS)"
echo "===================================================================="
