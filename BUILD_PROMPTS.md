# BUILD_PROMPTS.md — Sprint Tracker & Session Context
# ─────────────────────────────────────────────────────────────────────────────
# This is the session gravity well. Read on every session start.
# OpenClaw routing: CLAUDE.md → MEMORY.md → BUILD_PROMPTS.md → work
# ─────────────────────────────────────────────────────────────────────────────

## PROJECT
```
NAME     : <project name>
REPO     : <github url>
LANGUAGE : <cpp | java | python | typescript | go | rust>
PLATFORM : <server | client | embedded | library>
BRANCH   : <current working branch>
```

---

## SESSION START COMMANDS

```bash
# 1. Verify baseline (run before ANY new work)
[BUILD_CMD]
[TEST_CMD]
./scripts/coverage_gate.sh

# 2. Check for pending RED tests from last session
grep -n "STATUS: RED" BUILD_PROMPTS.md

# Expected output: BUILD: PASS | TESTS: N/N | COVERAGE: 100%
# If baseline fails → fix it FIRST, do not start new work
```

---

## CURRENT SPRINT

### IN PROGRESS
```
[ ] TASK-001 — [description]
    Status: [RED/GREEN/REFACTOR/COMPLETE]
    Files:  [file list]
    Notes:  [any context]
```

### READY (not started)
```
[ ] TASK-002 — [description]
    Acceptance: [what done looks like]
    
[ ] TASK-003 — [description]
    Acceptance: [what done looks like]
```

### BLOCKED
```
[ ] TASK-004 — [description]
    Blocked by: [reason]
    Unblocked when: [condition]
```

---

## QA OPEN ITEMS

Coverage gaps and review findings that must be resolved.
Format: [file:line] — [gate] — [description] — [added: YYYY-MM-DD]

```
[ ] src/module.cpp:147 — COVERAGE — timeout path in send_update() not covered — 2026-01-15
[ ] src/parser.cpp:89  — REVIEW   — [WARN-S2] recv() without timeout — 2026-01-15
```

---

## COMPLETED (this sprint)

```
[x] TASK-000 — Example completed task
    Completed: 2026-01-14
    Tests added: test_send_update_timeout, test_send_update_success
    Coverage: 100% line + branch
```

---

## ARCHITECTURE DECISIONS (session-persistent)

Record decisions made during dev that affect future work:

```
ADR-001: Use static memory pool for CoAP message buffers
  Reason: No heap in ISR context (Law L5)
  Impact: MAX_COAP_MSGS = 8 (config.h), adjust if throughput requires
  Date: 2026-01-14
```

---

## KNOWN FRAGILE AREAS

Areas that require extra test care:

```
- src/dtls_session.cpp: DTLS reconnect after PSM sleep — timing-sensitive
- src/lwm2m_parser.cpp: TLV type field bit 6 — spec is ambiguous
- src/coap_client.cpp:  Observe cancel race condition (see ADR-002)
```

---

## SESSION WRAP TEMPLATE (/wrapup)

```
## Session [date] Wrap

### Completed
- [task ID] — [what was done]

### Memory updates
- [what was added/changed in MEMORY.md]

### Open items added
- [new QA_OPEN entries]

### Next session start
- First: resolve [specific QA_OPEN item]
- Then: [next task]
```
