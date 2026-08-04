import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from '../conversation-core';
import type { TravelSemanticInterpretation } from './schema';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function addDaysIso(isoDate: string, days: number): string | null {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Deterministic validation + mapping from semantic interpretation → stateUpdate.
 * AI never writes canonical state directly.
 */
export function validateAndMapSemanticInterpretation(
  semantic: TravelSemanticInterpretation,
  currentState: ConversationCoreState,
): { stateUpdate: ConversationStateUpdate; warnings: string[] } {
  const warnings: string[] = [];
  const stateUpdate: ConversationStateUpdate = {};

  if (semantic.confidence < 0.35 && semantic.intent === 'unknown') {
    return { stateUpdate: {}, warnings: ['Low-confidence unknown intent rejected'] };
  }

  if (semantic.destination !== null) {
    stateUpdate.destination = semantic.destination;
  }
  if (semantic.origin !== null) {
    stateUpdate.origin = semantic.origin;
  }

  if (semantic.departureDate !== null) {
    if (isValidIsoDate(semantic.departureDate)) {
      stateUpdate.departureDate = semantic.departureDate;
    } else {
      warnings.push(`Invalid departureDate rejected: ${semantic.departureDate}`);
    }
  }

  if (semantic.returnDate !== null) {
    if (isValidIsoDate(semantic.returnDate)) {
      stateUpdate.returnDate = semantic.returnDate;
    } else {
      warnings.push(`Invalid returnDate rejected: ${semantic.returnDate}`);
    }
  }

  // Derive return from night count when departure is known (new or existing).
  if (
    stateUpdate.returnDate === undefined &&
    semantic.nightCount !== null &&
    semantic.nightCount > 0
  ) {
    const departure =
      stateUpdate.departureDate ?? currentState.departureDate ?? null;
    if (departure !== null) {
      const derived = addDaysIso(departure, semantic.nightCount);
      if (derived !== null) {
        stateUpdate.returnDate = derived;
      }
    } else {
      warnings.push('nightCount ignored until departureDate is known');
    }
  }

  // Conflict: return before departure → drop return.
  const dep = stateUpdate.departureDate ?? currentState.departureDate;
  const ret = stateUpdate.returnDate ?? currentState.returnDate;
  if (
    stateUpdate.returnDate !== undefined &&
    stateUpdate.returnDate !== null &&
    dep !== null &&
    stateUpdate.returnDate < dep
  ) {
    warnings.push('returnDate before departureDate rejected');
    delete stateUpdate.returnDate;
  }
  void ret;

  for (const [key, value] of [
    ['adultCount', semantic.adultCount],
    ['childCount', semantic.childCount],
    ['infantCount', semantic.infantCount],
  ] as const) {
    if (value !== null) {
      if (value > 20) {
        warnings.push(`${key} out of range rejected: ${value}`);
      } else {
        stateUpdate[key] = value;
      }
    }
  }

  if (semantic.flightsRequested !== null) {
    stateUpdate.flightsRequested = semantic.flightsRequested;
  }
  if (semantic.accommodationRequested !== null) {
    stateUpdate.accommodationRequested = semantic.accommodationRequested;
  }
  if (semantic.carHireRequested !== null) {
    stateUpdate.carHireRequested = semantic.carHireRequested;
  }
  if (semantic.activitiesRequested !== null) {
    stateUpdate.activitiesRequested = semantic.activitiesRequested;
  }
  if (semantic.restaurantsRequested !== null) {
    stateUpdate.restaurantsRequested = semantic.restaurantsRequested;
  }
  if (semantic.restaurantPreference !== null) {
    stateUpdate.restaurantPreference = semantic.restaurantPreference;
  }

  // Removals clear fields / set service flags false.
  for (const removal of semantic.removals) {
    switch (removal) {
      case 'destination':
        stateUpdate.destination = null;
        break;
      case 'origin':
        stateUpdate.origin = null;
        break;
      case 'departureDate':
        stateUpdate.departureDate = null;
        break;
      case 'returnDate':
        stateUpdate.returnDate = null;
        break;
      case 'flights':
        stateUpdate.flightsRequested = false;
        break;
      case 'accommodation':
        stateUpdate.accommodationRequested = false;
        break;
      case 'carHire':
        stateUpdate.carHireRequested = false;
        break;
      case 'activities':
        stateUpdate.activitiesRequested = false;
        break;
      case 'restaurants':
        stateUpdate.restaurantsRequested = false;
        break;
      default:
        break;
    }
  }

  if (semantic.conversationComplete === true) {
    stateUpdate.conversationComplete = true;
  } else if (semantic.conversationComplete === false) {
    stateUpdate.conversationComplete = false;
  }

  // Origin must not equal destination when both set after merge.
  const nextDestination =
    stateUpdate.destination !== undefined
      ? stateUpdate.destination
      : currentState.destination;
  const nextOrigin =
    stateUpdate.origin !== undefined ? stateUpdate.origin : currentState.origin;
  if (
    nextDestination !== null &&
    nextOrigin !== null &&
    nextDestination === nextOrigin &&
    (stateUpdate.destination !== undefined || stateUpdate.origin !== undefined)
  ) {
    // Prefer keeping destination; clear origin update if it collides.
    if (stateUpdate.origin !== undefined && stateUpdate.origin === nextDestination) {
      warnings.push('origin equal to destination rejected');
      delete stateUpdate.origin;
    }
  }

  return { stateUpdate, warnings };
}
