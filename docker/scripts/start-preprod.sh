#!/bin/bash
# Friendly AIAEP - Pre-Production Environment Startup Script
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
echo -e "Friendly AIAEP - Pre-Production Environment Startup"
echo -e "====================================================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Check if docker-compose file exists
if [ ! -f "$DOCKER_DIR/docker-compose.preprod.yml" ]; then
    echo -e "${RED}✗ docker-compose.preprod.yml not found${NC}"
    exit 1
fi

# Check if .env.preprod exists
if [ ! -f "$PROJECT_ROOT/.env.preprod" ]; then
    echo -e "${YELLOW}⚠ .env.preprod not found. Using .env.example as template.${NC}"
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.preprod"
    echo -e "${YELLOW}⚠ Please configure $PROJECT_ROOT/.env.preprod before proceeding.${NC}"
    read -p "Press Enter to continue or Ctrl+C to exit..."
fi

echo -e "${GREEN}✓ Found docker-compose.preprod.yml${NC}"
echo ""

# Step 1: Build images
echo -e "${CYAN}Step 1: Building Docker images...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"
cd "$DOCKER_DIR"
docker-compose -f docker-compose.preprod.yml build

echo ""
echo -e "${GREEN}✓ Images built successfully${NC}"
echo ""

# Step 2: Start all services
echo -e "${CYAN}Step 2: Starting all services...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"
docker-compose -f docker-compose.preprod.yml up -d

echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 15

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
        cmd.exe /c "wt -w 0 nt -d \"$DOCKER_DIR\" --title \"$title\" bash -c \"docker logs -f friendly-aep-preprod-$service; exec bash\""
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
echo -e "${BLUE}Databases:${NC}"
echo -e "  ${GREEN}PostgreSQL:${NC}         localhost:46100"
echo -e "  ${GREEN}InfluxDB:${NC}           http://localhost:46101"
echo -e "  ${GREEN}Redis:${NC}              localhost:46102"
echo ""
echo -e "${BLUE}Storage:${NC}"
echo -e "  ${GREEN}MinIO API:${NC}          http://localhost:46200"
echo -e "  ${GREEN}MinIO Console:${NC}      http://localhost:45003"
echo ""
echo -e "${YELLOW}====================================================================${NC}"
echo ""

# Step 5: Auto-open browser URLs
echo -e "${CYAN}Step 5: Opening browser URLs...${NC}"
echo -e "${YELLOW}--------------------------------------------------------------------${NC}"

if command -v cmd.exe &> /dev/null; then
    # Open URLs in default browser (Windows)
    cmd.exe /c start http://localhost:45001 2>/dev/null  # Grafana
    sleep 2
    cmd.exe /c start http://localhost:46000/documentation 2>/dev/null  # API Docs
    sleep 2
    cmd.exe /c start http://localhost:46000/health 2>/dev/null  # Health

    echo -e "${GREEN}✓ Opened dashboards in browser${NC}"
elif command -v xdg-open &> /dev/null; then
    # Linux with xdg-open
    xdg-open http://localhost:45001 &
    sleep 2
    xdg-open http://localhost:46000/documentation &

    echo -e "${GREEN}✓ Opened dashboards in browser${NC}"
else
    echo -e "${YELLOW}⚠ Could not auto-open browser. Please open URLs manually.${NC}"
fi

echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}✓ Pre-production environment started successfully!${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo ""
echo -e "${YELLOW}Helpful Commands:${NC}"
echo -e "  ${GREEN}View all containers:${NC}  docker ps"
echo -e "  ${GREEN}Stop all services:${NC}    cd $DOCKER_DIR && docker-compose -f docker-compose.preprod.yml down"
echo -e "  ${GREEN}View logs:${NC}            docker logs -f <container-name>"
echo -e "  ${GREEN}Restart service:${NC}      docker-compose -f docker-compose.preprod.yml restart <service>"
echo ""
echo -e "${CYAN}Press Ctrl+C to exit (containers will keep running)${NC}"
echo ""

# Keep script running
tail -f /dev/null
