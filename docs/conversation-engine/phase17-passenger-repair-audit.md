# Phase 17 Passenger Repair Audit

Investigation and characterization only. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 17E baseline preserved exactly.
No live environment has been changed.
```

## Scope

Characterize passenger-count repair extraction for:

```text
adultCount
childCount
infantCount
```

before any Phase 17G production change. Preserve mixed Phase 17A findings and expand them across repair prefaces, singular/plural forms, cross-field sentences, zero/removal phrasing, and negative clauses.

Characterization tests:

```text
src/features/conversation-core/__tests__/passengerRepairHandlingAudit.phase17F.test.ts
```

## Passenger Extraction Architecture

| Aspect | Current fact |
| --- | --- |
| Extractors | Separate classes: `AdultCountConversationStateExtractor`, `ChildCountConversationStateExtractor`, `InfantCountConversationStateExtractor` |
| Shared parsing module | **No** — digit/word token parsers and block lists are duplicated per file |
| Cue shape | `\b{count}\s+{noun}\b` plus a few preface forms (`travelling with`, `for`, `child count is`, `adult count is`, `infant count is`) |
| Count domain | Integers **1–99** only; `< 1` rejected in token parse |
| Message blockers (all three) | `?`, `how many`, `actually`, `instead`, `not`, `no {noun}`, `remove`, keep/forget, do-not-change |
| Adult-only blocker | Any mention of child/infant/kids/baby in the same message |
| Child/infant extra blockers | fare/ticket/seat phrases; broad traveller synonyms; age phrases |
| State inspection | None — extractors do not read prior counts |
| Composite merge | `createConversationStateExtractor` merges field patches; destination/capability extractors may also fire |
| Classification | `newlyPopulated` / `updated` / `unchanged` — **no `removed` array** |
| Downstream | Selection/rendering behave correctly on whatever patch extraction emits |

Runtime path:

```text
processConversationTurn()
→ extractConversationState() / composite extractors
→ applyConversationStateUpdate()
→ classifyConversationStateChange()
→ selectConversationReplyComponents()
→ assembleConversationReplyPlan()
→ baseline-conversational render
```

## Adult Repair Results

Seed unless noted: `adultCount = 2`, trip otherwise complete.

| Phrase | Patch | Final adultCount | Event / reply shape |
| --- | --- | --- | --- |
| `Sorry, I meant 3 adults` | `{ adultCount: 3 }` | 3 | field-changed → `Updated to 3 adults.` + 16B bridge |
| `I meant 3 adults` | `{ adultCount: 3 }` | 3 | field-changed |
| `No, make that 3 adults` | `{ adultCount: 3 }` | 3 | field-changed |
| `Change that to 3 adults` | `{ adultCount: 3 }` | 3 | field-changed |
| `3 adults` / `1 adult` / `I meant one adult` | count patch | updated | field-changed (singular wording preserved in ack) |
| `Actually, 3 adults` | `{}` | 2 | neutral (15J) |
| `Not 2 adults, 3 adults` | `{}` | 2 | neutral — `\bnot\b` block |
| `Change the adult count to 3` | `{}` | 2 | neutral — cue is `adult count is N`, not `to N` |
| Null seed + `I meant 3 adults` | `{ adultCount: 3 }` | 3 | field-set → `Travelling with 3 adults.` |
| Equal value `I meant 2 adults` | `{ adultCount: 2 }` | 2 | no classification change → neutral |

## Child Repair Results

| Phrase | Patch | Notes |
| --- | --- | --- |
| `I meant 2 children` / `Sorry, I meant 2 children` | `{ childCount: 2 }` | field-changed → `Updated to 2 children.` |
| `No, make that 2 children` / `Change that to 2 children` | `{ childCount: 2 }` | works |
| `Actually, 2 children` | `{}` | `\bactually\b` |
| `Not 1 child, 2 children` | `{}` | `\bnot\b` |
| `Change the child count to 2` | `{}` | missing `to N` cue |
| `I meant 1 child` / `Sorry, I meant 1 child` | `{ destination: "1 child", childCount: 1 }` | **destination collision** with Phase 17B `meant` cue; when childCount already 1, only destination is acknowledged (`Updated — 1 child it is.`) |
| Null seed + `I meant 2 children` | `{ childCount: 2 }` | field-set → `I've noted 2 children.` |

## Infant Repair Results

| Phrase | Patch | Notes |
| --- | --- | --- |
| `I meant 2 infants` | `{ infantCount: 2 }` | field-changed → `Updated to 2 infants.` |
| `No, make that 1 infant` / `Change that to 1 infant` | `{ infantCount: 1 }` | extractor succeeds; if already 1 → no ack (equal value) |
| `I meant 1 infant` (seed 1) | `{ infantCount: 1 }` | no classified change → neutral |
| `Actually, 1 infant` | `{}` | `\bactually\b` |
| `Not 1 infant, 2 infants` | `{}` | `\bnot\b` |
| `Change the infant count to 1` | `{}` | missing `to N` cue |
| Null seed + `I meant 1 infant` | `{ infantCount: 1 }` | field-set → `That includes 1 infant.` |

## Singular and Plural Behaviour

| Observation | Evidence |
| --- | --- |
| Nouns accept singular/plural via `adults?` / `child(?:ren)?` / `infants?` | `1 adult`, `2 children`, `1 infant` extract |
| Word tokens `one`…`ten` accepted | `I meant one adult` → 1 |
| Acknowledgement wording follows singular/plural catalogue shapes | `Updated to 1 adult.` vs `Updated to 3 adults.` |
| Consistency across fields | Same singular/plural cue pattern in all three extractors |

## Cross-Field Repair Results

| Phrase | Result |
| --- | --- |
| `Sorry, I meant 3 adults, not 2 children` | `{}` — adult blocked by child noun + `not` |
| `Actually, 2 adults and 1 child` | `{}` — `actually` + cross nouns |
| `No infants, make that 1 infant` | `{}` — `no infants` / `not` family blocks |
| `Change that to 2 children, not adults` | `{}` — `not` block on child extractor |

No multi-passenger patch is produced. Failures are extraction guards, not reply selection.

## Zero and Removal Semantics

| Phrase family | Patch | Meaning today |
| --- | --- | --- |
| `No adults/children/infants` | `{}` | Explicit `\bno {noun}\b` block — **not** count 0, **not** null clear |
| `Zero …` / `0 …` | `{}` | No cue match and/or parse rejects `< 1` |
| `Remove the …` | `{}` | `\bremove\b` block |
| `Actually, no children` / `I meant no infants` | `{}` | no/actually/not blocks |

**Conclusion:** zero and removal are **not** modeled as `count = 0` or `count = null` by these extractors. Trusted `stateUpdate` clears (tested elsewhere) remain the only deterministic removal path. Do not assume zero ≡ removal.

## Negative and Ambiguous Cases

| Input | Passenger extraction | Side effects |
| --- | --- | --- |
| `The hotel allows 3 adults` | **unintended** `adultCount: 3` | also `accommodationRequested` |
| `Tickets for 2 children` | **unintended** `childCount: 2` (`for N children` cue) | child field-changed ack |
| `Activities suitable for 1 infant` | `infantCount: 1` (equal → inert) | `activitiesRequested` ack wins |
| `I meant the room fits 3 adults` | **unintended** `adultCount: 3` | field-changed adults |
| `Actually, the flight price is for 2 adults` | `{}` | actually + adult price block path |
| `Change that to room 3` | no passenger patch | destination `"room 3"` via 17B |
| `Not sure whether 2 children are coming` | `{}` | `not` block |
| `Adult-only hotel` | adult `{}` (adults? only block) | accommodation enabled |
| `Child-friendly activities` | child `{}` | activities enabled |
| `Infant seat required` | `{}` | infant seat block |

## Verified Facts

1. Passenger fields use **separate extractors** with **duplicated** parse/block logic — not one shared repair framework.
2. Working repair preface for all three: `meant` / `Sorry, I meant` / `No, make that` / `Change that to` when a `{count} {noun}` cue remains.
3. Blocked repair preface for all three: `Actually, …` and contrast `Not {old}, {new}` via `\bactually\b` / `\bnot\b`.
4. `Change the {field} count to N` fails — only `… count is N` exists.
5. Contrast repairs do **not** select the new count; the whole message is blocked.
6. Singular and plural nouns behave consistently within each extractor.
7. Equal-value patches apply but produce **no acknowledgement** (classification unchanged).
8. Zero/removal phrases produce **no patch** — neither `0` nor `null`.
9. Adult extractor refuses any message that also mentions children/infants.
10. Downstream layers correctly reflect empty or populated patches; they are not the originating defect for Actually/Not failures.
11. Destination 17B `meant` can collide with `I meant 1 child`, inventing destination `"1 child"`.

## Observed Failures

```text
F1. Actually, {N} {passengers} blocked on all three fields.
F2. Not {old}, {new} contrast blocked on all three fields.
F3. Change the {adult|child|infant} count to N unsupported.
F4. Cross-field passenger sentences always empty.
F5. Zero/removal language never clears or zeroes counts via extraction.
F6. Non-trip sentences can still set counts (hotel allows / tickets for / room fits).
F7. Meant + singular child can corrupt destination ("1 child").
```

## Root-Cause Evidence

For `Actually, 3 adults` with `adultCount = 2`:

```text
1. AdultCountConversationStateExtractor.isBlockedAdultCountMessage
   → true because /\bactually\b/
2. extractExplicitAdultCount → null → stateUpdate {}
3. applyConversationStateUpdate → unchanged
4. classify → hasInterpretedChange false
5. selection → null ack/event → activated neutral
```

For `Not 2 adults, 3 adults`: same chain with `/\bnot\b/`.

For `Change the adult count to 3`: not blocked, but no cue matches (`adult count is` ≠ `adult count to`).

For `I meant 1 child` collision: destination repair cue `i meant (.+)$` captures `1 child` while child extractor also emits `childCount: 1`.

## Defect Ownership

| Failure | Owning layer |
| --- | --- |
| F1 Actually blocks | **extraction** (shared guard pattern in each passenger extractor) |
| F2 contrast Not blocks | **extraction** |
| F3 change-count-to missing | **extraction** (cue gap) |
| F4 cross-field empty | **extraction** (adult sibling-noun block + not block) |
| F5 zero/removal inert | **extraction** (intentional blocks + parse domain ≥ 1) |
| F6 unintended counts | **extraction** (over-broad `{count} {noun}` / `for N children`) |
| F7 meant child → destination | **extraction** (destination 17B repair capture vs child cue) |
| Neutral after failed repair | selection *(symptom)* |
| Unchanged state after `{}` | state update *(symptom)* |

## Blast Radius

A Phase 17G fix should concentrate on:

```text
AdultCountConversationStateExtractor
ChildCountConversationStateExtractor
InfantCountConversationStateExtractor
```

Optionally a narrowly shared helper for:

```text
actually-preface exception when an explicit {count}{noun} cue exists
contrast Not {oldCount} {noun}, {newCount} {noun}
change the {field} count to {N}
```

Related collision surface (only if in scope for a later phase):

```text
DestinationConversationStateExtractor repair capture guards
  — reject "{N} child/children/infant/adults" as destinations
```

Out of blast radius for a correct extraction-only passenger repair fix:

```text
classification semantics
acknowledgement event contract
catalogue / Phase 16J wording
follow-up / continuation
integration mode
zero↔removal product policy (needs an explicit design; do not invent in 17G)
```

## Recommended Boundary for Phase 17G

```text
Phase 17G should unlock explicit passenger-count repairs that are already
cue-shaped ({N} adults|children|infants) but blocked only by Actually/Not
prefaces, and add missing "change the {field} count to N" cues — without
redesigning zero/removal semantics or multi-passenger sentence parsing.
```

Concrete recommended boundary:

1. **In scope:** allow `Actually, {N} {passenger-noun}` when an explicit count cue is present; allow narrow contrast `Not {old} {noun}, {new} {noun}`; support `Change the {adult|child|infant} count to {N}`; keep field-specific extractors (or a tiny shared helper) rather than a general repair framework.
2. **Out of scope:** zero→0, no→null removal redesign, multi-field sentences (`3 adults and 1 child`), hotel/ticket false-positive hardening (unless trivial and shared), destination `"1 child"` collision (track separately or as a one-line destination guard if required for safety).
3. **Success signal:** `Actually, 3 adults` with prior 2 → `{ adultCount: 3 }` → `field-changed` → existing `Updated to 3 adults.` path; same pattern for children/infants; bare `I meant 3 adults` remains working; `No adults` remains non-extracting until a dedicated removal phase.

Phase 17F stops at characterization. No production fix in this phase.
