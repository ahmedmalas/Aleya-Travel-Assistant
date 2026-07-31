# Conversation Style Interface

Phase 13B design for separating **conversational style** from **deterministic conversational intent**.

Companion to [`travel-consultant-layer.md`](./travel-consultant-layer.md). This document defines the style interface only. It does **not** implement AI, prompts, LLM calls, or production behaviour changes.

## Status

| Item | Value |
| --- | --- |
| Phase | 13B — interface design only |
| Production code | Unchanged |
| Authoritative contract | `ConversationReplyPlan` from the deterministic engine |
| Style layer I/O | structured intent in → conversational wording out |

## Interface summary

```text
ConversationReplyPlan  (structured intent — immutable control)
        ↓
Conversation style interface / profile
        ↓
Assistant wording string  (presentation only)
```

Hard rules:

1. The conversational layer **receives only structured intent** (`ConversationReplyPlan`, plus optional read-only context).
2. The conversational layer **returns only conversational wording** (a single assistant text string for the turn).
3. The deterministic engine **never consumes free-form conversational text** to decide state, priority, eligibility, objective, or approvals.
4. Style variation **cannot alter** required objective, priority, eligibility, authoritative state, or approval requirements.

## Authoritative conversational contract

### `ConversationReplyPlan`

Current shape (from `assembleConversationReplyPlan.ts`):

```ts
type ConversationReplyPlan = {
  acknowledgements: readonly string[];
  followUpQuestion: string | null;
  messageInterpreted: boolean;
};
```

| Field | Role in the style interface |
| --- | --- |
| `acknowledgements` | Zero or one acknowledgement intent selected by the engine (catalogue string today) |
| `followUpQuestion` | Sole required conversational objective for the turn (specific follow-up **or** neutral continuation after assembly) |
| `messageInterpreted` | Engine signalling flag; may influence tone, never invents an objective |

Catalogue baseline strings in `CONVERSATION_REPLY_CATALOGUE` are the deterministic semantic markers for each intent. Style profiles may rephrase them; they must not replace them with a different intent.

## Immutable plan fields (control surface)

The following are **immutable for style purposes**. A style profile may read them; it must not change their control meaning:

| Immutable concern | How it appears in the plan |
| --- | --- |
| Whether an acknowledgement is required | `acknowledgements.length` is 0 or 1; style must not invent an acknowledgement when empty, nor drop a required acknowledgement’s factual content when present |
| Acknowledgement fact class | The selected acknowledgement intent (e.g. destination set, flights added, count removed) |
| Required objective identity | The semantic objective encoded by `followUpQuestion` (destination / origin / dates / counts / activities / restaurants / neutral continuation) |
| Single-prompt invariant | At most one question/objective per turn |
| Interpreted-turn signalling | `messageInterpreted` boolean from the engine |
| Absence of side-effect approval | Plan never grants booking/tool approval; style cannot invent it |

Practical test: if two style outputs preserve the same acknowledgement fact class, the same objective identity, and the same `messageInterpreted` meaning, they are valid variants of one plan.

## What a conversational layer may vary

Allowed presentation variation:

- tone (warm, concise, premium, formal)
- phrasing and synonym choice
- light empathy / courtesy
- connective tissue between acknowledgement and objective (“Thanks — noted. …”)
- brief explanation that restates the same objective
- repair wording that asks the **same** unresolved objective more clearly
- locale/spelling within brand policy (e.g. Australian English)

Not variation — these are control violations:

- asking a different missing field
- asking two questions
- inventing trip facts not present in the plan/state
- omitting a required objective
- treating style output as a state update

## Rephrasing acknowledgements

**Input:** `plan.acknowledgements` (0..1 strings; catalogue-owned today).

**Allowed:**

- restate the same fact in natural consultant language
- soften or warm the phrasing
- keep factual anchors (destination name, date, capability list, removal event)

**Forbidden:**

- acknowledging a different field or capability than selected
- inventing values (“Sydney” when the plan acknowledged Brisbane)
- converting acknowledgement into a question
- adding an acknowledgement when `acknowledgements` is empty

### Examples

Deterministic acknowledgement intent: destination set to Brisbane (`Great — Brisbane.`).

Possible style outputs:

- `Great — Brisbane.`
- `Brisbane sounds wonderful.`
- `Perfect — Brisbane is locked in.`

All preserve the same acknowledgement intent. None change the follow-up objective.

Deterministic acknowledgement intent: flights enabled (`I've added flights to your trip requirements.`).

Possible style outputs:

- `I've added flights to your trip requirements.`
- `Flights are on your list now.`
- `Noted — I'll include flights for this trip.`

## Rephrasing follow-up questions

**Input:** `plan.followUpQuestion` when it encodes a **specific** required field/service question.

**Allowed:**

- alternate phrasings of the **same** missing requirement
- slight contextual grounding from read-only state (e.g. using a known destination name in a clause) without changing which field is asked
- keeping exactly one question mark / one ask

**Forbidden:**

- switching to another follow-up in the priority list
- combining origin + dates (or any multi-ask)
- answering the question in the assistant turn
- skipping the ask because style “assumes” the user already said it

### Example mapping — collect origin

Deterministic objective: **collect origin**  
Catalogue baseline: `Where will you be travelling from?`

Possible conversational outputs (same underlying objective):

- `Where will you be travelling from?`
- `Where are you flying out of?`
- `Which city will you be departing from?`

### Example mapping — collect destination

Deterministic objective: **collect destination**  
Catalogue baseline: `Where would you like to travel?`

Possible conversational outputs:

- `Where would you like to travel?`
- `Which destination are you thinking about?`
- `Where shall we plan for you to go?`

### Example mapping — collect departure date

Deterministic objective: **collect departureDate**  
Catalogue baseline: `When would you like to depart?`

Possible conversational outputs:

- `When would you like to depart?`
- `What departure date works for you?`
- `When are you hoping to leave?`

### Example mapping — collect flights adult count

Deterministic objective: **collect adultCount for flights**  
Catalogue baseline: `How many adults will be travelling?`

Possible conversational outputs:

- `How many adults will be travelling?`
- `How many adults should I plan flights for?`
- `What’s the adult passenger count?`

## Rephrasing neutral continuation

**Input:** `plan.followUpQuestion` when it is the assembled **neutral continuation** (catalogue: `What else should I know about your trip?`).

**Allowed:**

- open-ended invitational phrasing
- soft consultant check-ins that request no specific field

**Forbidden:**

- turning continuation into a specific missing-field question (destination, dates, counts, etc.)
- implying a required next data field
- stacking a specific follow-up after continuation

### Examples

Deterministic objective: **neutral continuation**

Possible conversational outputs:

- `What else should I know about your trip?`
- `Is there anything else you’d like me to factor in?`
- `Happy to keep shaping the trip — what else matters to you?`

All remain open-ended; none select a new engine objective.

## Adding explanations without changing intent

Explanations are optional clauses that clarify **why** the assistant is asking or acknowledging, without changing the ask.

**Allowed:**

- one short reason tied to the current objective  
  e.g. origin ask → “So I can look at the right departure options — where will you be travelling from?”
- clarifying scope already implied by the objective  
  e.g. adult-count ask → “For flight seats — how many adults will be travelling?”

**Forbidden:**

- explanations that smuggle a second question
- explanations that assert unknown facts
- explanations that promise tool/booking actions without approval

Pattern:

```text
[optional acknowledgement rephrase]
[optional one-sentence explanation]
[exactly one objective rephrase]
```

## Conversational repairs without changing state

Repair means the user did not satisfy the **same** outstanding objective; the style layer asks again more clearly.

**Allowed:**

- rephrase the identical objective with more guidance
- briefly note that the previous answer was unclear **without** writing state
- keep waiting for the engine’s next turn to interpret the user’s new message

**Forbidden:**

- “repairing” by asking a different field
- writing corrected values into state from the style layer
- claiming the field is collected when the engine still marks it missing

Repair is presentation-only. State changes happen only on the next engine turn via extraction / `stateUpdate`.

## Multiple style profiles, one deterministic engine

Style profiles are interchangeable presenters over the same plan contract:

```text
                    ┌─ profile: catalogue-literal (today’s renderer)
ConversationReplyPlan ─├─ profile: warm consultant
                    ├─ profile: concise
                    └─ profile: formal
                         ↓
                 assistant wording
```

| Profile concern | Shared across profiles |
| --- | --- |
| Objective identity | Yes — from `followUpQuestion` |
| Acknowledgement fact class | Yes — from `acknowledgements` |
| Priority / eligibility | Engine-only; profiles never recompute |
| Authoritative state | Engine-only |
| Approval requirements | Engine/product policy only |
| Wording / tone | Profile-specific |

Requirements for any profile:

1. Pure function: `(plan, readOnlyContext?, profileId) → string`
2. Deterministic engine remains the only producer of `ConversationReplyPlan`
3. Engine never reads profile output to decide the next plan
4. Regression oracles may still assert catalogue baseline intent via Phase 11–12 characterisation tests

## Direction of data flow (engine never consumes style text)

```text
User message
  → Deterministic engine (state, classify, select, assemble)
  → ConversationReplyPlan
  → Style interface (wording only)
  → Assistant text (transcript / UI)

Next user message
  → Deterministic engine again
  (style text from prior turn is not a control input)
```

The engine may record assistant text in the transcript for display/history. Transcript wording is **not** authoritative for travel fields, priority, eligibility, or approvals.

## Style variation cannot alter control

| Control surface | Style may change? |
| --- | --- |
| Required objective | No |
| Follow-up priority | No |
| Eligibility / suppression | No |
| Authoritative `ConversationCoreState` | No |
| Approval requirements / tool permission | No |
| Catalogue baseline used as intent marker | Rephrase only; do not replace intent |
| Number of prompts in the turn | No — maximum one |

## Non-goals for Phase 13B

- No production code changes
- No AI / LLM / prompt implementation
- No changes to reply-plan structure, selectors, or catalogue wording
- No change to deterministic behaviour

## Related documents

- [`travel-consultant-layer.md`](./travel-consultant-layer.md) — ownership, tool gateway, approvals, logging
- Phase 11–12 characterisation tests — locked deterministic intent and catalogue baselines
