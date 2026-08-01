# Phase 19H — Adult / Passenger Requirement Policy Audit

Audit and characterization only. Production behaviour intentionally unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 19G baseline preserved exactly.
No live environment has been changed by this audit phase.
```

Characterization tests:

```text
src/features/conversation-core/__tests__/adultPassengerRequirementPolicyAudit.phase19H.test.ts
```

---

## Current production policy

**Option A — service-gated passenger progression (accepted today):**

```text
flightsRequested === true
OR
accommodationRequested === true
→ solicit adultCount, then childCount, then infantCount

otherwise
→ adultCount / childCount / infantCount are not required follow-ups
```

Priority after core travel fields:

```text
flights adult question
→ accommodation guest question (shares adultCount)
→ child-count question
→ infant-count question
→ activities / restaurants / terminal continuation
```

Car hire, activities, restaurants, and trips with no flights/accommodation never unlock passenger follow-ups. Users may still volunteer cued counts; extractors persist them and acknowledgements fire, but the selector does not solicit.

---

## State ownership

| Field | Schema | Default | Extractor |
| --- | --- | --- | --- |
| `adultCount` | `number \| null` | `null` | `AdultCountConversationStateExtractor` |
| `childCount` | `number \| null` | `null` | `ChildCountConversationStateExtractor` |
| `infantCount` | `number \| null` | `null` | `InfantCountConversationStateExtractor` |

Persistence: `applyConversationStateUpdate.ts`  
Classification: `classifyConversationStateChange.ts` (`TRAVEL_COMPARE_KEYS`)  
Acknowledgements: dedicated set/changed/removed catalogue paths  
Follow-ups: `selectConversationFollowUpQuestion.ts` via `needsChildCountFollowUp` / `needsInfantCountFollowUp`

Note: `types.ts` still carries historical comments saying counts are “never extracted from message text”; extractors contradict that. Comment drift only — not a policy defect.

---

## Follow-up ownership

Owner: `selectConversationFollowUpQuestion.ts`.

| Gate | Predicate (summary) |
| --- | --- |
| Adults (flights) | `flightsRequested && adultCount === null` |
| Guests (accommodation) | `accommodationRequested && adultCount === null` |
| Children | passenger service relevant ∧ `adultCount !== null` ∧ `childCount === null` |
| Infants | passenger service relevant ∧ adult+child captured ∧ `infantCount === null` |

`passenger service relevant` ≡ `flightsRequested || accommodationRequested`.

---

## Current downstream consumers

### Conversation-core (only production consumers of these fields)

| Concern | Uses adult/child/infant? |
| --- | --- |
| Extraction | yes — populates fields |
| State update / comparison | yes — persists and diffs |
| Acknowledgement selection + transform | yes — dedicated wording |
| Follow-up selection | yes — service-gated solicitation |
| Reply-plan assembly / renderer | no semantic consumption of counts beyond selected strings |
| Activities / restaurant completion | **no** — do not inspect passenger counts |
| Car-hire capability | **no** — no count follow-up and no count read |

### Outside conversation-core

Repository search shows **no** production reads of `adultCount` / `childCount` / `infantCount` outside `src/features/conversation-core/`.

Related but **separate** surface:

| Surface | Field | Wired to conversation-core counts? |
| --- | --- | --- |
| `TripSetupForm` / trip vault | `travellerCount` | **No** |
| `StaysPanel` plan guests | `activeVaultTrip.travellerCount` | **No** |
| Flight / booking / deal / itinerary search modules | — | **No** conversation-core passenger fields |

Architecture docs (`docs/architecture/conversation-style-interface.md`) describe adult-count collection **for flights** as a deterministic objective — consistent with Option A, not a global trip-party model.

There is **no** repository evidence of a planned global trip-party contract, nor of activities/restaurants/car-hire search APIs consuming conversation-core passenger composition today.

---

## Answers to required audit questions

1. **Which features consume `adultCount`?**  
   Conversation-core extraction, persistence, classification, acknowledgement, and flights/accommodation follow-up gating. No other production feature.

2. **Which features consume `childCount`?**  
   Same conversation-core chain + child follow-up (Phase 19F). No other production feature.

3. **Which features consume `infantCount`?**  
   Same conversation-core chain + infant follow-up (Phase 19G). No other production feature.

4. **Used beyond follow-up and acknowledgement?**  
   Only the shared state pipeline (apply/classify/compare). Not used for ranking, search, pricing, or itinerary suitability.

5. **Would a global requirement block destination/activities-only users?**  
   **Yes.** Option B would force adult → child → infant after core fields even when the user only wants destination guidance, activities, or dining ideas.

6. **Does the current policy leave downstream searches without traveller data?**  
   Conversation-core counts are not fed into search/booking today. Trip-platform `travellerCount` is independent. Broadening solicitation would not currently unblock a missing integration — that wiring does not exist yet.

7. **Does car hire need passenger count under the present architecture?**  
   **No.** Selector never gates on `carHireRequested`; no car-hire consumer reads the counts.

8. **Do activities or restaurants need party composition today?**  
   **No.** Completion depends on specific activity flags / `restaurantPreference`, not passenger counts.

9. **Evidence for a planned global trip-party model?**  
   **None** in code or architecture docs. Prior audits (19A G6 / 19D D3) flagged this as an open product decision, not an implemented direction.

10. **Smallest launch-safe policy?**  
    **Retain Option A** — ask party composition only when flights or accommodation is requested.

11. **Change before launch, after launch, or not at all?**  
    **Not before launch.** Revisit **after launch** only when a named downstream integration (flight search, stay search, or vault sync) requires conversation-core counts.

---

## Policy options

### Option A — Current service-gated policy (flights / accommodation)

| | |
| --- | --- |
| **Benefits** | Matches present consumers; avoids blocking advice-only trips; already implemented (19F/19G); aligns with architecture wording for flights adult count |
| **Risks** | If future flight/stay search is wired without counts, searches may lack party data until the user enables those services and answers |
| **Launch impact** | None — already live on this branch |
| **Migration** | None |

### Option B — Global trip-party policy

| | |
| --- | --- |
| **Benefits** | Always-known party for any later personalization |
| **Risks** | Forces three count questions on destination-only / activities-only journeys; higher drop-off; no current consumer justifies the friction |
| **Launch impact** | High UX cost for limited gain |
| **Migration** | New follow-up gates; large characterization rewrite |

### Option C — Broader service-gated policy

| | |
| --- | --- |
| **Benefits** | Could cover future services that truly need party size |
| **Risks** | No current evidence that car hire / activities / restaurants need counts; broadening without consumers adds friction and false product certainty |
| **Launch impact** | Unnecessary unless a concrete consumer is added |
| **Migration** | Extend `passenger service relevant` predicate per proven consumer |

### Option D — Explicit opt-in party composition

| | |
| --- | --- |
| **Benefits** | Minimal questioning; volunteer path already works |
| **Risks** | Would **remove** today’s flights/accommodation solicitation (regression vs 19F/19G); flight/hotel journeys would miss required counts unless the user volunteers |
| **Launch impact** | Breaks accepted passenger progression contracts |
| **Migration** | Would need product approval to drop service-gated asks |

---

## Launch impact summary

| Option | Launch-safe? | Notes |
| --- | --- | --- |
| **A** | **Yes** | Status quo; matches consumers |
| B | No | Blocks light-planning users |
| C | Premature | No verified extra consumers |
| D | No | Regresses flights/accommodation progression |

---

## Recommended final policy

**Retain current policy (Option A).**

### Evidence

1. Only conversation-core reads `adultCount` / `childCount` / `infantCount`.
2. Trip-platform `travellerCount` is a separate, unwired field.
3. Car hire, activities, and restaurants do not depend on these counts.
4. Globally requiring counts would force unnecessary questions on advice-only trips.
5. Architecture docs frame adult collection as a **flights** objective, not a universal trip-party field.
6. No planned global trip-party model exists in-repo.

### Production change recommended?

**No production change in Phase 19H or as a pre-launch follow-on.**

### Recommended future phase (only if needed later)

**Defer the decision until a named downstream integration exists** that consumes conversation-core passenger fields (for example: flight search booking payload, stay search guest payload, or vault `travellerCount` sync).

When that integration lands, open an isolated phase to:

1. Wire conversation-core counts into that consumer, then  
2. Re-evaluate whether Option C must expand the passenger-service gate to match that consumer — **not** before the consumer exists.

Do **not** schedule a freestanding “global trip-party” phase without that dependency.

---

## Characterization coverage

`adultPassengerRequirementPolicyAudit.phase19H.test.ts` locks:

- no services / car hire only / activities only / restaurants only → no passenger solicitation  
- flights only / accommodation only / both → adult → child → infant  
- complete core without passenger services → terminal continuation  
- unsupported input without passenger services → neutral (no adult/child/infant Q)  
- volunteered counts without passenger services → persist + ack, still no solicitation gate  
- activities/restaurants completion without passenger counts → neutral  

---

## Phase 19H decision

**Phase 19H is complete as an audit.**

```text
Recommended policy: retain current policy (Option A).
No passenger requirement policy was changed.
No passenger extraction or progression defects were addressed.
```
