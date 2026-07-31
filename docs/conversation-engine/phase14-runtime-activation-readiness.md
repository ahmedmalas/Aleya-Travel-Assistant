# Phase 14M — Controlled Runtime Activation Readiness

Audit-only assessment of whether the baseline conversational branch is safe to activate in production later via a deliberate static mode change.

This document does **not** activate the baseline branch, recommend merge, or recommend deployment.

## Accepted baseline

| Check | Value |
| --- | --- |
| HEAD | `b961795aa6903c693ecce1a716dd7defc2cd0fcb` |
| Commit | Phase 14L: classify baseline comparison outcomes |
| PR #29 | OPEN, Draft, Unmerged, Undeployed |
| Working tree at audit start | clean |
| Production mode | statically `'deterministic'` |

## Authoritative production path

```text
processTurn()
→ generateIntegratedConversationReply()
→ generateConversationReply()
→ renderIntegratedConversationReplyPlan({ plan })
→ renderConversationReplyPlanByIntegrationMode({ plan, mode: 'deterministic' })
→ renderConversationReplyPlan(plan)
```

Production mode selection:

- `generateIntegratedConversationReply` binds `mode = 'deterministic'` (state-level seam; no caller argument).
- `renderIntegratedConversationReplyPlan` binds `mode = 'deterministic'` (plan-level seam; no caller argument).
- No production caller can supply or alter either mode.

Evidence: `processTurn.ts`, `generateIntegratedConversationReply.ts`, `generateConversationReply.ts`, `renderIntegratedConversationReplyPlan.ts`, `renderConversationReplyPlanByIntegrationMode.ts`.

## Baseline conversational path

```text
renderConversationReplyPlanByIntegrationMode({
  plan,
  mode: 'baseline-conversational'
})
→ try generateBaselineConversationalReply(plan)
→ conversational layer stack (objective → layer input → registry → wording)
→ on synchronous failure: renderConversationReplyPlan(plan)
```

Production never selects this mode today. The branch exists as an exhaustive arm of the mode-driven renderer and is reachable only when a caller explicitly supplies `'baseline-conversational'` (evaluation helpers and tests).

## Evaluation path

```text
evaluateBaselineConversationalReplyPlan({ plan })
→ evaluateBaselineConversationalReplyPlanOutcome({ plan })
   → try generateBaselineConversationalReply(plan)
   → catch → mode-driven deterministic + usedFallback: true

compareBaselineConversationalReplyPlan({ plan })
→ deterministic via mode-driven('deterministic')
→ baseline via outcome evaluator
→ { deterministicReply, baselineReply, matchesDeterministic, status }
   status: 'identical' | 'different' | 'fallback'
```

Evaluation modules are not imported by the authoritative production path and are not exported from `index.ts`.

## Ownership boundaries

| Concern | Owner |
| --- | --- |
| Trip state | Deterministic engine (`processTurn` / state update) |
| Classification | `classifyConversationStateChange` |
| Priority / eligibility / component selection | `createConversationReplyPlan` → selectors |
| Reply-plan assembly | `assembleConversationReplyPlan` / `selectConversationReplyComponents` |
| Wording only | Deterministic renderer **or** conversational layer |

The conversational layer receives only a completed `Readonly<ConversationReplyPlan>`. Seam and mode-driven modules do not classify, select, or assemble plans.

## Fallback contract

On the `'baseline-conversational'` arm only:

1. Invoke `generateBaselineConversationalReply(input.plan)`.
2. On any synchronous throw, return `renderConversationReplyPlan(input.plan)`.
3. The fallback uses the **exact same** `ConversationReplyPlan` instance reference passed into the mode-driven renderer.
4. Neither success nor fallback mutates the plan (proven with frozen plans in Phase 14M tests).

Successful baseline rendering currently remains parity-identical to deterministic rendering for the audited catalogue cases.

## Bundle impact

Conversational modules are included in the production bundle because `renderConversationReplyPlanByIntegrationMode` **statically imports** `generateBaselineConversationalReply` for the unselected exhaustive branch (Phase 14G onward). Tree-shaking cannot drop that import while the case arm remains in source.

Included via that static edge (wording stack):

1. `generateBaselineConversationalReply.ts`
2. `renderBaselineConversationalReplyPlan.ts`
3. `buildConversationalLayerInput.ts`
4. `selectConversationalObjective.ts`
5. `conversationalLayerContracts.ts`
6. `executeBaselineConversationalRenderer.ts`
7. `createBaselineConversationalRendererRegistry.ts`
8. `executeConversationalLayerRenderer.ts`
9. `conversationalRendererRegistry.ts`
10. `invokeConversationalLayerRenderer.ts`
11. `renderBaselineConversationalLayer.ts`

Not included (evaluation-only / unused by production edges):

- `evaluateBaselineConversationalReplyPlan.ts`
- `evaluateBaselineConversationalReplyPlanOutcome.ts`
- `compareBaselineConversationalReplyPlan.ts`
- `referenceConversationalStyleProfiles.ts` (no production import edge)

Phase 14M adds only an audit test and this documentation file. Neither enters the production JS bundle.

## Test evidence

File: `src/features/conversation-core/__tests__/controlledRuntimeActivationReadiness.phase14M.test.ts`

| Assertion area | Covered |
| --- | --- |
| Production static deterministic selection | yes |
| No production mode injection | yes |
| Completed-plan ownership boundary | yes |
| Successful deterministic / baseline parity | yes |
| Deterministic fallback on baseline failure | yes |
| Same-plan fallback | yes |
| Immutability | yes |
| No runtime selection mechanisms | yes |
| No production imports of evaluation-only helpers | yes |
| No public barrel exposure | yes |
| Exhaustive integration-mode handling | yes (two cases; both arms asserted) |

## Blocking risks

```text
none
```

Verified: production cannot select baseline today; ownership boundaries hold; successful baseline matches deterministic wording; failure falls back to deterministic wording on the same plan; no runtime selection / side-effect mechanisms on the authoritative path; evaluation helpers stay off production and public barrels.

## Non-blocking risks

```text
- Baseline failure catch is silent in production code (no logging/telemetry); visibility of usedFallback exists only in evaluation helpers.
- Controlled activation would be a deliberate static const change at the plan-level seam; there is no percentage, flag, or request-scoped rollout mechanism (by design).
```

## Activation readiness verdict

```text
READY FOR CONTROLLED ACTIVATION
```

Meaning: the architecture is safe for a **later, deliberate, static** change of the plan-level production mode constant from `'deterministic'` to `'baseline-conversational'`, given current parity and the deterministic fallback contract. This verdict does **not** authorize performing that change in Phase 14M, does not authorize merge of PR #29, and does not authorize deployment.
