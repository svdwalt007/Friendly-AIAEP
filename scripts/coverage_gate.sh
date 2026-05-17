#!/usr/bin/env bash
# coverage_gate.sh — Universal coverage enforcement
# Version: 2.0 | Auto-detects project language
# Usage: ./coverage_gate.sh [min_line] [min_branch]
#        Defaults: 100 100
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MIN_LINE="${1:-100}"
MIN_BRANCH="${2:-100}"
PASS=0
FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; FAIL=1; }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# ─────────────────────────────────────────────────────────────────────────────
# LANGUAGE DETECTION
# ─────────────────────────────────────────────────────────────────────────────

detect_language() {
  if [ -f "CMakeLists.txt" ] || [ -f "west.yml" ]; then
    echo "cpp"
  elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ] || [ -f "pom.xml" ]; then
    echo "java"
  elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "setup.cfg" ]; then
    echo "python"
  elif [ -f "package.json" ] && [ -f "tsconfig.json" ]; then
    echo "typescript"
  elif [ -f "go.mod" ]; then
    echo "go"
  elif [ -f "Cargo.toml" ]; then
    echo "rust"
  else
    echo "unknown"
  fi
}

LANG=$(detect_language)
log_info "Detected language: $LANG"
log_info "Coverage thresholds: line≥${MIN_LINE}%, branch≥${MIN_BRANCH}%"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# COVERAGE BY LANGUAGE
# ─────────────────────────────────────────────────────────────────────────────

run_cpp() {
  log_info "Running C/C++ coverage via gcovr..."
  
  if ! command -v gcovr &>/dev/null; then
    log_fail "gcovr not found. Install: pip install gcovr"
    return 1
  fi
  
  gcovr \
    --root . \
    --exclude '.*test.*' \
    --exclude '.*mock.*' \
    --exclude '.*third_party.*' \
    --exclude '.*generated.*' \
    --exclude '.*build.*' \
    --branches \
    --fail-under-line "${MIN_LINE}" \
    --fail-under-branch "${MIN_BRANCH}" \
    --html-details coverage/index.html \
    --print-summary \
    2>&1 | tee .coverage.log
  
  local exit_code=${PIPESTATUS[0]}
  if [ $exit_code -eq 0 ]; then
    log_pass "C/C++ coverage gate passed"
  else
    log_fail "C/C++ coverage below threshold — see .coverage.log"
    echo ""
    echo "Uncovered lines:"
    gcovr --root . --branches \
      --exclude '.*test.*' --exclude '.*third_party.*' \
      --print-summary 2>/dev/null | grep -E "TOTAL|0%" || true
    return $exit_code
  fi
}

run_java() {
  log_info "Running Java coverage via JaCoCo..."
  
  if [ -f "gradlew" ]; then
    ./gradlew jacocoTestReport jacocoTestCoverageVerification --quiet 2>&1 | tee .coverage.log
    local exit_code=${PIPESTATUS[0]}
    if [ $exit_code -eq 0 ]; then
      log_pass "Java JaCoCo coverage gate passed"
    else
      log_fail "Java coverage below threshold — check build/reports/jacoco/"
      return $exit_code
    fi
  elif [ -f "pom.xml" ]; then
    mvn jacoco:report jacoco:check --quiet 2>&1 | tee .coverage.log
    local exit_code=${PIPESTATUS[0]}
    [ $exit_code -eq 0 ] && log_pass "Maven JaCoCo passed" || { log_fail "Maven JaCoCo failed"; return $exit_code; }
  else
    log_fail "No Gradle or Maven build file found"
    return 1
  fi
}

run_python() {
  log_info "Running Python coverage via coverage.py..."
  
  if ! command -v coverage &>/dev/null && ! python -m coverage --version &>/dev/null; then
    log_fail "coverage.py not found. Install: pip install coverage"
    return 1
  fi
  
  python -m pytest \
    --cov=src \
    --cov-branch \
    --cov-report=term-missing \
    --cov-report=html:coverage/ \
    --cov-fail-under="${MIN_LINE}" \
    -q 2>&1 | tee .coverage.log
  
  local exit_code=${PIPESTATUS[0]}
  if [ $exit_code -eq 0 ]; then
    log_pass "Python coverage gate passed"
  else
    log_fail "Python coverage below ${MIN_LINE}% — see .coverage.log"
    echo ""
    python -m coverage report --show-missing 2>/dev/null | grep -v "100%" || true
    return $exit_code
  fi
}

run_typescript() {
  log_info "Running TypeScript/JS coverage via Jest/c8..."
  
  if ! command -v npx &>/dev/null; then
    log_fail "npx not found. Install Node.js"
    return 1
  fi
  
  npx jest \
    --coverage \
    --coverageThreshold="{\"global\":{\"lines\":${MIN_LINE},\"branches\":${MIN_BRANCH},\"functions\":100,\"statements\":100}}" \
    --forceExit \
    --silent 2>&1 | tee .coverage.log
  
  local exit_code=${PIPESTATUS[0]}
  if [ $exit_code -eq 0 ]; then
    log_pass "TypeScript coverage gate passed"
  else
    log_fail "TypeScript coverage below threshold — see .coverage.log"
    return $exit_code
  fi
}

run_go() {
  log_info "Running Go coverage..."
  
  if ! command -v go &>/dev/null; then
    log_fail "go not found"
    return 1
  fi
  
  go test -race -coverprofile=.coverage.out -covermode=atomic ./... 2>&1 | tee .test.log
  local test_exit=${PIPESTATUS[0]}
  [ $test_exit -eq 0 ] || { log_fail "Go tests failed"; return $test_exit; }
  
  go tool cover -html=.coverage.out -o coverage/index.html 2>/dev/null || true
  
  COVERAGE=$(go tool cover -func=.coverage.out | tail -1 | awk '{print $3}' | tr -d '%')
  echo "Total coverage: ${COVERAGE}%"
  
  if awk -v c="$COVERAGE" -v min="$MIN_LINE" 'BEGIN{exit !(c+0 >= min+0)}'; then
    log_pass "Go coverage gate passed (${COVERAGE}%)"
  else
    log_fail "Go coverage ${COVERAGE}% < required ${MIN_LINE}%"
    echo ""
    echo "Uncovered functions:"
    go tool cover -func=.coverage.out | grep -v "100.0%" | grep -v "^total" || true
    return 1
  fi
}

run_rust() {
  log_info "Running Rust coverage via cargo-tarpaulin..."
  
  if ! cargo tarpaulin --version &>/dev/null; then
    log_info "Installing cargo-tarpaulin..."
    cargo install cargo-tarpaulin --quiet
  fi
  
  cargo tarpaulin \
    --fail-under "${MIN_LINE}" \
    --branches \
    --out Html \
    --output-dir coverage/ \
    --print-summary 2>&1 | tee .coverage.log
  
  local exit_code=${PIPESTATUS[0]}
  if [ $exit_code -eq 0 ]; then
    log_pass "Rust coverage gate passed"
  else
    log_fail "Rust coverage below ${MIN_LINE}% — see .coverage.log"
    return $exit_code
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# GREP GATE (universal)
# ─────────────────────────────────────────────────────────────────────────────

run_grep_gate() {
  log_info "Running grep gate for forbidden patterns..."
  
  local grep_fail=0
  local source_dirs="src lib app"
  
  declare -a PATTERNS=(
    "TODO" "FIXME" "HACK" "XXX"
    "stub" "placeholder"
    "not implemented"
    "throw new RuntimeException"
    "raise NotImplementedError"
    "unimplemented!()"
    "todo!()"
  )
  
  for dir in $source_dirs; do
    [ -d "$dir" ] || continue
    for pattern in "${PATTERNS[@]}"; do
      if grep -rn "$pattern" "$dir" \
           --include="*.cpp" --include="*.hpp" --include="*.h" \
           --include="*.java" --include="*.py" \
           --include="*.ts" --include="*.tsx" \
           --include="*.go" --include="*.rs" 2>/dev/null; then
        echo "  → Found forbidden pattern: '$pattern'"
        grep_fail=1
      fi
    done
  done
  
  if [ $grep_fail -eq 0 ]; then
    log_pass "Grep gate — no forbidden patterns"
  else
    log_fail "Grep gate — forbidden patterns found (see above)"
    FAIL=1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# DIFF CHECK
# ─────────────────────────────────────────────────────────────────────────────

run_diff_check() {
  log_info "Running diff check for silent deletions..."
  
  if ! command -v git &>/dev/null || ! git rev-parse --git-dir &>/dev/null; then
    log_info "Not a git repo — skipping diff check"
    return 0
  fi
  
  local deleted_src
  deleted_src=$(git diff --diff-filter=D HEAD --name-only 2>/dev/null | \
    grep -v "^test\|^spec\|__test__\|_test\.\|_spec\." || true)
  
  if [ -z "$deleted_src" ]; then
    log_pass "Diff check — no source files deleted"
  else
    echo -e "${YELLOW}[WARN]${NC} Source files deleted — verify each is intentional:"
    echo "$deleted_src" | sed 's/^/  → /'
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COVERAGE GATE — OpenClaw Quality Enforcement"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p coverage

# Run coverage for detected language
case "$LANG" in
  cpp)        run_cpp        ;;
  java)       run_java       ;;
  python)     run_python     ;;
  typescript) run_typescript ;;
  go)         run_go         ;;
  rust)       run_rust       ;;
  *)
    log_fail "Unknown language — set LANGUAGE env var or create a project file"
    FAIL=1
    ;;
esac

echo ""
run_grep_gate
echo ""
run_diff_check

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}GATE: ALL PASS${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo -e "  ${RED}GATE: BLOCKED — fix above failures before proceeding${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
