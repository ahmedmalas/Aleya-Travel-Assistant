# Phase 21A — Origin bare-answer progression failure audit

Investigation and characterization only. No production behaviour change.
No deploy. No UI patch. No wording workaround.

Characterization tests:

```text
src/features/conversation-core/__tests__/originBareAnswerProgressionAudit.phase21A.test.ts
```

---

## Baseline verification

| Item | Value |
| --- | --- |
| Investigation branch | `cursor/origin-progression-failure-audit-8697` |
| Base commit (main / v1.0.0) | `c2be8365054f3eb28dfe84bbf9e17b1ead0419d3` |
| PR #29 | MERGED (unchanged by this audit) |
| Working tree at investigation start | clean on main |

---

## Runtime identity

| Item | Value |
| --- | --- |
| Production deployment | `dpl_HoMtFR8L114b1EgjsKEbckkxnRyp` |
| Deployed commit | `c2be8365054f3eb28dfe84bbf9e17b1ead0419d3` |
| Production URL | https://travel-buddy-assistant-ai.vercel.app |
| Branch that produced deploy | `main` |
| Conversation-core entry point | `processConversationTurn` |
| Active panel | `AiPlanningPanel.runEngineTurn` → `processConversationTurn({ state: coreState })` |
| Bundle | `conversation-core-HhEirSkd.js` |
| Trace flags shown in UI | Boundary `conversation-core`; Status `active`; Turn count from in-memory state; Persistence label hard-coded `disabled` |

---

## Exact reproduction

Through `processConversationTurn` (same path as the active panel):

| Turn | User | Origin before | Origin after | Interpreted | Reply (exact) |
| --- | --- | --- | --- | --- | --- |
| 1 | `I want to go to Melbourne.` | `null` | `null` | `true` (destination) | `Great, Melbourne it is. Where will you be travelling from?` |
| 2 | `Sydney.` | `null` | `null` | `false` | `Let's begin with where you're travelling from. Where will you be travelling from?` |
| 3 | `Sydney.` | `null` | `null` | `false` | `Let's begin with where you're travelling from. Where will you be travelling from?` |

Control (cued origin succeeds):

| Turn | User | Origin after | Next follow-up |
| --- | --- | --- | --- |
| 2 | `from Sydney` | `Sydney` | departure date |
| 2 | `I am travelling from Sydney` | `Sydney` | departure date |
| 2 | `Fly from Sydney` | `Sydney` | departure date |

---

## Turn-by-turn state trace (first bare `Sydney.` turn)

### Canonical state passed in

```text
destination: 'Melbourne'
origin: null
departureDate: null
returnDate: null
turnCount: 1
status: 'active'
```

### Extractor invocation

1. `createConversationStateExtractor()` registers `OriginConversationStateExtractor` second in the composite (after destination).
2. `extractConversationState` → composite `extract(input)` invokes every extractor including Origin.
3. Isolated `OriginConversationStateExtractor.extract({ message: 'Sydney.' })` → `{ stateUpdate: {} }`.
4. Composite merge result has **no** `origin` key.
5. Destination extractor also returns empty for `Sydney.` (does not steal or set origin).

### stateUpdate ownership / precedence

| Layer | Precedence rule |
| --- | --- |
| Composite extractors | Later extractor wins on overlapping keys (`CompositeConversationStateExtractor`) |
| Explicit `processConversationTurn` `stateUpdate` | Wins over extraction (`applyConversationStateUpdate` after extraction) |
| Bare `Sydney.` case | No extractor emits `origin`; panel does not inject `stateUpdate` |

### Merge and hydration

1. `transitionConversationStateFromExtraction` applies empty update → `nextState.origin` remains `null`; destination preserved.
2. `processConversationTurn` builds provisional state from that travel slice; reply generated against origin still missing.
3. Returned state keeps `origin: null`, increments `turnCount`, appends transcript.
4. Panel `setCoreState(result.state)` hydrates the next turn with that same in-memory state.

### Persistence

`persistenceUsed: false` / UI `Persistence: disabled` means durable storage is not used. It does **not** disable session-level in-memory progression. Destination surviving turns 1→3 while origin stays null proves hydration works; extraction simply never wrote origin.

---

## Why destination “succeeds” while origin fails

Destination succeeded because the user message contained an **explicit destination cue** (`I want to go to Melbourne.`), which `DestinationConversationStateExtractor` recognises.

Bare place answers fail for both destination and origin:

| Message when field is next required | Result |
| --- | --- |
| `Melbourne` (destination asked) | destination stays `null` |
| `Sydney` / `Sydney.` (origin asked) | origin stays `null` |

Origin failure is therefore not a merge/hydration bug. It is a **missing bare follow-up answer ownership** inside origin extraction (cue-only contract).

---

## Root cause

`OriginConversationStateExtractor` only accepts explicit origin cues (`from X`, `flying from X`, `I am travelling from X`, repair forms, etc.). It intentionally does not inspect `currentState` / active follow-up.

When the catalogue asks `Where will you be travelling from?` and the user answers with a bare place (`Sydney` / `Sydney.`):

1. Origin extractor returns `{}`
2. No origin `stateUpdate` is produced
3. Canonical state keeps `origin: null`
4. Follow-up selection still chooses the origin question
5. Baseline conversational expression re-asks origin (`Let's begin with where you're travelling from.` + catalogue)

This matches historical Phase 7B/8B contracts and existing `origin.test.ts`, which assert bare `Sydney` leaves origin null.

Contrast: Phase 19I added `BareNumberPassengerCountConversationStateExtractor` for active passenger questions — no equivalent bare-place origin (or destination/date) path exists.

---

## Blast radius

| Bare follow-up answer class | Through `processConversationTurn` today |
| --- | --- |
| Origin bare place (`Sydney`) | FAIL — loop |
| Destination bare place (`Melbourne`) | FAIL — uninterpreted |
| Departure bare date (`28 August 2026`) | FAIL — uninterpreted |
| Return bare date (`1 September 2026`) | FAIL — uninterpreted |
| Adult bare number (`2`) | PASS (Phase 19I) |
| Accommodation guest bare number (`2`) | PASS (Phase 19I → adultCount) |
| Origin with explicit cue (`from Sydney`) | PASS |

Affected contracts/files (source of defect):

- `OriginConversationStateExtractor.ts` — cue-only origin ownership; no active-question bare place path
- Related same-class gaps (not origin-specific): destination / departure / return extractors likewise lack bare follow-up answers
- Not a defect in: `processTurn` hydration, persistence flag, composite merge, reply selection (selection correctly re-asks missing origin), or panel state passing

---

## Missing or inadequate tests (before this audit)

- No production-path multi-turn test expecting bare `Sydney` after destination to set origin and advance to departure
- `origin.test.ts` encodes the opposite: bare `Sydney` must remain null
- Follow-up suites seed origin or use cued forms (`from Sydney` / `Fly from Sydney`)
- Passenger bare-number coverage exists; place/date bare-answer coverage does not

---

## Recommended clean fix boundary (do not implement in this phase)

Repair ownership at extraction source — not UI, not wording, not special-case retention:

1. Extend **origin extraction ownership** so that when the next required core field is origin (destination already set, origin null), a bare place answer can emit `{ origin: <place> }` through the canonical extractor → stateUpdate → merge path.
2. Keep explicit cue / repair / collision contracts intact; do not hard-code place names; do not bypass `processConversationTurn`.
3. Treat destination/date bare follow-ups as **related but separately scoped** gaps of the same class; do not silently expand the origin fix into those fields without their own phase.
4. Replace or supersede the characterization that bare `Sydney` must stay null for the active-origin-question case; preserve rejection of bare `Sydney` when origin is not the active required field.

---

## Stop condition

No production code changed.
No deploy.
No UI patch.
No prompt/acknowledgement wording change.
No special-case state retention.

Next action after acceptance: a separately scoped fix phase targeting origin bare follow-up extraction ownership only.
