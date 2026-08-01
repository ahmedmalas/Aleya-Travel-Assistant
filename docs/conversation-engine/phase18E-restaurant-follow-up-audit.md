# Phase 18 Restaurant Follow-Up Completion Audit

Investigation and characterization. Phase 18F closes the pre-18F dining re-ask defect.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 18D baseline preserved for activities.
Phase 18F adds restaurantPreference persistence.
No live environment has been changed by this audit document.
```

## Scope

Full audit of restaurant follow-up completion logic after Phase 18D closed the parallel activities re-ask defect.

Characterization tests:

```text
src/features/conversation-core/__tests__/restaurantFollowUpAudit.phase18E.test.ts
src/features/conversation-core/__tests__/restaurantPreferenceCompletion.phase18F.test.ts
```

## Architecture (post-18F)

Restaurant service enablement and dining preference follow-up:

```text
restaurantsRequested (boolean | null)
  → enables restaurants capability acknowledgement
restaurantPreference (string | null)
  → persists cuisine/seafood/style answers
  → suppresses dining follow-up when non-null
```

Selector (Phase 18F):

```typescript
{
  applies: (state) =>
    state.restaurantsRequested === true &&
    state.restaurantPreference === null,
  question: CONVERSATION_REPLY_CATALOGUE.followUps.restaurants,
}
```

## Pre-18F defect (historical evidence)

Same architectural class as **pre-18D activities**:

```text
Defect (pre-18F):
User answers the dining preference question with cuisine/seafood text
→ engine did not persist a preference
→ dining follow-up remained selected
→ question was asked again (including on repeats and unsupported hedges)
```

Pre-18F selector contract:

```text
restaurantsRequested === true (no preference field consulted)
```

Root cause layers (pre-18F):

| Layer | Finding |
| --- | --- |
| Schema | No dining preference field |
| Extraction | Cuisine/seafood not owned |
| Follow-up selection | Completion depended only on `restaurantsRequested === true` |
| Assembly / renderer | Not at fault |

## Ownership (post-18F)

| Concern | Owner |
| --- | --- |
| Restaurant service extraction | `RestaurantsRequestedConversationStateExtractor` |
| Cuisine / seafood preference extraction | `RestaurantPreferenceConversationStateExtractor` |
| Persistence of restaurant preference | `restaurantPreference` on `ConversationCoreState` |
| Persistence of restaurants service flag | authoritative state update of `restaurantsRequested` |
| Dining follow-up selection / completion | `selectConversationFollowUpQuestion` |
| Acknowledgement of restaurants enable | `selectConversationAcknowledgement` |
| Reply assembly / render | unchanged; faithfully emit selected follow-up |

## Supported restaurant preference fields (post-18F)

| Preference concept | Persisted field | Supported today? |
| --- | --- | --- |
| Restaurants service requested | `restaurantsRequested` | yes |
| Free-text dining preference | `restaurantPreference` | yes |
| Cuisine (Italian, Thai, …) | `restaurantPreference` | yes |
| Seafood | `restaurantPreference` | yes |
| Fine / casual dining style | `restaurantPreference` | yes |
| Vegetarian / vegan dining preference | `restaurantPreference` | yes |

`wineriesFoodTrailsRequested` remains an activity-interest capability, not a restaurants dining-preference field.

## Verified behaviour (post-18F)

### Restaurants requested only

```text
User: find restaurants
→ restaurantsRequested=true
→ Great, I've added restaurants to your trip. What type of dining are you looking for?
```

### Restaurants + cuisine preference

```text
Seed: restaurantsRequested=true
User: Italian / I want Italian food / fine dining / …
→ restaurantPreference persisted
→ messageInterpreted=true
→ neutral continuation (dining follow-up suppressed)
```

### Restaurants + seafood preference

```text
Seed: restaurantsRequested=true
User: looking for seafood
→ restaurantPreference=seafood
→ no seafood wording in reply
→ neutral continuation (dining follow-up suppressed)
```

### Repeated cuisine / seafood

```text
First answer persists preference and suppresses dining.
Repeated identical preference: unchanged, no dining re-ask.
```

### Unsupported after preference captured

```text
looking for seafood → preference persisted, neutral follow-up
I'm not sure → neutral follow-up (Phase 18B); no dining re-ask
```

### Activities + restaurants interaction (post-18D)

```text
activitiesRequested=true + hikingWalkingRequested=true + restaurantsRequested=true + restaurantPreference=null
→ dining follow-up

hiking then find restaurants
→ terminal/neutral after hiking, then dining follow-up after restaurants enable
```

### Related food capability

```text
restaurantsRequested=true + restaurantPreference=null + User: wineries
→ wineriesFoodTrailsRequested=true
→ ack for wineries
→ dining follow-up still selected
```

## Runtime path (representative seafood turn, post-18F)

```text
processConversationTurn()
↓
RestaurantPreferenceConversationStateExtractor (restaurantsRequested gate)
  "looking for seafood" → { restaurantPreference: "seafood" }
↓
authoritative state update
  restaurantPreference=seafood
↓
classifyConversationStateChange()
  hasInterpretedChange = true
↓
selectConversationFollowUpQuestion(state)
  restaurantPreference !== null → dining follow-up suppressed
↓
selectConversationReplyComponents / assemble
  generic acknowledgement + neutral continuation
↓
rendered reply
  Perfect, got it. … What else should I know about your trip?
```

## Characterization files

```text
src/features/conversation-core/__tests__/restaurantFollowUpAudit.phase18E.test.ts
src/features/conversation-core/__tests__/restaurantPreferenceCompletion.phase18F.test.ts
```

Phase 18E preserves pre-18F defect documentation; post-18F behaviour is asserted in both audit tests.
