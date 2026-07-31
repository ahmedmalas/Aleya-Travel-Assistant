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

### Unchanged categories (as of Phase 15B)

```text
acknowledgement + follow-up   (later transformed in Phase 15C)
follow-up only
neutral continuation
multiple acknowledgements
empty plans
uninterpreted messages (neutral continuation shape)
```

At Phase 15B completion, those shapes still equalled deterministic
`renderConversationReplyPlan(plan)` output. Phase 15C intentionally diverges
acknowledgement-plus-follow-up only (see below).

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

---

## Phase 15C record — acknowledgement-plus-follow-up transitions

```text
The conversational layer may transform the acknowledgement expression.
The deterministic engine continues to own the exact follow-up question and its selection.
```

### Transformed category

```text
acknowledgement + follow-up plans
```

### Exact eligibility boundary

```text
plan.acknowledgements.length === 1
AND plan.followUpQuestion !== null
```

Renderer branching order in `renderBaselineConversationalLayer`:

1. single acknowledgement + no follow-up → Phase 15B acknowledgement-only transform
2. single acknowledgement + follow-up → `renderBaselineAcknowledgementFollowUp`
3. all other plan shapes → deterministic `renderConversationReplyPlan`

Investigation note: the plan still exposes acknowledgement and follow-up as
separate fields (`plan.acknowledgements[0]`, `plan.followUpQuestion`) before
rendering. Deterministic rendered form remains
`{acknowledgement}\n{followUpQuestion}`; activated conversational form uses a
space transition after the transformed acknowledgement.

### Acknowledgement transformation reuse

`renderBaselineAcknowledgementFollowUp` reuses `transformBaselineAcknowledgement`
and does not duplicate its mapping. Unknown acknowledgements remain unchanged.

### Follow-up preservation guarantee

The follow-up string is joined byte-for-byte identically. No filler phrases
(`Now,` / `Next,` / `Also,`), no follow-up punctuation changes, and no
follow-up selection changes.

Approved structure:

```text
{transformed acknowledgement} {unchanged follow-up question}
```

### Unchanged categories

```text
acknowledgement-only (Phase 15B behaviour preserved)
follow-up only
neutral continuation
multiple acknowledgements
empty plans
```

### Fallback guarantee

Phase 14I remains authoritative. No additional fallback layer.

### Ownership guarantee

Deterministic ownership remains exclusive for trip state, classification,
priority, eligibility, reply-component selection, reply-plan assembly, required
follow-up selection, and the deterministic renderer. Production mode remains
`'baseline-conversational'`.

---

## Phase 15D record — follow-up-only baseline output characterisation

Investigation-only. Production wording for follow-up-only plans is unchanged.

### Exact eligibility boundary

```text
plan.acknowledgements.length === 0
AND plan.followUpQuestion !== null
```

### Traced runtime path

```text
renderIntegratedConversationReplyPlan({ plan })
→ static mode: 'baseline-conversational'
→ renderConversationReplyPlanByIntegrationMode()
→ generateBaselineConversationalReply(plan)
→ renderBaselineConversationalReplyPlan()
→ buildConversationalLayerInput()
→ executeBaselineConversationalRenderer()
→ renderBaselineConversationalLayer()
→ (no Phase 15B/15C branch matches: acknowledgements.length !== 1)
→ renderConversationReplyPlan(plan)
→ follow-up string only
```

### Complete follow-up-only catalogue

Catalogue follow-ups that currently characterise this surface (exact wording):

| id | Exact output |
| --- | --- |
| destination | `Where would you like to travel?` |
| origin | `Where will you be travelling from?` |
| departureDate | `When would you like to depart?` |
| returnDate | `When would you like to return?` |
| flightsAdultCount | `How many adults will be travelling?` |
| accommodationGuestCount | `How many guests will be staying?` |
| activities | `What kinds of activities are you interested in?` |
| restaurants | `What type of dining are you looking for?` |

### Current output surface

For every follow-up-only plan above:

- baseline output is **byte-identical** to deterministic `renderConversationReplyPlan(plan)`
- output is exactly the catalogue follow-up string
- no acknowledgement is introduced
- no conversational filler (`Now,` / `Next,` / `Also,`) is introduced

### Ownership boundary

```text
Follow-up-only plans remain owned by the deterministic renderer path inside
the baseline conversational layer fall-through branch.
Phase 15B owns acknowledgement-only.
Phase 15C owns acknowledgement-plus-follow-up.
Neutral continuation is outside the Phase 15D follow-up-only characterisation
group (separate category), even though it also has empty acknowledgements.
Multiple acknowledgements and empty plans remain unchanged / deterministic.
```

### Unchanged by this phase

No production files were modified in Phase 15D. No follow-up wording transform
was added in Phase 15D. Phase 15E later adds lead-ins for the eight supported
follow-up-only categories (see below).

---

## Phase 15E record — follow-up-only conversational expression

### Exact eligibility boundary

```text
plan.acknowledgements.length === 0
AND plan.followUpQuestion !== null
```

Neutral continuation is excluded from transformation (exact-string pass-through).

### Branch ownership

```text
1. acknowledgement-only → Phase 15B
2. acknowledgement + follow-up → Phase 15C
3. follow-up-only → Phase 15E (renderBaselineFollowUpOnly)
4. all other plans → deterministic renderConversationReplyPlan
```

### Exact transformed outputs (Phase 15E; refined in Phase 15F)

Phase 15E originally used some clause-style lead-ins that produced mid-sentence
capitalization (`First, Where…`, `And When…`). Phase 15F refined lead-ins to
complete sentences; eligibility and ownership are unchanged. Current outputs:

| Follow-up | Activated output |
| --- | --- |
| destination | `Let's start with the destination. Where would you like to travel?` |
| origin | `Let's begin with where you're travelling from. Where will you be travelling from?` |
| departureDate | `Now for the timing. When would you like to depart?` |
| returnDate | `And for your return. When would you like to return?` |
| flightsAdultCount | `Now for the flights. How many adults will be travelling?` |
| accommodationGuestCount | `Now for the accommodation. How many guests will be staying?` |
| activities | `Let's look at activities. What kinds of activities are you interested in?` |
| restaurants | `Now for dining. What type of dining are you looking for?` |

### Follow-up preservation proof

Each original follow-up question remains a byte-identical trailing substring.
Lead-ins are selected by exact catalogue-string match only. No question
wording, punctuation, capitalization, or selection changes.

### Unknown-string behaviour

Unknown follow-up strings that satisfy the plan shape pass through unchanged
(deterministic question only; no lead-in).

### Unchanged categories

```text
neutral continuation (pass-through)
acknowledgement-only (Phase 15B)
acknowledgement + follow-up (Phase 15C)
multiple acknowledgements
empty plans
```

---

## Phase 15F record — follow-up-only lead-in grammar refinement

Grammatical refinement of Phase 15E only. Eligibility boundary and branch
ownership are unchanged.

### Before → after (selected)

| Category | Before (15E) | After (15F) |
| --- | --- | --- |
| origin | `First, Where will you be travelling from?` | `Let's begin with where you're travelling from. Where will you be travelling from?` |
| departureDate | `And When would you like to depart?` | `Now for the timing. When would you like to depart?` |
| flightsAdultCount | `For flights, How many adults will be travelling?` | `Now for the flights. How many adults will be travelling?` |

### Malformed-pattern exclusion

Activated follow-up-only outputs must not contain:

```text
, Where
And When
, How
, What
```

### Unchanged

```text
eligibility boundary
branch order
neutral continuation pass-through
unknown follow-up pass-through
Phase 15B / 15C outputs
follow-up catalogue strings and selection
Phase 14I fallback
production mode
```
