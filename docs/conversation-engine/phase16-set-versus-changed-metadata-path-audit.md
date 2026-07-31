# Phase 16H — Set-Versus-Changed Semantic Metadata Path Audit

Investigation and design-boundary characterization only. No metadata implemented. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 16G baseline preserved exactly.
No live environment has been changed.
```

## Accepted baseline

| Check | Value |
| --- | --- |
| HEAD | `2d4b478577cba88ee7b766e1cf61f1c2154e8103` |
| Branch | `cursor/conversation-progression-8697` |
| Prior commit | Phase 16G: audit stateless same-family diversification |
| PR #29 | OPEN, Draft, Unmerged, Undeployed |
| Working tree at audit start | clean |
| Production bundle | `conversation-core-DtRaANhV.js` / `a01df1ba…` / 114517 bytes (unchanged) |

## Objective

Determine the **smallest correct architecture change** that could give the conversational layer a principled semantic distinction between:

```text
initial field set
existing field changed
```

without letting that layer compare trip states or infer events from rendered text.

## Production path traced

```text
previous trip state
+ current authoritative trip state
→ classifyConversationStateChange()
→ selectConversationReplyComponents()
    → selectConversationAcknowledgement()
→ assembleConversationReplyPlan() / createConversationReplyPlan()
→ generateConversationReply()
→ generateIntegratedConversationReply()  (deterministic seam → generateConversationReply)
→ renderIntegratedConversationReplyPlan()
→ mode: 'baseline-conversational'
→ generateBaselineConversationalReply(plan)
→ renderBaselineConversationalReplyPlan(plan)
→ buildConversationalLayerInput(plan)
→ renderBaselineConversationalLayer(input)
→ transformBaselineAcknowledgement(acknowledgement: string)
   (and 15C / 16B helpers that also take string pairs only)
```

Supported travel fields for this audit:

```text
destination, origin, departureDate, returnDate,
adultCount, childCount, infantCount
```

## Stage-by-stage semantic availability

Legend: **Y** = known / available at that stage; **N** = not available; **partial** = available in a merged or ambiguous form.

| Stage | field identity | previous value | current value | field was updated | field was removed | initially set | changed from existing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Previous + current trip state | Y (keys) | Y | Y | derivable | derivable | derivable | derivable |
| `classifyConversationStateChange` | Y (`TravelCompareKey`) | used, not emitted | used, not emitted | Y (`updated`) | Y (null final in `updated`) | Y (`newlyPopulated`) | Y (`updated` with non-null final) |
| `selectConversationAcknowledgement` | Y (priority slots) | N (not an input) | Y (`state`) | partial (`fieldValueChanged` merges set+change) | Y (separate removal branches) | discarded | discarded |
| Selected acknowledgement result | N (string only) | N | only as prose interior | N | via distinct catalogue string | N | N |
| `ConversationReplyComponents` | N | N | N | N | N | N | N |
| `ConversationReplyPlan` | N (`acknowledgements: string[]`) | N | N | N | N | N | N |
| Integrated conversational input (`ConversationalLayerInput`) | N | N | N | N | N | N | N |
| Baseline renderer / 15C / 16B helpers | inferred from string shape | N | interior text only | N | via removal string shape | N | N |
| `transformBaselineAcknowledgement` | inferred from string shape | N | interior text only | N | via exact removal map | N | N |

### Exact point where set-versus-changed is lost

```text
First exists:
  classifyConversationStateChange()
  — newlyPopulated vs updated for each TravelCompareKey

First discarded for acknowledgement wording:
  selectConversationAcknowledgement()
  — uses fieldValueChanged() = newlyPopulated ∪ updated
  — same catalogue entry for both (e.g. acknowledgements.destination(value))

Irrecoverably absent thereafter:
  ConversationReplyComponents.acknowledgement: string | null
  ConversationReplyPlan.acknowledgements: readonly string[]
  ConversationalLayerInput (plan-only + objective)
  transformBaselineAcknowledgement(acknowledgement: string)
```

Catalogue templates are identical for initial set and later change, e.g.:

```text
Great — Cairns.          // first set or later change
Perfect — 2 adults travelling.
```

Rendered openers therefore match within a family (`Great,` / `Travelling with`, etc.).

## Exact source inspection

### `classifyConversationStateChange`

| Item | Current fact |
| --- | --- |
| Input | `previousState: ConversationCoreState`, `state: ConversationCoreState` |
| Output | `ConversationStateChangeClassification` with `newlyPopulated`, `updated`, `unchanged`, request-flag buckets, eligibility flags |
| Semantic info | **Exists** — null→value vs value→value (and clears) |
| Discarded? | Not discarded here; full classification is returned |
| Later recovery from text? | N/A |

### `selectConversationAcknowledgement`

| Item | Current fact |
| --- | --- |
| Input | `state`, `classification` |
| Output | `string \| null` |
| Semantic info | Classification still in scope; selector **could** branch on `newlyPopulated` vs `updated` |
| Discarded? | **Yes** — `fieldValueChanged()` collapses set and change; one catalogue string emitted |
| Later recovery from text? | **Impossible** — catalogue strings do not encode the event |

### `selectConversationReplyComponents`

| Item | Current fact |
| --- | --- |
| Input | `{ state, classification }` |
| Output | `{ acknowledgement: string \| null, followUpQuestion, continuationPrompt, messageInterpreted }` |
| Semantic info | Classification available to the coordinator; not placed on the component object |
| Discarded? | Acknowledgement reduced to string before return |
| Later recovery from text? | No |

### `assembleConversationReplyPlan` / `createConversationReplyPlan`

| Item | Current fact |
| --- | --- |
| Input | Components / `{ state, classification }` |
| Output | `ConversationReplyPlan` with `acknowledgements: readonly string[]` |
| Semantic info | None beyond the catalogue string(s) |
| Discarded? | Classification ends at plan creation; only the plan proceeds to render |
| Later recovery from text? | No |

### `generateConversationReply` / `generateIntegratedConversationReply`

| Item | Current fact |
| --- | --- |
| Input | `{ message, state, previousState }` (integrated seam → same) |
| Output | `string` (final wording) |
| Semantic info | Classification computed then consumed only to build the plan |
| Discarded? | Classification and previous state never reach the conversational layer |
| Later recovery from text? | No |

### `generateBaselineConversationalReply` / `renderBaselineConversationalLayer`

| Item | Current fact |
| --- | --- |
| Input | `ConversationReplyPlan` → `ConversationalLayerInput` (`plan`, `objective`, optional `styleProfile`) |
| Output | wording string / `{ wording }` |
| Semantic info | Objective is follow-up identity only; no acknowledgement event |
| Discarded? | Already absent on the plan |
| Later recovery from text? | 16B currently **parses transformed text** into a coarse `field-set-or-changed` bridge category — still cannot split set vs change |

### `transformBaselineAcknowledgement`

| Item | Current fact |
| --- | --- |
| Input | `acknowledgement: string` |
| Output | `string` |
| Semantic info | Family inferred from catalogue shape; values from interiors |
| Discarded? | Never received set-versus-changed |
| Later recovery from text? | Would require inventing semantics the text does not contain — **unacceptable** |

## Candidate-path classifications

Each option is classified as exactly one of:
`REJECT` | `POSSIBLE_BUT_WRONG_LAYER` | `VIABLE` | `PREFERRED` | `UNNECESSARY_FOR_THIS_PROBLEM`.

| # | Option | Classification | Rationale |
| --- | --- | --- | --- |
| 1 | Encode set-versus-changed in catalogue strings | **POSSIBLE_BUT_WRONG_LAYER** | Selector could emit two prose variants, but the event becomes buried in wording; the conversational layer (and 16B) would keep parsing strings. Catalogue would own a semantic split that should be structured. |
| 2 | Add metadata to the selected acknowledgement result | **VIABLE** | Natural first structured carrier: selection already decides which field/event wins. Requires changing `string \| null` to a structured selection result (text + event). |
| 3 | Add metadata to selected reply components | **VIABLE** | Thin propagation of (2); keeps assembly dumb. |
| 4 | Add metadata to the assembled reply plan | **PREFERRED** | The plan is the sole structured object that already crosses into `ConversationalLayerInput`. Carrying a narrow `acknowledgementEvent` here preserves deterministic ownership and gives expression a typed signal without trip state. |
| 5 | Add metadata only to conversational-layer input | **POSSIBLE_BUT_WRONG_LAYER** | Dual channel beside the plan breaks the “plan is the reply contract” model unless the plan also carries it. Input-only injection would tempt ad-hoc wiring around `buildConversationalLayerInput`. |
| 6 | Re-derive the event by parsing acknowledgement text | **REJECT** | Text does not encode set vs changed today; parsing would invent semantics and violate conversational-expression-only ownership. |
| 7 | Give the conversational layer previous and current trip state | **REJECT** | Forces the expression layer to re-classify; duplicates deterministic ownership; expands the conversational contract far beyond wording. |
| 8 | Add transcript or previous-reply history | **UNNECESSARY_FOR_THIS_PROBLEM** | Useful for same-event anti-repetition (Phase 16G option D), not required to distinguish initial set from later change when classification already knows. |

## Preferred metadata layer

```text
PREFERRED path:

classification (already distinguishes newlyPopulated vs updated)
  → selectConversationAcknowledgement emits structured selection
       { text: string; event: AcknowledgementEvent } | null
  → ConversationReplyComponents carries event alongside acknowledgement text
  → ConversationReplyPlan carries acknowledgementEvent (narrow)
  → ConversationalLayerInput receives it via plan (no extra channel)
  → transform / 15C / 16B may read the event for expression only
```

Deterministic layers keep:

```text
state interpretation          → classifyConversationStateChange
set-versus-changed class      → classification buckets + selector event emission
ack eligibility and priority  → selectConversationAcknowledgement
expression only               → conversational transforms
```

The conversational layer must **not** compare trip states or infer set-versus-changed from text.

## Minimal proposed contract

Prefer a narrow acknowledgement event over exposing classification or trip state.

Proposed shape (meaning-equivalent; exact TypeScript names may follow repo conventions):

```text
metadata name:
  acknowledgementEvent

allowed values (discriminated union):
  | { kind: 'field-set'; field: AcknowledgementTravelField }
  | { kind: 'field-changed'; field: AcknowledgementTravelField }
  | { kind: 'field-removed'; field: AcknowledgementTravelField }
  | { kind: 'capability-enabled'; labels: readonly string[] }  // or capability keys
  | { kind: 'capability-disabled'; labels: readonly string[] }
  | { kind: 'generic' }
  | null

where AcknowledgementTravelField is the supported set:
  destination | origin | departureDate | returnDate |
  adultCount | childCount | infantCount

owning deterministic function:
  selectConversationAcknowledgement
  (reads classification.newlyPopulated vs updated / removal branches /
   capability buckets already used for priority; emits one event for the
   acknowledgement that wins — does not re-open priority rules elsewhere)

first type that carries it:
  structured acknowledgement selection result
  (replacing bare string | null at the selector boundary)

reply-plan representation:
  ConversationReplyPlan.acknowledgementEvent: AcknowledgementEvent
  (parallel to acknowledgements: readonly string[];
   null when acknowledgements is empty)

conversational-input representation:
  available as input.plan.acknowledgementEvent
  (no new top-level ConversationalLayerInput field required)

fallback when absent:
  null / missing → current behaviour
  (same family opener for set and change; 16B keeps field-set-or-changed bridge)

whether acknowledgement text remains unchanged:
  yes for the contract-propagation phase
  (catalogue strings stay as today; expression may later vary openers
   using the event without changing deterministic catalogue ownership)
```

Notes on adopting the illustrative union from the phase brief:

- The repository already separates removal catalogue strings and capability add/remove acknowledgements; modelling those as `field-removed` / `capability-*` / `generic` matches existing selector branches.
- Do **not** put previous/current values on the event unless a later product need requires them; field identity + kind is enough for set-versus-changed openers.
- Do **not** pass the full `ConversationStateChangeClassification` into the conversational layer.

## Ownership-boundary proof

| Concern | Owner after preferred path | Conversational layer |
| --- | --- | --- |
| Interpreting previous vs current state | `classifyConversationStateChange` | never |
| Deciding set vs changed vs removed | classification buckets + selector event | never re-derives |
| Acknowledgement eligibility / priority | `selectConversationAcknowledgement` | never |
| Catalogue baseline wording | `CONVERSATION_REPLY_CATALOGUE` + selector | may transform using event + string |
| Expression / opener choice | conversational transforms | yes, from event + string only |

Parsing acknowledgement text for set-versus-changed: **not acceptable**.

Previous trip state in the conversational layer: **not required and not acceptable** for this problem.

## Blast-radius analysis

### Required production changes (future implementation)

```text
src/features/conversation-core/selectConversationAcknowledgement.ts
src/features/conversation-core/selectConversationReplyComponents.ts
src/features/conversation-core/assembleConversationReplyPlan.ts
src/features/conversation-core/createConversationReplyPlan.ts  (types/passthrough)
```

Likely for expression adoption (phase 2):

```text
src/features/conversation-core/transformBaselineAcknowledgement.ts
src/features/conversation-core/renderBaselineAcknowledgementFollowUp.ts
src/features/conversation-core/renderBaselineAcknowledgementNeutralContinuation.ts
src/features/conversation-core/renderBaselineConversationalLayer.ts  (only if helper signatures change)
```

### Required type changes

```text
ConversationReplyComponents
AssembleConversationReplyPlanInput / ConversationReplyPlan
selectConversationAcknowledgement return type
(optional) transformBaselineAcknowledgement input widening
```

`ConversationalLayerInput` need not grow a sibling field if the plan carries the event.

### Required test changes

```text
assembleConversationReplyPlan.test.ts
selectConversationAcknowledgement* / reply-component tests
any test constructing ConversationReplyPlan literals
```

### Likely parity-test updates

```text
phase13* / phase14* / phase15* plan-literal and surface tests
phase16A–16G characterization tests that build plans or assert component shapes
baselineConversationalGeneratorParity / controlled runtime activation suites
```

### Files that must remain untouched (for this problem)

```text
trip state / extraction / processConversationTurn state-update path
classifyConversationStateChange.ts semantics (already sufficient)
follow-up and continuation selectors
conversationReplyCatalogue.ts (if catalogue strings stay unchanged in phase 1)
integration mode constants / branch order (unless helper signatures force call-site edits)
```

## Recommended implementation split

```text
TWO PHASES

Phase A — contract propagation (behaviour-preserving):
  structured acknowledgement selection + components + plan.acknowledgementEvent
  catalogue strings unchanged
  transform ignores event (fallback = current openers)
  full parity green

Phase B — conversational wording adoption:
  transform / 16B (optionally 15C) consume acknowledgementEvent
  principled set vs changed openers (and optionally bridges)
  no trip-state comparison; no text re-classification of set vs change
```

One isolated phase is possible only if wording changes ship with the contract in a single tightly scoped PR; the safer split is **contract first, expression second**, matching ownership and reducing parity risk.

## Characterization test

```text
src/features/conversation-core/__tests__/setVersusChangedMetadataPath.phase16H.test.ts
```

Locks current production facts without implementing the proposal.

## Conclusions (required)

| Question | Conclusion |
| --- | --- |
| Where the semantic distinction first exists | `classifyConversationStateChange` — `newlyPopulated` vs `updated` |
| Where it is currently lost | `selectConversationAcknowledgement` via `fieldValueChanged` + shared catalogue entry; thereafter only `string` |
| Preferred layer for preserving it | Reply plan (`acknowledgementEvent`), fed from structured acknowledgement selection |
| Smallest safe contract | Narrow `acknowledgementEvent` union (field-set / field-changed / field-removed / capability-* / generic / null) |
| Is parsing acknowledgement text acceptable? | **No** |
| Should previous state enter the conversational layer? | **No** |
| One phase or two? | **Two** — contract propagation, then conversational wording adoption |

## Production-preservation proof

Phase 16H modifies **no** production files.

Unchanged:

```text
trip state
extraction
classification
acknowledgement selection
follow-up selection
continuation selection
reply-plan assembly
conversational transformation
branch order
integration mode
fallback behaviour
```

Bundle identity retained:

```text
conversation-core-DtRaANhV.js
SHA-256 a01df1ba557609113ba8315b7dbe8902cc5191e853d33377f6ca82efa5cea18f
raw 114517 bytes / parsed 114.51 kB / gzip 19.91 kB
```
