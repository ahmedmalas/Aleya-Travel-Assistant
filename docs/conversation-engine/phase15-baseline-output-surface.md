# Phase 15A — Baseline Conversational Output Surface

Characterisation of the exact current output behaviour of the activated baseline conversational renderer before any new phrasing, tone, empathy, repair, or style transformation.

This phase is characterisation only. Production wording is unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
No live environment has been changed.
```

## Accepted baseline

| Check | Value |
| --- | --- |
| HEAD (Phase 15A start) | `834ef4e540d6d8d8e7f70633b59c62de40e2fdc4` |
| Prior commit | Phase 14O: complete conversational runtime integration |
| PR #29 | OPEN, Draft, Unmerged, Undeployed |
| Working tree at audit start | clean |
| Production mode | statically `'baseline-conversational'` |

## Activated runtime path

```text
ConversationReplyPlan
→ generateBaselineConversationalReply()
→ renderBaselineConversationalReplyPlan()
→ buildConversationalLayerInput()
→ selectConversationalObjective(plan)
→ createConversationalLayerInput(plan, objective, styleProfile?)
→ executeBaselineConversationalRenderer()
→ renderer registry id "baseline"
→ renderBaselineConversationalLayer()
→ ConversationalLayerOutput { wording }
→ rendered string
```

Production reaches this path through:

```text
renderIntegratedConversationReplyPlan({ plan })
→ mode: 'baseline-conversational'
→ generateBaselineConversationalReply(plan)
```

## Conversational-layer input fields

`ConversationalLayerInput` exposes:

| Field | Source | Currently used by baseline renderer |
| --- | --- | --- |
| `plan.acknowledgements` | reply-plan assembly | **yes** — joined into wording |
| `plan.followUpQuestion` | reply-plan assembly | **yes** — appended / sole wording / empty→neutral fallback |
| `plan.messageInterpreted` | reply-plan assembly | **no** — ignored by baseline renderer |
| `objective.id` | `selectConversationalObjective(plan)` | **no** — never overrides plan |
| `objective.catalogueWording` | copied from plan follow-up / continuation | **no** — never overrides plan |
| `styleProfile.id` | optional caller argument | **no** — ignored |
| `styleProfile.tone` | optional caller argument | **no** — ignored |
| `styleProfile.phrasingPreferences` | optional caller argument | **no** — ignored |

Acknowledgement, follow-up, and continuation boundaries remain visible on the plan:

- acknowledgements array (empty / single / multi)
- `followUpQuestion` (specific catalogue prompt, neutral continuation, or null)
- assembled plans store continuation in `followUpQuestion` when no specific follow-up was selected

The renderer can distinguish empty, single-component, and multi-component plans via `plan.acknowledgements.length` and `plan.followUpQuestion`, even though wording is currently a direct deterministic render of those fields.

## Current objective selection

`selectConversationalObjective(plan)` is deterministic and plan-derived:

| Plan shape | Objective |
| --- | --- |
| specific catalogue follow-up present | that follow-up id + catalogue wording |
| no specific follow-up; continuation / neutral present in `followUpQuestion` | `neutralContinuation` |
| acknowledgement-only / empty (no follow-up) | `null` |

Objective selection does **not** inspect trip state or user text. Different objectives currently remain output-parity preserving relative to the plan: the baseline renderer ignores objective metadata and renders `input.plan` only.

## Current output categories

Exact activated baseline output equals `renderConversationReplyPlan(plan)`:

| Category | Exact output rule |
| --- | --- |
| acknowledgement only | single acknowledgement string |
| follow-up only | follow-up catalogue string |
| acknowledgement + follow-up | `{ack}\n{followUp}` |
| neutral continuation | `What else should I know about your trip?` |
| capability enabled | capability-add ack + optional follow-up |
| capability disabled | capability-remove ack + optional follow-up |
| field removed | removal ack + optional follow-up |
| generic acknowledgement | `Perfect.` |
| uninterpreted message | plan-driven wording; `messageInterpreted` ignored |
| empty reply plan | neutral fallback (`NEUTRAL_TRIP_FALLBACK_REPLY`) |
| multi-component reply plan | acknowledgements joined with space, then `\n` + follow-up |

## Currently ignored style fields

All `ConversationalStyleProfile` fields are ignored by `renderBaselineConversationalLayer`:

- `id`
- `tone`
- `phrasingPreferences`

Passing professional / warm / luxury reference profiles does not change output.

## Currently absent transformations

The baseline renderer performs **no**:

- phrasing transformation
- empathy transformation
- conversational repair
- tone rewriting
- prompt or model calls
- randomness
- async behaviour

Current implementation:

```ts
wording: renderConversationReplyPlan(input.plan)
```

## Immutability evidence

Proven by Phase 15A tests:

- frozen `ConversationReplyPlan` is unchanged after baseline / production rendering
- frozen `ConversationalLayerInput` is unchanged
- frozen style profiles are unchanged when supplied
- layer input preserves the plan object reference

## Determinism evidence

Proven by Phase 15A tests:

- repeated `generateBaselineConversationalReply` calls return identical strings
- production seam output matches baseline and deterministic renderers
- objective selection is stable across repeated calls for the same plan

## Fallback boundary

Mode-driven fallback remains:

```text
try generateBaselineConversationalReply(plan)
catch → renderConversationReplyPlan(plan)
```

Successful characterisation paths do not trigger fallback. Forced synchronous failure still returns the deterministic rendering of the same plan.

## Safe transformation boundaries for Phase 15

```text
Phase 15 may transform only the rendered conversational expression.
Phase 15 must not change:
trip state
classification
priority
eligibility
reply-component selection
reply-plan assembly
required follow-up selection
deterministic fallback
```

---

## Phase 15B record — first acknowledgement-only transformation

Baseline parity is now **intentionally broken only for eligible acknowledgement-only plans**.

### First transformed category

```text
acknowledgement-only plans
```

### Exact eligibility boundary

```text
plan.acknowledgements.length === 1
AND plan.followUpQuestion === null
```

Eligible plans apply `transformBaselineAcknowledgement(acknowledgement)` inside
`renderBaselineConversationalLayer`. Catalogue ownership and deterministic
acknowledgement selection are unchanged; only the completed plan’s
acknowledgement string is rewritten at render time.

### Mapped acknowledgement categories

| Category | Examples (deterministic → conversational) |
| --- | --- |
| field set or changed | `Great — Cairns.` → `Great, Cairns it is.`; `Perfect — departing from Sydney.` → `Perfect, we'll start from Sydney.`; date / passenger count templates similarly |
| field removed | `Destination removed.` → `No problem, I've removed the destination.` (and parallel removal strings) |
| capability enabled | `I've added flights to your trip requirements.` → `Great, I've added flights to your trip.` |
| capability disabled | `I've removed flights from your trip requirements.` → `No problem, I've removed flights from your trip.` |
| generic acknowledgement | `Perfect.` → `Perfect, got it.` |

Unknown acknowledgement strings remain unchanged.

### Unchanged categories

```text
acknowledgement + follow-up
follow-up only
neutral continuation
multiple acknowledgements
empty plans
uninterpreted messages (neutral continuation shape)
```

These continue to equal deterministic `renderConversationReplyPlan(plan)` output.

### Fallback guarantee

Phase 14I mode-driven fallback is preserved:

```text
try generateBaselineConversationalReply(plan)
catch → renderConversationReplyPlan(plan)
```

No additional fallback layer was added. Transformation failure is covered by the
existing baseline catch boundary and returns the deterministic reply for the
same plan.

### Deterministic ownership guarantee

Unchanged and still exclusively deterministic:

- trip state
- classification
- priority
- eligibility
- reply-component selection
- reply-plan assembly
- required follow-up selection
- deterministic renderer (`renderConversationReplyPlan`)
- production mode (`'baseline-conversational'`)
