import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import {
  renderConversationReplyPlanByIntegrationMode,
  type ConversationReplyPlanIntegrationMode,
} from './renderConversationReplyPlanByIntegrationMode';

/**
 * Phase 14D/14E — plan-level reply rendering seam.
 * Phase 14N — production expression mode `'baseline-conversational'`.
 * Phase 20B — freeze: sole production expression integration seam.
 *
 * Shared internal contract boundary: ConversationReplyPlan → rendered reply.
 * Statically selects `'baseline-conversational'` and delegates to
 * renderConversationReplyPlanByIntegrationMode. Deterministic fallback remains
 * inside the mode-driven renderer. Does not accept a mode argument, read
 * environment variables, or use feature flags.
 *
 * Not exported from index.ts.
 */

export type RenderIntegratedConversationReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export function renderIntegratedConversationReplyPlan(
  input: RenderIntegratedConversationReplyPlanInput,
): string {
  const mode: ConversationReplyPlanIntegrationMode =
    'baseline-conversational';
  return renderConversationReplyPlanByIntegrationMode({
    plan: input.plan,
    mode,
  });
}
