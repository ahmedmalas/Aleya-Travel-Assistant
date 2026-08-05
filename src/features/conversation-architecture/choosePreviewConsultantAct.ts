/**
 * Consultant Governor preview act selection.
 *
 * Engine Consolidation: decisions come from committed state, Dialogue State,
 * obligations, ambiguity, and applied writes — not a fixed progression ladder
 * and not neutralContinuation as success camouflage after opaque commits.
 */

import { CONVERSATION_REPLY_CATALOGUE } from '../conversation-core/conversationReplyCatalogue';
import type { ConversationCoreState, OpenClarification } from '../conversation-core';
import type { ConsultantAct } from '../conversation-consultant/types';
import type { ValidationResult } from './validationResult';
import type { SemanticInterpretation } from './semanticInterpretation';
import type { DialogueDecision, DialogueState } from './dialogue/dialogueTypes';
import type { ProposedOperation } from './canonicalOperations';

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

function journeyCoreReady(state: ConversationCoreState): boolean {
  if (state.origin === null || state.departureDate === null) return false;
  if (state.tripStructure === 'multi_city') {
    return (state.destinationStops?.length ?? 0) >= 2;
  }
  if (state.destination === null) return false;
  if (state.tripStructure === 'one_way') return true;
  return state.returnDate !== null;
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

function askForTopic(topic: string): PreviewConsultantAct {
  const F = CONVERSATION_REPLY_CATALOGUE.followUps;
  switch (topic) {
    case 'origin':
      return { kind: 'ask', reply: F.origin, askTopic: 'origin', confidence: 0.8 };
    case 'destination':
      return {
        kind: 'ask',
        reply: F.destination,
        askTopic: 'destination',
        confidence: 0.8,
      };
    case 'destinationStops':
      return {
        kind: 'ask',
        reply: F.multiCityDestinations,
        askTopic: 'destinationStops',
        confidence: 0.8,
      };
    case 'departureDate':
      return {
        kind: 'ask',
        reply: F.departureDate,
        askTopic: 'departureDate',
        confidence: 0.8,
      };
    case 'returnDate':
      return {
        kind: 'ask',
        reply: F.returnDate,
        askTopic: 'returnDate',
        confidence: 0.8,
      };
    case 'adultCount':
      return {
        kind: 'ask',
        reply: F.flightsAdultCount,
        askTopic: 'adultCount',
        confidence: 0.8,
      };
    case 'services':
      return {
        kind: 'ask',
        reply:
          'Would you like me to look at flights, hotels, or car hire for this trip?',
        askTopic: 'services',
        confidence: 0.8,
      };
    default:
      return {
        kind: 'recover',
        reply: 'Could you rephrase that for me?',
        confidence: 0.55,
      };
  }
}

/**
 * Single blocking journey gap from post-commit state — not a fixed ladder walk.
 * Returns null when core journey fields are satisfied.
 */
function blockingJourneyGap(
  state: ConversationCoreState,
): PreviewConsultantAct | null {
  if (!hasDestinations(state)) {
    if (state.tripStructure === 'multi_city') {
      return askForTopic('destinationStops');
    }
    return askForTopic('destination');
  }
  if (state.origin === null) return askForTopic('origin');
  if (state.departureDate === null) return askForTopic('departureDate');
  if (
    state.tripStructure !== 'one_way' &&
    state.tripStructure !== 'multi_city' &&
    state.returnDate === null
  ) {
    return askForTopic('returnDate');
  }
  return null;
}

function meaningfulAcceptedOps(accepted: ProposedOperation[]): ProposedOperation[] {
  return accepted.filter(
    (o) =>
      o.op !== 'no_state_change' &&
      !o.op.startsWith('preserve_') &&
      o.op !== 'undo_last_commit',
  );
}

/**
 * Acknowledge a concrete committed write — never generic "what else" alone.
 */
function acknowledgeCommittedOps(
  accepted: ProposedOperation[],
  previewState: ConversationCoreState,
): PreviewConsultantAct | null {
  const ops = meaningfulAcceptedOps(accepted);
  if (ops.length === 0) return null;
  const A = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
  const last = ops[ops.length - 1]!;

  if (last.op === 'set_origin' && typeof last.value === 'string') {
    return {
      kind: 'acknowledge',
      reply: A.origin(last.value),
      confidence: 0.75,
    };
  }
  if (
    (last.op === 'set_destinations' || last.op === 'add_destination') &&
    previewState.destination
  ) {
    if (
      previewState.tripStructure === 'multi_city' &&
      (previewState.destinationStops?.length ?? 0) >= 2
    ) {
      return {
        kind: 'acknowledge',
        reply: A.multiCityDestinations(
          (previewState.destinationStops ?? []).join(', '),
        ),
        confidence: 0.75,
      };
    }
    return {
      kind: 'acknowledge',
      reply: A.destination(previewState.destination),
      confidence: 0.75,
    };
  }
  if (last.op === 'set_departure_date' && typeof last.value === 'string') {
    return {
      kind: 'acknowledge',
      reply: A.departureDate(last.value),
      confidence: 0.75,
    };
  }
  if (last.op === 'set_return_date' && typeof last.value === 'string') {
    return {
      kind: 'acknowledge',
      reply: A.returnDate(last.value),
      confidence: 0.75,
    };
  }
  return {
    kind: 'acknowledge',
    reply: A.genericTravelFieldChange,
    confidence: 0.7,
  };
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
  dialogueDecision?: DialogueDecision;
  dialogueStatePrior?: DialogueState;
}): PreviewConsultantAct {
  const { previewState, validation, semantic, clearedClarificationIds } = input;
  const open = previewState.openClarification;

  if (open && clearedClarificationIds.includes(open.id)) {
    return {
      kind: 'recover',
      reply: 'Could you rephrase that for me?',
      confidence: 0.5,
    };
  }

  if (validation.clarificationAction === 'narrow' && open?.blocking) {
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

  // Deferred dialogue obligation → re-ask that obligation only.
  if (
    input.dialogueDecision &&
    input.dialogueStatePrior &&
    input.dialogueDecision.deferredObligationIds.length > 0 &&
    input.dialogueDecision.satisfiedObligationIds.length === 0 &&
    (input.dialogueDecision.event === 'ignored_move_with_contribution' ||
      input.dialogueDecision.event === 'ambiguous_relation' ||
      input.dialogueDecision.planningMode === 'no_domain_mutation')
  ) {
    const oblId = input.dialogueDecision.deferredObligationIds[0]!;
    const obl = input.dialogueStatePrior.obligations.find((o) => o.id === oblId);
    const target =
      typeof obl?.domainSealed?.domainTarget === 'string'
        ? obl.domainSealed.domainTarget
        : null;
    if (target) return askForTopic(target);
    if (input.dialogueDecision.ambiguity === 'require_recovery_prompt') {
      return {
        kind: 'recover',
        reply: 'Could you rephrase that for me?',
        confidence: 0.55,
      };
    }
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

  const refusedPlaceGuess = validation.accepted.some(
    (o) =>
      o.op === 'no_state_change' &&
      o.reasoningTrace.some((line) =>
        /Untyped mention_place|refusing vacancy|no vacancy role assignment/i.test(
          line,
        ),
      ),
  );

  if (
    (refusedPlaceGuess ||
      validation.rejected.some((r) =>
        /Low confidence|refusing|out of range|not found|unresolved|Undo rejected|Untyped mention_place/i.test(
          r.reason,
        ),
      )) &&
    validation.accepted.every(
      (o) =>
        o.op === 'no_state_change' ||
        o.op.startsWith('preserve_') ||
        o.op === 'undo_last_commit',
    )
  ) {
    // Prefer place-role clarification over opaque recover when a place was mentioned.
    const places = semantic.deltas
      .filter((d) => d.kind === 'mention_place')
      .flatMap((d) =>
        d.entities
          .map((e) => e.resolvedHint ?? e.surface)
          .filter((p): p is string => typeof p === 'string' && p.length > 0),
      );
    if (places.length >= 1 && !hasDestinations(previewState) && previewState.origin === null) {
      const subject = places[0]!;
      const clarification: OpenClarification = {
        id: `place-role:${subject}`,
        type: 'place_role',
        subject,
        prompt: `Are you starting from ${subject}, or is ${subject} your first destination?`,
        options: ['origin', 'first_destination'],
        blocking: true,
        placesInOrder: places,
      };
      return {
        kind: 'clarify',
        reply: clarification.prompt,
        clarification,
        confidence: 0.8,
      };
    }
    return {
      kind: 'recover',
      reply: 'I want to be sure I have that right — which place did you mean?',
      confidence: 0.55,
    };
  }

  if (semantic.intent === 'reset' || semantic.intent === 'restart') {
    return askForTopic('destination');
  }

  const gap = blockingJourneyGap(previewState);
  const ack = acknowledgeCommittedOps(validation.accepted, previewState);

  // After a real commit, ask the next blocking gap when one remains.
  if (gap !== null) {
    if (ack !== null && meaningfulAcceptedOps(validation.accepted).length > 0) {
      return {
        kind: 'ask',
        reply: `${ack.reply} ${gap.reply}`,
        askTopic: gap.askTopic,
        confidence: 0.8,
      };
    }
    return gap;
  }

  // Core journey ready: acknowledge the write if any, else invite services —
  // never recycle neutralContinuation as the only success signal.
  if (journeyCoreReady(previewState)) {
    if (ack !== null) {
      return {
        kind: 'acknowledge',
        reply: `${ack.reply} ${askForTopic('services').reply}`,
        askTopic: 'services',
        confidence: 0.75,
      };
    }
    return askForTopic('services');
  }

  if (ack !== null) return ack;

  return {
    kind: 'recover',
    reply: 'Could you tell me a bit more about the trip you have in mind?',
    confidence: 0.55,
  };
}
