# Phase 18 — Unsupported Follow-Up and Preference Completion Closure

Audit and closure only. Production behaviour intentionally unchanged in Phase 18G.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 18F baseline preserved exactly.
No live environment has been changed by this closure phase.
```

## Closure tests

```text
src/features/conversation-core/__tests__/unsupportedFollowUpPreferenceClosure.phase18G.test.ts
```

## Final deterministic ownership chain

```text
message
→ extraction
→ state update
→ classification
→ acknowledgement selection
→ follow-up selection
→ continuation selection
→ reply-plan assembly
→ conversational expression
```

| Concern | Owner |
| --- | --- |
| Unsupported-input handling | Deterministic selection (`selectConversationReplyComponents` always selects follow-up from final state; Phase 18B) |
| Activity completion | Activity capability state + `selectConversationFollowUpQuestion` (Phase 18D) |
| Restaurant preference extraction | `RestaurantPreferenceConversationStateExtractor` (Phase 18F) |
| Restaurant completion | Canonical `restaurantPreference` + `selectConversationFollowUpQuestion` (Phase 18F) |
| Conversational rendering | Expression only — does not own semantic completion |

## Phase 18A root cause

Unsupported / uninterpreted turns set `messageInterpreted = false`. Reply-component composition gated follow-up selection on that flag:

```typescript
const followUpQuestion = messageInterpreted
  ? selectConversationFollowUpQuestion(state)
  : null;
```

When follow-up was null, continuation fell through to the activated neutral prompt even though required trip fields were still missing.

## Phase 18B unsupported-input selector fix

Changed only `selectConversationReplyComponents`:

```typescript
const followUpQuestion = selectConversationFollowUpQuestion(state);
```

Incomplete trip + unsupported input → no acknowledgement → next genuine required-field follow-up.  
Complete trip + unsupported input → no acknowledgement → terminal neutral continuation.

## Phase 18C activity re-request defect

After `activitiesRequested = true`, answering with a specific interest (for example hiking) set a capability flag such as `hikingWalkingRequested = true`, but the activities follow-up predicate consulted only `activitiesRequested === true`. The activities preference question was therefore asked again.

There was (and still is) no free-text activity preference field; completion is capability-flag based.

## Phase 18D activity completion fix

`selectConversationFollowUpQuestion` activities eligibility became:

```text
activitiesRequested === true
AND NOT hasSpecificActivityInterest(state)
```

where `hasSpecificActivityInterest` is true when any supported specific activity-interest flag is true. Broad services (flights, accommodation, car hire, restaurants, activities) are excluded from that set.

## Phase 18E restaurant architecture defect

Parallel to pre-18D activities: `restaurantsRequested === true` alone kept the dining follow-up eligible. Cuisine / seafood / dining-style answers were not persisted, so the dining question was re-asked.

## Phase 18F restaurant preference contract and completion fix

Added canonical field:

```ts
restaurantPreference: string | null
```

Ownership:

```text
RestaurantPreferenceConversationStateExtractor
→ state update
→ canonical trip state
→ classification
→ restaurant completion selector
→ reply plan
→ conversational expression
```

Context boundary: preference extraction requires `restaurantsRequested === true`.  
Selector completion predicate:

```text
restaurantsRequested === true && restaurantPreference === null
```

## Final supported behaviour

### Unsupported input

| Trip state | Unsupported message | Acknowledgement | Selected question |
| --- | --- | --- | --- |
| Incomplete core | e.g. "I'm not sure yet" | none | next required field |
| Complete core | e.g. "I'm not sure yet" | none | terminal neutral |

### Activities

| State | Selected question |
| --- | --- |
| `activitiesRequested` + no specific interest | What kinds of activities are you interested in? |
| `activitiesRequested` + ≥1 specific interest | next genuine required field or terminal neutral |

### Restaurants

| State | Selected question |
| --- | --- |
| `restaurantsRequested` + `restaurantPreference === null` | What type of dining are you looking for? |
| `restaurantsRequested` + preference captured | next genuine required field or terminal neutral |

### Cross-capability

| Situation | Selected question |
| --- | --- |
| Activities complete, restaurants incomplete | dining follow-up |
| Restaurants complete, higher-priority field missing | that higher-priority field |
| Activities + restaurants complete, trip otherwise complete | terminal neutral |
| Repeated identical activity / restaurant preference | no false changed event; no re-request |
| Unsupported after both complete | terminal neutral |

### Single-question invariant

Each rendered reply contains at most one catalogue follow-up or continuation question.

## Remaining known exclusions

```text
shopping extraction
nightlife extraction
zero passenger counts
multi-passenger parsing
broad free-text food taxonomy
restaurant recommendations
restaurant search or booking
unrelated acknowledgement wording
```

## Phase 18 closure decision

**Phase 18 is complete.**

Unsupported-input progression, activity follow-up completion, and restaurant preference completion now behave consistently across the deterministic conversation pipeline. Phase 18G adds closure tests and this document only; no production behaviour was changed during Phase 18G.
