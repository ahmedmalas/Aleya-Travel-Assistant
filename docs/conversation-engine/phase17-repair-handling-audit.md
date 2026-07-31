# Phase 17 Repair Handling Audit

Investigation and characterization only. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 16K baseline preserved exactly.
No live environment has been changed.
```

## Scope

Characterize the current repair-handling defect for natural correction phrasing, without changing production code.

Primary case:

```text
Existing destination: Melbourne
User: Sorry, I meant Cairns
```

Required repair phrases:

```text
Sorry, I meant Cairns
I meant Cairns
Actually, Cairns
No, make that Cairns
Change that to Cairns
Not Melbourne, Cairns
```

Required travel fields:

```text
destination, origin, departureDate, returnDate,
adultCount, childCount, infantCount
```

Characterization tests:

```text
src/features/conversation-core/__tests__/repairHandlingAudit.phase17A.test.ts
```

## Verified Runtime Path

```text
processConversationTurn()
→ transitionConversationStateFromExtraction()
   → extractConversationState()
      → createConversationStateExtractor().extract()
         → CompositeConversationStateExtractor
            → Destination / Origin / DepartureDate / ReturnDate
              / AdultCount / ChildCount / InfantCount extractors
   → applyConversationStateUpdate(currentState, extractedPatch)
→ generateIntegratedConversationReply({ previousState, state })
   → generateConversationReply()
      → classifyConversationStateChange(previous, final)
      → createConversationReplyPlan()
         → selectConversationReplyComponents()
         → assembleConversationReplyPlan()
      → renderIntegratedConversationReplyPlan()
→ final rendered reply
```

Key facts about this path:

1. Extractors are **message-only** cue matchers. They do not read prior field values to infer “correction of the last slot.”
2. There is **no dedicated repair layer**.
3. After extraction, the reply path **does not re-inspect the user message**. Classification and selection see state delta only.
4. `ConversationStateChangeClassification` exposes `newlyPopulated` / `updated` / `unchanged`. It has **no `removed` array**; clears appear in `updated` when a non-null value becomes null.

## Characterized Repair Phrases

Seed for destination phrases unless noted: populated trip with `destination = Melbourne`.

| Phrase | Extracted patch | Final destination | Interpreted change? | Selected ack / event | Exact final reply (shape) |
| --- | --- | --- | --- | --- | --- |
| `Sorry, I meant Cairns` | `{}` | Melbourne | no | none / null | activated neutral (15J) |
| `I meant Cairns` | `{}` | Melbourne | no | none / null | activated neutral |
| `Actually, Cairns` | `{}` | Melbourne | no | none / null | activated neutral |
| `No, make that Cairns` | `{}` | Melbourne | no | none / null | activated neutral |
| `Change that to Cairns` | `{}` | Melbourne | no | none / null | activated neutral |
| `Not Melbourne, Cairns` | `{}` | Melbourne | no | none / null | activated neutral |
| `change it to Cairns` *(contrast)* | `{ destination: Cairns }` | Cairns | yes | `Great — Cairns.` / `field-changed` | `Updated — Cairns it is.` + 16B bridge |
| `go to Cairns` *(contrast)* | `{ destination: Cairns }` | Cairns | yes | field-changed destination | updated destination + bridge |
| `Actually make it Cairns` *(contrast)* | `{ destination: Cairns }` | Cairns | yes | field-changed destination | updated destination + bridge |

Exact activated neutral reply locked by tests:

```text
There's just one more thing I'd like to know. What else should I know about your trip?
```

## Field-by-Field Results

### destination

| Scenario | Result |
| --- | --- |
| Populated Melbourne + `Sorry, I meant Cairns` | empty patch; destination unchanged; neutral |
| Null destination + same phrase | empty patch; destination stays null; neutral |
| Both values in sentence: `Not Melbourne, Cairns` | empty patch; blocked by `\bnot\b` in destination extractor |
| Valid cue-backed replacement | succeeds (`change it to`, `go to`, `Actually make it`) |
| Ambiguous: `Sorry, I meant somewhere` / `I meant Cairns or Hobart` | empty patch (also rejected by destination normalisation even if a cue matched) |

**Ownership:** extraction. Destination cues do not include `meant` / `make that` / `change that`. `\bnot\b` and `\bleaving\b` are hard blocks.

### origin

| Scenario | Result |
| --- | --- |
| `I meant Sydney` / `Actually, Sydney` | empty patch; origin unchanged; neutral |
| Null origin + `Sorry, I meant Brisbane` | empty patch; origin stays null |
| Cue-backed: `from Brisbane instead` | `{ origin: Brisbane }`; field-changed ack |

**Ownership:** extraction. Origin requires `from …` / `origin is …` style cues. Bare place after `meant` is not an origin cue. `\bnot\b` also blocks origin.

### departureDate

| Scenario | Result |
| --- | --- |
| `Sorry, I meant 30 August 2026` | empty patch (no `Depart on` / date cue) |
| `Actually, Depart on 30 August 2026` | empty patch — `\bactually\b` hard-blocks departure extraction |
| Null departure + meant bare date | empty patch |
| `Depart on 30 August 2026` | `{ departureDate: 2026-08-30 }`; field-changed |

**Ownership:** extraction. Bare dates after repair prefaces are not cues; `actually` actively suppresses otherwise-valid departure cues.

### returnDate

| Scenario | Result |
| --- | --- |
| `Sorry, I meant Return on 20 August 2026` | `{ returnDate: 2026-08-20 }` — Return cue survives `meant` preface |
| `Actually, Return on 20 August 2026` | empty patch — `\bactually\b` hard-block |
| `Return on 20 August 2026` | succeeds |

**Ownership:** extraction. Asymmetry vs destination: when an explicit Return cue is present after `meant`, returnDate updates; `actually` still blocks.

### adultCount

| Scenario | Result |
| --- | --- |
| `Sorry, I meant 3 adults` | `{ adultCount: 3 }`; field-changed; `Updated to 3 adults.` + bridge |
| `Change that to 3 adults` | `{ adultCount: 3 }` — `\b3 adults\b` matches despite `that` |
| `Actually, 3 adults` | empty — `\bactually\b` hard-block |
| `Not 2 adults, 3 adults` | empty — `\bnot\b` hard-block |
| Null adultCount + `Sorry, I meant 3 adults` | `{ adultCount: 3 }`; newlyPopulated / field-set |

**Ownership:** extraction. Count token cues are prefix-tolerant for `meant`, but `actually` / `not` block the adult extractor.

### childCount / infantCount

| Scenario | Result |
| --- | --- |
| `I meant 2 children` | `{ childCount: 2 }`; field-changed |
| `I meant 2 infants` | `{ infantCount: 2 }`; field-changed |

**Ownership:** extraction succeeds when the count cue is present; these are not destination-style repair failures.

## Multi-Fact Repair Results

Phrase:

```text
Sorry, I meant Cairns, leaving from Sydney on 28 August
```

| Field | Extracted | Final | Notes |
| --- | --- | --- | --- |
| destination | missed | Melbourne | no `meant` cue; `\bleaving\b` would block destination even if a cue existed |
| origin | `Sydney on 28 August` | polluted | broad `\bfrom\s+(.+)$` captures trailing date text |
| departureDate | missed | unchanged | day/month without year fails parse |

Phrase:

```text
Sorry, I meant Cairns, leaving from Brisbane on 28 August 2026
```

| Field | Extracted | Final | Notes |
| --- | --- | --- | --- |
| destination | missed | Melbourne | repair destination still absent |
| origin | `Brisbane on 28 August 2026` | polluted | same trailing capture |
| departureDate | `2026-08-28` | updated | `from … on …` cue with year |
| acknowledgement | origin field-changed | — | origin priority wins; departure update is silent in ack |

Exact reply for the year-bearing multi-fact case:

```text
We'll depart from Brisbane on 28 August 2026 instead. Is there anything else you'd like me to consider? What else should I know about your trip?
```

## Verified Facts

1. Primary destination repair phrases produce **empty extraction patches**.
2. Authoritative trip state is therefore **unchanged** for those phrases.
3. Classification correctly reports **no interpreted change** when the patch is empty — it is not inventing a false negative after a successful extract.
4. Selection correctly emits **null acknowledgement / null event** and falls through to **activated neutral continuation** when nothing changed.
5. Cue-backed destination replacements (`change it to`, `go to`, `Actually make it`) still work end-to-end, including Phase 16J `field-changed` wording and the Phase 16B bridge.
6. Passenger-count repair-like phrasing often **succeeds** because `\bN adults/children/infants\b` matches inside `I meant …` sentences.
7. Date extractors (and adult count) **hard-block** `\bactually\b` and `\binstead\b`, creating preface-sensitive failures even when a later cue looks valid.
8. Destination / origin hard-block `\bnot\b`, so contrastive “Not X, Y” cannot extract.
9. Multi-fact “meant” utterances can **partially apply** origin/date patches while still missing the repaired destination — a compounding extraction defect.
10. Classification has no separate `removed` bucket; repair failures do not clear fields.

## Observed Failures

```text
F1. Natural destination repair ("meant" / "make that" / "change that" / bare "Actually, Place") does not update destination.
F2. Contrastive "Not Melbourne, Cairns" is blocked, not parsed as replacement.
F3. Origin bare-place repair phrases fail similarly.
F4. Bare date after "meant" fails; "Actually, Depart/Return on …" is hard-blocked.
F5. Multi-fact repair misses destination, pollutes origin, and may silently update departureDate.
F6. When multi-fact partial extraction occurs, acknowledgement may describe the polluted origin while destination remains wrong.
```

Non-failures (current behaviour that already works via existing cues):

```text
W1. change it to Cairns / go to Cairns / Actually make it Cairns
W2. from Brisbane instead
W3. Depart on / Return on with year
W4. Sorry, I meant N adults|children|infants (count cue present; not blocked by meant)
W5. Change that to N adults (count cue present)
```

## Root-Cause Evidence

For the primary case `Sorry, I meant Cairns` with `destination = Melbourne`:

```text
1. DestinationConversationStateExtractor.extract → {}
   - No cue matches "meant"
   - Bare place names are unsupported
2. Composite extractor stateUpdate → {}
3. applyConversationStateUpdate → state identical to previous
4. classifyConversationStateChange → hasInterpretedChange=false, updated=[]
5. selectConversationAcknowledgement → null
6. assemble plan → acknowledgements=[], acknowledgementEvent=null, follow-up=canonical neutral
7. baseline-conversational render → activated neutral continuation
```

Source evidence in `DestinationConversationStateExtractor.ts`:

```text
- EXPLICIT_DESTINATION_CUES includes change it to / make it … instead /
  actually make it / switch it to / go to / …
- EXPLICIT_DESTINATION_CUES does not include meant / make that / change that
- isBlockedDestinationMessage returns true on \\bnot\\b and \\bleaving\\b
```

Downstream layers behave consistently with an empty patch. They are **not** the originating defect for F1–F4.

For multi-fact F5/F6, the originating defect is still extraction: destination miss + origin over-capture + optional departure parse — selection only surfaces whichever field wins acknowledgement priority.

## Defect Ownership

| Failure | Owning layer | Why not a downstream root cause |
| --- | --- | --- |
| F1 destination natural repair | **extraction** | empty patch before state update |
| F2 contrastive Not X, Y | **extraction** | `\bnot\b` block inside destination/origin extractors |
| F3 origin bare repair | **extraction** | no origin cue; empty patch |
| F4 actually/meant date failures | **extraction** | hard-blocks / missing cues inside date extractors |
| F5/F6 multi-fact partial / pollution | **extraction** | wrong/missing fields in patch; selection acknowledges whatever changed |
| Neutral reply after failed repair | deterministic reply selection *(symptom)* | correct response to `hasInterpretedChange=false` |
| Unchanged Melbourne after failed repair | authoritative state update *(symptom)* | correctly applies empty patch |
| Empty `updated` after failed repair | classification *(symptom)* | correctly compares identical states |

**Summary ownership for the Phase 16/17 primary repair defect:**

```text
extraction
```

Not classification. Not acknowledgement selection. Not conversational wording.

## Blast Radius

If extraction were later taught to recognise repair phrases, impact would concentrate at:

```text
DestinationConversationStateExtractor (primary)
OriginConversationStateExtractor
DepartureDate / ReturnDate extractors (preface / actually blocks)
Adult/Child/Infant count extractors (already partially tolerant; actually/not blocks)
CompositeConversationStateExtractor merge behaviour for multi-fact turns
```

Downstream layers that would then activate **without further wording work** (already event-aware from Phase 16I/16J):

```text
applyConversationStateUpdate
classifyConversationStateChange (newlyPopulated vs updated)
selectConversationAcknowledgement + acknowledgementEvent
Phase 16J transformBaselineAcknowledgement (field-set vs field-changed)
Phase 16B acknowledgement + neutral bridge
```

Risk surfaces if a repair extractor is naive:

```text
- Multi-fact turns could still pollute origin while setting destination
- Contrastive "Not X, Y" needs careful ordering so Not-blocking does not win
- "actually" hard-blocks on dates/counts would still suppress valid cues unless revisited
- Ambiguous values (somewhere / X or Y) must remain rejected
```

Out of blast radius for a correct extraction-only fix:

```text
acknowledgement catalogue strings
acknowledgement event contract shape
follow-up / continuation catalogue
integration mode
fallback renderer
```

## Out-of-Scope Hypotheses

Do not treat these as Phase 17A conclusions or as implied 17B work:

```text
- Conversational renderer should invent destination changes from message text
- Classification should mark updated without a state delta
- Acknowledgement selection should emit field-changed without extraction
- Arbitrary synonym rotation or LLM repair inference
- Preference / activities / seafood defects (separate owning layers)
- Multi-fact origin pollution as an acknowledgement-wording issue
```

## Recommended Boundary for Phase 17B

```text
Phase 17B should be limited to deterministic extraction (and only as far as
needed for repair-style destination/origin correction), without changing
classification, selection, acknowledgement events, or conversational wording.
```

Concrete recommended boundary:

1. **In scope for 17B design/implementation:** teach destination (and, if justified by the same evidence, origin) extractors to recognise the characterized natural repair phrases that currently yield `{}`, while preserving existing cue-backed successes and ambiguous-value rejections.
2. **Explicitly out of scope for 17B:** renderer/wording changes, acknowledgement event contract changes, reply-plan assembly changes, follow-up/continuation changes, integration mode, catalogue copy, classification semantics, state-update merge rules (unless a proven extraction patch cannot be applied — not observed here).
3. **Do not expand 17B into full multi-fact extraction redesign** unless a repair fix unavoidably intersects the `leaving from … on …` pollution path; if so, keep the change minimal and still extraction-owned.
4. **Success signal for a later fix:** `Sorry, I meant Cairns` with Melbourne → patch `{ destination: Cairns }` → classification `updated: ['destination']` → `acknowledgementEvent: { kind: 'field-changed', field: 'destination' }` → existing Phase 16J wording path.

Phase 17A stops at characterization. No production fix in this phase.
