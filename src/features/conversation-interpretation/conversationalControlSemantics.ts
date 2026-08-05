/**
 * Conversational-control semantic capability family.
 *
 * Expresses gathering-complete / summary / proceed / decline / confirm / reject
 * as typed control deltas. Meaning only — never sets search execution.
 *
 * Uses structural control families (exhaustion, summary request, proceed,
 * decline-more, plan polarity). Not a transcript sentence catalogue.
 */

import type {
  ConversationalControl,
  ConversationalControlValue,
  SemanticDelta,
  SemanticIntent,
} from '../conversation-architecture/semanticInterpretation';

export type ConversationalControlMeaning = {
  deltas: SemanticDelta[];
  conversationalControl: ConversationalControl;
  intent: SemanticIntent;
  confidence: number;
};

/**
 * Detect conversational-control meaning. May coexist with other fact deltas
 * in the same turn (caller merges).
 */
export function resolveConversationalControlSemantics(input: {
  message: string;
  folded: string;
}): ConversationalControlMeaning | null {
  const { message, folded } = input;
  const trimmed = folded.replace(/[.!?]+$/g, '').trim();

  // Exhaustion / finished supplying information (does NOT execute search).
  const informationComplete =
    /^(?:that(?:'s|\s+is)\s+all|thats\s+all|that\s+is\s+everything|that(?:'s|\s+is)\s+everything|nothing\s+else|nothing\s+more|no\s+more|i(?:'?m|\s+am)\s+done|we(?:'?re|\s+are)\s+done|finished|that(?:'s|\s+is)\s+it)$/.test(
      trimmed,
    ) ||
    /\b(?:that(?:'s|\s+is)\s+all|thats\s+all|nothing\s+else(?:\s+to\s+add)?|nothing\s+more(?:\s+to\s+add)?|no\s+more\s+(?:details?|info(?:rmation)?))\b/.test(
      folded,
    );

  const requestSummary =
    /\b(?:summar(?:y|ise|ize)|recap|what\s+do\s+you\s+have|what\s+have\s+you\s+got|show\s+me\s+what\s+you(?:'?ve|\s+have)\s+got)\b/.test(
      folded,
    );

  const readyToProceed =
    /\b(?:let(?:'?s|\s+us)\s+proceed|go\s+ahead|ready\s+to\s+(?:search|book|continue|proceed)|please\s+(?:search|continue)|look\s+for\s+(?:flights?|options))\b/.test(
      folded,
    ) && !/\bnot\s+ready\b/.test(folded);

  const declineFurther =
    /\b(?:no\s+(?:more\s+)?questions?|don'?t\s+ask\s+(?:me\s+)?(?:any\s+)?more|nothing\s+else\s+needed|no\s+thanks(?:\s+to\s+more)?)\b/.test(
      folded,
    );

  const confirmPlan =
    /^(?:confirm(?:ed)?|looks\s+good|that(?:'s|\s+is)\s+(?:correct|right)|yes(?:\s+please)?)$/.test(
      trimmed,
    ) ||
    /\b(?:confirm\s+the\s+plan|plan\s+looks\s+good|that(?:'s|\s+is)\s+correct)\b/.test(
      folded,
    );

  const rejectPlan =
    /\b(?:that(?:'s|\s+is)\s+wrong|not\s+what\s+i\s+want|reject\s+the\s+plan|start\s+over\s+on\s+the\s+plan)\b/.test(
      folded,
    );

  const deltas: SemanticDelta[] = [];
  let conversationalControl: ConversationalControl = 'none';
  let intent: SemanticIntent = 'conversational_control';
  let confidence = 0;

  if (informationComplete) {
    const value: ConversationalControlValue = {
      controlFamily: 'information_complete',
      executesSearch: false,
    };
    deltas.push({
      kind: 'control_information_complete',
      entities: [],
      value,
      evidence: message,
    });
    conversationalControl = 'information_complete';
    confidence = Math.max(confidence, 0.88);
  }

  if (requestSummary) {
    deltas.push({
      kind: 'control_request_summary',
      entities: [],
      value: {
        controlFamily: 'request_summary',
        executesSearch: false,
      } satisfies ConversationalControlValue,
      evidence: message,
    });
    if (conversationalControl === 'none') {
      conversationalControl = 'request_summary';
    }
    confidence = Math.max(confidence, 0.85);
  }

  if (readyToProceed) {
    deltas.push({
      kind: 'control_ready_to_proceed',
      entities: [],
      value: {
        controlFamily: 'ready_to_proceed',
        executesSearch: false,
      } satisfies ConversationalControlValue,
      evidence: message,
    });
    if (
      conversationalControl === 'none' ||
      conversationalControl === 'information_complete'
    ) {
      conversationalControl = 'ready_to_proceed';
    }
    intent = 'confirm';
    confidence = Math.max(confidence, 0.85);
  }

  if (declineFurther) {
    deltas.push({
      kind: 'control_decline_further',
      entities: [],
      value: {
        controlFamily: 'decline_further_questions',
        executesSearch: false,
      } satisfies ConversationalControlValue,
      evidence: message,
    });
    if (conversationalControl === 'none') {
      conversationalControl = 'decline_further_questions';
    }
    confidence = Math.max(confidence, 0.84);
  }

  if (confirmPlan && !rejectPlan) {
    deltas.push({
      kind: 'control_confirm_plan',
      entities: [],
      value: {
        controlFamily: 'confirm_plan',
        executesSearch: false,
      } satisfies ConversationalControlValue,
      evidence: message,
    });
    conversationalControl = 'confirm_plan';
    intent = 'confirm';
    confidence = Math.max(confidence, 0.86);
  }

  if (rejectPlan) {
    deltas.push({
      kind: 'control_reject_plan',
      entities: [],
      value: {
        controlFamily: 'reject_plan',
        executesSearch: false,
      } satisfies ConversationalControlValue,
      evidence: message,
    });
    conversationalControl = 'reject_plan';
    intent = 'reject';
    confidence = Math.max(confidence, 0.86);
  }

  if (deltas.length === 0) return null;

  return {
    deltas,
    conversationalControl,
    intent,
    confidence,
  };
}
