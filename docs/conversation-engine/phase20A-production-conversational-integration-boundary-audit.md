# Phase 20A — Production conversational integration boundary audit

Audit and characterization only. Production behaviour intentionally unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 19L baseline preserved exactly.
No live environment has been changed by this audit phase.
No production wiring was added in Phase 20A.
```

Characterization tests:

```text
src/features/conversation-core/__tests__/productionConversationalIntegrationBoundary.phase20A.test.ts
```

---

## 1. Current production path (verified)

```text
user message
→ processConversationTurn (processTurn.ts)
→ transitionConversationStateFromExtraction
    → extractConversationState (composite extractor registry)
    → applyConversationStateUpdate (extracted patch)
→ applyConversationStateUpdate (trusted explicit stateUpdate wins)
→ provisionalState (travel fields + turn metadata; transcript still pre-turn)
→ generateIntegratedConversationReply
    → generateConversationReply          [reply-generation boundary]
        → classifyConversationStateChange(previousState, state)
        → createConversationReplyPlan
            → selectConversationReplyComponents
                → acknowledgement / follow-up / continuation / interpreted
            → assembleConversationReplyPlan
        → renderIntegratedConversationReplyPlan({ plan })
            → renderConversationReplyPlanByIntegrationMode
                mode = 'baseline-conversational'   ← Phase 14N activation
                → generateBaselineConversationalReply(plan)
                    → renderBaselineConversationalReplyPlan
                        → buildConversationalLayerInput(plan)
                        → executeBaselineConversationalRenderer
                            → renderBaselineConversationalLayer
                catch → renderConversationReplyPlan(plan)  ← deterministic fallback
→ assistant transcript entry records reply string
→ final state returned (transcript appended)
```

### Exact production function currently responsible for final reply rendering

| Layer | Function | Role |
| --- | --- | --- |
| Turn entry | `processConversationTurn` | Orchestrates extract → state → reply → transcript |
| Integration seam (turn) | `generateIntegratedConversationReply` | Always delegates to `generateConversationReply` (`mode = 'deterministic'` label only) |
| Reply boundary | `generateConversationReply` | Classification + plan assembly + render seam call |
| **Expression seam (plan)** | **`renderIntegratedConversationReplyPlan`** | **Selects `'baseline-conversational'`** |
| Mode switch | `renderConversationReplyPlanByIntegrationMode` | Dispatches baseline vs deterministic |
| Baseline wording | `generateBaselineConversationalReply` | Returns `output.wording` |
| Deterministic renderer (fallback / ineligible shapes) | `renderConversationReplyPlan` | Join ack + follow-up / neutral |

**Finding:** final production wording is already produced by the baseline conversational expression path (Phase 14N/14O), not by a separate unreleased experimental stack.

---

## 2. Conversational path (completed layer)

```text
assembled ConversationReplyPlan
→ buildConversationalLayerInput(plan[, styleProfile])
    → selectConversationalObjective(plan)
    → createConversationalLayerInput(plan, objective, styleProfile)
→ executeBaselineConversationalRenderer(input)
    → createBaselineConversationalRendererRegistry()
    → executeConversationalLayerRenderer(registry, 'baseline', input)
        → invokeConversationalLayerRenderer(renderer, input)
            → renderBaselineConversationalLayer(input)
→ ConversationalLayerOutput.wording
```

Convenience entry used by production mode switch:

```text
generateBaselineConversationalReply(plan)
→ renderBaselineConversationalReplyPlan(plan).wording
```

Lower-level helpers (`invokeConversationalLayerRenderer`, registry factories, style profiles) are **not** imported by `processTurn.ts` or `generateConversationReply.ts`. They are reached only through the baseline convenience entry selected by the plan-mode renderer.

---

## 3. Recommended integration seam

**Primary seam (already live):**

```text
generateConversationReply
→ createConversationReplyPlan(...)
→ renderIntegratedConversationReplyPlan({ plan })
```

This is the smallest safe boundary:

- Plan assembly (ack / follow-up / interpreted / acknowledgementEvent) remains deterministic and authoritative.
- Expression is a pure `ConversationReplyPlan → string` transform.
- State mutation is complete before this call (`provisionalState` is already final travel state).
- Rendering does not write conversation state.

**Secondary / fallback seam (must remain):**

```text
renderConversationReplyPlanByIntegrationMode
  case 'baseline-conversational': try baseline; catch → renderConversationReplyPlan
  case 'deterministic': renderConversationReplyPlan
```

---

## 4. Required findings

### 4.1 Exact function that should invoke the conversational expression layer

`renderConversationReplyPlanByIntegrationMode` when `mode === 'baseline-conversational'`, selected exclusively by `renderIntegratedConversationReplyPlan`.

`processConversationTurn` and `generateIntegratedConversationReply` must **not** call baseline helpers directly.

### 4.2 Inputs already available at that boundary

| Input | Available? | Source |
| --- | --- | --- |
| `ConversationReplyPlan.acknowledgements` | yes | plan assembly |
| `ConversationReplyPlan.acknowledgementEvent` | yes | Phase 16I |
| `ConversationReplyPlan.followUpQuestion` | yes | follow-up or continuation |
| `ConversationReplyPlan.messageInterpreted` | yes | selector coordination |
| User message | unused by expression (voided in `generateConversationReply`) | — |
| Authoritative trip state | not passed into expression (by design) | — |

### 4.3 Required inputs not currently available

**None for current baseline expression.** Style profiles are optional and intentionally ignored by the baseline renderer. No additional trip-state or message inputs are required to keep parity with the activated production surface.

### 4.4 Can conversational output replace the deterministic string directly?

**Yes — and it already does on the production path.**

Parity is **not** always byte-identical to `renderConversationReplyPlan`. Activated baseline expression may transform acknowledgement / follow-up / neutral lead-ins (Phases 15B–16J). The authoritative expected surface is `expectedActivatedBaselineReply(plan)`.

Deterministic `renderConversationReplyPlan` remains:

1. fallback when baseline throws
2. branch target inside `renderBaselineConversationalLayer` for ineligible multi-ack / residual plan shapes

### 4.5 Interpreted flags, state updates, metadata, transcript

| Concern | Could expression change it? | Finding |
| --- | --- | --- |
| Extraction / state update | no | happens before reply generation |
| Classification | no | computed before plan assembly |
| `messageInterpreted` / trace flag | no | derived from travel-field diff, not wording |
| Transcript | only records the reply string | still one user + one assistant entry |
| AcknowledgementEvent | no | copied into plan/layer input; not reinvented by renderer |

### 4.6 Fallback behaviour

Exists in `renderConversationReplyPlanByIntegrationMode`:

```text
baseline-conversational → try generateBaselineConversationalReply(plan)
                       → catch renderConversationReplyPlan(plan)
```

**Must remain** for Phase 20B. Do not remove the deterministic renderer.

### 4.7 Baseline parity with deterministic output

| Plan shape | Relation to deterministic |
| --- | --- |
| Ineligible / residual shapes | Exact `renderConversationReplyPlan` wording |
| Eligible ack / follow-up / neutral transforms | Conversational wording via Phase 15/16 renderers; locked by `expectedActivatedBaselineReply` |

### 4.8 Exports / registries / wiring required for integration

Already internal (not on `index.ts` public surface):

- `generateIntegratedConversationReply`
- `generateConversationReply`
- `renderIntegratedConversationReplyPlan`
- `renderConversationReplyPlanByIntegrationMode`
- `generateBaselineConversationalReply` (+ baseline registry/renderer chain)
- `renderConversationReplyPlan` (fallback)

**No new public exports required for Phase 20B.**

### 4.9 Blast radius

| Area | Risk if re-wired carelessly |
| --- | --- |
| `processTurn.ts` | transcript + `messageInterpreted` ordering |
| `generateConversationReply.ts` | plan vs render ownership split |
| `renderIntegratedConversationReplyPlan.ts` | production mode constant |
| Mode-driven renderer | fallback loss |
| Phase 14/15/16 characterization suites | large lock surface |
| Passenger / activity / restaurant progression tests | reply wording assertions |

---

## 5. Exact files expected to change in Phase 20B

Only if Phase 20B is limited to **non-behavioural consolidation / freeze documentation**:

```text
generateIntegratedConversationReply.ts   (docs / mode-label clarity only)
renderIntegratedConversationReplyPlan.ts (docs only, if needed)
docs/conversation-engine/*phase20B*      (freeze / validation record)
__tests__/*phase20B*                     (freeze locks)
```

**Not expected for a wiring phase** (already wired in 14N):

```text
processTurn.ts
createConversationReplyPlan.ts
selectConversationReplyComponents.ts
assembleConversationReplyPlan.ts
baseline renderer implementations
extractor registry / passenger progression
index.ts public surface
```

## 6. Exact files that must remain unchanged

```text
trip-state schema / types travel fields
extractor implementations and registry order
acknowledgement / follow-up / continuation selectors
reply catalogue wording owners
renderConversationReplyPlan (keep; do not delete/rename)
baseline conversational transform implementations (unless a later expression phase)
restaurant / activity progression predicates
public index.ts exports
```

---

## 7. Identified risks

1. **Dual mode labels:** `generateIntegratedConversationReply` still hardcodes `ConversationReplyIntegrationMode = 'deterministic'` while expression uses `'baseline-conversational'`. Confusing for operators; not a runtime dual path today (turn seam always calls `generateConversationReply`).
2. **Removing deterministic fallback** would eliminate the catch path and residual-shape branch — high risk.
3. **Calling baseline helpers from `processTurn`** would bypass plan assembly invariants.
4. **Passing trip state / raw message into expression** would widen blast radius and break layer contracts.
5. **Re-wiring a second parallel conversational path** would fork wording ownership.

---

## 8. Fallback strategy

Keep current strategy:

1. Prefer baseline conversational wording for activated production mode.
2. On synchronous baseline failure → deterministic `renderConversationReplyPlan(plan)`.
3. Inside baseline renderer, ineligible plan shapes → deterministic join.

No environment flags, no percentage rollout, no async providers.

---

## 9. Validation plan (for any Phase 20B follow-up)

```text
Phase 20A characterization suite
Phase 14O runtime integration completion
Phase 14I fallback
Phase 15/16 conversational expression suites
passenger Phase 19I–19L suites
conversation-core suite
full test suite
typecheck
production build
bundle filename + SHA-256
```

---

## 10. Go / no-go recommendation for Phase 20B

### NO-GO for new production wiring

The completed conversational expression layer is **already** the production reply expression path via:

```text
renderIntegratedConversationReplyPlan → mode 'baseline-conversational'
→ generateBaselineConversationalReply
```

Phase 20B must **not** introduce another wire from `processTurn` into experimental helpers, and must **not** replace plan assembly.

### GO for a non-behavioural Phase 20B freeze / consolidation only if scoped to:

- documenting / aligning the dual mode-label naming without changing selected branches
- locking the live seam and fallback with freeze tests
- confirming passenger / activity / restaurant representative paths still match `expectedActivatedBaselineReply`

### Explicitly out of scope for Phase 20B

- merging PR #29
- deploying
- deleting `renderConversationReplyPlan`
- enabling AI / async providers
- changing public `index.ts` surface

---

## Summary table (audit answers)

| # | Question | Answer |
| --- | --- | --- |
| 1 | Final production rendering owner | `generateBaselineConversationalReply` via `renderIntegratedConversationReplyPlan` (`baseline-conversational`) |
| 2 | Function that should invoke expression | `renderConversationReplyPlanByIntegrationMode` (selected by render seam) |
| 3 | Inputs available | completed `ConversationReplyPlan` (+ optional ignored style) |
| 4 | Missing inputs | none for current baseline |
| 5 | Direct string replace? | yes; already live; expected surface = activated baseline |
| 6 | State / flags / transcript impact? | wording only; state mutates before render |
| 7 | Fallback | try/catch → `renderConversationReplyPlan`; keep it |
| 8 | Parity | activated baseline parity via `expectedActivatedBaselineReply` |
| 9 | Wiring required | already present; no new exports |
| 10 | Blast radius | render seam + Phase 14–16 locks; avoid processTurn rewiring |
