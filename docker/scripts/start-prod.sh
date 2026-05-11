#!/bin/bash
# Friendly AIAEP - Production Environment Startup Script
# Opens services in separate WSL windows and launches browser URLs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$DOCKER_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}===================================================================="
echo -e "Friendly AIAEP - Production Environment Startup"
echo -e "====================================================================${NC}"
echo ""
echo -e "${RED}WARNING: You are about to start the PRODUCTION environment!${NC}"
echo -e "${YELLOW}Make sure you have:${NC}"
echo -e "  1. Configured .env.production with production credentials"
echo -e "  2. Backed up all databases"
echo -e "  3. Tested in pre-production first"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Startup cancelled.${NC}"
    exit 0
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Check if docker-compose file exists
if [ ! -f "$DOCKER_DIR/docker-compose.prod.yml" ]; then
    echo -e "${RED}✗ docker-compose.prod.yml not found${NC}"
    exit 1
fi

# Check if .env.production exists
if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
    echo -e "${RED}✗ .env.production not found. This is REQUIRED for production.${NC}"
    echo -e "${YELLOW}  Please create and configure $PROJECT_ROOT/.env.production${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found docker-compose.prod.yml and .env.production${NC}"
echo ""

# Step 1: Build images
echo -e "${CYAN}Step 1: Building Docker images...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"
cd "$DOCKER_DIR"
docker-compose -f docker-compose.prod.yml build

echo ""
echo -e "${GREEN}✓ Images built successfully${NC}"
echo ""

# Step 2: Start all services
echo -e "${CYAN}Step 2: Starting all services...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 20

echo ""
echo -e "${GREEN}✓ All services started${NC}"
echo ""

# Step 3: Open service logs in separate WSL windows (if on Windows with WSL)
echo -e "${CYAN}Step 3: Opening service logs in separate windows...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"

if command -v cmd.exe &> /dev/null; then
    # We're in WSL, can open Windows Terminal tabs
    echo -e "${YELLOW}Opening Windows Terminal tabs for service logs...${NC}"

    # Function to open a new tab with docker logs
    open_log_window() {
        local service=$1
        local title=$2
        cmd.exe /c "wt -w 0 nt -d \"$DOCKER_DIR\" --title \"[PROD] $title\" bash -c \"docker logs -f friendly-aep-prod-$service; exec bash\""
        sleep 1
    }

    open_log_window "api-gateway" "API Gateway Logs"
    open_log_window "preview-host" "Preview Host Logs"
    open_log_window "postgres" "PostgreSQL Logs"
    open_log_window "influxdb" "InfluxDB Logs"
    open_log_window "grafana" "Grafana Logs"
    open_log_window "telegraf" "Telegraf Logs"

    echo -e "${GREEN}✓ Opened log windows${NC}"
else
    echo -e "${YELLOW}⚠ Not in WSL environment, skipping window opening${NC}"
    echo -e "${YELLOW}  You can view logs manually using: docker logs -f <container-name>${NC}"
fi

echo ""

# Step 4: Display service URLs
echo -e "${CYAN}Step 4: Service URLs${NC}"
echo -e "${YELLOW}====================================================================${NC}"
echo ""
echo -e "${BLUE}UI Applications:${NC}"
echo -e "  ${GREEN}Builder App:${NC}        http://localhost:45000"
echo -e "  ${GREEN}Grafana:${NC}            http://localhost:45001"
echo ""
echo -e "${BLUE}APIs:${NC}"
echo -e "  ${GREEN}API Gateway:${NC}        http://localhost:46000"
echo -e "  ${GREEN}API Docs:${NC}           http://localhost:46000/documentation"
echo -e "  ${GREEN}Preview Host:${NC}       http://localhost:46001"
echo -e "  ${GREEN}Health Check:${NC}       http://localhost:46000/health"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo -e "  ${GREEN}Grafana:${NC}            http://localhost:45001"
echo ""
echo -e "${YELLOW}====================================================================${NC}"
echo ""
echo -e "${RED}NOTE: Database ports are NOT exposed in production for security.${NC}"
echo -e "${RED}      Use docker exec to access databases if needed.${NC}"
echo ""

# Step 5: Perform health checks
echo -e "${CYAN}Step 5: Performing health checks...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"

sleep 5

# Check API Gateway health
if curl -f -s http://localhost:46000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API Gateway is healthy${NC}"
else
    echo -e "${RED}✗ API Gateway health check failed${NC}"
fi

# Check Preview Host health
if curl -f -s http://localhost:46001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Preview Host is healthy${NC}"
else
    echo -e "${RED}✗ Preview Host health check failed${NC}"
fi

# Check Grafana
if curl -f -s http://localhost:45001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Grafana is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Grafana may still be starting...${NC}"
fi

echo ""

# Step 6: Auto-open monitoring dashboard
echo -e "${CYAN}Step 6: Opening monitoring dashboard...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"

if command -v cmd.exe &> /dev/null; then
    cmd.exe /c start http://localhost:45001 2>/dev/null  # Grafana
    echo -e "${GREEN}✓ Opened Grafana monitoring dashboard${NC}"
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:45001 &
    echo -e "${GREEN}✓ Opened Grafana monitoring dashboard${NC}"
else
    echo -e "${YELLOW}⚠ Could not auto-open browser. Please open http://localhost:45001 manually.${NC}"
fi

echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}✓ Production environment started successfully!${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo ""
echo -e "${YELLOW}Helpful Commands:${NC}"
echo -e "  ${GREEN}View all containers:${NC}  docker ps"
echo -e "  ${GREEN}Stop all services:${NC}    cd $DOCKER_DIR && docker-compose -f docker-compose.prod.yml down"
echo -e "  ${GREEN}View logs:${NC}            docker logs -f <container-name>"
echo -e "  ${GREEN}Restart service:${NC}      docker-compose -f docker-compose.prod.yml restart <service>"
echo -e "  ${GREEN}Database access:${NC}      docker exec -it friendly-aep-prod-postgres psql -U <user> -d <db>"
echo ""
echo -e "${RED}IMPORTANT: Monitor Grafana at http://localhost:45001 for system health${NC}"
echo ""
echo -e "${CYAN}Press Ctrl+C to exit (containers will keep running)${NC}"
echo ""

# Keep script running
tail -f /dev/null
