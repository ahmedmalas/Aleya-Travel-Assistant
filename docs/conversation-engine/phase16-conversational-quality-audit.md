# Phase 16A — Multi-Turn Conversational Quality Audit

Investigation and characterization only. Production wording is unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 15 is closed.
No live environment has been changed.
```

## Accepted baseline

| Check | Value |
| --- | --- |
| HEAD | `97e9663ff122e1fd4c1dc7e3801dcb1e74cf21ca` |
| Prior commit | Phase 15M: audit production reachability and close phase 15 |
| PR #29 | OPEN, Draft, Unmerged, Undeployed |
| Working tree at audit start | clean |

## Production entry point

```text
processConversationTurn()
→ authoritative trip-state update (extraction + explicit stateUpdate)
→ classifyConversationStateChange()
→ selectConversationReplyComponents()
→ assembleConversationReplyPlan()
→ generateIntegratedConversationReply()
→ generateConversationReply()
→ renderIntegratedConversationReplyPlan()
→ baseline-conversational (Phase 15 owners)
→ user reply
```

Primary journey assertions do not manually construct reply plans.

## Journeys audited

| Journey | Turns | Primary owners observed |
| --- | --- | --- |
| Complete trip one field at a time | 5 | 15C |
| Destination changed after set | 2 (+ failed repair variant) | 15C / 15J |
| Origin changed after set | 3 | 15C |
| Departure and return dates changed | 6 | 15C |
| Adult / child / infant counts changed | 9 | 15C |
| Field removal then replacement | 4 | 15C |
| Capability enabled then disabled | 7 | 15C |
| Activities enabled and clarified | 6 | 15C |
| Restaurants enabled and clarified | 6 | 15C → 15J |
| Unsupported message mid-journey | 3 | 15C → 15J → 15C |
| Correction of previous statement | 2 | 15C → 15J |
| Multiple facts in one message | 1 | 15C |
| Fully satisfied then additional preference | 6 | 15C |

## Exact transcript evidence (representative)

### Complete trip one field at a time

```text
U: I want to go to Cairns
A: Great, Cairns it is. Where will you be travelling from?

U: flying from Sydney
A: Perfect, we'll start from Sydney. When would you like to depart?

U: Depart on 28 August 2026
A: Perfect, set to depart on 2026-08-28. When would you like to return?

U: Return on 5 September 2026
A: Perfect, set to return on 2026-09-05. What else should I know about your trip?

U: 2 adults
A: Perfect, 2 adults travelling. What else should I know about your trip?
```

### Failed destination repair (current behaviour)

```text
U: go to Brisbane
A: Great, Brisbane it is. Where will you be travelling from?

U: sorry I meant Cairns
A: There's just one more thing I'd like to know. What else should I know about your trip?
   (destination remains Brisbane)
```

Successful change uses a re-set phrase that extraction already understands:

```text
U: go to Brisbane
A: Great, Brisbane it is. Where will you be travelling from?

U: go to Cairns
A: Great, Cairns it is. Where will you be travelling from?
```

### Unsupported mid-journey with missing origin

```text
U: go to Cairns
A: Great, Cairns it is. Where will you be travelling from?

U: what is the weather like
A: There's just one more thing I'd like to know. What else should I know about your trip?
   (origin still null; required follow-up suppressed because uninterpreted)

U: from Sydney
A: Perfect, we'll start from Sydney. When would you like to depart?
```

### Activities clarification re-asks the same question

```text
U: book activities
A: Great, I've added activities to your trip. What kinds of activities are you interested in?

U: we like hiking
A: Great, I've added hiking and walking to your trip. What kinds of activities are you interested in?
```

### Multiple facts in one message (extraction defect evidence)

```text
U: go to Cairns from Sydney on 28 August 2026 returning 5 September 2026
A: Great, Cairns it is. When would you like to depart?

Final state:
  destination = Cairns
  origin = "Sydney on 28 August 2026 returning 5 September 2026"   ← polluted
  departureDate = null                                             ← missed
  returnDate = 2026-09-05
```

### Post-core preference

```text
U: I like beaches
A: Great, I've added beaches to your trip. What else should I know about your trip?
```

## Quality-gap catalogue

### Confirmed production behaviour → quality concern

| Finding | Confirmed behaviour | Quality concern | Architectural owner | Blast radius | Possible future transformation boundary |
| --- | --- | --- | --- | --- | --- |
| Repeated ack+neutral | After core fields are complete, nearly every additional fact yields `{transformedAck} What else should I know about your trip?` | Mechanical / catalogue-like; high repetition across consecutive turns | **Conversational rendering** (15C ack+neutral expression) | All post-core 15C turns (passengers, date edits, capability disable, beaches, etc.) | Narrow 15C eligibility: one ack + canonical neutral follow-up only; preserve trailing question bytes |
| Repeated `Perfect,` openers | Field-by-field progression often opens 3–5 consecutive turns with `Perfect,` | Tone monotony / repetitive acknowledgements | **Conversational rendering** (15B/15C ack transforms) | Core progression turns | Later ack-transform variation; broader than 16B |
| 15J after unsupported input while fields missing | Uninterpreted mid-journey suppresses specific follow-up and emits activated neutral | Awkward: asks “what else” while origin (etc.) still missing | **Deterministic selection** (`followUpQuestion` null when `!messageInterpreted`) | Any uninterpreted turn with incomplete core/context | Selection policy change — not expression-only |
| Failed conversational repair | “sorry I meant Cairns” / “actually change to Cairns” leave prior destination and emit 15J | Repair opportunity missed; feels ignoring the user | **State/extraction** | Destination (and similar) correction phrases | Extractor / repair understanding — not Phase 16 rendering |
| Multi-fact origin pollution | Single message packs dest/origin/dates; origin string absorbs trailing date text; departure missed | Wrong authoritative state + asks for already-stated departure | **State/extraction** | Multi-fact free-text turns | Extractor span / date isolation — **defect**, not rendering |
| Activities re-ask after hiking | Hiking capability ack added but activities interest question repeats | Duplicate concept across ack and follow-up | **Deterministic selection** (no interest-satisfaction field for activities) | Activities clarification turns | Selection/suppression or new state field — not expression-only |
| Seafood preference ignored | “looking for seafood” → 15J; restaurants flag unchanged, no dining preference stored | Clarification not absorbed | **State/extraction** (+ selection) | Restaurants clarification | Extractor / preference model |
| Same destination re-set re-asks origin | `go to Cairns` after Brisbane still asks origin even if conversation already asked | Mild repetition of follow-up after correction | **Deterministic selection** + missing conversational memory of prior ask | Destination re-set turns | Selection/context — broader than expression |

### No defect — acceptable current behaviour

| Behaviour | Why acceptable now |
| --- | --- |
| Field-by-field core progression (dest → origin → dates) | Clear, correct ownership; Phase 15C wording is serviceable |
| Capability enable asking the next required count question | Correct selection + preserved question |
| Explicit destination removal then replacement | Clear ack + correct next follow-up |
| Origin change via “actually from Sydney” | Extraction + 15C acknowledgement work |
| Successful destination re-set via “go to Cairns” | Works when phrasing matches extractor |

## Ownership classification summary

```text
conversational rendering gap
  - repetitive ack + neutral continuation expression (highest volume)
  - repetitive Perfect,/Great, openers across consecutive turns

deterministic selection gap
  - uninterpreted turns suppress required follow-ups → awkward 15J
  - activities interest never suppresses activities follow-up

classification gap
  - none newly found beyond existing interpreted vs acknowledgement-eligible split

state/extraction gap
  - multi-fact origin pollution + missed departureDate  (DEFECT evidence)
  - destination repair phrases not extracted
  - dining preference text not stored

no defect — acceptable current behaviour
  - core progression; capability enable/disable; explicit removal/replacement
```

## Blast-radius assessment

| Gap class | Blast radius |
| --- | --- |
| Ack+neutral rendering | High frequency after any completed-core conversation |
| Uninterpreted → 15J while incomplete | Medium; any off-topic or failed-extract turn mid-flow |
| Multi-fact extraction pollution | High severity when it happens; narrower trigger (dense one-shot messages) |
| Activities re-ask | Medium; every activities clarification path |
| Repair phrase misses | Medium; natural corrections often fail |

## Extraction defect report (not fixed in Phase 16A)

```text
category: multi-fact free-text extraction
journey: multiple facts supplied in one message
turn: 1
user input:
  "go to Cairns from Sydney on 28 August 2026 returning 5 September 2026"
previous state: empty travel fields
expected final state (user intent):
  destination=Cairns
  origin=Sydney
  departureDate=2026-08-28
  returnDate=2026-09-05
actual final state:
  destination=Cairns
  origin="Sydney on 28 August 2026 returning 5 September 2026"
  departureDate=null
  returnDate=2026-09-05
classification: interpreted + acknowledgement-eligible (destination)
reply plan: ack Great — Cairns. ; follow-up departureDate
actual reply: Great, Cairns it is. When would you like to depart?
suspected owner: state/extraction (origin span / date isolation)
blast radius: dense multi-fact user messages; cascading wrong follow-up
recommended next investigation: origin/date extractor boundary tests (outside Phase 16 expression work)
```

Related repair-extraction miss (same owner class):

```text
user: "sorry I meant Cairns" after destination=Brisbane
actual: destination remains Brisbane; 15J activated neutral
```

## Recommended single Phase 16B boundary

```text
Phase 16B — refine acknowledgement-plus-neutral-continuation expression
```

### Why this boundary

- Highest-volume remaining awkwardness after Phase 15 (post-core turns)
- Expression-only: does not change extraction, classification, selection, or assembly
- Preserves deterministic ownership of the canonical neutral question
- Narrow eligibility already present on the plan:

```text
plan.acknowledgements.length === 1
AND plan.followUpQuestion === "What else should I know about your trip?"
```

- Independently testable via existing 15C path + production journeys
- Avoids broad transcript rewriting and does not require chat history

### Out of scope for 16B (larger / different owners)

```text
multi-fact extraction pollution
destination repair phrase extraction
uninterpreted follow-up suppression policy
activities interest suppression
ack opener variation across all 15C turns
```

### Success criteria (for a future Phase 16B implementation)

```text
byte-identical trailing canonical neutral question
unchanged selection / assembly / state
narrow eligibility only for ack + canonical neutral
production and helper path agreement
no change to ack+specific-follow-up or 15J-only shapes unless explicitly scoped
```

## Characterization tests

```text
src/features/conversation-core/__tests__/multiTurnConversationalQuality.phase16A.test.ts
```

Locks exact current replies for every audited journey, including awkward and defective extraction outcomes.

---

## Phase 16B record — refine acknowledgement-plus-neutral expression

Expression-only refinement. Does not change extraction, state, classification,
selection, or reply-plan assembly.

### Eligibility boundary

```text
plan.acknowledgements.length === 1
AND
plan.followUpQuestion === "What else should I know about your trip?"
```

### Final branch order

```text
1. one acknowledgement + canonical neutral → Phase 16B
2. one acknowledgement, no follow-up → Phase 15B
3. one acknowledgement + non-neutral follow-up → Phase 15C
4. zero acknowledgements + canonical neutral → Phase 15J
5. zero acknowledgements + supported/unknown follow-up → Phase 15F / 15E
6. all remaining shapes → deterministic fallback
```

### Category-to-bridge mapping

| Acknowledgement category | Bridge before canonical neutral |
| --- | --- |
| field set or changed | `Is there anything else you'd like me to consider?` |
| field removed | `We can update the rest as we go.` |
| capability enabled | `Tell me anything else that matters for this trip.` |
| capability disabled | `We can keep refining the plan.` |
| generic acknowledgement | `Is there anything else you'd like me to consider?` |
| unknown acknowledgement | *(none — direct join)* |

Output shape:

```text
{transformed acknowledgement} {bridge?} {canonical neutral question}
```

One space between sentences. No newlines. Canonical neutral remains a
byte-identical trailing substring.

### Byte-preservation contract

- `transformBaselineAcknowledgement` is reused; transform logic is not duplicated
- Category recognition uses Phase 15B transform outcomes (unchanged string ⇒ unknown)
- Canonical question `What else should I know about your trip?` is preserved byte-for-byte
- Unknown acknowledgements receive no unsupported bridge

### Production journeys improved

| Journey | Prior repetitive join | Phase 16B expression |
| --- | --- | --- |
| Core field changed after trip completion | `{ack} What else…` | `{ack} Is there anything else you'd like me to consider? What else…` |
| Field removed after trip completion | `{ack} What else…` | `{ack} We can update the rest as we go. What else…` |
| Capability enabled after core completion | `{ack} What else…` | `{ack} Tell me anything else that matters for this trip. What else…` |
| Capability disabled after core completion | `{ack} What else…` | `{ack} We can keep refining the plan. What else…` |

### Unchanged categories

```text
one-ack + specific follow-up (15C)
acknowledgement-only (15B)
zero-ack canonical neutral (15J)
zero-ack supported follow-ups (15F)
unknown follow-up pass-through (15E)
multi-ack / empty deterministic fallback
Phase 14I fallback
catalogue strings, selection, assembly, extraction, classification
```

### Production files

```text
src/features/conversation-core/renderBaselineAcknowledgementNeutralContinuation.ts
src/features/conversation-core/renderBaselineConversationalLayer.ts
```

### Tests

```text
src/features/conversation-core/__tests__/acknowledgementNeutralContinuation.phase16B.test.ts
src/features/conversation-core/__tests__/multiTurnConversationalQuality.phase16A.test.ts
```
