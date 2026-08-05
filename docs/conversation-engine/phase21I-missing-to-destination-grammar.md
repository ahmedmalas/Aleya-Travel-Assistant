# Phase 21I — Missing-"to" destination travel grammar

Implements natural destination phrasing where the user omits the word "to"
(for example `I want to go Melbourne`, `go Gold Coast`). Repair is confined to
`DestinationConversationStateExtractor`. No UI, wording, hydration, persistence,
merge, or production deploy.

**Acceptance status:** IMPLEMENTED — PENDING AHMED'S PHYSICAL RUNTIME VERIFICATION.
Automated tests are evidence only; do not treat as production-accepted.

Focused tests:

```text
src/features/conversation-core/__tests__/destinationMissingToGrammar.phase21I.test.ts
```

---

## Confirmed gap (Phases 21D–21F)

Explicit destination cues required `go|travel|fly|head` + **`to`** + place.
Missing-"to" forms fell through; they were not whole-message bare places either.
Bare-answer ownership (21B / 21D / 21F) was already correct and must stay intact.

---

## Ownership boundary

Repair only:

```text
DestinationConversationStateExtractor
  - MISSING_TO_DESTINATION_CUES
  - hasExplicitDestinationCueAlongsideOrigin (coexist with from-origin)
  - asValidatedTitleCasePlace (shared with bare path)
```

Conversation-core **must not** import the travel location intelligence module
(architecture boundary). Place candidates are validated with the existing
alphabetic place-shape + deny-list boundary (no closed city list) — the same
validation used by bare destination follow-up.

---

## Implementation rule

1. With-"to" cues still run first; value casing unchanged.
2. Missing-"to" cues use `(?!to\b)` so `go to Melbourne` stays on the with-"to"
   family.
3. Captures are normalised (including trailing `from …` strip), then validated
   via `asValidatedTitleCasePlace` (1–3 place tokens, deny-list, Title-Case emit).
4. False positives (`I want to go`, `let's go`, `go ahead`, `I want to travel`)
   yield no destination.
5. Bare-answer ownership unchanged: destination-null bare → destination;
   destination-set origin-null bare → origin (21B).

---

## Required flows

| Flow | Result |
| --- | --- |
| A `I want to go Melbourne` → `Sydney` | destination Melbourne; origin Sydney; advances |
| B `travelling from Sydney` → `I want to go Lebanon` | origin kept; destination Lebanon; advances |
| C `go Gold Coast` | destination Gold Coast; asks origin |
| D `I want to go` | no fabricated destination; asks destination |
| E `I want to go Melbourne from Sydney` | destination Melbourne; origin Sydney; no reversal |

---

## Explicit non-goals

```text
UI / catalogue wording changes
Session hydration patches
Phrase-specific full-sentence string matches outside the cue family
Closed city / country whitelist
Importing travel-location-intelligence into conversation-core
```
