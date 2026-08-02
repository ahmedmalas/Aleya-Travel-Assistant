# Phase 21E — Lowercase destination runtime failure audit

Investigation and characterization only. No production fix. No deploy.

Characterization tests:

```text
src/features/conversation-core/__tests__/destinationLowercaseRuntimeFailureAudit.phase21E.test.ts
```

---

## Baseline verification

| Item | Value |
| --- | --- |
| Branch | `cursor/origin-progression-failure-audit-8697` |
| HEAD | `5ff5e9154d6a6d111247cb2239a35635773d47ba` (Phase 21D) |
| Tree at investigation start | clean |
| PR #31 | OPEN, Draft |

---

## Runtime identity findings

| Environment | Deploy | Commit | Phase 21D? |
| --- | --- | --- | --- |
| Production | `dpl_HoMtFR8L114b1EgjsKEbckkxnRyp` | `c2be836…` (main / v1.0.0) | **No** |
| Preview (PR #31 tip) | `dpl_7Z6bBv4QEAev529U1dqdKkAnipEN` | `5ff5e91…` | **Yes** |
| Preview branch alias | `travel-buddy-assistant-ai-git-cursor-1405cc-…` | tracks PR branch | Yes when tip |

Physical transcript (conversation `c2a62457-4cfe-4bec-afd6-d0561a73ecf3`,
Persistence disabled) is **fully reproducible on Phase 21D HEAD** via
`processConversationTurn`. Failure is therefore **not** explained by “runtime
missing 21D” alone: even with 21D, lowercase bare `lebanon` fails by contract.

If Ahmed tested **production**, bare Title-Case would also fail (no bare path).
If Ahmed tested **PR preview 21D**, Title-Case `Lebanon` would succeed while
lowercase fails — matching the casing matrix below.

---

## Exact physical reproduction (HEAD 5ff5e91)

```text
i want to go lebanon
→ destination=null; messageInterpreted=false
→ "Let's start with the destination. Where would you like to travel?"

lebanon
→ destination=null; messageInterpreted=false
→ same destination question
```

---

## Root cause

Two independent extractor gaps in `DestinationConversationStateExtractor`:

1. **Missing-"to" cue gap (Turn 1)**  
   Explicit cues require `go|travel|fly|head` + **`to`** + place (`/i`).  
   `i want to go lebanon` has no `to` → cue miss.  
   Message is not a whole-message bare place → bare path also fails.

2. **Title-Case bare-place restriction (Turn 2 / Phase 21D)**  
   Bare path activates (`destination === null`) but shape requires  
   `/^[A-Z][A-Za-z]*…$/` per token.  
   `lebanon` fails Title-Case → `stateUpdate: {}`.

**Title-Case is not the sole cause** of the physical transcript: Turn 1 fails
even for Title-Case (`I want to go Lebanon`). Turn 2 fails specifically because
of Title-Case (control: `Lebanon` succeeds).

Explicit cues are **case-insensitive** (`/i`). Captured casing is preserved
(`I want to travel to lebanon` → destination `"lebanon"`). There is **no**
destination capitalisation / catalogue / gazetteer layer.

---

## Ownership boundary

| Owner | Role |
| --- | --- |
| `DestinationConversationStateExtractor` | Sole owner of destination cues + bare path |
| Composite / merge / follow-up | Behaved correctly on empty capture |
| UI / hydration / persistence | Not implicated (`Persistence: disabled` is label only) |

No location catalogue exists in conversation-core (architecture forbids
lexicon/cityNames in this extractor).

---

## Safest remediation options (ranked; not implemented)

1. **Bare-path case folding / Title-Case normalisation** when destination
   follow-up is active — keep filler/capability deny-lists; emit a stable
   display form (e.g. capitalise words). Smallest fix for `lebanon`.
2. **Separate future phase:** missing-`"to"` cue (`go <place>`) with careful
   collision guards — needed for `i want to go lebanon`.
3. **Do not** introduce a new gazetteer in the same change unless explicitly
   scoped; deny-lists already protect many capability words when Title-Case.

---

## Stop condition

PR #31 remains Draft. No merge. No deploy. No production extractor patch in
this phase.
