import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import { renderConversationReplyPlan } from './generateConversationReply';

/**
 * Phase 14D/14E — plan-level reply rendering seam.
 *
 * Shared internal contract boundary: ConversationReplyPlan → rendered reply.
 * Delegates entirely to renderConversationReplyPlan. Phase 14E wires the
 * authoritative generateConversationReply path through this seam while
 * remaining deterministic-only. Does not assemble plans, invoke the
 * conversational layer, or introduce mode selection.
 *
 * Not exported from index.ts.
 */

export type RenderIntegratedConversationReplyPlanInput = Readonly<{
  plan: Readonly<ConversationReplyPlan>;
}>;

export function renderIntegratedConversationReplyPlan(
  input: RenderIntegratedConversationReplyPlanInput,
): string {
  return renderConversationReplyPlan(input.plan);
}
