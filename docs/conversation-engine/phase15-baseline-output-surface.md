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

---

## Phase 15G record — neutral-continuation baseline output characterisation

Investigation-only at the time of Phase 15G. Production wording for neutral
continuation was unchanged then (15E pass-through). **Superseded by Phase 15J**,
which adds a dedicated neutral-continuation transform; see Phase 15J / 15K.

### Exact current output

```text
What else should I know about your trip?
```

(`NEUTRAL_TRIP_FALLBACK_REPLY` / `CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation`)

### Exact neutral-continuation plan shape

```text
acknowledgements: []
followUpQuestion: "What else should I know about your trip?"
messageInterpreted: true | false
```

Representation (actual implementation, not assumed):

- Assembled plans store the neutral string in `followUpQuestion`.
- When a specific follow-up is selected, `selectConversationFollowUpQuestion`
  returns that question; otherwise it returns the neutral continuation string.
- `selectConversationContinuationPrompt` returns the neutral string only when
  `followUpQuestion === null`; otherwise `null`.
- `assembleConversationReplyPlan` assigns
  `followUpQuestion ?? continuationPrompt` into the plan’s `followUpQuestion`.
- There is no separate `continuation` field on `ConversationReplyPlan`.
- The baseline renderer has no dedicated neutral branch; the plan enters the
  Phase 15E follow-up-only arm (`acknowledgements.length === 0` and
  `followUpQuestion !== null`), and `renderBaselineFollowUpOnly` pass-through
  returns the question unchanged because the neutral string is absent from the
  lead-in map.

### Runtime path

```text
renderIntegratedConversationReplyPlan({ plan })
→ mode: 'baseline-conversational'
→ renderConversationReplyPlanByIntegrationMode()
→ generateBaselineConversationalReply(plan)
→ renderBaselineConversationalLayer()
→ renderBaselineFollowUpOnly({ followUpQuestion: neutral })
→ pass-through (no lead-in mapping)
→ "What else should I know about your trip?"
```

Deterministic `renderConversationReplyPlan(plan)` returns the same string for
this plan shape.

### Selection boundary

```text
selectConversationFollowUpQuestion(state)
→ first missing core/contextual follow-up, else NEUTRAL_TRIP_FALLBACK_REPLY

selectConversationContinuationPrompt({ followUpQuestion })
→ null when followUpQuestion !== null
→ NEUTRAL_TRIP_FALLBACK_REPLY when followUpQuestion === null
```

A required specific follow-up therefore prevents the continuation selector from
emitting neutral, and the follow-up selector itself emits neutral only after
progression and contextual questions are satisfied.

### Distinction from neighbouring shapes

| Shape | Distinguishing plan facts |
| --- | --- |
| Neutral continuation | empty acks + `followUpQuestion ===` exact neutral string |
| Follow-up-only (15E/15F) | empty acks + specific catalogue follow-up (lead-in applied) |
| Acknowledgement-only (15B) | one ack + `followUpQuestion === null` |
| Acknowledgement + follow-up (15C) | one ack + non-null follow-up |
| Empty plan | empty acks + `followUpQuestion === null` (renderer null-coalesces to same wording) |
| Uninterpreted neutral | same stored neutral `followUpQuestion`, `messageInterpreted: false` |

### Byte-identity proof

Baseline, production seam, layer output, and deterministic rendering are
byte-identical to the canonical neutral string. No acknowledgement, Phase 15E
lead-in, or filler is introduced.

### Branch ownership / unchanged categories

```text
Neutral continuation: 15E pass-through (no transform)
Specific follow-ups: Phase 15F
Acknowledgement-only: Phase 15B
Acknowledgement + follow-up: Phase 15C
Unknown follow-ups / empty plans: unchanged
Phase 14I fallback / production mode: unchanged
```

---

## Phase 15I record — complete remaining baseline output surface

Investigation-only. Production wording is unchanged. Phase 15H was a baseline
verification check (no behaviour commit); accepted tip remains Phase 15G
`86a303f56e67e9792f55db3d9fc546d649fd8450`.

### Complete output-surface matrix (superseded for neutral by Phase 15J)

At Phase 15I completion, zero-ack neutral continuation still passed through the
Phase 15E follow-up-only arm unchanged. Phase 15J replaces that pass-through
characterization with a dedicated transform (see below).

| Reply-plan shape | Baseline branch | Final renderer | Transformed / pass-through | Owning phase |
| --- | --- | --- | --- | --- |
| 1 ack + `followUpQuestion === null` | arm 1 | `transformBaselineAcknowledgement` | transformed | **15B** |
| 1 ack + specific follow-up | arm 2 | `renderBaselineAcknowledgementFollowUp` | ack transformed; follow-up preserved | **15C** |
| 1 ack + neutral continuation | arm 2 | `renderBaselineAcknowledgementFollowUp` | ack transformed; neutral preserved | **15C** |
| 1 ack + unknown follow-up | arm 2 | `renderBaselineAcknowledgementFollowUp` | ack transformed (or unchanged if unknown ack); follow-up preserved | **15C** |
| 0 acks + supported specific follow-up | arm 4 | `renderBaselineFollowUpOnly` | lead-in + preserved question | **15F** (15E renderer) |
| 0 acks + neutral continuation | arm 3 | `renderBaselineNeutralContinuation` | lead-in + preserved question | **15J** |
| 0 acks + unknown follow-up | arm 4 | `renderBaselineFollowUpOnly` | pass-through | **15E pass-through** |
| 0 acks + `followUpQuestion === null` (empty / uninterpreted empty) | arm 5 | `renderConversationReplyPlan` | deterministic null-coalesce to neutral wording | **deterministic** |
| 2+ acks + null follow-up | arm 5 | `renderConversationReplyPlan` | deterministic | **deterministic** |
| 2+ acks + specific / neutral / unknown follow-up | arm 5 | `renderConversationReplyPlan` | deterministic | **deterministic** |

`messageInterpreted` does not select a renderer branch; only acknowledgement
count and `followUpQuestion` do.

### Ownership map (after Phase 15J)

```text
15B  → acknowledgements.length === 1 && followUpQuestion === null
15C  → acknowledgements.length === 1 && followUpQuestion !== null
15J  → acknowledgements.length === 0
       && followUpQuestion === "What else should I know about your trip?"
15E  → acknowledgements.length === 0 && followUpQuestion !== null
       (after the 15J arm; 15F transforms the eight supported catalogue
        follow-ups; unknown strings pass through)
deterministic fall-through → all remaining shapes
  (empty plans; multi-acknowledgement plans with or without follow-up)
```

Branch predicates are mutually exclusive; multi-acknowledgement plans never
enter 15B/15C/15J.

### Remaining deterministic-only categories

```text
empty reply plans (including uninterpreted empty)
multiple acknowledgements only
multiple acknowledgements + specific follow-up
multiple acknowledgements + neutral continuation
multiple acknowledgements + unknown follow-up
```

### Confirmation

All reachable `ConversationReplyPlan` shapes are accounted for in the matrix
above. Phase 15I introduced no conversational transform; Phase 15J owns the
neutral-continuation expression that 15I had characterized as pass-through.

---

## Phase 15J record — neutral-continuation conversational expression

Implements the missing dedicated transform for the canonical zero-acknowledgement
neutral continuation prompt. Phase 15H was verification/check-only and never
landed this change; Phase 15I confirmed pass-through under the 15E arm.

### Exact eligibility boundary

```text
plan.acknowledgements.length === 0
AND
plan.followUpQuestion === "What else should I know about your trip?"
```

### Exact activated output

```text
There's just one more thing I'd like to know. What else should I know about your trip?
```

### Final branch order

```text
1. acknowledgement-only → Phase 15B
2. acknowledgement + follow-up → Phase 15C
3. neutral continuation → Phase 15J
4. follow-up-only supported/unknown → Phase 15F / Phase 15E
5. all remaining shapes → deterministic fallback
```

The Phase 15J arm appears before the general zero-ack follow-up-only arm.

### Byte-preservation proof

The canonical deterministic question remains an exact trailing substring of the
activated output. The lead-in is a complete sentence ending in a full stop.
Catalogue wording, selectors, and reply-plan assembly are unchanged.

### Distinction: zero-ack neutral vs acknowledgement-plus-neutral

| Shape | Owner | Activated form |
| --- | --- | --- |
| `acks=[]` + canonical neutral | **15J** | lead-in + preserved neutral question |
| `acks.length === 1` + canonical neutral | **15C** | transformed ack + space + preserved neutral question (no 15J lead-in) |
| `acks=[]` + `followUpQuestion === null` (empty) | **deterministic** | null-coalesce to raw neutral (no 15J lead-in) |

### Unchanged categories

```text
acknowledgement-only (15B)
acknowledgement + specific / neutral / unknown follow-up (15C)
supported follow-up-only lead-ins (15F)
unknown follow-up pass-through (15E)
multi-acknowledgement plans (deterministic)
empty plans (deterministic)
Phase 14I fallback / production mode
canonical neutral question string / selection / assembly
```

---

## Phase 15K record — final Phase 15 conversational output-surface audit

Characterization and completion-proof only. Production wording is unchanged.
Accepted tip before this audit: Phase 15J
`48a59ff140699bef82196cb0ab1c3d5a0d955089`.

### Final runtime path

```text
renderIntegratedConversationReplyPlan({ plan })
→ mode: 'baseline-conversational'
→ renderConversationReplyPlanByIntegrationMode()
→ try generateBaselineConversationalReply(plan)
→ renderBaselineConversationalReplyPlan()
→ buildConversationalLayerInput()
→ executeBaselineConversationalRenderer()
→ renderBaselineConversationalLayer()
→ ConversationalLayerOutput.wording
```

Phase 14I catch fallback still returns `renderConversationReplyPlan(plan)`.

### Final branch order

```text
1. one acknowledgement, no follow-up → Phase 15B
2. one acknowledgement + follow-up → Phase 15C
3. zero acknowledgements + canonical neutral prompt → Phase 15J
4. zero acknowledgements + supported or unknown follow-up → Phase 15F / 15E
5. every remaining shape → deterministic fallback
```

### Complete output-surface matrix

| Plan shape | Branch | Owning phase | Final renderer / helper | Transformed / deterministic | Representative output |
| --- | --- | --- | --- | --- | --- |
| acknowledgement-only | arm 1 | **15B** | `transformBaselineAcknowledgement` | transformed | `Great, Cairns it is.` |
| acknowledgement + specific follow-up | arm 2 | **15C** | `renderBaselineAcknowledgementFollowUp` | ack transformed; follow-up preserved | `Perfect, we'll start from Sydney. When would you like to depart?` |
| acknowledgement + neutral follow-up | arm 2 | **15C** | `renderBaselineAcknowledgementFollowUp` | ack transformed; neutral preserved | `Perfect, got it. What else should I know about your trip?` |
| acknowledgement + unknown follow-up | arm 2 | **15C** | `renderBaselineAcknowledgementFollowUp` | ack transformed; follow-up preserved | `No problem, I've removed the destination. Would you like a window seat preference noted?` |
| supported follow-up-only | arm 4 | **15F** | `renderBaselineFollowUpOnly` | lead-in + preserved question | `Let's look at activities. What kinds of activities are you interested in?` |
| neutral continuation | arm 3 | **15J** | `renderBaselineNeutralContinuation` | lead-in + preserved question | `There's just one more thing I'd like to know. What else should I know about your trip?` |
| unknown follow-up-only | arm 4 | **15E pass-through** | `renderBaselineFollowUpOnly` | deterministic pass-through | `Would you like a window seat preference noted?` |
| multiple acknowledgements, no follow-up | arm 5 | **deterministic** | `renderConversationReplyPlan` | deterministic | `Great — Cairns. Perfect — departing from Sydney.` |
| multiple acknowledgements + specific follow-up | arm 5 | **deterministic** | `renderConversationReplyPlan` | deterministic | `{acks joined by space}\n{follow-up}` |
| multiple acknowledgements + neutral follow-up | arm 5 | **deterministic** | `renderConversationReplyPlan` | deterministic | `{acks joined by space}\nWhat else should I know about your trip?` |
| empty plan | arm 5 | **deterministic** | `renderConversationReplyPlan` | deterministic null-coalesce | `What else should I know about your trip?` |
| uninterpreted empty plan | arm 5 | **deterministic** | `renderConversationReplyPlan` | deterministic null-coalesce | `What else should I know about your trip?` |

`messageInterpreted` does not select a renderer branch.

### Ownership map

```text
15B  → acknowledgements.length === 1 && followUpQuestion === null
15C  → acknowledgements.length === 1 && followUpQuestion !== null
15J  → acknowledgements.length === 0
       && followUpQuestion === "What else should I know about your trip?"
15E/F → acknowledgements.length === 0 && followUpQuestion !== null
        (after 15J; eight supported catalogue strings → 15F lead-ins;
         all other non-null strings → 15E pass-through)
deterministic → every remaining shape
  (empty / uninterpreted-empty; multi-acknowledgement ± follow-up)
```

Predicates are mutually exclusive. Multi-acknowledgement plans never enter
15B, 15C, 15J, or 15E/F.

### Byte-preservation contracts

| Owner | Preserved deterministic content |
| --- | --- |
| **15B** | Transform operates on the completed acknowledgement string only |
| **15C** | Follow-up question is an exact trailing substring (space join) |
| **15F** | Supported follow-up question is an exact trailing substring |
| **15J** | Canonical neutral question is an exact trailing substring |
| **15E pass-through** | Unknown follow-up string unchanged |
| **deterministic** | Exact `renderConversationReplyPlan` output |

### Deterministic fallback boundary

```text
try generateBaselineConversationalReply(plan)
catch → renderConversationReplyPlan(plan)
```

Empty plans (`followUpQuestion === null`) are not Phase 15J-eligible; they
null-coalesce to the raw canonical neutral string without the 15J lead-in.

### Confirmation

All currently reachable `ConversationReplyPlan` shapes are accounted for in the
matrix above. No production behaviour was changed in Phase 15K. No ownership
overlap or production defect was found during the audit.
