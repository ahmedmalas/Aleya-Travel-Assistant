import type { ConversationAcknowledgementEvent } from './conversationAcknowledgementEvent';
import {
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
} from './renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from './transformBaselineAcknowledgement';

/**
 * Phase 16B — acknowledgement-plus-canonical-neutral conversational bridge.
 * Phase 16J — forwards acknowledgementEvent into acknowledgement transform.
 *
 * Reuses transformBaselineAcknowledgement for acknowledgement expression, then
 * inserts a deterministic category bridge before the byte-identical canonical
 * neutral question. Non-canonical follow-ups fall through to the Phase 15C
 * join shape so neighbouring ownership stays unchanged.
 *
 * Does not inspect trip state, classification, selection, or extraction data.
 *
 * Not exported from index.ts.
 */

export type RenderBaselineAcknowledgementNeutralContinuationInput = Readonly<{
  acknowledgement: string;
  followUpQuestion: string;
  acknowledgementEvent?: ConversationAcknowledgementEvent;
}>;

type AcknowledgementBridgeCategory =
  | 'field-set-or-changed'
  | 'field-removed'
  | 'capability-enabled'
  | 'capability-disabled'
  | 'generic'
  | 'unknown';

const BRIDGE_FIELD_SET_OR_CHANGED =
  "Is there anything else you'd like me to consider?";
const BRIDGE_FIELD_REMOVED = 'We can update the rest as we go.';
const BRIDGE_CAPABILITY_ENABLED =
  'Tell me anything else that matters for this trip.';
const BRIDGE_CAPABILITY_DISABLED = 'We can keep refining the plan.';
const BRIDGE_GENERIC = "Is there anything else you'd like me to consider?";

/**
 * Classify a catalogue acknowledgement using Phase 15B/16J recognition
 * outcomes.
 *
 * Unknown strings are those transformBaselineAcknowledgement leaves unchanged.
 * Known categories are derived from the transformed expression shapes — no
 * duplicate transform mapping. field-set and field-changed share one bridge.
 */
function classifyAcknowledgementBridgeCategory(
  acknowledgement: string,
  transformedAcknowledgement: string,
): AcknowledgementBridgeCategory {
  if (transformedAcknowledgement === acknowledgement) {
    return 'unknown';
  }
  if (transformedAcknowledgement === 'Perfect, got it.') {
    return 'generic';
  }
  if (
    transformedAcknowledgement.startsWith("Great, I've added ") &&
    transformedAcknowledgement.endsWith(' to your trip.')
  ) {
    return 'capability-enabled';
  }
  if (
    transformedAcknowledgement.startsWith("No problem, I've removed ") &&
    transformedAcknowledgement.endsWith(' from your trip.')
  ) {
    return 'capability-disabled';
  }
  if (transformedAcknowledgement.startsWith("No problem, I've removed ")) {
    return 'field-removed';
  }
  return 'field-set-or-changed';
}

function bridgeForCategory(
  category: AcknowledgementBridgeCategory,
): string | null {
  switch (category) {
    case 'field-set-or-changed':
      return BRIDGE_FIELD_SET_OR_CHANGED;
    case 'field-removed':
      return BRIDGE_FIELD_REMOVED;
    case 'capability-enabled':
      return BRIDGE_CAPABILITY_ENABLED;
    case 'capability-disabled':
      return BRIDGE_CAPABILITY_DISABLED;
    case 'generic':
      return BRIDGE_GENERIC;
    case 'unknown':
      return null;
  }
}

/**
 * Render one acknowledgement plus the canonical neutral continuation with a
 * category-specific bridge.
 *
 * Canonical-neutral output:
 * `{transformed acknowledgement} {bridge?} {byte-identical neutral question}`
 *
 * Non-canonical follow-ups preserve Phase 15C:
 * `{transformed acknowledgement} {unchanged follow-up}`
 */
export function renderBaselineAcknowledgementNeutralContinuation(
  input: RenderBaselineAcknowledgementNeutralContinuationInput,
): string {
  const transformedAcknowledgement = transformBaselineAcknowledgement(
    input.acknowledgement,
    input.acknowledgementEvent ?? null,
  );

  if (input.followUpQuestion !== CANONICAL_NEUTRAL_CONTINUATION_PROMPT) {
    return `${transformedAcknowledgement} ${input.followUpQuestion}`;
  }

  const category = classifyAcknowledgementBridgeCategory(
    input.acknowledgement,
    transformedAcknowledgement,
  );
  const bridge = bridgeForCategory(category);
  if (bridge === null) {
    return `${transformedAcknowledgement} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
  }
  return `${transformedAcknowledgement} ${bridge} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
}
