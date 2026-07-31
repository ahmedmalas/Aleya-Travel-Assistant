# Phase 16E — Remaining Acknowledgement Repetition Audit

Investigation and characterization only. Production wording is unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 16D opener refinements are preserved exactly.
No live environment has been changed.
```

## Accepted baseline

| Check | Value |
| --- | --- |
| HEAD | `d3f1ad1d99eb18495b5cdc450401ce978348c724` |
| Branch | `cursor/conversation-progression-8697` |
| Prior commit | Phase 16D: refine stateless acknowledgement openers |
| PR #29 | OPEN, Draft, Unmerged, Undeployed |
| Working tree at audit start | clean |

## Production path exercised

```text
processConversationTurn()
→ selectConversationAcknowledgement / assembleConversationReplyPlan
→ baseline-conversational rendering
→ transformBaselineAcknowledgement (Phase 16D openers)
→ 15C / 16B join or bridge
```

Primary assertions use the production reply path, not helper-only fixtures.

## Journeys audited

| Journey | Consecutive pattern measured |
| --- | --- |
| Destination set then changed | Brisbane → Cairns |
| Origin set then changed | Brisbane → Sydney |
| Departure date set then changed | consecutive departure re-sets |
| Return date set then changed | consecutive return re-sets |
| Adult count set then changed | 2 → 3 adults |
| Child count set then changed | 1 → 2 children |
| Infant count set then changed | 1 → 2 infants |
| Child count followed by infant count | cross-family `I've noted` |
| Multiple capability enables | beaches → camping |
| Multiple capability disables | flights then beaches removed |
| Multiple field removals | child count then adult count cleared |
| Generic acknowledgement | catalogue transform identity (`Perfect.` → `Perfect, got it.`) |
| Mixed-field core progression | destination → origin → departure → return → adults (+ child/infant) |

## Per-turn measurement schema

For every turn:

```text
input turn
acknowledgement family
deterministic acknowledgement
rendered acknowledgement
rendered opener
whether the opener matches the previous turn
whether the complete acknowledgement matches the previous turn
whether current acknowledgement string alone distinguishes the turns
boundary class A | B | C | D | n/a
```

## Repetition measurements (aggregate)

| Metric | Observed result |
| --- | --- |
| Most frequent remaining opener (across audited journeys) | Shared family openers after 16D (`Great,`, `Great, I've added`, `I've noted`, `We'll start`, date openers, `Travelling with`, removal openers) — **not** `Perfect,` |
| `Perfect,` frequency in audited journeys | **0** (only generic catalogue family still maps to `Perfect, got it.`; not emitted in these journeys) |
| Longest consecutive identical-opener run | **2** (same-family consecutive changes, or child→infant) |
| Longest consecutive identical-complete-acknowledgement run | **1** (values always differ when fields change) |
| Cross-family opener repetition | child → infant share `I've noted` |
| Same-family opener repetition | destination (`Great,`), origin (`We'll start`), dates, adult (`Travelling with`), child/infant (`I've noted`), capability enable (`Great, I've added`), capability disable, field removal |

### Phase 16D mixed-field sequence (preserved)

```text
Great, → We'll start → Departure is set → Return is set → Travelling with
```

Max consecutive identical opener on that sequence: **1**.

## Classification of every remaining repeated pattern

Boundary classes:

```text
A — safely distinguishable from the current acknowledgement string alone
B — safely distinguishable from current reply-plan fields alone
C — requires previous-turn or recent-phrase history
D — repetition is intentional and should remain unchanged
```

| Repeated pattern | Families | Opener | Complete ack identical? | Current ack distinguishes? | Class | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Destination re-set | destination → destination | `Great,` | no | yes (different place names) | **A** | Template family shared; interiors differ |
| Origin re-set | origin → origin | `We'll start` | no | yes | **A** | |
| Departure re-set (consecutive) | departureDate → departureDate | `Departure is set` | no | yes | **A** | |
| Return re-set (consecutive) | returnDate → returnDate | `Return is set` | no | yes | **A** | |
| Adult count change | adultCount → adultCount | `Travelling with` | no | yes | **A** | |
| Child count change | childCount → childCount | `I've noted` | no | yes | **A** | |
| Infant count change | infantCount → infantCount | `I've noted` | no | yes | **A** | |
| Child then infant | childCount → infantCount | `I've noted` | no | yes (child vs infant label) | **A** | Cross-family; see below |
| Capability enables | capabilityEnabled → capabilityEnabled | `Great, I've added` | no | yes (label list) | **A** | |
| Capability disables | capabilityDisabled → capabilityDisabled | `No problem, I've removed (capability)` | no | yes | **A** | |
| Field removals | fieldRemoved → fieldRemoved | `No problem, I've removed (field)` | no | yes | **A** | Already distinct from capability-disable via `from your trip.` |
| Identical acknowledgement twice | any | same | yes | no | **C** | Not observed in value-changing journeys; would need history |
| Generic `Perfect.` twice | generic → generic | `Perfect,` | yes (identical string) | no | **C** | Rare; selector emits residual generic only |
| Destination vs capability lead-in | destination vs capabilityEnabled | coarse `Great,` vs fine `Great, I've added` | no | yes | **D / already split** | Fine-grained openers already differ; no cross-family collision at measured granularity |

### Class B assessment

Current reply-plan fields beyond the acknowledgement string (`followUpQuestion`, `messageInterpreted`) do **not** safely distinguish remaining opener repetitions: consecutive same-family edits often share the same follow-up shape (especially 16B canonical neutral). No Class **B** candidate was found that is stronger than Class **A**.

## Child-versus-infant boundary finding

```text
Finding: CROSS-FAMILY, STATELESSLY DISTINGUISHABLE (Class A)
```

Evidence:

```text
turn N:   deterministic = "Perfect — 1 child travelling."
          rendered     = "I've noted 1 child."
          opener       = "I've noted"
          family       = childCount

turn N+1: deterministic = "Perfect — 1 infant travelling."
          rendered     = "I've noted 1 infant."
          opener       = "I've noted"
          family       = infantCount
```

- Opener matches previous turn: **yes**
- Complete acknowledgement matches: **no**
- Current acknowledgement strings differ by the catalogue suffixes `child travelling.` vs `infant travelling.`
- Therefore Phase 15B/16D recognition already separates the families; a future opener split does **not** require transcript history

This is **not** a history-dependent repetition.

## Statelessly fixable candidates (if a later phase chooses to act)

All Class **A** rows above. Highest clarity / lowest risk:

1. **Child vs infant opener split** — distinct openers keyed on existing child/infant template suffixes
2. Optional same-family opener pools keyed on acknowledgement text alone (destination/origin/dates/passengers/capabilities/removals) — larger tone churn; still Class A when values differ

None of these require history, plan-field expansion, or selection changes.

## History-required candidates

| Pattern | Class | Why |
| --- | --- | --- |
| Consecutive turns with **identical** deterministic acknowledgement string | **C** | No current-input difference to key a variation |
| Consecutive generic `Perfect.` emissions | **C** | Identical catalogue string |

Not observed as a high-volume production path in the audited journeys.

## Intentional unchanged repetitions

| Pattern | Recommendation |
| --- | --- |
| Keeping a stable opener **within** a family when the product wants recognisable voice (e.g. always `Great,` for destination) | **D** — product choice, not a defect |
| Field-removal vs capability-disable already using distinct rendered shapes | **D** — already correct; do not merge them |

## Production-preservation proof

Phase 16E modified **no** production files.

Confirmed unchanged:

```text
trip state / extraction / classification
acknowledgement selection / follow-up selection / continuation selection
reply-plan assembly
conversational transformation wording (Phase 16D map intact)
branch order / integration mode / fallback behaviour
```

Source evidence: `transformBaselineAcknowledgement.ts` still documents Phase 16D only; layer source has no Phase 16E edits.

## Characterization tests

```text
src/features/conversation-core/__tests__/remainingAcknowledgementRepetition.phase16E.test.ts
```

Locks observed production behaviour without asserting a future implementation.

## Recommended posture for a later phase (not implemented here)

If a Phase 16F expression pass is desired, the single safest narrow boundary is:

```text
Split child vs infant openers inside transformBaselineAcknowledgement
using only the current acknowledgement string (Class A).
```

Broader same-family opener diversification is also Class A but higher tone risk.
History integration remains unnecessary for the measured remaining high-clarity cases.
