# Phase 19A — Conversation Flow Gap Audit

Audit and characterization only. Production behaviour intentionally unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 18G baseline preserved exactly.
No live environment has been changed by this audit phase.
```

Characterization tests:

```text
src/features/conversation-core/__tests__/conversationGapAudit.phase19A.test.ts
```

## Ownership chain (verified)

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
| Extraction registry | `createConversationStateExtractor.ts` |
| Persistence | `types.ts` + `applyConversationStateUpdate.ts` |
| Classification | `classifyConversationStateChange.ts` |
| Acknowledgement | `selectConversationAcknowledgement.ts` + catalogue |
| Follow-up / completion | `selectConversationFollowUpQuestion.ts` |
| Unsupported progression | `selectConversationReplyComponents.ts` (Phase 18B) |
| Continuation | `selectConversationContinuationPrompt.ts` |
| Expression | baseline conversational renderer (no semantic completion) |

Every supported field that participates in live chat follows this lifecycle. Gaps below are places where schema / ack / completion paths exist without a matching extraction or progression path, or where progression wording and extraction cues diverge.

---

## Verified clean areas

These areas were verified as consistent end-to-end for the current launch contract:

### Core travel progression

| Field | Extraction | Persistence | Acknowledgement | Follow-up completion | Unsupported when next | Repeated value |
| --- | --- | --- | --- | --- | --- | --- |
| destination | `DestinationConversationStateExtractor` | `destination` | dedicated | asked until set | re-asks destination | no false ack; progression continues |
| origin | `OriginConversationStateExtractor` | `origin` | dedicated | asked until set | re-asks origin | same |
| departure date | `DepartureDateConversationStateExtractor` | `departureDate` | dedicated | asked until set | re-asks departure | same |
| return date | `ReturnDateConversationStateExtractor` | `returnDate` | dedicated | asked until set | re-asks return | same |

### Broad travel services

| Capability | Extraction | Persistence | Acknowledgement | Follow-up | Unsupported | Repeated |
| --- | --- | --- | --- | --- | --- | --- |
| flights | `FlightsRequestedConversationStateExtractor` | `flightsRequested` | capability label | unlocks adult-count Q when `adultCount === null` | adult Q remains if next | true→true: no ack |
| accommodation | `AccommodationRequestedConversationStateExtractor` | `accommodationRequested` | capability | unlocks guest-count Q (backed by `adultCount`) | guest Q remains if next | same |
| car hire | `CarHireRequestedConversationStateExtractor` | `carHireRequested` | capability | no count follow-up (by design) | N/A | same |
| activities | `ActivitiesRequestedConversationStateExtractor` | `activitiesRequested` | capability | asked until any specific interest flag is true (Phase 18D) | re-asks activities Q | same |
| restaurants | `RestaurantsRequestedConversationStateExtractor` | `restaurantsRequested` | capability | asked until `restaurantPreference` set (Phase 18F) | re-asks dining Q | same |
| restaurant preference | `RestaurantPreferenceConversationStateExtractor` | `restaurantPreference` | generic `"Perfect."` only | suppresses dining when non-null | next field / neutral | identical → no ack, no re-ask |

### Extractable activity interests

Each of the following has a registered extractor, persists a `*Requested` boolean, acknowledges via `CAPABILITY_LABELS`, and satisfies the activities follow-up when true:

```text
nearby discovery
beaches
camping
kayaking
four wheel driving
scenic drives
attractions
snow activities
hiking / walking
fishing
diving / snorkelling
wineries / food trails
events / festivals (eventsFestivalsRequested)
wildlife
national parks
```

### Cross-cutting contracts (Phase 18)

| Contract | Status |
| --- | --- |
| Incomplete trip + unsupported input → next required field | verified (18B) |
| Complete trip + unsupported input → terminal neutral | verified (18B) |
| Activities completion via specific interest flags | verified (18D) |
| Restaurant preference persistence + dining completion | verified (18F) |
| Single selected follow-up / continuation question per reply | verified (18G) |

---

## Verified gaps

### G1 — Activity completion flags without message extractors

- **Title:** `SPECIFIC_ACTIVITY_INTEREST_FLAGS` includes capabilities that user text cannot set
- **Owner:** follow-up selection / extraction registry mismatch
- **Affected production file(s):**
  - `src/features/conversation-core/selectConversationFollowUpQuestion.ts`
  - `src/features/conversation-core/createConversationStateExtractor.ts`
  - `src/features/conversation-core/selectConversationAcknowledgement.ts`
- **Reproduction example:**
  ```text
  Seed: complete core + activitiesRequested=true
  User: Shopping
  → shoppingRequested stays null
  → reply still asks: What kinds of activities are you interested in?
  ```
  Same pattern for Nightlife, Wellness activities, I want tours, family activities, wheelchair accessible.
- **Expected behaviour:** extract flag → acknowledge → suppress activities follow-up
- **Actual behaviour:** empty extraction; activities follow-up re-asked. Flags only complete the follow-up when set via trusted `stateUpdate`.
- **Recommended future phase:** 19B — add extractors, or remove non-extractable flags from the completion set and document explicit-only status

### G2 — Nightlife / shopping / wellness remain unextractable

- **Title:** Nightlife, shopping, and wellness are schema/ack-ready but not extractable from chat
- **Owner:** extraction
- **Affected production file(s):**
  - `src/features/conversation-core/createConversationStateExtractor.ts` (no extractors)
  - `src/features/conversation-core/types.ts` (fields exist)
  - `src/features/conversation-core/selectConversationAcknowledgement.ts` (labels exist)
  - documented as Phase 18G known exclusions
- **Reproduction example:**
  ```text
  Seed: complete core + activitiesRequested=true
  User: Nightlife
  → nightlifeRequested remains null; activities Q re-asked

  User: Wellness activities
  → may re-assert activitiesRequested via the word "activities"
  → wellnessRequested remains null; activities Q still re-asked
  ```
- **Expected behaviour:** persist nightlife/shopping/wellness from clear user wording
- **Actual behaviour:** message text never sets these capability flags
- **Recommended future phase:** 19B extractors (ack + activities-completion already wired for explicit updates)

### G3 — Dual events model

- **Title:** `eventsFestivalsRequested` vs legacy `eventsRequested`
- **Owner:** schema / extraction
- **Affected production file(s):**
  - `src/features/conversation-core/types.ts`
  - `src/features/conversation-core/EventsFestivalsRequestedConversationStateExtractor.ts`
  - `src/features/conversation-core/selectConversationAcknowledgement.ts`
  - `src/features/conversation-core/selectConversationFollowUpQuestion.ts`
- **Reproduction example:**
  ```text
  User: find local events
  → eventsFestivalsRequested=true
  → eventsRequested stays null
  ```
- **Expected behaviour:** one events concept owned by message extraction
- **Actual behaviour:** two fields; only `eventsFestivalsRequested` is owned by text extraction; `eventsRequested` is explicit-update only
- **Recommended future phase:** 19C consolidate or deprecate `eventsRequested`

### G4 — Tours / family activities / wellness / accessible travel: schema-only from chat

- **Title:** Tours, family activities, wellness, and accessible travel cannot be enabled by user message text
- **Owner:** extraction
- **Affected production file(s):**
  - `src/features/conversation-core/types.ts`
  - `src/features/conversation-core/createConversationStateExtractor.ts`
  - `src/features/conversation-core/selectConversationAcknowledgement.ts`
  - existing explicit-only tests under `__tests__/toursRequested.test.ts`, `familyActivitiesRequested.test.ts`, `wellnessRequested.test.ts`, `accessibleTravelRequested.test.ts`
- **Reproduction example:**
  ```text
  User: I want tours / family activities / spa wellness / wheelchair accessible
  → respective *Requested flags remain null without trusted stateUpdate
  ```
- **Expected behaviour:** clear wording enables the capability and can complete the activities follow-up
- **Actual behaviour:** live chat cannot enable them; explicit `stateUpdate` paths work
- **Recommended future phase:** 19B extractors

### G5 — Child and infant counts extract but are never solicited

- **Title:** `childCount` / `infantCount` have extractors and acknowledgements but no follow-up progression
- **Owner:** follow-up selection
- **Affected production file(s):**
  - `src/features/conversation-core/ChildCountConversationStateExtractor.ts`
  - `src/features/conversation-core/InfantCountConversationStateExtractor.ts`
  - `src/features/conversation-core/selectConversationFollowUpQuestion.ts`
  - `src/features/conversation-core/conversationReplyCatalogue.ts`
- **Reproduction example:**
  ```text
  Seed: complete core + flightsRequested=true + adultCount=2
  → engine never asks about children or infants
  User volunteers: 2 children
  → childCount persisted + child ack; no solicitation path existed
  ```
- **Expected behaviour:** family composition progression after adults (or a shared travellers question)
- **Actual behaviour:** extract + ack only; never the next required field
- **Recommended future phase:** 19D passenger progression

### G6 — Adult count only solicited for flights or accommodation

- **Title:** Traveller count is not asked unless flights or accommodation is requested
- **Owner:** follow-up selection
- **Affected production file(s):**
  - `src/features/conversation-core/selectConversationFollowUpQuestion.ts` (`CONTEXTUAL_QUESTIONS`)
- **Reproduction example:**
  ```text
  Seed: complete core, adultCount=null, no flights/accommodation
  → terminal neutral; adults never asked
  Seed: carHireRequested=true only, adultCount=null
  → terminal neutral; no count question
  ```
- **Expected behaviour:** general traveller-count follow-up when counts matter for the trip
- **Actual behaviour:** intentional Phase 10E design leaves travellers unspecified for non-flight/hotel trips
- **Recommended future phase:** 19D general traveller-count follow-up

### G7 — Accommodation guest wording vs adult-count extraction cues

- **Title:** Guest-count question wording does not match adult-count extractor cues
- **Owner:** follow-up wording vs adult extraction
- **Affected production file(s):**
  - `src/features/conversation-core/conversationReplyCatalogue.ts` (`How many guests will be staying?`)
  - `src/features/conversation-core/AdultCountConversationStateExtractor.ts`
- **Reproduction example:**
  ```text
  After guest Q, User: 2 guests
  → adultCount stays null; guest Q re-asked
  User: 2 adults
  → adultCount=2; guest Q suppressed
  ```
- **Expected behaviour:** natural guest answers satisfy the guest question
- **Actual behaviour:** only adult-cued phrases extract into `adultCount`
- **Recommended future phase:** 19D guest/adult answer normalisation

### G8 — Bare numeric answers fail the adult-count question

- **Title:** Bare numbers do not satisfy the flights adult-count follow-up
- **Owner:** adult extraction cues / lack of active-question context
- **Affected production file(s):**
  - `src/features/conversation-core/AdultCountConversationStateExtractor.ts`
- **Reproduction example:**
  ```text
  Seed: flightsRequested=true, adultCount=null
  User: 2
  → adultCount remains null; adult Q re-asked
  User: 2 adults
  → adultCount=2
  ```
- **Expected behaviour:** when the adult question is active, a bare count completes it
- **Actual behaviour:** extractors are message-local and require adult cues; no transcript-aware bare-number repair
- **Recommended future phase:** 19D contextual bare-number handling when adult Q is active

### G9 — Restaurant preference has no dedicated acknowledgement

- **Title:** Captured dining preference acknowledges only via generic travel-field wording
- **Owner:** acknowledgement selection
- **Affected production file(s):**
  - `src/features/conversation-core/selectConversationAcknowledgement.ts`
  - `src/features/conversation-core/conversationReplyCatalogue.ts`
- **Reproduction example:**
  ```text
  Seed: restaurantsRequested=true
  User: looking for seafood
  → restaurantPreference=seafood; dining suppressed
  → acknowledgement is generic "Perfect." (no dedicated preference wording)
  ```
- **Expected behaviour:** optional dedicated preference acknowledgement
- **Actual behaviour:** generic travel-field change ack only; completion itself is correct (Phase 18F)
- **Recommended future phase:** 19E preference acknowledgement wording

### G10 — Structural mismatch summary (flags / labels / extractors)

| Capability flag | In `SPECIFIC_ACTIVITY_INTEREST_FLAGS` | In `CAPABILITY_LABELS` | Extractor registered? |
| --- | --- | --- | --- |
| nearby…national parks, eventsFestivals | yes | yes | yes |
| `accessibleTravelRequested` | yes | yes | **no** |
| `toursRequested` | yes | yes | **no** |
| `eventsRequested` | yes | yes | **no** |
| `nightlifeRequested` | yes | yes | **no** |
| `shoppingRequested` | yes | yes | **no** |
| `wellnessRequested` | yes | yes | **no** |
| `familyActivitiesRequested` | yes | yes | **no** |

---

## Registry snapshot (current)

Registered extractors in `createConversationStateExtractor.ts`:

```text
destination, origin, departureDate, returnDate,
adultCount, childCount, infantCount,
flights, accommodation, carHire, activities, restaurants,
restaurantPreference,
nearbyDiscovery, beaches, camping, kayaking, fourWheelDrive,
scenicDrives, attractions, snowActivities, hikingWalking,
fishing, divingSnorkelling, wineriesFoodTrails, eventsFestivals,
wildlife, nationalParks,
EmptyConversationStateExtractor
```

Not registered (schema present):

```text
toursRequested
eventsRequested
nightlifeRequested
shoppingRequested
wellnessRequested
familyActivitiesRequested
accessibleTravelRequested
```

---

## Recommended future phase order

| Phase | Focus |
| --- | --- |
| 19B | Extractors for nightlife, shopping, wellness, tours, family activities, accessible travel (and/or trim completion flags) |
| 19C | Consolidate dual events model (`eventsFestivalsRequested` vs `eventsRequested`) |
| 19D | Passenger progression: child/infant solicitation, adult solicitation scope, bare/guest answer normalisation |
| 19E | Dedicated restaurant-preference acknowledgement wording |

---

## Phase 19A decision

**Phase 19A is complete as an audit.**

No production behaviour was changed. Remaining launch gaps cluster as:

1. Schema / acknowledgement / activity-completion flags without message extractors
2. Passenger progression holes (child/infant never asked; adult only via flights/accommodation; bare/guest answers do not extract)
3. Restaurant preference acknowledgement still generic-only (completion already closed in Phase 18F)
