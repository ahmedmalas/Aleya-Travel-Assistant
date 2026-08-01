# Phase 17 Multi-Fact Repair Audit

Investigation and characterization only. Production behaviour unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 17G baseline preserved exactly.
No live environment has been changed.
```

## Scope

Characterize remaining multi-fact repair defects after Phase 17B–17G single-field repair extraction.

Primary case:

```text
Previous:
  destination = Melbourne
  origin = Adelaide
  departureDate = null

User:
  Sorry, I meant Cairns, leaving from Sydney on 28 August 2026
```

Characterization tests:

```text
src/features/conversation-core/__tests__/multiFactRepairExtractionAudit.phase17H.test.ts
```

This phase does **not** modify production extraction, classification, selection, or wording.

## Extraction Pipeline and Precedence

Runtime path:

```text
processConversationTurn()
→ extractConversationState() / createConversationStateExtractor().extract()
   → CompositeConversationStateExtractor
      → [0] DestinationConversationStateExtractor
      → [1] OriginConversationStateExtractor
      → [2] DepartureDateConversationStateExtractor
      → [3] ReturnDateConversationStateExtractor
      → [4] AdultCountConversationStateExtractor
      → [5] ChildCountConversationStateExtractor
      → [6] InfantCountConversationStateExtractor
      → … capability extractors …
      → EmptyConversationStateExtractor
→ applyConversationStateUpdate(currentState, extractedPatch)
→ classifyConversationStateChange(previous, final)
→ createConversationReplyPlan()
   → selectConversationReplyComponents()
   → assembleConversationReplyPlan()
→ final rendered reply
```

Verified precedence facts:

| Fact | Evidence |
| --- | --- |
| Extractor order is fixed as above | `createConversationStateExtractor.ts` |
| Every extractor receives the **full original message** | `CompositeConversationStateExtractor.extract` calls `extractor.extract(input)` with unchanged `input` |
| No extractor sees a message rewritten by another | Composite never assigns `input.message` |
| Patch assembly is shallow merge; **Later extractors win** for the same property | `accumulatedStateUpdate = { ...accumulated, ...result.stateUpdate }` |
| Polluted values originate **inside individual extractors**, not merge | Origin alone emits `Sydney on 28 August 2026` before merge |
| Classification has **no `removed` array** | `ConversationStateChangeClassification` exposes `newlyPopulated` / `updated` / `unchanged` only |
| Continuation is folded into `followUpQuestion` | `assembleConversationReplyPlan` uses `followUpQuestion ?? continuationPrompt` |

## Destination and Origin Results

Seed unless noted: `destination=Melbourne`, `origin=Adelaide`, `departureDate=null`.

| Message | Destination extractor | Origin extractor | Combined patch | Final dest / origin |
| --- | --- | --- | --- | --- |
| `Sorry, I meant Cairns, leaving from Sydney` | `{}` | `{ origin: Sydney }` | origin only | Melbourne / Sydney |
| `I meant Cairns, from Sydney` | `{ destination: Cairns }` | `{ origin: Sydney }` | both | Cairns / Sydney |
| `Actually, Cairns, departing from Sydney` | `{}` | `{ origin: Sydney }` | origin only | Melbourne / Sydney |
| `No, make that Cairns, leaving from Sydney` | `{}` | `{ origin: Sydney }` | origin only | Melbourne / Sydney |
| `Change that to Cairns, departing from Sydney` | `{}` | `{ origin: Sydney }` | origin only | Melbourne / Sydney |
| `Not Melbourne, Cairns, from Sydney` | `{ destination: Cairns }` | `{}` | destination only | Cairns / Adelaide |

Findings:

1. Destination repair cues capture greedily to end-of-message (`.+$`). Trailing `leaving from` / `departing from` clauses leave residual text such as `Cairns, leaving` after `from`-clause stripping; the comma rejection then drops destination.
2. Bare `from` after a comma works for destination because normalisation strips `\s+from\b.*$` down to `Cairns,` and trailing punctuation removal yields `Cairns`.
3. Origin often captures a clean `Sydney` via `leaving from` / `departing from` / bare `from` when no date/passenger trailer is present.
4. Contrast destination (`Not Melbourne, Cairns, …`) can succeed while origin stays empty — trailing `from Sydney` is not treated as an origin repair under the `not` block.
5. Extractor order does not cause destination/origin overwrite here; failures are empty or polluted captures from each extractor independently.

## Destination and Date Results

| Message | Destination | Departure | Combined | Notes |
| --- | --- | --- | --- | --- |
| `Sorry, I meant Cairns, leaving on 28 August 2026` | `{}` | `2026-08-28` | date only | destination missed |
| `I meant Cairns, depart on 28 August 2026` | `{}` | `2026-08-28` | date only | destination missed |
| `Actually, Cairns, departure is 28 August 2026` | `{}` | `2026-08-28` | date only | destination missed |
| `No, make that Cairns, leaving on 28 August 2026` | `{}` | `2026-08-28` | date only | destination missed |
| `Not Melbourne, Cairns, departing on 28 August 2026` | `{}` | `{}` | `{}` | contrast next rejected; departure `not`-blocked |
| `Sorry, I meant Cairns, leaving on 28 August` | `{}` | `{}` | `{}` | no-year |
| `Actually, Cairns, departing on 28 August` | `{}` | `{}` | `{}` | no-year |

With year and null prior departure: acknowledgement is `field-set` on `departureDate`; reply `Departure is set for 2026-08-28. When would you like to return?` Destination remains Melbourne.

## Origin and Date Results

| Message | Origin capture | Departure | Combined |
| --- | --- | --- | --- |
| `Sorry, I meant from Sydney, leaving on 28 August 2026` | `Sydney, leaving on 28 August 2026` | `2026-08-28` | polluted origin + date |
| `Actually, from Sydney, depart on 28 August 2026` | `Sydney, depart on 28 August 2026` | `2026-08-28` | polluted origin + date |
| `Change the origin to Sydney and departure date to 28 August 2026` | `{}` | `{}` | empty — `and` rejected in origin normaliser; no departure cue match |
| `From Sydney instead, leaving on 28 August 2026` | `Sydney` (clean via `instead` truncate) | `{}` | origin only; departure missed |

Origin pollution includes:

```text
departure phrases (leaving on / depart on / departing on)
date tokens
commas
passenger count clauses
trailing repair text after the place name
```

Origin normalisation strips `to` / `for` / `with` / `instead` / go-to clauses, but **does not** strip `on <date>`, `leaving on…`, or passenger counts.

## Three-Field Repair Results

| Message | Dest | Origin | Departure | Combined effect |
| --- | --- | --- | --- | --- |
| `Sorry, I meant Cairns, leaving from Sydney on 28 August 2026` | miss | `Sydney on 28 August 2026` | `2026-08-28` | polluted origin + date; dest unchanged |
| `Actually, Cairns, departing from Sydney on 28 August 2026` | miss | `Sydney on 28 August 2026` | miss | polluted origin only |
| `Change that to Cairns, from Sydney, departing on 28 August 2026` | miss | `Sydney, departing on 28 August 2026` | `2026-08-28` | polluted origin + date |
| `Not Melbourne, Cairns, from Sydney on 28 August 2026` | `Cairns` | miss | miss | destination only |
| `Sorry, I meant Cairns, leaving from Sydney on 28 August` | miss | `Sydney on 28 August` | miss | polluted origin only |

Primary exact reply (null prior departure):

```text
We'll depart from Sydney on 28 August 2026 instead. When would you like to return?
```

Acknowledgement event: `{ kind: 'field-changed', field: 'origin' }` — describes the polluted origin string.

## Passenger Combination Results

| Message | Dest | Origin | Passenger | Combined |
| --- | --- | --- | --- | --- |
| `Sorry, I meant Cairns, 3 adults` | miss (adults rejection) | — | `adultCount: 3` | passenger only |
| `Actually, from Sydney, 2 adults` | — | `Sydney, 2 adults` | miss (`actually` block; not whole-message Actually repair) | polluted origin only |
| `Change that to Cairns, 2 children` | miss | — | `childCount: 2` | passenger only |
| `Not Melbourne, Cairns, with 1 infant` | `Cairns` | — | miss (`not` block) | destination only |
| `Sorry, I meant from Sydney, 3 adults, leaving on 28 August 2026` | — | heavily polluted | `adultCount: 3` | polluted origin + date + adults |

Passenger repair guards do **not** block the full multi-fact patch. They either:

- extract only the passenger field (destination rejected as passenger-like), or
- leave passenger empty while origin absorbs passenger text, or
- suppress infant under a destination contrast `not` preface.

Sibling-field adult suppression (child/infant nouns in the same message) is not the dominant failure mode in these samples; greedy capture and `actually`/`not` blocks are.

## Punctuation and Conjunction Results

Comparing `I meant Cairns … Sydney` separators:

| Separator / wording | Destination | Origin |
| --- | --- | --- |
| `Cairns, from Sydney` | Cairns | Sydney |
| `Cairns from Sydney` | Cairns | Sydney |
| `Cairns and from Sydney` | miss (`and` reject) | Sydney |
| `Cairns; from Sydney` | Cairns | Sydney |
| `Cairns — from Sydney` | `Cairns —` (dash pollution) | Sydney |
| `Cairns, leaving from Sydney` | miss (comma residue) | Sydney |
| `Cairns and leaving from Sydney` | miss | Sydney |

Extractor boundaries **do** depend on punctuation:

- Comma + bare `from` is the rare dual-success shape.
- `and` rejects destination captures.
- Em-dash is not treated as a clause boundary and pollutes destination.
- `leaving from` / `departing from` after a destination repair preface typically drops destination.

## Previous-State Results

For `Sorry, I meant Cairns, leaving from Sydney on 28 August 2026`:

| Prior state | Patch | Classification | Event |
| --- | --- | --- | --- |
| All populated (incl. prior departure) | polluted origin + new date | `updated: [origin, departureDate]` | field-changed origin |
| All null trip fields | polluted origin + date | `newlyPopulated: [origin, departureDate]` | field-set origin |
| Only destination exists | same patch | newlyPopulated origin+date | field-set origin |
| Only origin exists | same patch | updated origin + newlyPopulated date | field-changed origin |
| Equal clean dual (`I meant Cairns, from Sydney` with both already Cairns/Sydney) | `{ destination: Cairns, origin: Sydney }` | empty updated/newlyPopulated | null event / neutral-style follow-up |
| Prior origin already `Sydney` but repair emits `Sydney on 28 August 2026` | polluted origin + date | `updated: [origin]` (string differs) | field-changed origin |

Classification correctly distinguishes field-set / field-changed / unchanged **on whatever values extraction emits**. It cannot repair polluted strings.

## Verified Facts

1. Single-field repairs from Phases 17B–17G still work when the message contains one owned field cue.
2. Some multi-fact shapes already dual-extract cleanly: notably `I meant Cairns, from Sydney` and `I meant Cairns from Sydney`.
3. The primary three-field apology form still misses destination, pollutes origin with the date trailer, and may set departure when a year is present.
4. Extractors are independent full-message matchers; composite merge does not rewrite values.
5. No-year day-month phrases fail in the departure-date parser itself (`\d{4}` required), with or without multi-fact wrappers.
6. Acknowledgement/selection layers faithfully describe polluted origin values.
7. Passenger fields may succeed alone in multi-fact messages while destination is rejected, or be suppressed by `actually`/`not` while origin absorbs their text.

## Observed Failures

1. **Destination miss** on repair + `leaving/departing from` / date / passenger trailers.
2. **Origin pollution** absorbing dates, departure phrases, commas, and passenger clauses.
3. **Departure miss** without year; also when `actually`/`not`/conjunction forms do not match departure cues.
4. **Contrast + extra clause** often keeps only destination or nothing.
5. **Conjunction forms** such as `Change the origin to Sydney and departure date to …` extract nothing.
6. **Dash-separated** destination pollution (`Cairns —`).
7. Downstream replies acknowledge polluted origins (e.g. `We'll depart from Sydney on 28 August 2026 instead.`).

## Root-Cause Evidence

| Mechanism | Where | Effect |
| --- | --- | --- |
| Greedy repair capture `.+$` | Destination / Origin repair cues | Trailing clauses enter the capture |
| Incomplete clause stripping | `normaliseCapturedDestination` / `normaliseCapturedOrigin` | Destination keeps `Cairns, leaving`; origin keeps `Sydney on 28 August 2026` |
| Comma / `and` / passenger rejection | Destination repair guards | Multi-clause destination captures discarded entirely |
| Origin lacks date/departure trailer stripping | `normaliseCapturedOrigin` | Date and leaving-clauses remain in origin |
| Departure date token requires year | `DepartureDateConversationStateExtractor` date regex | No-year phrases never resolve |
| Hard `not` / `actually` blocks | Departure / passenger extractors | Extra-clause contrast and Actually multi-fact forms suppressed |
| No multi-fact segmentation layer | Composite / extractors | Each field reparses the whole utterance independently |

Defects originate in **individual extractors' capture and normalisation**, not in patch assembly, classification, or reply selection.

## Defect Ownership

| Layer | Owns defect? |
| --- | --- |
| Destination extractor capture/normalise | Yes — misses or pollutes on trailing clauses |
| Origin extractor capture/normalise | Yes — absorbs date/departure/passenger trailers |
| Departure-date extractor / date resolution | Yes — year required; some multi-fact prefaces block |
| Passenger extractors | Partial — interact via rejection/`actually`/`not`, not multi-fact ownership |
| Composite patch assembly | No — faithful later-wins merge of emitted patches |
| Classification | No — correctly classifies emitted values |
| Acknowledgement / reply selection / renderer | No — correctly describe polluted state |

## Blast Radius

A multi-fact fix will touch at least:

```text
DestinationConversationStateExtractor capture boundaries
OriginConversationStateExtractor capture boundaries
possibly DepartureDateConversationStateExtractor preface coexistence
characterization suites 17A / 17H
any e2e expectations that currently assert polluted origin acknowledgements
```

It must **not** regress:

```text
single-field destination / origin / date / passenger repairs (17B–17G)
bare-place destination ownership
explicit from-cue origin ownership
bare-date unowned rule
passenger whole-message Actually / contrast families
zero/removal passenger inertness
```

## Safe Fix Boundary

Safe for a follow-on phase:

1. Narrow clause-boundary trimming on destination and origin repair captures so trailing `leaving/departing/from/on <date>` / passenger clauses are not retained.
2. Optionally allow destination repair captures to stop before a recognised origin/date clause delimiter.
3. Keep extractors message-local and independent — do not add transcript/history inference.
4. Do not broaden zero/removal, multi-passenger parsing, or general NLU segmentation.

Unsafe / out of scope for a narrow fix:

1. Rewriting classification or acknowledgement wording to paper over polluted state.
2. Changing extractor order or later-wins merge semantics as a substitute for capture fixes.
3. Full free-text multi-intent parsing.

## Recommended Phase 17I

Phase 17I should introduce a **narrow shared clause-boundary helper** used by destination and origin repair normalisation (and only as needed by departure coexistence), rather than fixing a single field in isolation.

Recommended 17I goal:

```text
Sorry, I meant Cairns, leaving from Sydney on 28 August 2026
→
{
  destination: "Cairns",
  origin: "Sydney",
  departureDate: "2026-08-28"
}
```

Implementation shape:

1. Shared private helper that truncates a place capture before recognised sibling clauses (`leaving from`, `departing from`, `from`, `leaving on`, `depart on`, `on <date>`, passenger count phrases) without changing non-repair cues broadly.
2. Apply at destination and origin repair normalisation boundaries first.
3. Preserve existing single-field repair families and punctuation successes (`Cairns, from Sydney`).
4. Leave no-year date resolution policy unchanged unless explicitly scoped — year requirement is a date-parser rule, not a multi-fact segmentation bug.
5. Keep passenger multi-fact combinations characterization-only unless the clause helper naturally prevents origin pollution by passenger trailers.

A single-field-only origin trim would improve pollution but would still leave destination misses on the primary apology form; therefore **shared clause-boundary segmentation at capture time** is the safer 17I boundary.
