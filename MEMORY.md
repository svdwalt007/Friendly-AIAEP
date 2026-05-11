# MEMORY.md — Project State (Session-Persistent)
# ─────────────────────────────────────────────────────────────────────────────
# Updated by: /wrapup protocol
# Read by: session start protocol (step 2)
# Rule: Store reusable institutional knowledge only.
#       Do NOT store session narratives or derivable info.
# ─────────────────────────────────────────────────────────────────────────────

## CURRENT STATE
```
Last session : [date]
Build status : [PASS/FAIL]
Test status  : [N/N PASS]
Coverage     : [line%/branch%]
Open QA items: [count]
```

---

## ARCHITECTURE

### Key Design Decisions
- [decision 1] — [rationale] — [impact]
- [decision 2] — [rationale] — [impact]

### Module Map
```
src/
├── [module]/    — [responsibility]
├── [module]/    — [responsibility]
└── [module]/    — [responsibility]
```

### External Dependencies & Quirks
```
[library name] v[version]:
  - [quirk or gotcha discovered during dev]
  - [non-obvious API behaviour]
  
[protocol/spec]:
  - [ambiguity found in spec section X.Y]
  - [implementation decision taken]
```

---

## QA OPEN

Format: [file:line] — [gate] — [description] — [added: date]

```
```

---

## PERFORMANCE BASELINES
```
[metric name]: [value] [unit] @ [date]
[metric name]: [value] [unit] @ [date]
```

---

## FRAGILE AREAS
Areas requiring extra test care and review attention:
```
- [file:function] — [why fragile] — [mitigation]
```

---

## EXTERNAL API NOTES
```
[service/API name]:
  - [discovered quirk]
  - [rate limit]
  - [auth gotcha]
```
