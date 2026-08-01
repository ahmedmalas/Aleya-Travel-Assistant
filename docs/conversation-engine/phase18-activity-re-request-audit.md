# Phase 18 Activity Re-Request Audit

Investigation and characterization only. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 18B baseline preserved exactly.
No live environment has been changed.
```

## Scope

Characterize the defect where the engine asks for activity preferences again after the user has already supplied a specific activity such as hiking.

Characterization tests:

```text
src/features/conversation-core/__tests__/activityReRequestAudit.phase18C.test.ts
```

This phase does **not** modify production extraction, schema, selection, wording, or rendering.

Representative journey:

```text
activitiesRequested = true
core trip fields complete
User: I'm interested in hiking
Observed reply includes:
Great, I've added hiking and walking to your trip.
What kinds of activities are you interested in?
```

## Runtime Path

```text
processConversationTurn()
↓
capability extraction
  "I'm interested in hiking" → { hikingWalkingRequested: true }
↓
authoritative trip-state update
  hikingWalkingRequested = true
  activitiesRequested unchanged (still true)
↓
classifyConversationStateChange()
  newlyEnabledRequestFlags = [hikingWalkingRequested]
  hasInterpretedChange = true
↓
selectConversationFollowUpQuestion(state)
  activitiesRequested === true → activities follow-up
  (specific activity flags are not consulted)
↓
selectConversationContinuationPrompt
  follow-up present → null
↓
selectConversationReplyComponents / assembleConversationReplyPlan
  acknowledgement + activities follow-up
↓
rendered reply
  Great, I've added hiking and walking to your trip.
  What kinds of activities are you interested in?
```

## Activity State Architecture

There is **no** free-text activity preference field on `ConversationCoreState`.

Current storage is capability-flag based:

| Concept | Field | Role |
| --- | --- | --- |
| Broad activities service | `activitiesRequested` | Enables the general activities follow-up |
| Hiking / walking | `hikingWalkingRequested` | Specific capability flag |
| Kayaking | `kayakingRequested` | Specific capability flag |
| Diving / snorkelling | `divingSnorkellingRequested` | Specific capability flag |
| Fishing / wildlife / national parks / scenic drives / beaches / … | matching `*Requested` flags | Specific capability flags |
| Free-text preference | *(absent)* | Not in schema |

Broad “I need activities” and specific “I want hiking” therefore use **related but separate** storage paths:

```text
I need activities
→ activitiesRequested = true

I'm interested in hiking
→ hikingWalkingRequested = true
(does not clear or complete activitiesRequested)
```

## Activity Phrase Results

Seed unless noted: complete core trip + `activitiesRequested = true`.

| Phrase | Extracted / persisted | Follow-up after turn |
| --- | --- | --- |
| I'm interested in hiking | `hikingWalkingRequested=true` | activities question |
| We want to go hiking | `hikingWalkingRequested=true` | activities question |
| Hiking | `hikingWalkingRequested=true` | activities question |
| Walking and hiking | `hikingWalkingRequested=true` | activities question |
| Bushwalking | `hikingWalkingRequested=true` | activities question |
| Nature walks | `hikingWalkingRequested=true` | activities question |
| Kayaking | `kayakingRequested=true` | activities question |
| Snorkelling | `divingSnorkellingRequested=true` | activities question |
| Diving | `divingSnorkellingRequested=true` | activities question |
| Fishing | `fishingRequested=true` | activities question |
| Wildlife experiences | `wildlifeRequested=true` (+ may restate activities) | activities question |
| National parks | `nationalParksRequested=true` | activities question |
| Scenic drives | `scenicDrivesRequested=true` | activities question |
| Beaches | `beachesRequested=true` | activities question |
| Shopping | `{}` (no flag set from bare phrase) | activities question |
| Nightlife | `{}` | activities question |
| Wellness activities | restates `activitiesRequested` only / no wellness flag | activities question |

Supported specific activities are extracted and persisted. The re-ask is **not** an extraction failure for hiking and the other supported capability phrases above.

## Multi-Turn Journey Matrix

### Journey A — enable activities, then hiking

```text
Turn 1: I need activities
→ activitiesRequested=true
→ Great, I've added activities to your trip. What kinds of activities are you interested in?

Turn 2: I'm interested in hiking
→ hikingWalkingRequested=true (activitiesRequested remains true)
→ Great, I've added hiking and walking to your trip. What kinds of activities are you interested in?
```

Defect observed on Turn 2.

### Journey B — hiking first, then unsupported

```text
Turn 1: I want hiking
→ hikingWalkingRequested=true, activitiesRequested=null
→ ack + terminal neutral (no activities question)

Turn 2: I'm not sure / I don't know
→ messageInterpreted=false
→ activated neutral (Phase 18B preserves terminal when no missing required field)
```

### Journey C — hiking and kayaking together

```text
Turn 1: I want hiking and kayaking
→ both specific flags true, activitiesRequested=null
→ ack + terminal neutral
```

### Journey D — activities, hiking, then kayaking

```text
Turn 1: I want activities → activities follow-up
Turn 2: Hiking → hiking flag + activities follow-up again
Turn 3: I also like kayaking → kayaking flag + activities follow-up again
```

### Journey E — hiking then “I don’t know”

Same as Journey B when activities was never enabled: terminal neutral both turns.

### Unsupported after hiking while activities enabled

```text
Seed: activitiesRequested=true
Turn 1: I'm interested in hiking → activities follow-up
Turn 2: I don't know → activities follow-up again (Phase 18B keeps required follow-up)
```

## Activity Completion Contract

Current contract, from `selectConversationFollowUpQuestion`:

```text
Select activities follow-up iff:
  core progression fields are populated
  AND activitiesRequested === true
```

Documented in source:

```text
Activity/dining interest has no dedicated state field yet,
so those questions remain eligible while the capability stays requested.
```

Therefore:

| State | Activities question selected? |
| --- | --- |
| `activitiesRequested=true`, no specific flags | yes |
| `activitiesRequested=true`, `hikingWalkingRequested=true` | **yes** |
| `activitiesRequested=true`, multiple specific flags true | **yes** |
| `activitiesRequested=null/false`, `hikingWalkingRequested=true` | no |
| Incomplete core fields | core follow-up wins first |

**An explicit activity capability does not currently satisfy the general activity-preference requirement.** Those concepts are intentionally separate under today’s completeness definition.

## Follow-Up Selection Evidence

Applies predicate:

```typescript
{
  applies: (state) => state.activitiesRequested === true,
  question: CONVERSATION_REPLY_CATALOGUE.followUps.activities,
}
```

Proof:

1. Setting `hikingWalkingRequested` (or kayaking / diving / …) does not change the predicate.
2. Direct `selectConversationFollowUpQuestion` on a state with activities + many specific flags still returns the activities question.
3. Reply-component composition, assembly, and renderer faithfully carry that already-selected question.

## Comparison Cases

| Case | Result |
| --- | --- |
| activities enabled, no detail | activities follow-up |
| activities enabled + free-text-like unsupported phrase | no preference stored; activities follow-up |
| activities enabled + one capability flag | flag persisted; activities follow-up remains |
| activities enabled + multiple capability flags | flags persisted; activities follow-up remains |
| activities disabled (`false`) + hiking | hiking persisted; terminal neutral |
| restaurants enabled + seafood | seafood not extracted; restaurants follow-up remains (parallel architecture; no dining preference field) |

Seafood is a related missing-preference-field pattern, not investigated beyond this distinction.

## Verified Facts

1. Hiking and other supported specific activities **are extracted**.
2. They are persisted on dedicated `*Requested` capability flags (e.g. `hikingWalkingRequested`).
3. There is no activity preference field; specific capabilities do **not** complete the general activities follow-up.
4. The activities question is selected again solely because `activitiesRequested` remains `true`.
5. The re-ask affects **all** supported specific activities under `activitiesRequested=true`, not only hiking.
6. Repeated same-capability input is classified as uninterpreted (`messageInterpreted=false`) but still receives the activities follow-up via Phase 18B.
7. Unsupported input after hiking:
   - without `activitiesRequested` → preserves terminal neutral
   - with `activitiesRequested` → reselects the activities follow-up
8. Renderer and assembly are not at fault; the plan already contains the activities question.

## Observed Failure

```text
User answers the activities preference prompt with a supported specific activity
→ engine acknowledges the capability
→ engine asks the same general activities preference question again
```

The failure is a **completeness / suppression gap** in follow-up selection, not lost state.

## Root-Cause Evidence

From `selectConversationFollowUpQuestion.ts`:

```typescript
{
  applies: (state: ConversationCoreState) => state.activitiesRequested === true,
  question: CONVERSATION_REPLY_CATALOGUE.followUps.activities,
}
```

Combined with Phase 10E comment admitting no dedicated interest field and therefore no suppression when specific interest already exists.

Extraction evidence for the representative turn:

```text
patch: { hikingWalkingRequested: true }
final.activitiesRequested: true
final.hikingWalkingRequested: true
follow-up: What kinds of activities are you interested in?
```

## Defect Ownership

| Layer | Owns the defect? |
| --- | --- |
| activity / capability extraction | No — hiking and peers extract correctly |
| authoritative state schema | Contributing gap: no preference / completion field, but not where the re-ask is decided |
| state persistence | No — flags persist |
| classification | No — correctly reports capability enable / unchanged repeats |
| **activity completeness definition in follow-up selection** | **Yes** |
| reply-component selection | No — post-18B correctly forwards follow-up |
| reply-plan assembly | No |
| renderer | No — plan already wrong |

**Owner for Phase 18D:** `selectConversationFollowUpQuestion` (activities contextual `applies` / suppression rule).

## Blast Radius

A narrow 18D suppression such as “skip activities follow-up when any specific activity capability is already true” would affect:

```text
every turn where activitiesRequested=true and at least one specific activity flag is true
unsupported / repeated turns in that state (post-18B)
multi-capability activity journeys
```

It would **not** need to change:

```text
capability extractors
acknowledgement wording
catalogue strings
core progression order
restaurants follow-up (unless explicitly scoped later)
Phase 18B uninterpreted follow-up preservation
```

Product caution: suppressing on any specific flag treats “hiking” as a complete answer to “what kinds of activities…”. That matches the observed user expectation for this defect, but is a product contract decision (one specific capability vs free-text preference completeness).

## Safe Fix Boundary

Phase 18D should change only the activities contextual eligibility/suppression rule in follow-up selection:

```text
Keep:
  extractors and capability flag semantics
  activitiesRequested meaning
  catalogue wording
  acknowledgement selection
  Phase 18B messageInterpreted-independent follow-up selection

Change (recommended narrow option):
  suppress activities follow-up when one or more specific activity
  capability flags are already true

Defer:
  new free-text preference field
  seafood / restaurants preference persistence
  changing priority among contextual questions
```

## Recommended Phase 18D

1. Narrow the activities `applies` predicate in `selectConversationFollowUpQuestion` so a persisted specific activity capability satisfies / suppresses the general activities preference question.
2. Flip Phase 18C characterization expectations only where re-ask behaviour intentionally ends.
3. Keep restaurants/seafood as a separate later phase unless the same suppression pattern is explicitly adopted for dining.
4. Re-run Phase 18A/18B/16K/17J suites to prove unsupported-input and repair paths stay intact.

## Required conclusions

| # | Conclusion |
| --- | --- |
| 1 | Hiking and other supported activities are extracted. |
| 2 | They persist on specific `*Requested` capability flags. |
| 3 | An explicit activity capability does **not** currently satisfy the general activity-preference requirement. |
| 4 | The question is reselected because follow-up selection only checks `activitiesRequested === true`. |
| 5 | The defect affects all supported specific activities under that condition, not only hiking. |
| 6 | Repeated same activity input is uninterpreted (`messageInterpreted=false`) when the flag is already true. |
| 7 | Unsupported after hiking: preserves neutral if activities were never enabled; reselects activities follow-up if `activitiesRequested` remains true (Phase 18B). |
| 8 | Single deterministic 18D owner: **follow-up selection** (`selectConversationFollowUpQuestion`). |
