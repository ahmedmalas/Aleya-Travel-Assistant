/**
 * Phase 4 — diagnostic Consultant Governor preview.
 *
 * Chooses one act from the committer preview state only.
 * Does not mutate state and does not use a slot ladder.
 */

import { CONVERSATION_REPLY_CATALOGUE } from '../conversation-core/conversationReplyCatalogue';
import type { ConversationCoreState, OpenClarification } from '../conversation-core';
import type { ConsultantAct } from '../conversation-consultant/types';
import type { ValidationResult } from './validationResult';
import type { SemanticInterpretation } from './semanticInterpretation';

export type PreviewConsultantAct = {
  kind: ConsultantAct['kind'] | 'acknowledge' | 'recover';
  reply: string;
  askTopic?: string;
  clarification?: OpenClarification | null;
  confidence: number;
};

function hasDestinations(state: ConversationCoreState): boolean {
  return (
    state.destination !== null || (state.destinationStops?.length ?? 0) > 0
  );
}

function journeyReady(state: ConversationCoreState): boolean {
  if (state.origin === null || state.departureDate === null) return false;
  if (state.tripStructure === 'multi_city') {
    return (state.destinationStops?.length ?? 0) >= 2;
  }
  if (state.destination === null) return false;
  if (state.tripStructure === 'one_way') return true;
  return state.returnDate !== null;
}

/**
 * Goal-driven single ask — not a form slot ladder.
 * Chooses the blocking gap for journey readiness only.
 */
function nextGoalAsk(state: ConversationCoreState): PreviewConsultantAct {
  const F = CONVERSATION_REPLY_CATALOGUE.followUps;

  // Origin missing while destinations exist — ask origin (role already known).
  if (state.origin === null && hasDestinations(state)) {
    return {
      kind: 'ask',
      reply: F.origin,
      askTopic: 'origin',
      confidence: 0.8,
    };
  }

  if (!hasDestinations(state)) {
    if (state.tripStructure === 'multi_city') {
      return {
        kind: 'ask',
        reply: F.multiCityDestinations,
        askTopic: 'destinationStops',
        confidence: 0.8,
      };
    }
    return {
      kind: 'ask',
      reply: F.destination,
      askTopic: 'destination',
      confidence: 0.8,
    };
  }

  if (state.origin === null) {
    return {
      kind: 'ask',
      reply: F.origin,
      askTopic: 'origin',
      confidence: 0.8,
    };
  }

  if (state.departureDate === null) {
    return {
      kind: 'ask',
      reply: F.departureDate,
      askTopic: 'departureDate',
      confidence: 0.8,
    };
  }

  if (
    state.tripStructure !== 'one_way' &&
    state.tripStructure !== 'multi_city' &&
    state.returnDate === null
  ) {
    return {
      kind: 'ask',
      reply: F.returnDate,
      askTopic: 'returnDate',
      confidence: 0.8,
    };
  }

  return {
    kind: 'acknowledge',
    reply: F.neutralContinuation,
    askTopic: 'optional',
    confidence: 0.6,
  };
}

function roleAmbiguousPlaces(semantic: SemanticInterpretation): string[] {
  for (const delta of semantic.deltas) {
    if (delta.kind !== 'mention_place' || delta.value === null) continue;
    if (typeof delta.value !== 'object') continue;
    const value = delta.value as { roleAmbiguous?: unknown; places?: unknown };
    if (value.roleAmbiguous !== true) continue;
    if (Array.isArray(value.places)) {
      return value.places.filter((p): p is string => typeof p === 'string');
    }
    return delta.entities
      .map((e) => e.resolvedHint ?? e.surface)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
  }
  return [];
}

/**
 * Choose one preview ConsultantAct from committed preview state.
 */
export function choosePreviewConsultantAct(input: {
  previewState: ConversationCoreState;
  validation: ValidationResult;
  semantic: SemanticInterpretation;
  clearedClarificationIds: string[];
  priorClarificationId: string | null;
}): PreviewConsultantAct {
  const { previewState, validation, semantic, clearedClarificationIds } = input;
  const open = previewState.openClarification;

  // Never re-emit a cleared clarification id.
  if (open && clearedClarificationIds.includes(open.id)) {
    return {
      kind: 'recover',
      reply: 'Could you rephrase that for me?',
      confidence: 0.5,
    };
  }

  // Never repeat a resolved (cleared) clarification id in the act either.
  if (
    input.priorClarificationId &&
    clearedClarificationIds.includes(input.priorClarificationId) &&
    open === null
  ) {
    // Fall through to goal ask / acknowledge — do not re-open prior id.
  }

  if (validation.clarificationAction === 'narrow' && open?.blocking) {
    // Narrowed prompts are intentionally shorter than the original binary ask.
    return {
      kind: 'clarify',
      reply: open.prompt,
      clarification: open,
      confidence: 0.85,
    };
  }

  if (open?.blocking) {
    return {
      kind: 'clarify',
      reply: open.prompt,
      clarification: open,
      confidence: 0.88,
    };
  }

  const ambiguousPlaces = roleAmbiguousPlaces(semantic);
  if (
    ambiguousPlaces.length >= 2 &&
    previewState.origin === null &&
    !hasDestinations(previewState)
  ) {
    const subject = ambiguousPlaces[0]!;
    const clarification: OpenClarification = {
      id: `place-role:${subject}`,
      type: 'place_role',
      subject,
      prompt: `Are you starting from ${subject}, or is ${subject} your first destination?`,
      options: ['origin', 'first_destination'],
      blocking: true,
      placesInOrder: ambiguousPlaces,
    };
    return {
      kind: 'clarify',
      reply: clarification.prompt,
      clarification,
      confidence: 0.86,
    };
  }

  if (
    validation.rejected.some((r) =>
      /Low confidence|refusing|out of range|not found|unresolved|Undo rejected/i.test(
        r.reason,
      ),
    ) &&
    validation.accepted.every(
      (o) =>
        o.op === 'no_state_change' ||
        o.op.startsWith('preserve_') ||
        o.op === 'undo_last_commit',
    )
  ) {
    return {
      kind: 'recover',
      reply: 'I want to be sure I have that right — which place did you mean?',
      confidence: 0.55,
    };
  }

  if (semantic.intent === 'reset' || semantic.intent === 'restart') {
    return {
      kind: 'ask',
      reply: CONVERSATION_REPLY_CATALOGUE.followUps.destination,
      askTopic: 'destination',
      confidence: 0.8,
    };
  }

  if (journeyReady(previewState)) {
    return {
      kind: 'acknowledge',
      reply: CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation,
      confidence: 0.7,
    };
  }

  return nextGoalAsk(previewState);
}
