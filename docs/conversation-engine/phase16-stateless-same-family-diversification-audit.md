# Phase 16G — Stateless Same-Family Diversification Audit

Investigation and characterization only. Production wording is unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phases 16D–16F opener refinements are preserved exactly.
No live environment has been changed.
```

## Accepted baseline

| Check | Value |
| --- | --- |
| HEAD | `c32005f922d74b3c370abe6e5ae67df533b91eb3` |
| Branch | `cursor/conversation-progression-8697` |
| Prior commit | Phase 16F: distinguish infant acknowledgement opener |
| PR #29 | OPEN, Draft, Unmerged, Undeployed |
| Working tree at audit start | clean |
| Production bundle | `conversation-core-DtRaANhV.js` / `a01df1ba…` / 114517 bytes (unchanged) |

## Objective

Phase 16E showed that consecutive same-family acknowledgements are **technically** distinguishable because their deterministic strings differ when values differ (Class A). Phase 16G asks whether that distinction provides a **legitimate semantic basis** for different openers—or would only enable arbitrary phrase rotation keyed on literal values.

## Production path

```text
processConversationTurn()
→ acknowledgement selection + reply-plan assembly
→ transformBaselineAcknowledgement(currentAcknowledgementString)
→ 15C / 16B rendering
```

`transformBaselineAcknowledgement` receives **only** the current acknowledgement string.

## Journeys audited

| Family | Consecutive values |
| --- | --- |
| destination | Melbourne → Cairns → Hobart |
| origin | Sydney → Brisbane → Adelaide |
| departure date | three distinct dates |
| return date | three distinct dates |
| adult count | 1 → 2 → 4 |
| child count | 1 → 2 → 3 |
| infant count | 1 → 2 → 3 |

Plus preservation of Phase 16D mixed-field and Phase 16F adult→child→infant sequences.

## Current same-family repetition measurements

| Family | Opener across consecutive value changes | Complete acks differ? |
| --- | --- | --- |
| destination | `Great,` × N | yes (place name) |
| origin | `We'll start` × N | yes (city) |
| departure date | `Departure is set` × N | yes (date) |
| return date | `Return is set` × N | yes (date) |
| adult count | `Travelling with` × N | yes (count / singular-plural) |
| child count | `I've noted` × N | yes |
| infant count | `That includes` × N | yes |

Longest consecutive identical-opener run within a family: **3** (when three consecutive same-family updates are exercised).

## Available-input findings

For every family, the transform sees:

```text
deterministic acknowledgement string only
```

It does **not** receive:

```text
previous acknowledgement / previous reply
turn number / first-occurrence flag
set-versus-changed classification
trip state / conversation history
```

### Semantic event vs string content

| Question | Finding |
| --- | --- |
| Does the string identify **initial set** vs **later change**? | **No.** Catalogue templates are identical for first set and later change (e.g. `Great — Cairns.` for both). |
| Does the string identify **first occurrence** vs **repeated update**? | **No.** No occurrence counter or “again” marker exists. |
| Does the string identify **correction** vs **preference change** vs **confirmation**? | **No.** Those events are not encoded; only the resulting field value appears. |
| Does a different interior value alone justify a different opener? | **No.** Value differences are payload content (place, date, count), not conversational-event labels. Choosing openers from them would be arbitrary rotation. |

Example (destination):

```text
turn 1 (initial set):   Great — Melbourne.  → Great, Melbourne it is.  opener Great,
turn 2 (change):        Great — Cairns.     → Great, Cairns it is.     opener Great,
turn 3 (change):        Great — Hobart.     → Great, Hobart it is.     opener Great,
```

Strings differ; openers match; **no set/change marker** is present.

## Candidate-rule classifications

| # | Strategy | Classification | Rationale |
| --- | --- | --- | --- |
| 1 | Different wording by acknowledgement family | **ALREADY_IMPLEMENTED** | Phases 16D / 16F already diversify cross-family openers |
| 2 | Different wording by singular versus plural | **ALREADY_IMPLEMENTED** (interior) / **ARBITRARY_STATELESS** (opener) | Singular/plural already changes the noun form inside the sentence; assigning different *openers* solely for 1 vs 2+ would not mark a conversational event |
| 3 | Different wording by literal value | **ARBITRARY_STATELESS** | Keys tone on payload text (names/counts), not discourse role |
| 4 | Different wording by date format or date value | **ARBITRARY_STATELESS** | Same as (3) for dates |
| 5 | Different wording by destination or origin name | **ARBITRARY_STATELESS** | Same as (3) for places |
| 6 | Hashing / deterministic selection from acknowledgement text | **ARBITRARY_STATELESS** | Guarantees variety without semantic grounding; still value-keyed rotation |
| 7 | Phrase catalogues / rotation without history | **ARBITRARY_STATELESS** | Without an event signal, rotation is stylistic only |
| 8 | Additional deterministic classification metadata (set vs changed) | **REQUIRES_NEW_SEMANTIC_INPUT** | Would need selector/classification to expose a principled event flag to rendering |
| 9 | Previous-reply or recent-opener history | **REQUIRES_HISTORY** | Needed to avoid repeating an opener when the event type is the same and no new metadata exists |

No strategy using **only current acknowledgement-string inputs** qualifies as **SAFE_STATELESS** for same-family opener diversification.

## Set-versus-change signal finding

```text
Current acknowledgement strings do NOT encode set versus changed.
```

Classification already knows field transitions, but that signal is **not** passed into `transformBaselineAcknowledgement`. Therefore:

- Technical string inequality (Class A from Phase 16E) ≠ semantic event inequality
- A principled “first set” vs “later correction” opener split cannot be implemented from current transform inputs alone

## Recommended decision boundary

```text
B. Current inputs can distinguish strings technically, but cannot distinguish
   conversational events semantically; any same-family opener diversification
   using only the current acknowledgement string would be arbitrary phrase rotation.
```

Supporting architecture options (not recommended as Phase 16H expression-only work without an explicit product decision):

```text
C. If product wants principled “initial set” vs “later change” wording,
   add deterministic metadata (or catalogue variants) identifying that event,
   then refine expression from that signal.

D. If product wants anti-repetition when the event type is unchanged,
   previous-reply / recent-opener history is required.
```

```text
A. is NOT available with current inputs for same-family opener diversification.
```

## Answers to the architectural questions

| Question | Answer |
| --- | --- |
| Does any safe current-input same-family opener implementation exist? | **No** — only arbitrary value-keyed rotation |
| Would new deterministic metadata help? | **Yes** — set-versus-changed (or equivalent event labels) would enable Class C → principled expression |
| Is history required for anti-repetition without new metadata? | **Yes** — Class D |

## Production-preservation proof

Phase 16G modified **no** production files.

Unchanged:

```text
trip state / extraction / classification
acknowledgement / follow-up / continuation selection
reply-plan assembly
conversational transformation (16D/16F map intact)
branch order / integration mode / fallback
```

Bundle identity retained:

```text
conversation-core-DtRaANhV.js
SHA-256 a01df1ba557609113ba8315b7dbe8902cc5191e853d33377f6ca82efa5cea18f
raw 114517 bytes / parsed 114.51 kB / gzip 19.91 kB
```

## Characterization tests

```text
src/features/conversation-core/__tests__/statelessSameFamilyDiversification.phase16G.test.ts
```

Locks observed production facts without encoding a proposed diversification implementation.
