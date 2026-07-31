import type { ConversationReplyPlan } from './assembleConversationReplyPlan';
import type { ConversationAcknowledgementEvent } from './conversationAcknowledgementEvent';
import { CONVERSATION_REPLY_CATALOGUE } from './conversationReplyCatalogue';

/**
 * Phase 13C — immutable TypeScript contracts for the future Travel Consultant
 * conversational layer.
 *
 * Design-only surface: describes structured intent in and wording out.
 * Not wired into reply generation, turn processing, selectors, or any runtime
 * reply path. Does not own state, priority, eligibility, approvals, tools, or
 * booking actions.
 *
 * See docs/architecture/travel-consultant-layer.md and
 * docs/architecture/conversation-style-interface.md.
 */

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

/** Deterministic objective identity keys aligned with catalogue follow-ups. */
export type ConversationalObjectiveId =
  | 'destination'
  | 'origin'
  | 'departureDate'
  | 'returnDate'
  | 'flightsAdultCount'
  | 'accommodationGuestCount'
  | 'activities'
  | 'restaurants'
  | 'neutralContinuation'
  | 'none';

/**
 * Identifies the deterministic objective already selected in the reply plan.
 * Does not recalculate priority or eligibility from authoritative state.
 */
export type ConversationalObjective = {
  readonly id: ConversationalObjectiveId;
  /** Catalogue baseline wording copied from the plan, or null when absent. */
  readonly catalogueWording: string | null;
};

/** Tone preferences only — never control flags or state. */
export type ConversationalStyleTone =
  | 'catalogue-literal'
  | 'warm'
  | 'concise'
  | 'formal';

/**
 * Describes tone and phrasing preferences for a style profile.
 * Must not represent state changes, approvals, tools, or booking actions.
 */
export type ConversationalStyleProfile = {
  readonly id: string;
  readonly tone: ConversationalStyleTone;
  readonly phrasingPreferences?: readonly string[];
};

/**
 * Sole structured input to a future conversational layer.
 * Contains a readonly reply plan plus an identified objective and optional style.
 * `objective` is null when the plan has no follow-up and no continuation —
 * never a synthetic "none" objective. Must not carry mutable authoritative
 * conversation state.
 *
 * Phase 13F — nullable objective correction.
 * Phase 16I — acknowledgementEvent copied unchanged from the reply plan.
 * Does not expose trip state, classification, prior replies, or turn metadata.
 */
export type ConversationalLayerInput = {
  readonly plan: ConversationReplyPlan;
  readonly objective: ConversationalObjective | null;
  readonly acknowledgementEvent: ConversationAcknowledgementEvent;
  readonly styleProfile?: ConversationalStyleProfile;
};

/**
 * Sole output of a future conversational layer: rendered wording only.
 * Must not contain state updates, priority, eligibility, approvals, tools,
 * or booking actions.
 */
export type ConversationalLayerOutput = {
  readonly wording: string;
};

/**
 * Phase 13I — minimal renderer contract for conversational-layer implementations.
 *
 * Accepts readonly structured input and returns wording-only output.
 * Implementations must not produce state updates, approvals, tools, or booking
 * actions.
 */
export type ConversationalLayerRenderer = (
  input: Readonly<ConversationalLayerInput>,
) => ConversationalLayerOutput;

const OBJECTIVE_BY_CATALOGUE_WORDING = new Map<string, ConversationalObjectiveId>(
  (
    Object.entries(FOLLOW_UPS) as Array<
      [Exclude<ConversationalObjectiveId, 'none'>, string]
    >
  ).map(([id, wording]) => [wording, id]),
);

/**
 * Identify the plan's deterministic objective by exact catalogue wording match.
 * Reads `plan.followUpQuestion` only — does not inspect or mutate state, and
 * does not re-run follow-up selection.
 */
export function identifyConversationalObjective(
  plan: ConversationReplyPlan,
): ConversationalObjective {
  const catalogueWording = plan.followUpQuestion;
  if (catalogueWording === null) {
    return { id: 'none', catalogueWording: null };
  }
  const id = OBJECTIVE_BY_CATALOGUE_WORDING.get(catalogueWording);
  if (id === undefined) {
    return { id: 'none', catalogueWording };
  }
  return { id, catalogueWording };
}

/**
 * Build a contract input from an already-assembled reply plan and an
 * already-identified objective (or null when none).
 *
 * Pure packaging helper — preserves the plan reference and objective as given,
 * including null. Does not invent a synthetic "none" objective. Not integrated
 * into reply generation.
 *
 * Phase 13F — accepts and preserves nullable objective.
 */
export function createConversationalLayerInput(
  plan: ConversationReplyPlan,
  objective: ConversationalObjective | null,
  styleProfile?: ConversationalStyleProfile,
): ConversationalLayerInput {
  const acknowledgementEvent = plan.acknowledgementEvent;
  const input: ConversationalLayerInput =
    styleProfile === undefined
      ? { plan, objective, acknowledgementEvent }
      : { plan, objective, acknowledgementEvent, styleProfile };
  return Object.freeze(input);
}
