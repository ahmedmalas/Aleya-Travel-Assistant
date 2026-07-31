# Phase 18 Unsupported Input Selection Audit

Investigation and characterization only. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 17J baseline preserved exactly.
No live environment has been changed.
```

## Scope

Characterize the defect where unsupported or uninterpreted input produces the neutral continuation even though required trip fields are still missing.

Characterization tests:

```text
src/features/conversation-core/__tests__/unsupportedInputSelectionAudit.phase18A.test.ts
```

This phase does **not** modify production extraction, classification, selection, wording, or rendering.

Representative case:

```text
destination = Cairns
origin = null
departureDate = null
returnDate = null
User: I'm not sure yet
Observed reply: There's just one more thing I'd like to know. What else should I know about your trip?
Expected architectural question: Should the origin follow-up remain active instead?
```

## Runtime Path

```text
processConversationTurn()
↓
extractConversationStateUpdate()          → usually {}
↓
authoritative trip-state update           → state unchanged
↓
classifyConversationStateChange()         → hasInterpretedChange = false
↓
selectConversationAcknowledgement()       → null
↓
selectConversationMessageInterpreted()    → false
↓
selectConversationReplyComponents()
  followUpQuestion = messageInterpreted
    ? selectConversationFollowUpQuestion(state)
    : null                                 → null (gated)
  continuationPrompt =
    selectConversationContinuationPrompt({ followUpQuestion: null })
                                           → NEUTRAL
↓
assembleConversationReplyPlan()
  followUpQuestion = null ?? NEUTRAL       → NEUTRAL
↓
rendered reply                             → Phase 15J activated neutral
```

Critical gate in `selectConversationReplyComponents.ts`:

```typescript
const followUpQuestion = messageInterpreted
  ? selectConversationFollowUpQuestion(state)
  : null;
const continuationPrompt = selectConversationContinuationPrompt({
  followUpQuestion,
});
```

## Unsupported Input Families

Seed: `destination = Cairns`, `flightsRequested = true`, other core fields null.

All of the following currently share one selection path:

| Family | Extracted patch | `messageInterpreted` | Follow-up if called | Gated follow-up | Continuation | Exact reply |
| --- | --- | --- | --- | --- | --- | --- |
| I'm not sure yet | `{}` | false | origin | null | neutral | activated neutral |
| I'm not sure | `{}` | false | origin | null | neutral | activated neutral |
| I don't know | `{}` | false | origin | null | neutral | activated neutral |
| Maybe | `{}` | false | origin | null | neutral | activated neutral |
| Okay | `{}` | false | origin | null | neutral | activated neutral |
| Thanks | `{}` | false | origin | null | neutral | activated neutral |
| Can you help me? | `{}` | false | origin | null | neutral | activated neutral |
| What do you recommend? | `{}` | false | origin | null | neutral | activated neutral |
| Tell me more | `{}` | false | origin | null | neutral | activated neutral |
| That sounds good | `{}` | false | origin | null | neutral | activated neutral |
| Let me think | `{}` | false | origin | null | neutral | activated neutral |
| My favourite colour is blue | `{}` | false | origin | null | neutral | activated neutral |
| I like warm weather | `{}` | false | origin | null | neutral | activated neutral |
| This is for my anniversary | `{}` | false | origin | null | neutral | activated neutral |
| I have a flexible budget | `{}` | false | origin | null | neutral | activated neutral |

They do not need identical future treatment, but current behaviour is identical: empty extraction → uninterpreted → gated follow-up → neutral continuation.

Exact activated neutral wording:

```text
There's just one more thing I'd like to know. What else should I know about your trip?
```

## Required-Field State Matrix

Unsupported message: `I'm not sure yet`.

| Next required field / scenario | Follow-up if called | Gated follow-up | Continuation | Final reply |
| --- | --- | --- | --- | --- |
| destination | Where would you like to travel? | null | neutral | activated neutral |
| origin | Where will you be travelling from? | null | neutral | activated neutral |
| departureDate | When would you like to depart? | null | neutral | activated neutral |
| returnDate | When would you like to return? | null | neutral | activated neutral |
| adultCount (flights) | How many adults will be travelling? | null | neutral | activated neutral |
| guest count (accommodation) | How many guests will be staying? | null | neutral | activated neutral |
| activities preference | What kinds of activities are you interested in? | null | neutral | activated neutral |
| restaurant preference | What type of dining are you looking for? | null | neutral | activated neutral |
| multiple fields missing | first missing (origin when dest set) | null | neutral | activated neutral |
| only one field missing | that field’s question | null | neutral | activated neutral |
| previous turn just set destination | origin | null | neutral | activated neutral |
| previous state unchanged | correct missing-field question | null | neutral | activated neutral |
| all required fields complete | neutral (follow-up terminal) | null | neutral | activated neutral |
| no services enabled (core complete) | neutral (follow-up terminal) | null | neutral | activated neutral |

## Interpreted-State Results

For unsupported / empty-patch turns on incomplete state:

| Signal | Current value |
| --- | --- |
| `messageInterpreted` | `false` (`classification.hasInterpretedChange`) |
| `classification.updated` | `[]` |
| `classification.newlyPopulated` | `[]` |
| `classification.removed` | property absent (no `removed` array) |
| `acknowledgement` | `null` |
| `acknowledgementEvent` | `null` |
| `followUpQuestion` (components) | `null` (gated) |
| `continuation` | `What else should I know about your trip?` |
| assembled plan `followUpQuestion` | neutral (via `followUp ?? continuation`) |

Unsupported input is therefore represented as:

```text
messageInterpreted = false
empty state change
null acknowledgement
null gated follow-up
neutral continuation
```

`messageInterpreted` is independent of trip completeness: it tracks travel-field change only.

## Follow-Up and Continuation Precedence

Proven order:

```text
1. selectConversationFollowUpQuestion(state)
   → still returns the correct missing-field question from final state
2. selectConversationReplyComponents gates that call on messageInterpreted
   → when false, followUpQuestion becomes null without calling the selector
3. selectConversationContinuationPrompt({ followUpQuestion: null })
   → emits NEUTRAL because follow-up is absent
4. assembleConversationReplyPlan
   → plan.followUpQuestion = followUpQuestion ?? continuationPrompt = NEUTRAL
5. renderer (Phase 15J)
   → wraps canonical NEUTRAL with the activated lead-in
```

Answers:

| Question | Result |
| --- | --- |
| Does the follow-up selector still return the required question? | **Yes**, when invoked directly on final state |
| Does the continuation selector overwrite/replace it? | **Effectively yes**, because the gated follow-up is null, so continuation fills the slot |
| Does reply-component assembly discard one? | Assembly coalesces null follow-up to continuation; the specific follow-up never reaches the plan |
| Does the renderer change the selected prompt? | **No** — it correctly activates the already-selected neutral prompt |

## Exact Reply Matrix

Unsupported message: `I'm not sure yet`.

| Case | Ack | Specific follow-up | Neutral continuation | Exact final reply |
| --- | --- | --- | --- | --- |
| Missing destination | no | no (would be destination) | yes | activated neutral |
| Missing origin | no | no (would be origin) | yes | activated neutral |
| Missing departure date | no | no (would be departure) | yes | activated neutral |
| Missing return date | no | no (would be return) | yes | activated neutral |
| Missing adult count | no | no (would be adults) | yes | activated neutral |
| Complete trip | no | no (follow-up terminal = neutral) | yes | activated neutral |

Every incomplete case currently contains **neutral continuation only** — not both prompts, and not the specific required-field question.

## Comparison Cases

Seed: missing origin (`destination = Cairns`).

| Input | Patch | `messageInterpreted` | Selection behaviour |
| --- | --- | --- | --- |
| empty message | `{}` | false | same uninterpreted → gated follow-up → neutral |
| whitespace-only | `{}` | false | same |
| supported-shaped text with no extract (`Hello there friend`) | `{}` | false | same |
| same value repeated (`Cairns` bare, already set) | `{}` | false | same |
| explicit repair unchanged (`Sorry, I meant Cairns`) | `{ destination: Cairns }` | false | same selection path (unchanged value ⇒ uninterpreted) |
| unknown destination-like (`Xyzzyville`) | `{}` | false | same |
| unsupported hedge (`I'm not sure yet`) | `{}` | false | same |

These enter through different extraction boundaries in some cases (empty vs unchanged repair patch), but they converge on the same reply-component gate once `hasInterpretedChange` is false.

Supported interpreted path remains different:

```text
go to Cairns from Sydney
→ patch { destination, origin }
→ messageInterpreted true
→ acknowledgement present
→ follow-up = departureDate
→ continuation null
```

## Verified Facts

1. The specific follow-up selector returns the correct missing-field question from final canonical state.
2. Neutral continuation is selected despite missing required fields whenever `messageInterpreted` is false.
3. Unsupported input sets `messageInterpreted = false` independently of trip completeness.
4. The defective incomplete-trip behaviour occurs on unchanged / uninterpreted state (empty patch or unchanged extracted value).
5. Complete trips already resolve to neutral whether via follow-up terminal (`messageInterpreted true`) or continuation (`false`); retaining neutral there is consistent.
6. Acknowledgement is null on these turns and does not create the wrong prompt; the defect is the follow-up gate, not acknowledgement wording.
7. The renderer receives an already-incorrect plan (`followUpQuestion = NEUTRAL`) and activates it faithfully.
8. Existing supported interpreted paths already emit the required-field follow-up and must remain unchanged.

## Observed Failure

```text
Incomplete trip + uninterpreted user turn
→ required-field follow-up bypassed
→ neutral continuation emitted
→ activated neutral reply shown
```

The failure is not that the follow-up selector forgets the missing field; it is that reply-component orchestration never asks it when the turn did not change travel state.

## Root-Cause Evidence

From `selectConversationReplyComponents.ts`:

```typescript
const followUpQuestion = messageInterpreted
  ? selectConversationFollowUpQuestion(state)
  : null;
```

Direct call with the same final state still returns e.g. origin:

```text
selectConversationFollowUpQuestion({ destination: 'Cairns', origin: null, ... })
→ "Where will you be travelling from?"
```

Continuation then fires only because the gated value is null:

```text
selectConversationContinuationPrompt({ followUpQuestion: null })
→ "What else should I know about your trip?"
```

Assembly preserves that continuation as the plan prompt; Phase 15J only adds the lead-in.

## Defect Ownership

| Layer | Owns the defect? |
| --- | --- |
| classification | No — correctly reports no interpreted change |
| `messageInterpreted` selection | No — correctly mirrors `hasInterpretedChange` |
| follow-up selection | No — still returns the correct missing-field question |
| continuation selection | No — correctly emits neutral when follow-up is null |
| **reply-component composition** | **Yes** — gates follow-up on `messageInterpreted`, discarding the required-field question |
| reply-plan assembly | No — faithfully coalesces null follow-up to continuation |
| renderer | No — plan is already wrong before render |

**Owner for Phase 18B:** `selectConversationReplyComponents` (the `messageInterpreted` gate around follow-up selection).

## Blast Radius

A fix that always selects follow-up from final state (independent of `messageInterpreted`) would affect every uninterpreted turn:

```text
unsupported hedges
empty / whitespace messages
unknown / non-catalogue text
same-value repeats
unchanged repairs
```

It would **not** need to change:

```text
extractors
repair handling
authoritative state-update semantics
classification
messageInterpreted definition
acknowledgement selection / wording
follow-up wording / priority
continuation wording
catalogue strings
integration mode
supported interpreted acknowledgement + follow-up paths
```

Complete-trip uninterpreted turns would still land on neutral because the follow-up selector’s terminal return is already the neutral prompt.

## Safe Fix Boundary

Phase 18B should change only reply-component orchestration:

```text
Keep:
  messageInterpreted = classification.hasInterpretedChange
  acknowledgement still driven by classification / eligible change
  selectConversationFollowUpQuestion(state) semantics unchanged
  selectConversationContinuationPrompt semantics unchanged
  assemble / render unchanged

Change:
  always invoke selectConversationFollowUpQuestion(state)
  (do not null it solely because messageInterpreted is false)
```

Optional equivalent: gate only acknowledgement on interpretation; never gate required-field progression on interpretation.

Do **not** in 18B:

```text
add unsupported-input phrase catalogues
add generic conversational replies
change required-field priority
change messageInterpreted semantics for other consumers
alter extractor / repair behaviour
```

## Recommended Phase 18B

1. Remove or narrow the `messageInterpreted` gate in `selectConversationReplyComponents` so missing-field follow-ups remain active on uninterpreted turns.
2. Preserve characterization fixtures from Phase 18A as regression expectations flipped only where incomplete-trip unsupported replies must keep the specific follow-up.
3. Keep complete-trip neutral behaviour.
4. Re-run Phase 16K / 17J closure suites to prove supported and repair paths stay unchanged.

## Required conclusions

| # | Conclusion |
| --- | --- |
| 1 | Specific follow-up selector returns the correct missing-field question. |
| 2 | Neutral continuation is selected despite missing required fields. |
| 3 | Unsupported input sets `messageInterpreted` independently of trip completeness. |
| 4 | Defect occurs on unchanged / uninterpreted state (not only named hedge phrases). |
| 5 | Complete trips should retain neutral continuation — current terminal behaviour already does. |
| 6 | Acknowledgement nulls do not create the wrong prompt; the follow-up gate does. |
| 7 | Single deterministic fix layer: **reply-component composition** (`selectConversationReplyComponents`). |
| 8 | Supported interpreted paths (ack + specific follow-up / ack + neutral bridge) must remain unchanged. |
