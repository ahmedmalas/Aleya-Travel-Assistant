# Phase 18 Restaurant Follow-Up Completion Audit

Investigation and characterization only. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 18D baseline preserved exactly.
No live environment has been changed.
```

## Scope

Full audit of restaurant follow-up completion logic after Phase 18D closed the parallel activities re-ask defect.

Characterization tests:

```text
src/features/conversation-core/__tests__/restaurantFollowUpAudit.phase18E.test.ts
```

This phase does **not** modify production extraction, schema, selection, wording, or rendering.

## Architecture

Restaurant service enablement and dining preference follow-up are currently a single-flag design:

```text
restaurantsRequested (boolean | null)
  → enables restaurants capability acknowledgement
  → exclusively decides the dining preference follow-up
```

There is **no** free-text or structured dining preference field on `ConversationCoreState`.

Related but separate:

| Field | Role relative to restaurants follow-up |
| --- | --- |
| `restaurantsRequested` | Broad restaurants service; sole dining follow-up gate |
| `wineriesFoodTrailsRequested` | Specific activity/food-trail capability; does **not** suppress dining follow-up |
| cuisine / seafood / dining style | Not present in schema |

## Ownership

| Concern | Owner |
| --- | --- |
| Restaurant service extraction | `RestaurantsRequestedConversationStateExtractor` |
| Cuisine / seafood preference extraction | **None** |
| Persistence of restaurant preference | **None** (no field) |
| Persistence of restaurants service flag | authoritative state update of `restaurantsRequested` |
| Dining follow-up selection / completion | `selectConversationFollowUpQuestion` |
| Acknowledgement of restaurants enable | `selectConversationAcknowledgement` |
| Reply assembly / render | unchanged; faithfully emit selected follow-up |

## Current selector rule

From `selectConversationFollowUpQuestion.ts`:

```typescript
{
  applies: (state) => state.restaurantsRequested === true,
  question: CONVERSATION_REPLY_CATALOGUE.followUps.restaurants,
}
```

Source comment (Phase 18D era):

```text
Dining still has no dedicated preference field, so the
restaurants question remains eligible while restaurantsRequested is true.
```

## Current completion rule

```text
Select dining follow-up iff:
  core progression fields are populated
  AND restaurantsRequested === true
```

Nothing suppresses the question once `restaurantsRequested` is true:

```text
cuisine answers → not persisted → question remains
seafood answers → not persisted → question remains
wineries/food trails capability → persisted elsewhere → question remains
unsupported hedges → Phase 18B keeps the dining follow-up
```

Contrast with activities after Phase 18D:

```text
activitiesRequested === true
AND NOT hasSpecificActivityInterest(state)
```

Restaurants have no equivalent completion predicate.

## Supported restaurant preference fields

| Preference concept | Persisted field | Supported today? |
| --- | --- | --- |
| Restaurants service requested | `restaurantsRequested` | yes |
| Free-text dining preference | — | **no** |
| Cuisine (Italian, Thai, …) | — | **no** |
| Seafood | — | **no** |
| Fine / casual dining style | — | **no** |
| Vegetarian / vegan dining preference | — | **no** |

`wineriesFoodTrailsRequested` is an activity-interest capability, not a restaurants dining-preference field.

## Required audit answers

1. **Which trip-state fields represent restaurant preferences?**  
   Only `restaurantsRequested` exists for restaurants. No preference subfields.

2. **Does the engine support free-text restaurant preferences?**  
   No.

3. **Which extractors populate restaurant preference fields?**  
   `RestaurantsRequestedConversationStateExtractor` populates `restaurantsRequested` only. No cuisine/seafood extractor. Cuisine/seafood phrases appear in that extractor’s **block** paths (they must not count as a restaurants-service request) and are not written to any preference field.

4. **What condition currently suppresses “What type of dining are you looking for?”**  
   Only `restaurantsRequested !== true` (or higher-priority missing core / earlier contextual questions). No preference-completion suppression.

5. **Does selecting a specific cuisine prevent the restaurant follow-up?**  
   No. Cuisine phrases extract `{}` and the dining question remains.

6. **Does selecting seafood prevent the restaurant follow-up?**  
   No. Seafood phrases extract `{}` and the dining question remains.

7. **Does repeating the same restaurant preference trigger another restaurant question?**  
   Yes. Repeated cuisine/seafood stays uninterpreted and re-asks dining (Phase 18B preserves the still-incomplete restaurants follow-up).

8. **Does unsupported input after restaurant preference preserve the correct next follow-up?**  
   With `restaurantsRequested=true`, unsupported input preserves the dining follow-up (Phase 18B). There is no persisted preference that would make a different “next” follow-up correct under today’s completion contract.

## Verified behaviour

### Restaurants requested only

```text
User: find restaurants
→ restaurantsRequested=true
→ Great, I've added restaurants to your trip. What type of dining are you looking for?
```

### Restaurants + cuisine preference

```text
Seed: restaurantsRequested=true
User: Italian / I want Italian food / Japanese cuisine / we like Thai / …
→ extracted {}
→ messageInterpreted=false
→ Now for dining. What type of dining are you looking for?
```

### Restaurants + seafood preference

```text
Seed: restaurantsRequested=true
User: looking for seafood
→ extracted {}
→ no seafood wording in reply
→ Now for dining. What type of dining are you looking for?
```

### Repeated cuisine / seafood

```text
Same dining follow-up every turn; no acknowledgement.
```

### Unsupported after preference attempt

```text
looking for seafood → dining follow-up
I'm not sure → dining follow-up (Phase 18B)
```

### Activities + restaurants interaction (post-18D)

```text
activitiesRequested=true + hikingWalkingRequested=true + restaurantsRequested=true
→ dining follow-up (activities already satisfied)

hiking then find restaurants
→ terminal/neutral after hiking, then dining follow-up after restaurants enable
```

### Related food capability

```text
restaurantsRequested=true + User: wineries
→ wineriesFoodTrailsRequested=true
→ ack for wineries
→ dining follow-up still selected
```

## Verified defects

Same architectural class as **pre-18D activities**:

```text
Defect:
User answers the dining preference question with cuisine/seafood text
→ engine does not persist a preference
→ dining follow-up remains selected
→ question is asked again (including on repeats and unsupported hedges)
```

Root cause layers:

| Layer | Finding |
| --- | --- |
| Schema | No dining preference field |
| Extraction | Cuisine/seafood not owned |
| Follow-up selection | Completion depends only on `restaurantsRequested === true` |
| Assembly / renderer | Not at fault |

This audit does **not** propose a fix. Characterization only.

## Runtime path (representative seafood turn)

```text
processConversationTurn()
↓
RestaurantsRequestedConversationStateExtractor / others
  "looking for seafood" → {}
↓
authoritative state update
  restaurantsRequested unchanged (true)
↓
classifyConversationStateChange()
  hasInterpretedChange = false
↓
selectConversationFollowUpQuestion(state)
  restaurantsRequested === true → dining follow-up
↓
selectConversationReplyComponents / assemble
  no ack + dining follow-up
↓
rendered reply
  Now for dining. What type of dining are you looking for?
```

## Characterization file

```text
src/features/conversation-core/__tests__/restaurantFollowUpAudit.phase18E.test.ts
```

Preserves current (including defective) behaviour as regression evidence for a later phase.
