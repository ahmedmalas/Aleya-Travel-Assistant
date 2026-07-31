# Phase 17 Repair Handling Closure Audit

Investigation and characterization only. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 17I baseline preserved exactly.
No live environment has been changed.
```

## Scope

Final closure audit of Phase 17 repair handling after Phases 17A–17I.

Characterization tests:

```text
src/features/conversation-core/__tests__/repairHandlingClosure.phase17J.test.ts
```

This phase does **not** modify production extraction, classification, selection, or wording.

## Completed Phase Map

| Phase | Role | Outcome |
| --- | --- | --- |
| **17A** | Repair-handling characterization | Root cause = extraction; empty patches for natural repairs |
| **17B** | Destination repair extraction | Meant / Actually, / make that / change that / Not X, Y |
| **17C** | Origin repair extraction | Explicit from / origin / departure-location cues; bare place stays destination-owned |
| **17D** | Departure-date repair extraction | Explicit departure cues; bare dates remain unowned |
| **17E** | Return-date repair extraction | Explicit return cues; bare dates remain unowned |
| **17F** | Passenger repair audit | Characterized Actually / Not / change-count-to gaps + destination child collision |
| **17G** | Passenger repair extraction | Actually / contrast / change-the-{field}-count-to; singular-child destination guard |
| **17H** | Multi-fact repair audit | Destination miss + origin pollution characterized |
| **17I** | Multi-fact place boundaries | Shared clause-boundary helper; clean dest/origin/date coexistence |

## Final Repair Ownership Rules

```text
bare repaired place
→ destination-owned

explicit from / origin / departure-location cue
→ origin-owned

explicit departure-date cue
→ departureDate-owned

explicit return-date cue
→ returnDate-owned

explicit passenger noun / field-count cue
→ corresponding passenger field

bare repaired date
→ unowned

multi-passenger sentence
→ unsupported unless an existing single-field rule unambiguously applies
```

Verified representatives:

| Message | Patch |
| --- | --- |
| `I meant Hobart` | `{ destination: Hobart }` |
| `I meant from Hobart` | `{ origin: Hobart }` |
| `Actually, depart on 30 August 2026` | `{ departureDate: 2026-08-30 }` |
| `Actually, return on 5 September 2026` | `{ returnDate: 2026-09-05 }` |
| `Actually, 3 adults` | `{ adultCount: 3 }` |
| `I meant 30 August 2026` | `{}` |
| `Actually, 2 adults and 1 child` | `{}` |

## Single-Field Repair Matrix

Seed unless noted: populated Melbourne / Adelaide / 2026-08-10 / 2026-09-01 / 2 adults / 1 child / 1 infant.

### Changed (field-changed)

| Field | Message | Exact reply opener |
| --- | --- | --- |
| destination | `Sorry, I meant Cairns` | `Updated — Cairns it is.` |
| origin | `Sorry, I meant from Brisbane` | `We'll depart from Brisbane instead.` |
| departureDate | `Actually, depart on 30 August 2026` | `Departure is now set for 2026-08-30.` |
| returnDate | `Actually, return on 5 September 2026` | `Return is now set for 2026-09-05.` |
| adultCount | `Actually, 3 adults` | `Updated to 3 adults.` |
| childCount | `Not 1 child, 2 children` | `Updated to 2 children.` |
| infantCount | `Change the infant count to 2` | `Updated to 2 infants.` |

All use the Phase 16B bridge when the trip is otherwise complete:

```text
Is there anything else you'd like me to consider? What else should I know about your trip?
```

### Set (field-set, prior null)

| Field | Message | Exact reply opener |
| --- | --- | --- |
| destination | `Sorry, I meant Cairns` | `Great, Cairns it is.` |
| origin | `Sorry, I meant from Brisbane` | `We'll start from Brisbane.` |
| departureDate | `Actually, depart on 30 August 2026` | `Departure is set for 2026-08-30.` |
| returnDate | `Actually, return on 5 September 2026` | `Return is set for 2026-09-05.` |
| adultCount | `Actually, 3 adults` | `Travelling with 3 adults.` |
| childCount | `Actually, 2 children` | `I've noted 2 children.` |
| infantCount | `Change the infant count to 1` | `That includes 1 infant.` |

### Unchanged

| Message | Patch | Event |
| --- | --- | --- |
| `Sorry, I meant Cairns` (already Cairns) | `{ destination: Cairns }` | null |
| `Actually, 2 adults` (already 2) | `{ adultCount: 2 }` | null |

### Phrase support by field (final)

| Phrase family | Dest | Origin | Depart | Return | Passenger |
| --- | --- | --- | --- | --- | --- |
| `Sorry, I meant …` / `I meant …` | bare place | `meant from` | explicit depart/leave cue | explicit return cue | count+noun |
| `Actually, …` | bare place | `Actually, from` | explicit depart cue | explicit return cue | whole-message count+noun |
| `No, make that …` | bare place | `make that from` | field-specific | field-specific | count+noun |
| `Change that to …` | bare place | `departing from` | explicit depart cue | `returning on` | count+noun |
| `Change the {field} to …` | destination | origin / departure location | departure date | return date | `{adult\|child\|children\|infant} count` |
| `Not {old}, {new}` | place contrast | trailing `from` after dest contrast | depart contrast | return contrast | same-noun count contrast |

Intentionally unsupported (examples): bare repaired dates; zero/removal passenger phrasing; multi-passenger Actually sentences; ambiguous `somewhere` / `X or Y`.

## Multi-Fact Repair Matrix

| Message | Combined patch | Ack priority | Exact reply shape |
| --- | --- | --- | --- |
| `Sorry, I meant Cairns, leaving from Sydney on 28 August 2026` | `{ destination: Cairns, origin: Sydney, departureDate: 2026-08-28 }` | destination field-changed | `Updated — Cairns it is.` + follow-up/bridge |
| `I meant Cairns, from Sydney` | `{ destination: Cairns, origin: Sydney }` | destination | `Updated — Cairns it is.` |
| `Actually, Cairns, departing from Sydney` | `{ destination: Cairns, origin: Sydney }` | destination | `Updated — Cairns it is.` |
| `Sorry, I meant from Sydney, leaving on 28 August 2026` | `{ origin: Sydney, departureDate: 2026-08-28 }` | origin | `We'll depart from Sydney instead.` |
| `I meant Cairns, 3 adults` | `{ destination: Cairns, adultCount: 3 }` | destination | `Updated — Cairns it is.` |
| `Actually, from Sydney, 2 adults` | `{ origin: Sydney, adultCount: 2 }` | origin | `We'll depart from Sydney instead.` |
| `Not Melbourne, Cairns, from Sydney` | `{ destination: Cairns, origin: Sydney }` | destination | `Updated — Cairns it is.` |

Invariants confirmed:

```text
place values are clean (no date/leaving/passenger residue)
sibling clauses are not retained in destination/origin
extractor order unchanged: Dest → Origin → Depart → Return → Adult → Child → Infant
patch merge remains shallow later-wins
acknowledgement priority remains deterministic
only one acknowledgement is rendered
```

## Acknowledgement and Selection Preservation

| Concern | Status |
| --- | --- |
| Phase 16 field-set vs field-changed openers | Unchanged |
| Phase 16B acknowledgement bridge | Unchanged |
| Acknowledgement-event contract | Unchanged |
| Acknowledgement priority (destination > origin > dates > passengers among co-updates) | Unchanged; destination still wins primary three-field case |
| Follow-up / continuation catalogue | Unchanged |
| One acknowledgement per turn | Confirmed |

Conversational selection/transform modules contain **no** repair-phrase parsing (`meant` / `Actually,` / contrast forms).

## Architecture Preservation

Confirmed unchanged by Phase 17 production work:

```text
authoritative state-update semantics
classification semantics (newlyPopulated / updated / unchanged; no removed array)
acknowledgement-event contract
acknowledgement priority
reply-component selection
reply-plan assembly
conversational renderer
acknowledgement wording
follow-up wording
continuation wording
fallback behaviour
integration mode
catalogue wording
```

The conversational layer still receives **no** repair-specific state and does **not** inspect transcript history to infer repair ownership. Extractors remain message-local.

## Remaining Intentional Limitations

These are preserved boundaries, not closure blockers:

```text
bare repaired dates remain unowned
no-year departure dates remain governed by existing date policy
zero passenger counts remain unsupported
passenger removal remains unsupported
multi-passenger repairs remain unsupported
contextual bare passenger-count false positives may remain
general free-form multi-fact NLU is not implemented
```

Examples:

| Limitation | Representative | Result |
| --- | --- | --- |
| Bare date | `I meant 30 August 2026` | `{}` |
| No-year | `Sorry, I meant Cairns, leaving on 28 August` | destination clean; departureDate absent |
| Zero | `0 adults` | `{}` |
| Removal | `No children` | `{}` |
| Multi-passenger | `Actually, 2 adults and 1 child` | `{}` |
| Ambiguous | `Sorry, I meant somewhere` / `I meant Cairns or Hobart` | `{}` |

## Regression Evidence

Focused suites (Phase 17J validation command) cover:

```text
17J closure
17I multi-fact boundaries
17H multi-fact audit (updated characterizations)
17G passenger repairs
17F passenger audit
17A repair audit (updated characterizations)
17E return repairs
17D departure repairs
17C origin repairs
17B destination repairs
16K conversational quality closure
```

Ordinary non-repair extraction still works:

```text
Go to Cairns
From Sydney
Depart on 28 August 2026
Return on 2 September 2026
3 adults
2 children
1 infant
```

## Validation Summary

Phase 17J commits audit-only files. Full validation is run as specified in the phase brief:

```text
focused 17J + 17I–17A + 16K
full suite
typecheck
build
```

Bundle hash is expected to match the Phase 17I production bundle when no production files change.

## Closure Decision

```text
A. Phase 17 repair handling is complete and should close.
```

Rationale:

1. Single-field repairs for all seven travel fields support set and changed paths with unchanged Phase 16 wording.
2. Primary multi-fact apology form extracts clean destination + origin + departureDate.
3. Ownership rules are deterministic and regression-covered.
4. Remaining gaps are the intentionally deferred limitations listed above, not defects inside the 17B–17I repair boundary.
5. No additional narrowly scoped repair phase is required inside Phase 17.

## Remaining Non-Repair Defects

Outside Phase 17; status reconfirmed from Phase 16K evidence, not re-investigated here:

```text
unsupported input reaching neutral while required fields remain missing
activities being re-requested after hiking
seafood preference not persisting
```

These belong to later non-repair phases.

## Recommended Phase 18 Boundary

```text
Phase 18 should leave Phase 17 repair extraction closed and address
non-repair conversational-quality / preference / unsupported-input defects,
or other product work outside the repair-handling boundary.
```

Suggested first candidates (not scoped here):

1. Unsupported-input handling when required trip fields remain missing.
2. Activities follow-up repetition after hiking/walking interest.
3. Preference persistence (e.g. seafood) beyond capability flags.

Do **not** reopen Phase 17 for zero/removal, multi-passenger NLU, bare-date ownership, or no-year date policy unless a later product decision explicitly expands that boundary.
