# Travel Consultant Layer Architecture

Phase 13A design boundary for a future conversational Travel Consultant layer that sits **above** the deterministic conversation engine in `src/features/conversation-core/`.

This document characterises ownership, data exchange, allowed freedoms, and forbidden behaviours. It does **not** implement AI, prompts, tools, or production behaviour changes.

## Status

| Item | Value |
| --- | --- |
| Phase | 13A — architecture design only |
| Production code | Unchanged |
| Current reply path | Deterministic engine only (`processConversationTurn` → extraction/stateUpdate → `generateConversationReply`) |
| Future layer | Optional presentation/dialogue layer consuming a structured reply plan |

## Layering overview

```text
User message
    ↓
Deterministic conversation engine
  • extract / apply stateUpdate
  • classify state change
  • select reply components
  • assemble ConversationReplyPlan
  • (today) render catalogue wording
    ↓
Structured ConversationReplyPlan   ← sole conversational control input
    ↓
Travel Consultant conversational layer (future)
  • tone, phrasing, empathy, repair, explanation
  • never owns state, priority, or eligibility
    ↓
User-facing assistant text
```

Today, `renderConversationReplyPlan` emits catalogue strings directly. The future conversational layer may replace **only** that presentation step, using the same structured plan as its contract.

## Responsibilities of the deterministic engine

The engine in `src/features/conversation-core/` remains the sole authority for conversational control.

It owns:

| Concern | Mechanism (current) |
| --- | --- |
| Authoritative travel state | `ConversationCoreState` via extraction + explicit `stateUpdate` precedence |
| State transitions | `processConversationTurn`, `applyConversationStateUpdate`, extractors |
| Change classification | `classifyConversationStateChange` |
| Acknowledgement eligibility and selection | `selectConversationAcknowledgement` + catalogue templates |
| Follow-up priority and eligibility | `selectConversationFollowUpQuestion` |
| Continuation eligibility | `selectConversationContinuationPrompt` |
| Message-interpreted signalling | `selectConversationMessageInterpreted` |
| Required conversational objective | Assembled `ConversationReplyPlan.followUpQuestion` (one prompt max) |
| Deterministic catalogue wording | `CONVERSATION_REPLY_CATALOGUE` (baseline / fallback phrasing) |
| Structured plan assembly | `selectConversationReplyComponents` → `assembleConversationReplyPlan` |

It must continue to guarantee:

- conversation state is the sole source of conversational truth
- identical authoritative state yields an identical structured reply plan
- at most one user-facing prompt objective per turn
- acknowledgement, follow-up/continuation, and `messageInterpreted` remain separate structured concerns
- no reply-generation stage mutates authoritative state

## Responsibilities of the conversational layer

The future Travel Consultant layer owns **how** the turn is spoken, not **what** the turn must accomplish.

It owns:

- tone and formality appropriate to a premium travel consultant
- phrasing and natural dialogue variation
- empathy and conversational warmth
- brief explanations that clarify the objective without changing it
- conversation repair (rephrasing a missed or unclear prior ask)
- optional soft connective language between acknowledgement and objective

It does **not** own:

- travel state fields or their values
- transition rules
- follow-up priority order
- eligibility / suppression rules
- whether an acknowledgement or follow-up is required
- which objective is next

## Data exchanged between the two layers

### Engine → conversational layer (required input)

The conversational layer receives **only** a structured reply plan (and, optionally, read-only context that cannot override the plan).

Current plan shape (`ConversationReplyPlan`):

```ts
{
  acknowledgements: readonly string[]; // 0..1 catalogue acknowledgement strings today
  followUpQuestion: string | null;     // exactly one objective/continuation string when present
  messageInterpreted: boolean;         // signalling flag; not a prompt
}
```

Derived control semantics the conversational layer must honour:

| Plan field | Meaning for the conversational layer |
| --- | --- |
| `acknowledgements` | Facts/events that may be acknowledged; may be rephrased, not contradicted or expanded with invented facts |
| `followUpQuestion` | The sole required conversational objective for this turn (specific follow-up or neutral continuation) |
| `messageInterpreted` | Whether the engine treated the turn as an interpreted travel-field change; presentation may adapt, but must not invent interpretation |

Optional **read-only** context (future, non-authoritative):

- snapshot of final `ConversationCoreState` for grounding phrasing (destination name already present, etc.)
- turn metadata / trace ids for logging
- locale or brand voice profile

Read-only context must never be used to recalculate priority, eligibility, or invent missing requirements.

### Conversational layer → engine

None for control. The layer does not write state.

User answers return to the engine on the **next** turn through the existing pipeline (message → extraction / explicit `stateUpdate` → new plan). The conversational layer is not a state writer.

### Engine → user (current path)

Until the conversational layer is introduced, `generateConversationReply` / `renderConversationReplyPlan` continue to emit catalogue-owned deterministic text from the plan.

## Structured reply plan as the only conversational input

Hard rule:

> The Travel Consultant layer’s sole authoritative conversational input is the structured `ConversationReplyPlan` produced by the deterministic engine for that turn.

Consequences:

- The layer must not re-run follow-up selection, continuation selection, or acknowledgement selection.
- The layer must not inspect raw message text to decide the next objective.
- The layer must not invent a second question alongside `followUpQuestion`.
- If `followUpQuestion` is a specific requirement, the layer must not substitute neutral continuation (or vice versa).
- Catalogue strings in the plan are the semantic objective markers; the layer may rephrase them but must preserve intent and singularity.

## Allowed conversational freedoms

Given a frozen plan, the layer may:

- rephrase acknowledgement wording while preserving factual content already selected by the engine
- rephrase the single follow-up / continuation objective in natural consultant language
- add brief empathy or courtesy that does not ask a new question
- add a short clarifying clause that restates the same objective
- vary style across turns without changing which objective is active
- perform conversation repair by restating the **same** unresolved objective more clearly
- remain silent on optional colour when the plan has no acknowledgement

All freedoms remain bounded by: one objective, no invented facts, no state writes.

## Forbidden behaviours

The conversational layer must never:

| Forbidden | Reason |
| --- | --- |
| Mutate `ConversationCoreState` directly | Engine owns authoritative state |
| Call extractors or apply `stateUpdate` | State transitions stay in `processConversationTurn` |
| Recalculate eligibility or suppression | Engine owns eligibility |
| Change follow-up priority order | Engine owns priority |
| Replace the selected objective with a different one | Plan is authoritative |
| Emit multiple questions / prompts in one turn | Single-prompt invariant |
| Invent missing destinations, dates, counts, or preferences | No hallucinated trip facts |
| Treat catalogue absence as permission to invent requirements | Missing data is engine-owned |
| Bypass approval boundaries for side effects | Future approvals stay outside free-form dialogue |
| Call external tools, providers, or booking APIs directly | Tool gateway only |
| Perform recommendations, live pricing, or inventory claims | Out of conversational-layer scope |
| Persist memory that overrides structured state | State remains sole truth |
| Disable or ignore `messageInterpreted` signalling semantics | Signalling is engine-owned |

## Authoritative ownership of state

```text
Authoritative travel truth
  = ConversationCoreState after extraction + explicit stateUpdate precedence

Conversational presentation
  = optional rephrasing of ConversationReplyPlan
```

Rules:

1. Only the deterministic engine updates authoritative state.
2. The conversational layer is a pure function of the plan (+ optional read-only context) → assistant text.
3. Disputes between fluent dialogue and structured state are resolved in favour of structured state.
4. Transcript text is observational; it is not a second source of truth for travel fields.

## Future tool gateway integration point

External capabilities (search, deals, itinerary helpers, provider adapters) must enter through a **tool gateway**, not from free-form conversational output.

Proposed boundary:

```text
Deterministic engine
  → ConversationReplyPlan
       → Travel Consultant layer (phrasing only)
       → (optional) Tool gateway request proposals
            → Approval boundary
            → Tool execution
            → Structured results back to engine/state adapters
```

Constraints:

- The conversational layer may **describe** that help is available; it must not invoke tools itself.
- Tool proposals are structured intents (e.g. “search flights for known origin/destination/dates”), never opaque model-chosen side effects.
- Tool results update product/domain state through existing adapters; conversation-core still classifies and plans the next objective from authoritative state.
- No tool call may invent live prices, partnerships, or bookings (aligned with `docs/future-ai-roadmap.md` guardrails).

## Future approval boundaries

Side-effecting actions require an explicit approval boundary **outside** the conversational layer:

| Action class | Approval expectation |
| --- | --- |
| Read-only explanation of current plan/state | None beyond ordinary turn processing |
| External search / provider queries | User or product-policy approval as configured |
| Booking, payment, or itinerary mutation | Explicit user confirmation; never implicit from dialogue tone |
| Sharing / export of personal trip data | Explicit user confirmation |

The conversational layer may ask for confirmation in natural language only when the structured plan/objective (or a separate approved workflow) requires it. It must not treat fluent assent in free text as silent approval for booking or payment.

## Future logging boundary

Logging should preserve auditability without coupling the layer to control logic.

Recommended event surfaces:

| Stage | Log |
| --- | --- |
| Engine | Turn id, classification summary, assembled plan (acknowledgement present?, objective key/text, `messageInterpreted`) |
| Conversational layer | Plan fingerprint/hash, model/voice profile id (if any), rendered text hash; no alternate objective |
| Tool gateway | Proposal id, tool name, approval decision, result status |
| Approvals | Actor, action class, decision, timestamp |

Rules:

- Logs must show that the rendered objective matches the plan objective (semantic equivalence), not a replaced priority.
- The layer must not log secrets, raw credentials, or full payment details.
- Deterministic engine logs remain sufficient to reproduce the plan without the conversational layer.

## Stable contract for future implementation

When implementation begins (later phases), it should:

1. Keep `processConversationTurn` and plan assembly unchanged as the control path.
2. Introduce the conversational layer as a replaceable presenter: `(ConversationReplyPlan, readOnlyContext?) → string`.
3. Preserve catalogue wording as the deterministic baseline and regression oracle (Phase 11–12 characterisation tests).
4. Add characterisation tests that the layer cannot change objective identity for representative plans.
5. Integrate tools only via gateway + approval, never from the presenter.

## Non-goals for Phase 13A

- No AI / LLM / prompt implementation
- No tool wiring
- No persona or memory systems
- No changes to selectors, catalogue, assembly, or rendering
- No production behaviour change

## Related characterisation

Phase 11–12 characterisation tests lock the deterministic engine’s acknowledgement, follow-up priority, catalogue ownership, single-prompt, and human-conversation readiness boundaries that this layer must respect.
