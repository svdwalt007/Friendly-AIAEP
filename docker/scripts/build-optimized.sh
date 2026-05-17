#!/usr/bin/env bash

# ==============================================================================
# Docker BuildKit Optimized Build Script
# ==============================================================================
# This script builds Docker images with BuildKit optimization for:
# - Faster builds with cache mounting
# - Better layer caching
# - Multi-platform support
# - Build progress tracking
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY="${DOCKER_REGISTRY:-}"
TAG="${DOCKER_TAG:-latest}"
PUSH="${DOCKER_PUSH:-false}"
CACHE_FROM="${DOCKER_CACHE_FROM:-}"
CACHE_TO="${DOCKER_CACHE_TO:-}"
PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
NO_CACHE="${DOCKER_NO_CACHE:-false}"

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
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

# ==============================================================================
# Usage Information
# ==============================================================================

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] SERVICE

Build Docker images with BuildKit optimization.

ARGUMENTS:
    SERVICE         Service to build (api-gateway|builder|preview-host|all)

OPTIONS:
    -t, --tag TAG              Docker image tag (default: latest)
    -r, --registry REGISTRY    Docker registry URL
    -p, --push                 Push images to registry after build
    --platform PLATFORM        Target platform (default: linux/amd64)
    --no-cache                 Build without using cache
    --cache-from SOURCE        External cache source
    --cache-to DEST            External cache destination
    -h, --help                 Show this help message

ENVIRONMENT VARIABLES:
    DOCKER_REGISTRY            Default registry URL
    DOCKER_TAG                 Default image tag
    DOCKER_PUSH               Auto-push after build (true|false)
    DOCKER_PLATFORM           Target platform
    DOCKER_NO_CACHE           Disable cache (true|false)
    DOCKER_CACHE_FROM         Cache source
    DOCKER_CACHE_TO           Cache destination

EXAMPLES:
    # Build single service
    $(basename "$0") api-gateway

    # Build and push with custom tag
    $(basename "$0") -t v1.0.0 -p builder

    # Build all services with registry
    $(basename "$0") -r ghcr.io/myorg -t latest all

    # Build with external cache
    $(basename "$0") --cache-from type=registry,ref=myregistry/app:cache api-gateway

    # Multi-platform build
    $(basename "$0") --platform linux/amd64,linux/arm64 -p all

EOF
    exit 0
}

# ==============================================================================
# Build Configuration
# ==============================================================================

get_image_name() {
    local service=$1
    local image_name=""

    case $service in
        api-gateway)
            image_name="aep-api-gateway"
            ;;
        builder)
            image_name="aep-builder"
            ;;
        preview-host)
            image_name="aep-preview-host"
            ;;
        *)
            print_error "Unknown service: $service"
            exit 1
            ;;
    esac

    if [[ -n "$REGISTRY" ]]; then
        echo "$REGISTRY/$image_name"
    else
        echo "$image_name"
    fi
}

get_dockerfile_path() {
    local service=$1
    echo "$PROJECT_ROOT/apps/aep-$service/Dockerfile"
}

# ==============================================================================
# Build Function
# ==============================================================================

build_image() {
    local service=$1
    local image_name=$(get_image_name "$service")
    local dockerfile=$(get_dockerfile_path "$service")
    local full_image="$image_name:$TAG"

    print_header "Building $service"

    # Check if Dockerfile exists
    if [[ ! -f "$dockerfile" ]]; then
        print_error "Dockerfile not found: $dockerfile"
        return 1
    fi

    print_info "Image: $full_image"
    print_info "Dockerfile: $dockerfile"
    print_info "Platform: $PLATFORM"
    print_info "Context: $PROJECT_ROOT"

    # Build arguments
    local build_args=(
        "build"
        "--file" "$dockerfile"
        "--tag" "$full_image"
        "--platform" "$PLATFORM"
        "--progress" "auto"
    )

    # Add cache configuration
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args+=("--no-cache")
    fi

    if [[ -n "$CACHE_FROM" ]]; then
        build_args+=("--cache-from" "$CACHE_FROM")
    fi

    if [[ -n "$CACHE_TO" ]]; then
        build_args+=("--cache-to" "$CACHE_TO")
    fi

    # Add push flag if requested
    if [[ "$PUSH" == "true" ]]; then
        build_args+=("--push")
    fi

    # Add build context
    build_args+=("$PROJECT_ROOT")

    # Execute build
    print_info "Executing: docker buildx ${build_args[*]}"

    if docker buildx "${build_args[@]}"; then
        print_success "Successfully built $full_image"

        # Display image info
        if [[ "$PUSH" != "true" ]]; then
            docker images "$image_name" --filter "label=$TAG" | head -2
        fi

        return 0
    else
        print_error "Failed to build $full_image"
        return 1
    fi
}

# ==============================================================================
# Main Execution
# ==============================================================================

main() {
    # Parse arguments
    local services=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -t|--tag)
                TAG="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -p|--push)
                PUSH="true"
                shift
                ;;
            --platform)
                PLATFORM="$2"
                shift 2
                ;;
            --no-cache)
                NO_CACHE="true"
                shift
                ;;
            --cache-from)
                CACHE_FROM="$2"
                shift 2
                ;;
            --cache-to)
                CACHE_TO="$2"
                shift 2
                ;;
            all|api-gateway|builder|preview-host)
                services+=("$1")
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                ;;
        esac
    done

    # Validate service selection
    if [[ ${#services[@]} -eq 0 ]]; then
        print_error "No service specified"
        usage
    fi

    # Check BuildKit availability
    if ! docker buildx version &> /dev/null; then
        print_error "Docker BuildKit (buildx) is not available"
        print_info "Install it with: docker buildx install"
        exit 1
    fi

    # Create builder if needed
    if ! docker buildx inspect mybuilder &> /dev/null; then
        print_info "Creating BuildKit builder instance..."
        docker buildx create --name mybuilder --use
    else
        docker buildx use mybuilder
    fi

    print_header "Docker BuildKit Optimized Build"
    print_info "Registry: ${REGISTRY:-<none>}"
    print_info "Tag: $TAG"
    print_info "Platform: $PLATFORM"
    print_info "Push: $PUSH"
    print_info "No Cache: $NO_CACHE"

    # Expand 'all' to individual services
    if [[ " ${services[*]} " =~ " all " ]]; then
        services=(api-gateway builder preview-host)
    fi

    # Build each service
    local failed_builds=()
    local successful_builds=()

    for service in "${services[@]}"; do
        if build_image "$service"; then
            successful_builds+=("$service")
        else
            failed_builds+=("$service")
        fi
    done

    # Summary
    print_header "Build Summary"

    if [[ ${#successful_builds[@]} -gt 0 ]]; then
        print_success "Successfully built ${#successful_builds[@]} service(s):"
        for service in "${successful_builds[@]}"; do
            echo "  - $service"
        done
    fi

    if [[ ${#failed_builds[@]} -gt 0 ]]; then
        print_error "Failed to build ${#failed_builds[@]} service(s):"
        for service in "${failed_builds[@]}"; do
            echo "  - $service"
        done
        exit 1
    fi

    print_success "All builds completed successfully!"
}

# Run main function
main "$@"
