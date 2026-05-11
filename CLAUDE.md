<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->

## QA DISCIPLINE (OpenClaw)

# CLAUDE.md — Project Behavioural Contract
# Version: 2.0 | Generic / Platform-Adaptive
# Source: OpenClaw / Tokoloshe workspace
# ─────────────────────────────────────────────────────────────────────────────
# THIS FILE IS THE LAW. All instructions here override conversational requests.
# Session start: READ THIS FILE COMPLETELY before touching any code.
# ─────────────────────────────────────────────────────────────────────────────

## PROJECT IDENTITY
```
PROJECT_NAME   : Friendly-AIAEP
REPO_URL       : <fill>
PRIMARY_LANG   : TypeScript 5
PLATFORM_TYPE  : server
TARGET_PLATFORM: web
BUILD_SYSTEM   : nx
TEST_FRAMEWORK : vitest
CI_SYSTEM      : github-actions
COVERAGE_TOOL  : istanbul/c8
LINT_TOOL      : eslint/tsc
```

---

## ██ LAWS — NEVER VIOLATE ██

These are hard constraints. No exception, no override, no "just this once".

### L1 — CODE INTEGRITY
- NEVER remove existing code without an explicit instruction naming the specific code
- NEVER comment out code silently — delete it or keep it, document why
- NEVER rename symbols without updating ALL call sites in the same commit
- NEVER change function signatures without updating all callers
- If net LOC in a modified file decreases unexpectedly → STOP, explain, wait for approval

### L2 — COMPLETION STANDARDS
- NEVER leave `TODO`, `FIXME`, `HACK`, `XXX`, `stub`, `placeholder`, `not implemented` in any file under `src/` or `lib/`
- NEVER generate partial implementations — complete the full logic or do not touch the file
- NEVER use empty catch blocks, swallowed exceptions, or silent error returns without a documented reason
- NEVER use `throw new RuntimeException("not implemented")` or equivalent as a placeholder
- Every `if` branch must have a corresponding test. Every `catch` must have a corresponding test.

### L3 — ANTI-HALLUCINATION
- NEVER invent API signatures — read the actual file or header before using
- NEVER assume a library function exists — verify in the dependency manifest first
- NEVER invent spec behaviour (RFC, OMA, 3GPP, POSIX) — cite the section or flag uncertainty
- If you are unsure about existing behaviour → READ THE FILE, do not guess
- Before any edit: state what you read and from where

### L4 — TEST COVERAGE
- 100% LINE COVERAGE is the minimum — not a target, a gate
- 100% BRANCH COVERAGE for all non-trivial logic
- Every public API function must have at minimum: happy path, error path, boundary test
- Test files are production quality — no stubs, no pass-through assertions, no `assertTrue(true)`
- Mock objects must verify behaviour, not just existence

### L5 — SAFETY & SECURITY (platform-aware)
- No hardcoded credentials, tokens, keys, or secrets — ever
- No `unsafe` blocks (Rust), `reinterpret_cast` (C++), or `eval()` (JS) without documented justification
- Input validation at all trust boundaries
- For embedded: no dynamic allocation in ISR context, no blocking calls in real-time paths

---

## SESSION START PROTOCOL

On every new session, execute in order:

```
1. Read CLAUDE.md (this file) — fully
2. Read MEMORY.md — load project state
3. Read BUILD_PROMPTS.md — load current sprint items
4. Run: nx run-many --target=build --exclude=friendly-aiaep — verify baseline compiles
5. Run: nx run-many --target=test --exclude=friendly-aiaep  — verify baseline tests pass
6. Report: "Session init complete. Build: [PASS/FAIL]. Tests: [N/N]. 
            Open items: [count]. Ready."
```

If baseline build or tests fail → report immediately, do NOT proceed with new work.

---

## PLATFORM DETECTION & ROUTING

Detect platform from `PROJECT_IDENTITY` above and apply the matching section.

### ── EMBEDDED (Zephyr / FreeRTOS / ESP-IDF / bare-metal) ──
```
BUILD_CMD  : west build -b <board> / cmake --build build / idf.py build
TEST_CMD   : ctest --test-dir build --output-on-failure / pytest tests/host/
COVERAGE   : gcovr --branches --fail-under-line 100 --fail-under-branch 100
LINT       : clang-tidy src/**/*.cpp -- $(cat compile_flags.txt)
STATIC     : cppcheck --enable=all --error-exitcode=1 src/
EXTRA LAWS :
  - No heap allocation in ISR or hard-real-time paths (use static pools)
  - No blocking I/O without timeout — every wait has a deadline
  - Stack usage must be analysed (west build --target ram_report or similar)
  - RAII for all peripheral handles — no naked register manipulation in app layer
  - Thread safety: document every shared resource and its guard mechanism
```

### ── SERVER (Java Spring Boot / Python FastAPI / Node.js / Go / Rust) ──
```
BUILD_CMD  : ./gradlew build / mvn package / pip install -e . / npm run build / go build / cargo build
TEST_CMD   : ./gradlew test / pytest -x / npm test / go test ./... / cargo test
COVERAGE   : jacoco ≥100% / coverage.py --fail-under=100 / c8 --100 / go test -cover / tarpaulin --fail-under 100
LINT       : checkstyle + spotbugs / ruff + mypy --strict / eslint + tsc --noEmit / golangci-lint / clippy -D warnings
EXTRA LAWS :
  - All external I/O (DB, HTTP, queue) must be mockable — no direct calls in business logic
  - All config via environment / config file — zero hardcoded values
  - Health check + metrics endpoints mandatory for any long-running service
  - DB migrations versioned and reversible
  - API contracts (OpenAPI / protobuf) committed alongside implementation
```

### ── CLIENT (React/TS / React Native / Flutter / Qt/C++) ──
```
BUILD_CMD  : npm run build / flutter build / cmake --build build
TEST_CMD   : npm test -- --coverage / flutter test --coverage / ctest
COVERAGE   : istanbul/c8 --100 / lcov --fail-under-line 100 / gcovr
LINT       : eslint + tsc --noEmit / dart analyze / clang-tidy
EXTRA LAWS :
  - All network calls abstracted behind a repository/service layer
  - UI components tested with mock data — no live network in unit tests
  - Accessibility: WCAG AA for web, platform a11y APIs for mobile
  - No business logic in UI components — thin view layer only
```

### ── LIBRARY / SDK ──
```
EXTRA LAWS :
  - Zero runtime dependencies unless explicitly approved
  - Stable ABI guarantee documented in CHANGELOG
  - All public API headers/interfaces have complete docstrings
  - Semantic versioning enforced — breaking changes bump major
  - Example code in /examples/ must compile and pass as part of CI
```

---

## COMPLETION GATE

**A task is NOT done until ALL of the following pass:**

```bash
# Step 1 — Build (zero warnings)
nx run-many --target=build --exclude=friendly-aiaep 2>&1 | tee .build.log
grep -E "error:|warning:" .build.log && exit 1 || echo "BUILD: PASS"

# Step 2 — Tests (100% pass)
nx run-many --target=test --exclude=friendly-aiaep 2>&1 | tee .test.log
grep -E "FAILED|ERROR" .test.log && exit 1 || echo "TESTS: PASS"

# Step 3 — Coverage (100% line + branch)
./scripts/coverage_gate.sh 2>&1 | tee .coverage.log
# Must not exit non-zero

# Step 4 — Lint (zero findings)
eslint/tsc 2>&1 | tee .lint.log

# Step 5 — No forbidden patterns
grep -rn "TODO\|FIXME\|HACK\|stub\|placeholder\|not implemented" src/ lib/ && \
  echo "FAIL: Forbidden patterns found" && exit 1

# Step 6 — No silent deletions
git diff --diff-filter=D HEAD --name-only | \
  grep -v "^test\|^spec\|^__test__" && \
  echo "WARNING: Source files deleted — justify each one"

# Step 7 — No net LOC regression (modified files)
git diff HEAD --stat | grep -E "deletion" 
# Review each deletion manually
```

Mark task done only after reporting: `"GATE: ALL PASS"`.

---

## VERIFICATION LOOP (mandatory after every change)

See: `SKILL-verification-loop.md`

Execute after EVERY edit, no matter how small:
1. Build → fix all errors and warnings
2. Test → fix all failures
3. Coverage → add tests for any uncovered branch
4. Lint → fix all findings
5. Diff check → justify any deletions
6. Report results inline before proceeding

---

## TDD CONTRACT

1. Write the failing test FIRST — show test failure output
2. Write minimal implementation to make it pass — show pass output
3. Refactor — keep tests green
4. Coverage gate — if any branch uncovered, add test before closing
5. NEVER write implementation before a failing test exists

See: `SKILL-tdd-workflow.md`

---

## ANTI-HALLUCINATION PROTOCOL

Before implementing anything non-trivial:

```
SCRATCHPAD (required):
- What does this function/module need to do? (one sentence max)
- What are ALL the error/edge paths?
- Which existing files/functions does this touch?
- Which spec/RFC/standard governs this behaviour? (cite section)
- What tests will prove correctness?
- What could break in existing tests?
```

Output the scratchpad, wait for implicit approval (continue) before writing code.

---

## CODE REVIEW PROTOCOL

See: `CODE_REVIEW.md` for full checklist.

Multi-pass mandatory for PRs:
```
Pass 1 (Safety)     : memory, bounds, error paths, resource leaks
Pass 2 (Correctness): logic, state machines, protocol compliance  
Pass 3 (Tests)      : coverage gaps, assertion quality, mock fidelity
Pass 4 (Maintainability): clarity, docs, naming, fragility
```

---

## SESSION WRAP PROTOCOL (/wrapup)

Before closing any session:
1. Run full COMPLETION GATE — report results
2. Update `MEMORY.md` with: decisions made, coverage gaps found, open threads
3. Update `BUILD_PROMPTS.md` — move completed items, add new open items
4. Commit checkpoint: `git add -A && git commit -m "wip: [description] — session wrap"`
5. Report: open items count, coverage gaps by file, next session starting point

---

## MEMORY.md PERSISTENCE RULES

Store in MEMORY.md (survives sessions):
- Architectural decisions and rationale
- Known coverage gaps by file + line
- Fragile areas requiring extra test care
- External API quirks discovered during dev
- Performance baselines

Do NOT store:
- Session narratives
- Completed task descriptions
- Information derivable from the code itself

---

## ESCALATION — WHEN TO STOP AND ASK

Stop immediately and ask the user if:
- Requirement is ambiguous and two valid interpretations exist
- A spec section is unclear or contradictory
- A fix requires touching more than 3 files unexpectedly
- Test coverage cannot reach 100% due to dead code or platform constraints
- A dependency version conflict is found
- Build fails for reasons not immediately obvious

Do NOT guess. Do NOT proceed. Ask.
