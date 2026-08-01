# Phase 19D — Passenger Progression Gap Audit

Audit and characterization only. Production behaviour intentionally unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 19C baseline preserved exactly.
No live environment has been changed by this audit phase.
```

Characterization tests:

```text
src/features/conversation-core/__tests__/passengerProgressionAudit.phase19D.test.ts
```

---

## Current passenger state architecture

Trip state holds three independent nullable count fields:

| Field | Type | Default |
| --- | --- | --- |
| `adultCount` | `number \| null` | `null` |
| `childCount` | `number \| null` | `null` |
| `infantCount` | `number \| null` | `null` |

Runtime ownership chain (unchanged from Phase 19A):

```text
message
→ passenger extraction (Adult / Child / Infant extractors)
→ state update (`applyConversationStateUpdate`)
→ classification (`classifyConversationStateChange`)
→ acknowledgement selection
→ follow-up selection
→ reply-plan assembly
→ conversational expression
```

Passenger counts are **not** part of core progression (`destination` → `origin` → dates). They enter only through contextual follow-ups gated on travel-service flags, or when the user volunteers a cued phrase / trusted `stateUpdate`.

---

## Extractor ownership

| Field | Extractor | Cue shape (summary) | Domain |
| --- | --- | --- | --- |
| `adultCount` | `AdultCountConversationStateExtractor` | `\b{N} adults?\b`, `adult count is N`, travelling-with / for / there-are prefaces; Phase 17G repair families | integers **1–99** |
| `childCount` | `ChildCountConversationStateExtractor` | `\b{N} child(?:ren)?\b`, `child count is N`, we-have / book-for / for / travelling-with | **1–99** |
| `infantCount` | `InfantCountConversationStateExtractor` | `\b{N} infants?\b`, `infant count is N`, same preface family | **1–99** |

Shared helper:

```text
passengerCountRepairExtraction.ts
```

used only for Actually / contrast / change-the-{field}-count-to repair families (Phase 17G).

Important extractor properties:

- Message-local: **no** `currentState` inspection and **no** active-question context
- Zero rejected in token parse (`< 1` → null)
- Adult extractor **blocks** any same-message mention of child / children / kids / infant / baby
- Guest / people / travellers synonyms are **not** adult cues
- Bare digits alone never match any passenger cue
- Multi-passenger sentences are out of scope by design comments (Phase 7E/7F/7G / 17G)

Registry order in `createConversationStateExtractor.ts`:

```text
… → AdultCount → ChildCount → InfantCount → flights → …
```

Composite merge applies each non-empty field patch independently.

---

## Follow-up ownership

Owner: `selectConversationFollowUpQuestion.ts` → `CONTEXTUAL_QUESTIONS`.

| Condition | Question (catalogue) |
| --- | --- |
| `flightsRequested === true && adultCount === null` | `How many adults will be travelling?` |
| `accommodationRequested === true && adultCount === null` | `How many guests will be staying?` |
| else (after core complete) | neutral continuation — **no** child/infant questions |

Priority: flights adult-count question is evaluated **before** accommodation guest-count. Both gates share the same stored field: `adultCount`.

Catalogue keys:

```text
followUps.flightsAdultCount
followUps.accommodationGuestCount
```

There are **no** `childCount` / `infantCount` follow-up entries.

---

## Exact adult-count progression rules

1. Core travel fields must already be complete (destination, origin, dates), or the selector still asks those first.
2. Adult count is requested **only** when:
   - `flightsRequested === true` and `adultCount === null`, **or**
   - `accommodationRequested === true` and `adultCount === null`
3. Car hire, activities, restaurants, or a trip with no flights/accommodation **never** solicit `adultCount`.
4. Once `adultCount !== null`, both count follow-ups are suppressed, even if child/infant remain null.
5. Successful adult extraction (`2 adults`, repair forms, trusted update) completes the gate and advances to the next eligible contextual question or neutral.

---

## Child-count progression behaviour

| Path | Behaviour |
| --- | --- |
| Follow-up solicitation | **Never** — selector does not reference `childCount` |
| Volunteer cue `2 children` | Extracts `childCount=2`, child acknowledgement, adult Q still asked if open |
| After adults captured | Volunteer still extracts + acks; follow-up is neutral (no child question) |
| Trusted `stateUpdate` | Persists + acks without solicitation |

---

## Infant-count progression behaviour

Symmetric to child:

| Path | Behaviour |
| --- | --- |
| Follow-up solicitation | **Never** |
| Volunteer cue `1 infant` | Extracts `infantCount=1`, infant acknowledgement |
| After adults captured | Neutral follow-up; infant never becomes next required field |
| Trusted `stateUpdate` | Works end-to-end |

---

## Bare-number ownership

Extractors do not own bare numbers. There is no transcript-aware or active-question binder.

| Active question | User message | Result |
| --- | --- | --- |
| Flights adult Q | `2` | empty extraction; uninterpreted; adult Q re-asked |
| Accommodation guest Q | `2` | empty extraction; uninterpreted; guest Q re-asked |

Expected product behaviour (not implemented): when the adult/guest question is active, a bare positive integer should populate `adultCount`.

---

## “Guest” answer behaviour

Accommodation ask uses guest wording; extraction only accepts adult cues.

| User message after guest Q | `adultCount` | Follow-up |
| --- | --- | --- |
| `2 guests` | stays `null` | guest Q re-asked |
| `2 adults` | `2` | guest Q suppressed |

`guest` / `guests` are not adult cues and are not blocked tokens — they simply never match.

---

## Combined passenger-answer behaviour

Phrase audited: `2 adults and 1 child`

| Field | Result | Reason |
| --- | --- | --- |
| `adultCount` | remains unset | Adult blocker fires on `child` in the same message |
| `childCount` | `1` | Child cue `\b1 child\b` matches inside the sentence |
| Follow-up | flights adult Q (if still open) | Adults never captured from the combined answer |

Multi-passenger parsing remains unsupported; the adult half is actively rejected when a child noun is present.

---

## Zero-count behaviour

Characterized only — not fixed.

| Phrase | Extraction |
| --- | --- |
| `0 adults` | `{}` — token parse rejects `< 1` |
| `0 children` | `{}` |
| `0 infants` | `{}` |

Removal / “no adults” / “not” families remain blocked. Trusted explicit updates may still clear counts to `null` via existing removed-acknowledgement paths; setting `0` via message text is not supported.

---

## Repeated and changed count behaviour

| Scenario | Classification | Acknowledgement | Follow-up |
| --- | --- | --- | --- |
| Repeat `2 adults` when already `2` | no `newlyPopulated` / no `updated` for adult | no adult ack | neutral (if core+adult complete) |
| Change `2` → `3 adults` | `updated` includes `adultCount` | changed adult wording (e.g. includes `3 adults`) | neutral |
| First set from `null` | `newlyPopulated` includes `adultCount` | set acknowledgement | count Q suppressed |

Same equal-value / change semantics apply to volunteered child and infant counts.

---

## Unsupported input during passenger progression

Phase 18B contract still holds: uninterpreted incomplete turns re-select the next required follow-up.

| Seed | Message | Follow-up retained |
| --- | --- | --- |
| flights + `adultCount=null` | `asdf qwerty` | adult Q |
| accommodation + `adultCount=null` | `asdf qwerty` | guest Q |

---

## Answers to required audit questions

1. **When is adult count requested?**  
   Only when core fields are complete and (`flightsRequested && adultCount === null`) or (`accommodationRequested && adultCount === null`). Flights wording wins if both apply.

2. **Can a trip require child or infant counts through the follow-up selector?**  
   **No.**

3. **Passenger fields required for flights?**  
   Only `adultCount` (for the contextual flights adult question). `childCount` / `infantCount` are never required.

4. **Passenger fields required for accommodation?**  
   Only `adultCount` (asked with guest wording). Child/infant never required.

5. **Bare `2` when adults/guests question is active?**  
   Populates nothing; question re-asked.

6. **Cued singles:**  
   - `2 adults` → `adultCount=2`  
   - `2 guests` → no change  
   - `2 children` → `childCount=2`  
   - `1 infant` → `infantCount=1`

7. **`2 adults and 1 child`:** adult blocked; `childCount=1` only.

8. **Repeated unchanged count:** extraction may re-emit the same value; classification treats it as unchanged; no false newly-enabled ack.

9. **Changed count:** `updated` + change acknowledgement.

10. **Zeros:** non-extracting for all three fields (domain ≥ 1).

---

## Verified defects

### D1 — Child count never solicited

- **Owner:** follow-up selection
- **Reproduction:** seed complete core + `flightsRequested=true` + `adultCount=2` + `childCount=null` → selector returns neutral; reply never asks about children
- **Expected:** family composition progression (or explicit product decision that children are volunteer-only)
- **Actual:** extract + ack only when user volunteers a child cue
- **Affected production files:**
  - `selectConversationFollowUpQuestion.ts`
  - `conversationReplyCatalogue.ts`
  - `ChildCountConversationStateExtractor.ts` (extract-only)
- **Recommended isolated fix phase:** **19F** — child-count solicitation after adults (flights/accommodation family path)

### D2 — Infant count never solicited

- **Owner:** follow-up selection
- **Reproduction:** same as D1 with `infantCount=null`
- **Expected:** infant question when product requires lap infants, or documented volunteer-only
- **Actual:** never asked
- **Affected production files:**
  - `selectConversationFollowUpQuestion.ts`
  - `conversationReplyCatalogue.ts`
  - `InfantCountConversationStateExtractor.ts`
- **Recommended isolated fix phase:** **19G** — infant-count solicitation (after child, or combined travellers question)

### D3 — Adult count only via flights or accommodation

- **Owner:** follow-up selection
- **Reproduction:** complete core, `adultCount=null`, no flights/accommodation (or car-hire only) → neutral; adults never asked
- **Expected:** optional general traveller-count follow-up when counts matter for the trip
- **Actual:** intentional Phase 10E design; travellers unspecified for non-flight/hotel trips
- **Affected production files:**
  - `selectConversationFollowUpQuestion.ts`
- **Recommended isolated fix phase:** **19H** — general traveller-count follow-up (product decision required)

### D4 — Bare numeric answers fail active adult/guest questions

- **Owner:** adult extraction / lack of active-question context
- **Reproduction:** flights adult Q active; user `2` → `adultCount` stays null; Q re-asked. Same for accommodation guest Q.
- **Expected:** bare positive integer completes the active count question into `adultCount`
- **Actual:** message-local adult cues required; no bare-number binder
- **Affected production files:**
  - `AdultCountConversationStateExtractor.ts`
  - (optionally) turn pipeline if active-question context is introduced
- **Recommended isolated fix phase:** **19I** — contextual bare-number handling when adult/guest Q is active

### D5 — Guest wording vs adult extraction cues

- **Owner:** follow-up wording vs adult extraction
- **Reproduction:** after guest Q, `2 guests` → no extraction; `2 adults` works
- **Expected:** natural guest answers satisfy the guest question
- **Actual:** only adult-cued phrases populate `adultCount`
- **Affected production files:**
  - `conversationReplyCatalogue.ts` (`accommodationGuestCount`)
  - `AdultCountConversationStateExtractor.ts`
- **Recommended isolated fix phase:** **19J** — guest synonym cues (and/or align question wording with adult cues)

### D6 — Combined multi-passenger answers unsupported (adult half blocked)

- **Owner:** adult extraction blockers + single-field extractors
- **Reproduction:** `2 adults and 1 child` → `adultCount` unset; `childCount=1`
- **Expected:** parse both counts (or reject the whole sentence consistently)
- **Actual:** asymmetric — adult blocked by child mention; child still extracts
- **Affected production files:**
  - `AdultCountConversationStateExtractor.ts`
  - `ChildCountConversationStateExtractor.ts`
  - (future) coordinated multi-passenger extractor
- **Recommended isolated fix phase:** **19K** — multi-passenger sentence parsing

### D7 — Zero counts non-extractable (characterized, not a regression)

- **Owner:** token domain (`1–99`) + block lists
- **Reproduction:** `0 adults` / `0 children` / `0 infants` → empty patches
- **Expected:** product may eventually allow explicit zero for “no children”
- **Actual:** zeros never persist from message text
- **Affected production files:** adult/child/infant extractors
- **Recommended isolated fix phase:** **19L** — zero-count semantics (only if product requires “none”)

---

## Recommended implementation phases

| Phase | Focus | Closes |
| --- | --- | --- |
| **19E** | Restaurant-preference acknowledgement wording (from Phase 19A G9; out of passenger scope) | ack quality |
| **19F** | Child-count solicitation after adults for flights/accommodation | D1 |
| **19G** | Infant-count solicitation (ordered after child or combined) | D2 |
| **19H** | Optional general traveller-count follow-up beyond flights/hotel | D3 |
| **19I** | Bare-number completion when adult/guest question is active | D4 |
| **19J** | Guest synonym extraction / wording alignment | D5 |
| **19K** | Combined multi-passenger answer parsing | D6 |
| **19L** | Zero-count semantics (only if required) | D7 |

Suggested passenger-only order if fixing next: **19I → 19J → 19F → 19G → 19K**, with **19H** / **19L** gated on product decisions. Keep each phase isolated; do not bundle zero-count or multi-passenger work into bare-number fixes.

---

## Phase 19D decision

**Phase 19D is complete as an audit.**

No production behaviour was changed. No passenger defects were fixed. Remaining passenger gaps are characterized above and deferred to isolated follow-on phases.
