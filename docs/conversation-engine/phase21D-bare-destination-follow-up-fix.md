# Phase 21D — Bare destination follow-up extraction fix

Fixes the Phase 21C root cause for bare destination answers at the canonical
destination extractor boundary. No UI, wording, hydration, persistence, merge,
origin, date, or travel-grammar broadening changes. No deploy.

Focused tests:

```text
src/features/conversation-core/__tests__/destinationBareAnswerProgression.phase21D.test.ts
```

---

## Root cause (accepted Phase 21C)

`DestinationConversationStateExtractor` was cue-only and did not inspect
`currentState`. After an unsupported first message (or a greeting), bare
`Melbourne` / `Melbourne.` produced `{}`, so destination stayed `null` and
follow-up selection correctly re-asked destination.

Missing-"to" phrases such as `I want to go Melbourne` remain unsupported and
are **out of scope** for this phase.

---

## Ownership boundary

Repair only:

```text
DestinationConversationStateExtractor
```

Same architectural approach as Phase 21B origin:

1. Try explicit destination cues first (unchanged).
2. If `isDestinationFollowUpActive(state)` (`destination === null`), try bare place.
3. Emit canonical `stateUpdate.destination` through the existing composite → merge →
   `messageInterpreted` → follow-up selector path.

---

## Active destination contract

Bare place destination extraction activates **only** when:

```text
destination === null
```

This mirrors core follow-up priority (`destination → origin → …`). Explicit
destination cues remain unconditional. When destination is already set, bare
places do not overwrite via this path (origin Phase 21B may claim them when
origin is active).

---

## Supported inputs

When destination owns the follow-up (`Where would you like to travel?`):

```text
Melbourne
Melbourne.
Gold Coast
Sydney
Brisbane
Perth
```

One to three **Title-Case** place tokens (optional internal hyphen/apostrophe),
e.g. `Melbourne`, `Gold Coast`. Reuses `normaliseCapturedDestination`.
Lowercase capability words (`wildlife`, `events`) and mixed-case chatter are
rejected; capability/activity tokens are deny-listed even when Title-Case
(`Sydney Festival`, `Kakadu National Park`).

---

## Guard conditions

Bare place does **not** set destination when:

- destination already exists
- another field owns the follow-up (destination complete)
- the message is a conversational filler / phrase (`hello`, `hi`, `yes`, `no`,
  `maybe`, `not sure`, `surprise me`, `somewhere warm`, `what can you do`,
  `help me`, …)
- the message is hedged, questioned, or not a whole-message place shape

Missing-"to" travel phrasing (`Hi Aleya I want to go Melbourne`) stays
uninterpreted on the cue path.

---

## Before / after runtime trace

### Before (Phase 21C)

```text
Hi Aleya I want to go Melbourne → destination null; re-ask destination
Melbourne                        → destination null; re-ask destination
```

### After (Phase 21D)

```text
Hi Aleya I want to go Melbourne → destination null; re-ask destination (still unsupported cue)
Melbourne                        → destination = Melbourne; ask origin
```

Primary intended path:

```text
Hi Aleya. → uninterpreted; ask destination
Melbourne → destination = Melbourne; messageInterpreted = true; ask origin
```

---

## Files changed

| File | Change |
| --- | --- |
| `DestinationConversationStateExtractor.ts` | Active-destination gate + bare place path |
| `DestinationConversationStateExtractor.test.ts` | Architecture assertion allows gate-only currentState |
| `destinationBareAnswerProgression.phase21D.test.ts` | New focused Phase 21D tests |
| `destination.test.ts` | Bare place removed from “unsupported alone” list |
| `architecture.boundary.test.ts` | Destination currentState gate noted |
| `originBareAnswerProgression.phase21B.test.ts` | Guard expectation updated for 21D destination claim |
| `originBareAnswerProgressionAudit.phase21A.test.ts` | Guard comment/assertion updated; history retained |
| `phase21B-…-fix.md` | Known-gaps pointer |
| `phase21D-…-fix.md` | This document |

---

## Tests added / updated

| Suite | Role |
| --- | --- |
| `destinationBareAnswerProgression.phase21D.test.ts` | Primary reproduction, follow-ups, guards, missing-"to" out of scope |
| Destination / architecture / 21A / 21B characterization | Intentional expectation updates only |

---

## Validation

| Check | Result |
| --- | --- |
| Focused Phase 21D + destination / origin / 21A–21B | pass |
| conversation-core | 2120 passed (204 files) |
| Full repository | 2333 passed (261 files) |
| Typecheck | pass |
| Clean production build | pass |

Note: `commandCentre.test.ts` departure fixture refreshed (pre-existing date
drift vs runtime “today”); unrelated to destination extraction.

---

## Remaining known gaps (future phases)

```text
missing-"to" destination travel cues (go Melbourne)
bare departure-date follow-up extraction
bare return-date follow-up extraction
```

---

## Stop condition

PR #31 remains Draft. No merge. No deploy. No missing-"to" or date bare fixes.
