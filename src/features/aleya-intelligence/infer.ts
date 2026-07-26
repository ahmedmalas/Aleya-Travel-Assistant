import type { ConversationState, FieldValue, TravelServiceKind } from './types';

function inferred<T>(value: T): FieldValue<T> {
  return { value, source: 'inferred' };
}

function uniqueServices(services: TravelServiceKind[]): TravelServiceKind[] {
  return Array.from(new Set(services));
}

/** Safely infer obvious context without inventing preferences. */
export function inferContext(state: ConversationState): ConversationState {
  const next: ConversationState = {
    ...state,
    requestedServices: [...state.requestedServices],
    missingRequiredFields: [...state.missingRequiredFields],
  };

  if (next.accommodationArea && !next.requestedServices.includes('accommodation')) {
    next.requestedServices = uniqueServices([...next.requestedServices, 'accommodation']);
  }

  if (
    next.origin &&
    next.destination &&
    next.origin.value !== next.destination.value &&
    next.requestedServices.length === 0
  ) {
    next.requestedServices = ['flights'];
  }

  if (
    next.origin &&
    next.destination &&
    next.origin.value !== next.destination.value &&
    (next.requestedServices.includes('accommodation') || next.requestedServices.includes('car_hire')) &&
    !next.requestedServices.includes('flights')
  ) {
    next.requestedServices = uniqueServices([...next.requestedServices, 'flights']);
  }

  if (!next.travellers && next.requestedServices.length > 0) {
    next.travellers = inferred({ adults: 1, children: 0, total: 1 });
  }

  if (!next.tripPurpose && next.origin && next.destination) {
    next.tripPurpose = inferred('leisure');
  }

  return next;
}
