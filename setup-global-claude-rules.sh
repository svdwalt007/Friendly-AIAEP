#!/bin/bash
# Setup Global Claude Code Port Security Guidelines
# This script copies port security rules to your global Claude Code configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_RULES="$SCRIPT_DIR/.claude/rules/port-security-guidelines.md"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=================================================================="
echo -e "Claude Code Global Port Security Rules Setup"
echo -e "==================================================================${NC}"
echo ""

# Detect OS and set paths
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    # Linux or Mac
    GLOBAL_CLAUDE_DIR="$HOME/.claude/rules"
    GLOBAL_RULES_FILE="$GLOBAL_CLAUDE_DIR/port-security-guidelines.md"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WSLENV" ]]; then
    # Windows (Git Bash, Cygwin, or WSL)
    if [[ -n "$WSLENV" ]]; then
        # WSL - use Windows user profile
        WIN_USERPROFILE=$(wslpath "$(cmd.exe /c echo %USERPROFILE% 2>/dev/null | tr -d '\r')")
        GLOBAL_CLAUDE_DIR="$WIN_USERPROFILE/.claude/rules"
    else
        # Git Bash or Cygwin
        GLOBAL_CLAUDE_DIR="$USERPROFILE/.claude/rules"
    fi
    GLOBAL_RULES_FILE="$GLOBAL_CLAUDE_DIR/port-security-guidelines.md"
else
    echo -e "${YELLOW}⚠ Unknown OS type: $OSTYPE${NC}"
    echo -e "${YELLOW}  Using default Linux path${NC}"
    GLOBAL_CLAUDE_DIR="$HOME/.claude/rules"
    GLOBAL_RULES_FILE="$GLOBAL_CLAUDE_DIR/port-security-guidelines.md"
fi

echo -e "${BLUE}Detected configuration:${NC}"
echo -e "  OS Type: ${YELLOW}$OSTYPE${NC}"
echo -e "  Global Claude Dir: ${YELLOW}$GLOBAL_CLAUDE_DIR${NC}"
echo -e "  Rules File: ${YELLOW}$GLOBAL_RULES_FILE${NC}"
echo ""

# Check if source file exists
if [ ! -f "$SOURCE_RULES" ]; then
    echo -e "${YELLOW}✗ Source rules file not found: $SOURCE_RULES${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found source rules file${NC}"

# Create global Claude directory if it doesn't exist
if [ ! -d "$GLOBAL_CLAUDE_DIR" ]; then
    echo -e "${YELLOW}Creating global Claude rules directory...${NC}"
    mkdir -p "$GLOBAL_CLAUDE_DIR"
    echo -e "${GREEN}✓ Created: $GLOBAL_CLAUDE_DIR${NC}"
else
    echo -e "${GREEN}✓ Global Claude rules directory exists${NC}"
fi

# Check if rules file already exists
if [ -f "$GLOBAL_RULES_FILE" ]; then
    echo ""
    echo -e "${YELLOW}⚠ Port security rules already exist globally${NC}"
    echo -e "${YELLOW}  Location: $GLOBAL_RULES_FILE${NC}"
    echo ""
    read -p "Do you want to overwrite? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Setup cancelled. Existing rules preserved.${NC}"
        exit 0
    fi

    # Backup existing file
    BACKUP_FILE="${GLOBAL_RULES_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$GLOBAL_RULES_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backed up existing rules to: $BACKUP_FILE${NC}"
fi

# Copy rules file
echo ""
echo -e "${CYAN}Copying port security rules to global configuration...${NC}"
cp "$SOURCE_RULES" "$GLOBAL_RULES_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully copied rules to global location${NC}"
else
    echo -e "${YELLOW}✗ Failed to copy rules${NC}"
    exit 1
fi

# Set proper permissions
chmod 644 "$GLOBAL_RULES_FILE"

echo ""
echo -e "${CYAN}==================================================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${CYAN}==================================================================${NC}"
echo ""
echo -e "${BLUE}Port security guidelines installed globally at:${NC}"
echo -e "  ${YELLOW}$GLOBAL_RULES_FILE${NC}"
echo ""
echo -e "${BLUE}These rules will now apply to ALL your Claude Code projects!${NC}"
echo ""
echo -e "${YELLOW}Guidelines Summary:${NC}"
echo -e "  • Use high ports (45000+) for all services"
echo -e "  • Avoid system ports (0-1023)"
echo -e "  • Avoid common ports (1433, 3306, 5432, 8080, 8443)"
echo -e "  • Make all ports configurable via environment variables"
echo -e "  • Use reverse proxy for production"
echo -e "  • Configure firewall to block external access to high ports"
echo ""
echo -e "${CYAN}To verify installation:${NC}"
echo -e "  ${YELLOW}cat \"$GLOBAL_RULES_FILE\"${NC}"
echo ""
echo -e "${CYAN}==================================================================${NC}"
