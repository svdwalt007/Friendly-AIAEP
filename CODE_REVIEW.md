# CODE_REVIEW.md — PR Review Checklist
# Version: 2.0
# ─────────────────────────────────────────────────────────────────────────────
# Usage: Reference during every PR review. 
#        Link findings back to this checklist in review comments.
# ─────────────────────────────────────────────────────────────────────────────

## HOW TO USE

1. Run all automated gates first (CI must be green before human review)
2. Execute the four passes in order
3. Use severity codes: **[BLOCK]** / **[WARN]** / **[NOTE]**
4. BLOCK = merge prohibited. WARN = fix in follow-up. NOTE = optional.
5. Paste findings using the format at the bottom

---

## PASS 1 — Safety, Security & Resources

### Memory & Resources
- [ ] All allocations paired with deallocation in all code paths
- [ ] No use-after-free, no double-free
- [ ] All handles (file, socket, mutex, semaphore) released on every exit path
- [ ] RAII used for resource ownership (C++) / try-with-resources (Java) / context managers (Python)
- [ ] No unguarded shared mutable state between threads

### Bounds & Arithmetic
- [ ] All buffer accesses bounds-checked before use
- [ ] No integer overflow in size/offset arithmetic
- [ ] No unsafe string functions (strcpy, sprintf without n)
- [ ] Pointer arithmetic is explicit and verified

### Input Validation
- [ ] All external input (network, file, CLI, IPC) validated at entry point
- [ ] Oversized inputs rejected (DoS protection)
- [ ] Protocol: message length/type validated before payload access

### Error Handling
- [ ] All fallible calls checked — no discarded return values
- [ ] No empty catch/except blocks
- [ ] No silent error swallowing
- [ ] Error propagation is explicit

### Security
- [ ] No hardcoded credentials/keys/tokens anywhere
- [ ] No secrets in log output
- [ ] No homebrew crypto
- [ ] TLS/DTLS validation not bypassed
- [ ] SQL: parameterised queries only (if applicable)
- [ ] Input sanitised before use in commands/queries (if applicable)

### Embedded-Specific
- [ ] No heap allocation in ISR or hard-RT paths
- [ ] No blocking calls without timeout
- [ ] Stack depth analysed for deepest call path
- [ ] Hardware registers accessed atomically where required

---

## PASS 2 — Correctness & Protocol

### Logic
- [ ] All conditional branches reviewed independently
- [ ] Loop termination guaranteed
- [ ] Null/nil/None checked before dereference
- [ ] Switch/match has default case
- [ ] State machine: all states reachable, all transitions handled

### Protocol (check applicable)
- [ ] CoAP: message type, code, token, MID correct per RFC 7252
- [ ] LwM2M: object/resource IDs match OMNA, TLV/CBOR format correct
- [ ] DTLS: session reconnect after PSM/eDRX sleep handled
- [ ] MQTT: QoS semantics, session persistence correct
- [ ] HTTP/REST: status codes correct, idempotency respected
- [ ] gRPC/protobuf: field numbers stable, backward compatible

### Serialisation
- [ ] Serialise/deserialise round-trip tested
- [ ] Endianness explicit — no platform assumptions
- [ ] Variable-length fields correctly handled

### Concurrency
- [ ] No data races (TSan/race detector clean)
- [ ] Lock ordering documented (deadlock prevention)
- [ ] No I/O while holding lock
- [ ] Condition variables: spurious wakeup handled

### Timing
- [ ] All blocking operations have timeouts
- [ ] Retry has backoff + max limit
- [ ] Retry is idempotent or has deduplication

---

## PASS 3 — Test Quality

### Coverage
- [ ] Every public function: happy path + error path + boundary test
- [ ] Every conditional branch exercised
- [ ] Every exception/error type triggered
- [ ] Coverage report: 100% line AND branch for modified files

### Assertion Quality
- [ ] No trivial assertions (assertTrue(true), assertNotNull without value check)
- [ ] Expected values are specific, not just range-checks
- [ ] Exception tests verify type AND message
- [ ] Mock verifications check actual call arguments

### Test Isolation
- [ ] No shared mutable state between tests
- [ ] No test depends on execution order
- [ ] No Thread.sleep / time.sleep — deterministic fakes for time
- [ ] Network, filesystem, clock mocked in unit tests

### Test Design
- [ ] Names: test_[unit]_[condition]_[expectedOutcome]
- [ ] Arrange / Act / Assert structure clear
- [ ] Regression tests for any bug fixed (named with issue reference)
- [ ] Parametric tests for boundary/equivalence classes

### Mock Fidelity
- [ ] Mocks simulate realistic failures, not just success
- [ ] Mocks verify correct data was sent
- [ ] No mocking the unit under test

---

## PASS 4 — Maintainability & Design

### Naming & Structure
- [ ] Function names describe WHAT, not HOW
- [ ] Variable names precise — no unexplained single letters
- [ ] Constants named with units where applicable
- [ ] No magic numbers inline
- [ ] Functions ≤ 40 lines
- [ ] Files ≤ 500 lines

### Documentation
- [ ] All public APIs have complete docstrings
- [ ] Non-obvious logic has explanatory comments (WHY, not WHAT)
- [ ] Complex algorithms reference source (paper, spec, RFC section)
- [ ] Error messages are actionable

### Logging
- [ ] Sufficient for production diagnosis
- [ ] Not noisy
- [ ] No sensitive data in logs
- [ ] Structured where applicable

### Design
- [ ] No speculative abstractions
- [ ] Dependency direction correct (no upward dependencies)
- [ ] No circular dependencies introduced
- [ ] CHANGELOG updated for public API changes

---

## FINDINGS FORMAT

```
[SEVERITY-ID] `file:line` — SHORT TITLE
Description of the issue.
Fix: specific remediation.
```

Severity codes:
- `[BLOCK-S1]` — Safety/Security finding N
- `[BLOCK-C1]` — Correctness finding N
- `[BLOCK-T1]` — Test quality finding N
- `[WARN-M1]`  — Maintainability finding N
- `[NOTE-M1]`  — Optional improvement N

---

## GATE RESULT TEMPLATE

```
## GATE RESULT

| Gate  | Findings | Verdict |
|-------|----------|---------|
| Safety/Security | N BLOCK, N WARN | ❌/✅ |
| Correctness     | N BLOCK, N WARN | ❌/✅ |
| Test Quality    | N BLOCK, N WARN | ❌/✅ |
| Maintainability | 0 BLOCK, N WARN | ✅    |

VERDICT: [❌ BLOCKED | ✅ APPROVED | ✅ APPROVED WITH CONDITIONS]

Conditions (if any):
- [condition 1]
```
