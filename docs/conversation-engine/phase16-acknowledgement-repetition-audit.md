# Phase 16C — Acknowledgement Repetition and Stateless Rendering Audit

Investigation and characterization only. Production wording is unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 16B acknowledgement-plus-neutral bridges are preserved exactly.
No live environment has been changed.
```

## Accepted baseline

| Check | Value |
| --- | --- |
| HEAD | `4206ccdc39a1df47350851d10193aa50064be282` |
| Branch | `cursor/conversation-progression-8697` |
| Prior commit | Phase 16B: refine acknowledgement-plus-neutral expression |
| PR #29 | OPEN, Draft, Unmerged, Undeployed |
| Working tree at audit start | clean |

## Acknowledgement-expression path

```text
selectConversationAcknowledgement(state, classification)
  → one catalogue string | null
assembleConversationReplyPlan({ acknowledgement, followUp, continuation, … })
  → ConversationReplyPlan { acknowledgements: []|[ack], followUpQuestion, messageInterpreted }
generateBaselineConversationalReply(plan)
  → buildConversationalLayerInput(plan)
     → ConversationalLayerInput { plan, objective, styleProfile? }
  → renderBaselineConversationalLayer(input)
     → transformBaselineAcknowledgement(ack)                 // 15B
     → renderBaselineAcknowledgementFollowUp({ack, followUp}) // 15C
     → renderBaselineAcknowledgementNeutralContinuation(…)   // 16B
     → renderBaselineNeutralContinuation / FollowUpOnly       // 15J / 15F
```

### Data available at each boundary

| Boundary | Available inputs | Not available |
| --- | --- | --- |
| `selectConversationAcknowledgement` | final trip state + change classification | transcript, prior replies, renderer wording |
| `assembleConversationReplyPlan` | selected ack string, follow-up, continuation, `messageInterpreted` | trip state, history |
| `ConversationalLayerInput` | `plan`, plan-derived `objective`, optional `styleProfile` | transcript, previous reply, turn number, conversation id, phrase usage |
| `renderBaselineConversationalLayer` | `input.plan` fields only (ignores objective / style) | history / state / classification |
| `transformBaselineAcknowledgement` | single acknowledgement string | everything else |
| `renderBaselineAcknowledgementFollowUp` | `acknowledgement`, `followUpQuestion` | history / state |
| `renderBaselineAcknowledgementNeutralContinuation` | `acknowledgement`, `followUpQuestion` | history / state |

## Acknowledgement catalogue and transformation map

| Category | Catalogue / template | Transformed output | Opening phrase | Production-reachable shapes | Owning helper |
| --- | --- | --- | --- | --- | --- |
| field set (destination) | `Great — {destination}.` | `Great, {destination} it is.` | `Great,` | 15C / 16B | transform → 15C or 16B |
| field changed (destination) | same template | same transform family | `Great,` | 15C / 16B | transform → 15C or 16B |
| field set/changed (origin) | `Perfect — departing from {origin}.` | `Perfect, we'll start from {origin}.` | `Perfect,` | 15C / 16B | transform → 15C or 16B |
| field set/changed (departure date) | `Perfect — departing on {date}.` | `Perfect, set to depart on {date}.` | `Perfect,` | 15C / 16B | transform → 15C or 16B |
| field set/changed (return date) | `Perfect — returning on {date}.` | `Perfect, set to return on {date}.` | `Perfect,` | 15C / 16B | transform → 15C or 16B |
| field set/changed (adult/child/infant) | `Perfect — {n} … travelling.` | `Perfect, {n} … travelling.` | `Perfect,` | 15C / 16B | transform → 15C or 16B |
| field removed | `{Field} removed.` | `No problem, I've removed the {field}.` | `No problem,` | 15C (typical) / 16B | transform → 15C or 16B |
| capability enabled | `I've added {list} to your trip requirements.` | `Great, I've added {list} to your trip.` | `Great,` | 15C / 16B | transform → 15C or 16B |
| capability disabled | `I've removed {list} from your trip requirements.` | `No problem, I've removed {list} from your trip.` | `No problem,` | 16B (typical) / 15C | transform → 15C or 16B |
| generic | `Perfect.` | `Perfect, got it.` | `Perfect,` | 15C / 16B when selected | transform → 15C or 16B |
| unknown | arbitrary non-catalogue string | unchanged | first token | defensive renderer only | identity transform |

No unintended catalogue/transform defect was found: every mapped acknowledgement transforms to its Phase 15B expected wording.

## Multi-turn transcript evidence

Primary entry: `processConversationTurn()`.

### Complete trip one field at a time

| Turn | User | Deterministic ack | Follow-up shape | Owner | Opening | Exact reply (leading) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | I want to go to Cairns | `Great — Cairns.` | origin | 15C | `Great,` | Great, Cairns it is. Where will you… |
| 2 | flying from Sydney | `Perfect — departing from Sydney.` | departureDate | 15C | `Perfect,` | Perfect, we'll start from Sydney. When… |
| 3 | Depart on 28 August 2026 | `Perfect — departing on 2026-08-28.` | returnDate | 15C | `Perfect,` | Perfect, set to depart on… |
| 4 | Return on 5 September 2026 | `Perfect — returning on 2026-09-05.` | neutral | 16B | `Perfect,` | Perfect, set to return on… Is there anything else… |
| 5 | 2 adults | `Perfect — 2 adults travelling.` | neutral | 16B | `Perfect,` | Perfect, 2 adults travelling. Is there anything else… |

**Consecutive identical opener run: 4 (`Perfect,`)**

### Additional characterized journeys

| Journey | Notable opener sequence | Max consecutive identical opener |
| --- | --- | --- |
| Destination changed | `Great,` → `Great,` | 2 |
| Origin changed | `Great,` → `Perfect,` → `Perfect,` | 2 |
| Field removal + replacement | `Great,` → `Perfect,` → `No problem,` → `Great,` | 1 |
| Capability enable then disable | … `Perfect,`×3 → `Great,` → `Perfect,` → `No problem,` | 3 |
| Passenger counts after flights | post-ack passenger turns: `Perfect,`×4 | 4 |
| Post-completion beaches preference | ends with `Great,` (16B) | n/a (breaks Perfect run) |

## Repetition measurements

Across the characterized production journeys:

| Metric | Result |
| --- | --- |
| Most frequently repeated opener | `Perfect,` |
| Longest consecutive identical opener | **4** (`Perfect,` on origin → departure → return → adults) |
| Categories driving `Perfect,` | origin, departure date, return date, adult/child/infant counts, generic |
| Categories driving `Great,` | destination set/change, capability enabled |
| Categories driving `No problem,` | field removed, capability disabled |

### Source of repetition

Repetition comes from **both**:

1. **Deterministic catalogue wording** — origin, dates, passenger counts, and generic all open with `Perfect —` / `Perfect.`
2. **Conversational transformation wording** — Phase 15B maps that entire family to `Perfect, …` rather than diversifying openers by field

Phase 16B bridges improve mid-reply transitions for ack+neutral but **do not change acknowledgement openers**.

## Stateless-boundary proof

Architectural evidence (source + contracts + helper signatures):

```text
ConversationalLayerInput = { plan, objective, styleProfile? }
renderBaselineConversationalLayer reads only plan.acknowledgements / plan.followUpQuestion
transformBaselineAcknowledgement(acknowledgement: string)
renderBaselineAcknowledgementFollowUp({ acknowledgement, followUpQuestion })
renderBaselineAcknowledgementNeutralContinuation({ acknowledgement, followUpQuestion })
```

Confirmed absent from conversational helpers / layer / contracts:

```text
previous assistant reply
previous acknowledgement
transcript history
turn number
conversation identifier
recent phrase usage
```

`styleProfile` and `objective` exist on the input object but are ignored for wording by the baseline layer.

**Conclusion:** acknowledgement expression is strictly stateless with respect to conversation history. Only the current plan’s acknowledgement string (and follow-up string for join/bridge helpers) is available.

## Option assessment (not implemented)

### A. Static category-specific wording refinement

Refine Phase 15B transforms so each acknowledgement family uses a distinct opener (e.g. dates vs passengers vs origin), still keyed only on the current acknowledgement string.

| Dimension | Assessment |
| --- | --- |
| Quality benefit | High for the dominant origin→dates→passengers `Perfect,` streak |
| Risk | Low–medium; wording churn; must preserve byte-identical follow-ups / 16B bridges |
| Required inputs | Current acknowledgement string only |
| Ownership impact | Expression-only inside `transformBaselineAcknowledgement` |
| Determinism impact | Fully deterministic |
| Testability | High — exact string locks per catalogue entry |

### B. Deterministic variation based only on current acknowledgement text

Same practical boundary as A when variation is a pure function of the acknowledgement string (field/template recognition already present). Cannot break repetition when consecutive turns share the same template family (e.g. adult count then child count both stay in one opener family unless further subdivided).

| Dimension | Assessment |
| --- | --- |
| Quality benefit | Medium–high if families are subdivided finely enough |
| Risk | Over-fragmented tone if every template gets a unique gimmick |
| Required inputs | Current acknowledgement string only |
| Ownership impact | Expression-only transform map |
| Determinism impact | Fully deterministic |
| Testability | High |

### C. Deterministic variation based on current plan shape

Vary opener using `{acknowledgement, followUpQuestion}` (specific vs neutral, etc.).

| Dimension | Assessment |
| --- | --- |
| Quality benefit | Low for this problem — consecutive Perfect turns often share the same follow-up class mid-progression or all hit 16B neutral |
| Risk | Couples opener choice to follow-up shape; harder to reason about |
| Required inputs | Current plan strings only |
| Ownership impact | Would touch 15C/16B helpers or layer branching |
| Determinism impact | Deterministic |
| Testability | Medium |

### D. Variation requiring previous rendered reply or transcript history

True anti-repetition when consecutive turns emit the same category/template.

| Dimension | Assessment |
| --- | --- |
| Quality benefit | Highest for same-family streaks (adult→child→infant) |
| Risk | High architectural expansion; new reply-plan or layer inputs; history coupling |
| Required inputs | Previous reply / transcript / turn memory |
| Ownership impact | Beyond current conversational-rendering boundary |
| Determinism impact | Still can be deterministic, but broader contract |
| Testability | Medium — needs multi-turn fixtures wired into renderer inputs |

## Recommended single Phase 16D boundary

```text
Narrow stateless expression-only transformation:
refine acknowledgement openers inside transformBaselineAcknowledgement
by acknowledgement family / catalogue template, using only the current
acknowledgement string already available to Phase 15B.
```

### Why this boundary

- Directly targets the highest-volume `Perfect,` streak (origin / dates / passengers)
- Requires no transcript history, turn number, or plan-shape expansion
- Stays inside the existing transform ownership; 15C/16B continue to reuse the transformed acknowledgement
- Preserves byte-identical follow-up and Phase 16B bridge contracts if only the acknowledgement opener/sentence is refined
- Fully deterministic and independently testable

### Explicitly not Phase 16D

```text
transcript-history integration
random phrase rotation
reply-plan field expansion
selection / assembly / extraction / classification changes
```

If later product goals require avoiding identical openers across consecutive same-family turns (e.g. adult then child), that needs history and should be a separate architecture-characterization phase — not required to address the Phase 16A primary opener monotony.

## Phase 16B regression proof

Characterization tests lock:

```text
16B category bridges unchanged
canonical neutral trailing substring byte-identical
15C specific follow-ups byte-identical
15J activated neutral-only unchanged
```

No production files were modified in Phase 16C.

## Characterization tests

```text
src/features/conversation-core/__tests__/acknowledgementRepetitionAudit.phase16C.test.ts
```
