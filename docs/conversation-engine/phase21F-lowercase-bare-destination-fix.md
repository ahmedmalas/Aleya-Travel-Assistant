# Phase 21F — Lowercase bare destination follow-up fix

Implements the Phase 21E confirmed root cause at the bare-destination path only.
No UI, wording, hydration, persistence, merge, origin, date, or missing-`"to"`
cue changes. No deploy.

**Acceptance status:** IMPLEMENTED — PENDING AHMED'S PHYSICAL RUNTIME VERIFICATION.
Automated tests are evidence only; do not treat as production-accepted.

Focused tests:

```text
src/features/conversation-core/__tests__/destinationLowercaseBareFollowUp.phase21F.test.ts
```

---

## Confirmed root cause (Phase 21E)

Phase 21D bare path required Title-Case tokens (`/^[A-Z]…/`). Active-context
gate (`destination === null`) was correct. Lowercase `lebanon` was rejected
solely by the casing shape check.

---

## Ownership boundary

Repair only:

```text
DestinationConversationStateExtractor.extractBareDestinationPlace
```

(+ small Title-Case helper used only by that path)

---

## Implementation rule

1. Explicit destination cues still run first (unchanged value casing).
2. Bare path only when `destination === null`.
3. Place shape is 1–3 alphabetic tokens (hyphen/apostrophe allowed), **casing-insensitive**.
4. Existing filler / capability deny-lists still apply (ASCII case-fold compare).
5. Bare path emits deterministic Title-Case via `toTitleCasePlace` (no gazetteer,
   no `String#toLowerCase`).
6. Missing-`"to"` grammar is untouched.

---

## Casing / canonicalisation behaviour

| Input | Stored destination |
| --- | --- |
| `lebanon` | `Lebanon` |
| `Lebanon` | `Lebanon` |
| `gold coast` | `Gold Coast` |
| `GOLD COAST` | `Gold Coast` |
| `united arab emirates` | `United Arab Emirates` |
| Explicit `I want to travel to lebanon` | `lebanon` (cue path unchanged) |

---

## Active-context restriction

Bare path inactive when `destination !== null`. Origin Phase 21B may still
claim a bare place when origin owns the follow-up.

---

## Deny-list preservation

Guards such as `hello`, `yes`, `beach`, `flights`, `accommodation`,
`activities`, `restaurants`, `car hire` (any casing) do not become destinations.

---

## Explicit non-goal (at Phase 21F time; repaired by Phase 21I)

```text
i want to go lebanon
I want to go Lebanon
go Melbourne
```

Missing-`"to"` travel grammar was out of Phase 21F scope. See
`phase21I-missing-to-destination-grammar.md` for the cue-family repair.

---

## Validation evidence

| Check | Result |
| --- | --- |
| Focused Phase 21F / 21D / 21E | pass |
| conversation-core | 2154 passed (206 files) |
| Full repository | 2367 passed (263 files) |
| Typecheck | pass |
| Clean production build | pass |

---

## Physical verification required

Ahmed must retest on the **PR #31 preview** (not production) with a fresh
conversation:

```text
Hi Aleya.
lebanon
```

Expect destination acknowledged and origin question. Repeat for lowercase
`melbourne`, `gold coast`, `new york`, `united arab emirates`, `paris`.

---

## Stop condition

PR #31 remains Draft. No merge. No deploy. No missing-`"to"` work in this phase.
