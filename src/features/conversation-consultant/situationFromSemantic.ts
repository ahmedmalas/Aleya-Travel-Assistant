/**
 * SituationModel projector — consumes the single Semantic Interpretation.
 *
 * Does not reconstruct place meaning via independent extractors or curated
 * lookups. Places and ambiguities come only from the shared semantic result.
 */

import type { ConversationCoreState } from '../conversation-core';
import type { SemanticInterpretation } from '../conversation-architecture/semanticInterpretation';
import type {
  ConsultantIntent,
  SituationAmbiguity,
  SituationFacts,
  SituationModel,
} from './types';

function mapIntent(semantic: SemanticInterpretation): ConsultantIntent {
  switch (semantic.intent) {
    case 'correct':
      return 'correct';
    case 'confirm':
      return 'confirm';
    case 'clarify_answer':
      return 'clarify_answer';
    case 'inform':
    case 'add':
    case 'remove':
    case 'reorder':
    case 'replace_route':
    case 'preserve':
      return 'inform';
    case 'reset':
    case 'restart':
    case 'undo':
    case 'conversational_control':
      return 'amend';
    case 'reject':
      return 'inform';
    default:
      return 'unknown';
  }
}

function placesFromSemantic(semantic: SemanticInterpretation): string[] {
  const places: string[] = [];
  for (const delta of semantic.deltas) {
    const isPlaceBearing =
      delta.kind === 'mention_place' ||
      delta.kind === 'add_place' ||
      delta.kind === 'replace_place' ||
      delta.kind === 'remove_place' ||
      delta.kind === 'reorder_places' ||
      delta.kind.startsWith('relation_');
    if (!isPlaceBearing || delta.kind === 'relation_compare_optimise') {
      continue;
    }
    for (const entity of delta.entities) {
      const name = entity.resolvedHint ?? entity.surface;
      if (typeof name === 'string' && name.length > 0 && !places.includes(name)) {
        places.push(name);
      }
    }
    const value = delta.value;
    if (
      value &&
      typeof value === 'object' &&
      'places' in value &&
      Array.isArray((value as { places?: unknown }).places)
    ) {
      for (const place of (value as { places: unknown[] }).places) {
        if (typeof place === 'string' && place.length > 0 && !places.includes(place)) {
          places.push(place);
        }
      }
    }
  }
  return places;
}

function ambiguitiesFromSemantic(
  semantic: SemanticInterpretation,
  placesInOrder: string[],
): SituationAmbiguity[] {
  const roleAmbiguous = semantic.deltas.some((delta) => {
    if (delta.kind !== 'mention_place' || delta.value === null) return false;
    if (typeof delta.value !== 'object') return false;
    return (delta.value as { roleAmbiguous?: unknown }).roleAmbiguous === true;
  });

  if (
    !roleAmbiguous &&
    semantic.clarificationStance !== 'ambiguous' &&
    !semantic.ambiguityNotes.some((note) => /ambiguous|role/i.test(note))
  ) {
    return [];
  }

  if (placesInOrder.length === 0) return [];

  const subject = placesInOrder[0]!;
  return [
    {
      id: `place-role:${subject}`,
      type: 'place_role',
      subject,
      options: ['origin', 'first_destination'],
      reason: 'Semantic Interpretation reports place-role ambiguity.',
      blocking: true,
      placesInOrder,
    },
  ];
}

/**
 * Project SituationModel from the authoritative semantic result + prior state.
 * No independent meaning reconstruction.
 */
export function situationFromSemantic(input: {
  message: string;
  semantic: SemanticInterpretation;
  currentState: ConversationCoreState;
}): SituationModel {
  const placesInOrder = placesFromSemantic(input.semantic);
  const ambiguities = ambiguitiesFromSemantic(input.semantic, placesInOrder);
  const facts: SituationFacts = {
    openClarification: input.currentState.openClarification,
  };

  return {
    message: input.message,
    intent: mapIntent(input.semantic),
    facts,
    hypotheses: [],
    ambiguities,
    confidence: input.semantic.confidence,
    placesInOrder,
    // Commits are owned by architecture Committer — not SituationModel.
    proposedUpdate: {},
  };
}
