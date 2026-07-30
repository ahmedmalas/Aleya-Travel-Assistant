import { classifyConversationStateChange } from './classifyConversationStateChange';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  createConversationReplyPlan,
  type ConversationReplyPlan,
} from './createConversationReplyPlan';
import type { ConversationCoreState } from './types';

export { NEUTRAL_TRIP_FALLBACK_REPLY };

export type GenerateConversationReplyInput = {
  message: string;
  /** Final post-precedence travel state for this turn. */
  state: ConversationCoreState;
  /** Pre-turn state used only to isolate current-turn field changes. */
  previousState: ConversationCoreState;
};

/**
 * Internal conversation-core reply boundary.
 *
 * Phase 10B–10E: deterministic acknowledgements, core progression, contextual
 * follow-ups, and suppression. Phase 10F: acknowledgements are driven by an
 * internal change classification of previous vs final state. Phase 10G:
 * classification feeds createConversationReplyPlan, and this function only
 * renders the planned reply text. Invoked solely by processConversationTurn
 * after extraction and explicit stateUpdate precedence. Does not re-extract,
 * inspect message text, call search/itinerary, or use an AI provider.
 */
export function generateConversationReply(
  input: GenerateConversationReplyInput,
): string {
  void input.message;
  const { state, previousState } = input;
  const classification = classifyConversationStateChange(previousState, state);
  const plan = createConversationReplyPlan({ state, classification });
  return renderConversationReplyPlan(plan);
}

/** True when any canonical travel field differs between pre- and post-turn state. */
export function hasSupportedTravelFieldChange(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
): boolean {
  return classifyConversationStateChange(previousState, state).hasAnyChange;
}

/** Render a reply plan into the deterministic assistant reply string. */
export function renderConversationReplyPlan(
  plan: ConversationReplyPlan,
): string {
  if (plan.acknowledgements.length === 0) {
    return plan.followUpQuestion ?? NEUTRAL_TRIP_FALLBACK_REPLY;
  }
  if (plan.followUpQuestion === null) {
    return plan.acknowledgements.join(' ');
  }
  return `${plan.acknowledgements.join(' ')}\n${plan.followUpQuestion}`;
}
