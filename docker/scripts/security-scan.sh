#!/usr/bin/env bash

# ==============================================================================
# Docker Security Scanning Script
# ==============================================================================
# This script performs comprehensive security scans on Docker images using:
# - Trivy (vulnerability scanner)
# - Docker Scout (optional)
# - Custom security checks
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCAN_OUTPUT_DIR="${SCAN_OUTPUT_DIR:-$PROJECT_ROOT/security-reports}"
SEVERITY="${SEVERITY:-CRITICAL,HIGH}"
FORMAT="${FORMAT:-table}"
IGNORE_UNFIXED="${IGNORE_UNFIXED:-false}"
EXIT_CODE="${EXIT_CODE:-1}"
USE_SCOUT="${USE_SCOUT:-false}"

# ==============================================================================
# Helper Functions
# ==============================================================================

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${MAGENTA}===================================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}===================================================${NC}\n"
}

# ==============================================================================
# Usage Information
# ==============================================================================

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] IMAGE

Perform comprehensive security scans on Docker images.

ARGUMENTS:
    IMAGE               Docker image to scan (name:tag)

OPTIONS:
    -s, --severity LEVEL       Severities to scan for (default: CRITICAL,HIGH)
                               Options: CRITICAL,HIGH,MEDIUM,LOW,UNKNOWN
    -f, --format FORMAT        Output format (default: table)
                               Options: table, json, sarif, cyclonedx, spdx
    -o, --output DIR           Output directory for reports (default: ./security-reports)
    --ignore-unfixed           Ignore unfixed vulnerabilities
    --exit-code CODE           Exit code when vulnerabilities found (default: 1)
    --use-scout                Use Docker Scout in addition to Trivy
    --all                      Scan all project images
    -h, --help                 Show this help message

ENVIRONMENT VARIABLES:
    SEVERITY                   Default severity levels
    FORMAT                     Default output format
    SCAN_OUTPUT_DIR           Default output directory
    IGNORE_UNFIXED            Ignore unfixed vulnerabilities (true|false)
    EXIT_CODE                 Exit code for vulnerabilities
    USE_SCOUT                 Enable Docker Scout (true|false)

EXAMPLES:
    # Scan single image
    $(basename "$0") aep-api-gateway:latest

    # Scan with custom severity
    $(basename "$0") -s CRITICAL,HIGH,MEDIUM aep-builder:latest

    # Scan with JSON output
    $(basename "$0") -f json -o ./reports aep-preview-host:latest

    # Scan all project images
    $(basename "$0") --all

    # Scan with Docker Scout
    $(basename "$0") --use-scout aep-api-gateway:latest

    # Ignore unfixed vulnerabilities
    $(basename "$0") --ignore-unfixed aep-builder:latest

EOF
    exit 0
}

# ==============================================================================
# Dependency Checks
# ==============================================================================

check_dependencies() {
    local missing_deps=()

    # Check for Trivy
    if ! command -v trivy &> /dev/null; then
        missing_deps+=("trivy")
    fi

    # Check for Docker Scout if enabled
    if [[ "$USE_SCOUT" == "true" ]] && ! docker scout version &> /dev/null; then
        print_warning "Docker Scout is not available. Skipping Scout scans."
        USE_SCOUT="false"
    fi

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Install Trivy:"
        echo "  macOS:   brew install trivy"
        echo "  Linux:   curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
        echo "  Windows: choco install trivy"
        echo ""
        exit 1
    fi
}

# ==============================================================================
# Scanning Functions
# ==============================================================================

scan_with_trivy() {
    local image=$1
    local report_name=$2

    print_header "Scanning with Trivy: $image"

    # Prepare Trivy arguments
    local trivy_args=(
        "image"
        "--severity" "$SEVERITY"
        "--format" "$FORMAT"
    )

    # Add ignore-unfixed flag if requested
    if [[ "$IGNORE_UNFIXED" == "true" ]]; then
        trivy_args+=("--ignore-unfixed")
    fi

    # Scan vulnerabilities
    print_info "Scanning for vulnerabilities..."

    local vuln_report="$SCAN_OUTPUT_DIR/${report_name}-vulnerabilities.${FORMAT}"
    trivy_args+=("--output" "$vuln_report")
    trivy_args+=("$image")

    if trivy "${trivy_args[@]}"; then
        print_success "Vulnerability scan completed: $vuln_report"
    else
        local exit_status=$?
        if [[ $exit_status -eq 1 ]]; then
            print_error "Vulnerabilities found in $image"
            return 1
        else
            print_error "Trivy scan failed with exit code $exit_status"
            return $exit_status
        fi
    fi

    # Additional scans with table format for display
    if [[ "$FORMAT" != "table" ]]; then
        print_info "Generating summary..."
        trivy image --severity "$SEVERITY" --format table "$image"
    fi

    # Scan for secrets
    print_info "Scanning for secrets..."
    local secret_report="$SCAN_OUTPUT_DIR/${report_name}-secrets.txt"
    trivy image --scanners secret --format table --output "$secret_report" "$image" || true
    print_success "Secret scan completed: $secret_report"

    # Scan for misconfigurations
    print_info "Scanning for misconfigurations..."
    local config_report="$SCAN_OUTPUT_DIR/${report_name}-config.txt"
    trivy image --scanners config --format table --output "$config_report" "$image" || true
    print_success "Configuration scan completed: $config_report"

    # Generate SBOM (Software Bill of Materials)
    print_info "Generating SBOM..."
    local sbom_report="$SCAN_OUTPUT_DIR/${report_name}-sbom.json"
    trivy image --format cyclonedx --output "$sbom_report" "$image" || true
    print_success "SBOM generated: $sbom_report"

    return 0
}

scan_with_docker_scout() {
    local image=$1
    local report_name=$2

    print_header "Scanning with Docker Scout: $image"

    local scout_report="$SCAN_OUTPUT_DIR/${report_name}-scout.txt"

    # Run Docker Scout scan
    if docker scout cves "$image" > "$scout_report" 2>&1; then
        print_success "Docker Scout scan completed: $scout_report"

        # Display quick view
        docker scout quickview "$image" || true

        return 0
    else
        print_warning "Docker Scout scan failed, continuing..."
        return 0
    fi
}

perform_custom_checks() {
    local image=$1
    local report_name=$2

    print_header "Performing Custom Security Checks: $image"

    local custom_report="$SCAN_OUTPUT_DIR/${report_name}-custom.txt"

    {
        echo "========================================="
        echo "Custom Security Checks Report"
        echo "Image: $image"
        echo "Date: $(date)"
        echo "========================================="
        echo ""

        # Check image size
        echo "=== Image Size ==="
        docker images "$image" --format "Size: {{.Size}}"
        echo ""

        # Check image history
        echo "=== Image Layers ==="
        docker history "$image" --no-trunc --human
        echo ""

        # Inspect image configuration
        echo "=== Image Configuration ==="
        docker inspect "$image" --format '{{json .Config}}' | jq '.' || \
            docker inspect "$image" --format '{{json .Config}}'
        echo ""

        # Check for non-root user
        echo "=== User Configuration ==="
        local user=$(docker inspect "$image" --format '{{.Config.User}}')
        if [[ -n "$user" && "$user" != "root" && "$user" != "0" ]]; then
            echo "✓ Running as non-root user: $user"
        else
            echo "✗ WARNING: Running as root user or user not set"
        fi
        echo ""

        # Check for health check
        echo "=== Health Check ==="
        local healthcheck=$(docker inspect "$image" --format '{{.Config.Healthcheck}}')
        if [[ "$healthcheck" != "<no value>" && -n "$healthcheck" ]]; then
            echo "✓ Health check configured"
        else
            echo "✗ WARNING: No health check configured"
        fi
        echo ""

        # Check exposed ports
        echo "=== Exposed Ports ==="
        docker inspect "$image" --format '{{range $key, $value := .Config.ExposedPorts}}{{$key}} {{end}}'
        echo ""

        # Check environment variables (without values for security)
        echo "=== Environment Variables ==="
        docker inspect "$image" --format '{{range .Config.Env}}{{.}}{{"\n"}}{{end}}' | \
            sed 's/=.*/=***/' || echo "None"
        echo ""

    } > "$custom_report"

    print_success "Custom checks completed: $custom_report"
    cat "$custom_report"
}

# ==============================================================================
# Image Resolution
# ==============================================================================

get_all_project_images() {
    local images=()

    # Common image names
    local base_names=("aep-api-gateway" "aep-builder" "aep-preview-host")

    for name in "${base_names[@]}"; do
        # Find images matching the pattern
        while IFS= read -r img; do
            if [[ -n "$img" ]]; then
                images+=("$img")
            fi
        done < <(docker images --format "{{.Repository}}:{{.Tag}}" | grep "^$name:" || true)
    done

    if [[ ${#images[@]} -eq 0 ]]; then
        print_error "No project images found"
        print_info "Available images:"
        docker images
        exit 1
    fi

    echo "${images[@]}"
}

# ==============================================================================
# Main Scanning Function
# ==============================================================================

scan_image() {
    local image=$1

    # Verify image exists
    if ! docker inspect "$image" &> /dev/null; then
        print_error "Image not found: $image"
        return 1
    fi

    # Generate report name from image
    local report_name=$(echo "$image" | sed 's/[\/:]/-/g')

    # Create output directory
    mkdir -p "$SCAN_OUTPUT_DIR"

    print_header "Security Scan: $image"
    print_info "Severity: $SEVERITY"
    print_info "Format: $FORMAT"
    print_info "Output: $SCAN_OUTPUT_DIR"
    print_info "Ignore Unfixed: $IGNORE_UNFIXED"

    local scan_failed=false

    # Trivy scan
    if ! scan_with_trivy "$image" "$report_name"; then
        scan_failed=true
    fi

    # Docker Scout scan (optional)
    if [[ "$USE_SCOUT" == "true" ]]; then
        scan_with_docker_scout "$image" "$report_name"
    fi

    # Custom checks
    perform_custom_checks "$image" "$report_name"

    # Return appropriate exit code
    if [[ "$scan_failed" == "true" ]]; then
        return $EXIT_CODE
    fi

    return 0
}

# ==============================================================================
# Main Execution
# ==============================================================================

main() {
    local images=()
    local scan_all=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -s|--severity)
                SEVERITY="$2"
                shift 2
                ;;
            -f|--format)
                FORMAT="$2"
                shift 2
                ;;
            -o|--output)
                SCAN_OUTPUT_DIR="$2"
                shift 2
                ;;
            --ignore-unfixed)
                IGNORE_UNFIXED="true"
                shift
                ;;
            --exit-code)
                EXIT_CODE="$2"
                shift 2
                ;;
            --use-scout)
                USE_SCOUT="true"
                shift
                ;;
            --all)
                scan_all=true
                shift
                ;;
            -*)
                print_error "Unknown option: $1"
                usage
                ;;
            *)
                images+=("$1")
                shift
                ;;
        esac
    done

    # Check dependencies
    check_dependencies

    # Determine images to scan
    if [[ "$scan_all" == "true" ]]; then
        mapfile -t images < <(get_all_project_images)
        print_info "Found ${#images[@]} project images to scan"
    elif [[ ${#images[@]} -eq 0 ]]; then
        print_error "No image specified"
        usage
    fi

    print_header "Docker Security Scanner"

    # Scan each image
    local failed_scans=()
    local successful_scans=()

    for image in "${images[@]}"; do
        if scan_image "$image"; then
            successful_scans+=("$image")
        else
            failed_scans+=("$image")
        fi
        echo ""
    done

    # Summary
    print_header "Scan Summary"

    if [[ ${#successful_scans[@]} -gt 0 ]]; then
        print_success "Successfully scanned ${#successful_scans[@]} image(s):"
        for image in "${successful_scans[@]}"; do
            echo "  ✓ $image"
        done
    fi

    if [[ ${#failed_scans[@]} -gt 0 ]]; then
        print_error "Vulnerabilities found in ${#failed_scans[@]} image(s):"
        for image in "${failed_scans[@]}"; do
            echo "  ✗ $image"
        done
        echo ""
        print_info "Review reports in: $SCAN_OUTPUT_DIR"
        exit $EXIT_CODE
    fi

    print_success "All scans completed successfully!"
    print_info "Reports saved to: $SCAN_OUTPUT_DIR"
}

# Run main function
main "$@"
