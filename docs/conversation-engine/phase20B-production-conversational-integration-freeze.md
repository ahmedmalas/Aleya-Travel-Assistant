# Phase 20B — Production conversational integration freeze

Freeze and consolidation only. Runtime wording, mode defaults, and reply-plan
semantics intentionally unchanged.

```text
PR #29 remains OPEN, Draft, Unmerged and Undeployed.
Phase 20A audit preserved.
No second integration path was added.
No production re-wiring was performed.
```

Characterization tests:

```text
src/features/conversation-core/__tests__/productionConversationalIntegrationFreeze.phase20B.test.ts
```

---

## Canonical production expression path

```text
processConversationTurn
→ generateIntegratedConversationReply          [turn routing seam]
→ generateConversationReply                    [orchestration owner]
    → classifyConversationStateChange
    → createConversationReplyPlan
    → renderIntegratedConversationReplyPlan    [sole expression seam]
        → mode = 'baseline-conversational'     [active production mode]
        → renderConversationReplyPlanByIntegrationMode
            → generateBaselineConversationalReply(plan)   [expression-only]
            → catch → renderConversationReplyPlan(plan)   [deterministic fallback]
→ transcript records reply string
```

---

## Ownership of each layer

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Turn entry | `processConversationTurn` | Extract → apply state → request reply → transcript |
| Turn routing | `generateIntegratedConversationReply` | Always delegates to `generateConversationReply` |
| Orchestration | `generateConversationReply` | Classify → assemble plan → call expression seam |
| Expression seam | `renderIntegratedConversationReplyPlan` | Selects frozen production mode once |
| Mode dispatch | `renderConversationReplyPlanByIntegrationMode` | Baseline try / deterministic catch |
| Expression | `generateBaselineConversationalReply` | Plan → wording only |
| Deterministic renderer | `renderConversationReplyPlan` | Fallback + ineligible-shape branch |

---

## Active mode

```text
ConversationReplyPlanIntegrationMode = 'baseline-conversational'
```

Selected exactly once, statically, inside `renderIntegratedConversationReplyPlan`.

Note: `generateIntegratedConversationReply` still uses an internal turn-routing
label `'deterministic'` meaning “use `generateConversationReply`”. That label
does **not** select wording expression and must not be confused with plan-mode
`'deterministic'`.

---

## Fallback contract

1. Production mode is `'baseline-conversational'`.
2. On successful baseline render → return baseline wording; deterministic path
   is not invoked for that turn.
3. On synchronous baseline throw → return `renderConversationReplyPlan(plan)`.
4. Inside baseline renderer, ineligible plan shapes may still call
   `renderConversationReplyPlan` as an internal residual branch (not a second
   production integration seam).
5. No environment flags, percentage rollout, or async providers.

---

## Allowed production entry points

```text
processConversationTurn
→ generateIntegratedConversationReply
→ generateConversationReply
→ renderIntegratedConversationReplyPlan
```

Public barrel (`index.ts`) exposes only:

```text
createInitialConversationCoreState
processConversationTurn
types / contracts
```

Internal reply helpers remain unexported from the barrel.

---

## Prohibited bypass paths

Production must not:

- call `generateBaselineConversationalReply` from `processTurn`
- call `renderConversationReplyPlan` from `processTurn` or
  `generateIntegratedConversationReply`
- call `buildConversationalLayerInput` /
  `invokeConversationalLayerRenderer` /
  `selectConversationalObjective` from turn routing
- accept a caller-supplied expression mode
- introduce a second parallel expression seam

Verified production callers of `renderConversationReplyPlan` (non-test):

```text
renderConversationReplyPlanByIntegrationMode.ts  (mode + catch fallback)
renderBaselineConversationalLayer.ts             (ineligible-shape residual)
generateConversationReply.ts                     (definition only)
```

---

## Files reviewed

```text
processTurn.ts
generateIntegratedConversationReply.ts
generateConversationReply.ts
renderIntegratedConversationReplyPlan.ts
renderConversationReplyPlanByIntegrationMode.ts
generateBaselineConversationalReply.ts
renderBaselineConversationalReplyPlan.ts
buildConversationalLayerInput.ts
executeBaselineConversationalRenderer.ts
renderBaselineConversationalLayer.ts
createConversationReplyPlan.ts
index.ts
docs/conversation-engine/phase20A-production-conversational-integration-boundary-audit.md
```

---

## Redundancy found

1. **Stale comments** claiming production expression was still deterministic-only
   or that the plan-mode wrapper supplied `'deterministic'` (obsolete after
   Phase 14N).
2. **Dual mode vocabulary** (`ConversationReplyIntegrationMode` vs
   `ConversationReplyPlanIntegrationMode`) — retained because Phase 14A/14C
   locks require the turn-routing `'deterministic'` label; documented rather
   than renamed to avoid blast radius.
3. **No duplicate live integration path** — single expression seam confirmed.

---

## Consolidation performed

Documentation-only clarification (no runtime behaviour change):

```text
generateIntegratedConversationReply.ts
renderIntegratedConversationReplyPlan.ts
renderConversationReplyPlanByIntegrationMode.ts
generateConversationReply.ts
```

No functions renamed. Deterministic renderer not deleted. Mode defaults
unchanged. No extraction / classification / ack / follow-up / continuation
logic changed.

---

## Final frozen contract

1. `generateConversationReply` is the production orchestration owner.
2. `renderIntegratedConversationReplyPlan` is the sole production expression
   integration seam.
3. Active production expression mode is `'baseline-conversational'`.
4. `generateBaselineConversationalReply` is expression-only.
5. Deterministic fallback remains available and equivalent when baseline fails.
6. State mutation, classification, acknowledgement, follow-up, and continuation
   remain upstream of expression.
7. Rendering paths do not mutate trip state or reply-plan semantics.
8. No duplicate or bypass production expression path exists.
9. Public exports stay minimal (`index.ts` unchanged).

---

## Recommendation for final launch-readiness audit

**GO** for a final launch-readiness audit phase that:

- re-runs passenger / activity / restaurant representative matrices against the
  frozen path
- confirms PR #29 remains Draft until human acceptance
- does **not** change expression wiring, mode defaults, or wording

**NO-GO** for further production re-wiring or deleting the deterministic
renderer before that audit completes.
