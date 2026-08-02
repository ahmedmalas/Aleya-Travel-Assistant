# Phase 21B — Origin bare-answer progression fix

Fixes the Phase 21A root cause at the canonical origin extractor boundary.
No UI, hydration, persistence, destination, or date extraction changes.
No deploy.

Characterization / focused tests:

```text
src/features/conversation-core/__tests__/originBareAnswerProgression.phase21B.test.ts
```

---

## Accepted Phase 21A root cause

`OriginConversationStateExtractor` was cue-only. Bare `Sydney` / `Sydney.`
produced `{}`, so origin stayed `null` and follow-up selection correctly
re-asked origin. Session hydration and `Persistence: disabled` were not the
defect.

---

## Canonical ownership rule

Bare place origin extraction activates **only** when origin is the next
required core travel field:

```text
destination !== null
origin === null
```

This mirrors `selectConversationFollowUpQuestion` core priority
(`destination → origin → departureDate → returnDate`) without importing the
selector. Explicit origin cues still run first and remain unconditional.

---

## Active-context conditions

| Condition | Bare place allowed? |
| --- | --- |
| destination set, origin null | yes |
| destination null | no |
| origin already set | no |
| departure / return active (origin complete) | no |

---

## Supported inputs (production path)

After destination is complete:

```text
Sydney
Sydney.
from Sydney
I am travelling from Sydney
I will be travelling from Sydney
```

Each yields `origin = <place>`, `messageInterpreted = true`, next follow-up =
departure date.

Bare answers are **single place tokens** (optional internal hyphen/apostrophe).
Multi-word places (e.g. `Gold Coast`) continue to use explicit from-cues.

---

## Guard conditions

Bare place does **not** set origin when:

- destination is still required
- origin is already populated
- departure/return owns the follow-up
- the bare token equals the completed destination (case-insensitive)
- the token is a conversational filler (`Okay`, `Thanks`, `Maybe`, …)
- the message is multi-word chatter or hedged/question forms

(`maybe Brisbane`, `Sydney?`, `Brisbane please`, `Gold Coast` bare) stay
uninterpreted on the bare path.

---

## State progression before and after

### Before (Phase 21A)

```text
Melbourne (cued) → destination set; ask origin
Sydney.          → origin null; re-ask origin
Sydney.          → origin null; re-ask origin
```

### After (Phase 21B)

```text
Melbourne (cued) → destination set; ask origin
Sydney.          → origin = Sydney; ask departure date
```

---

## Files changed

| File | Change |
| --- | --- |
| `OriginConversationStateExtractor.ts` | Active-origin gate + bare place path |
| `OriginConversationStateExtractor.test.ts` | Architecture assertion allows gate-only currentState |
| `originBareAnswerProgression.phase21B.test.ts` | New focused Phase 21B tests |
| `originBareAnswerProgressionAudit.phase21A.test.ts` | Expectations updated to corrected behaviour; history retained |
| `phase21A-…-audit.md` | Status pointer to Phase 21B |
| `phase21B-…-fix.md` | This document |

---

## Tests added / updated

| Suite | Role |
| --- | --- |
| `originBareAnswerProgression.phase21B.test.ts` | Focused positive, multi-turn, guards |
| `originBareAnswerProgressionAudit.phase21A.test.ts` | Expectations updated to corrected behaviour |
| `OriginConversationStateExtractor.test.ts` | Architecture allows gate-only currentState |
| `architecture.boundary.test.ts` | Origin currentState gate noted |
| `extractConversationState.test.ts` | Bare origin retention path updated |
| `unsupportedInputSelectionAudit.phase18A.test.ts` | Bare unknown place now interpreted as origin |

---

## Validation results

| Check | Result |
| --- | --- |
| Focused Phase 21B + origin suites | pass |
| conversation-core | 2106 passed (203 files) |
| Full repository | 2319 passed (260 files) |
| Typecheck | pass |
| Clean production build | pass |

---

## Known related gaps left untouched (future phases)

```text
bare departure-date follow-up extraction
bare return-date follow-up extraction
missing-"to" destination travel cues (go Melbourne)
```

**Status update:** Phase 21D repaired bare-destination follow-up extraction at
`DestinationConversationStateExtractor`. See
`phase21D-bare-destination-follow-up-fix.md`.

---

## Stop condition

PR #31 remains Draft. No merge. No deploy. No missing-"to" / date bare fixes
from this phase.
