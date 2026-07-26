import type { ConversationState, FieldValue, TravelServiceKind } from './types';
import { withConfidence } from './confidence';

function inferred<T>(value: T): FieldValue<T> {
  return withConfidence(value, 'inferred', 0.55);
}

function uniqueServices(services: TravelServiceKind[]): TravelServiceKind[] {
  return Array.from(new Set(services));
}

/** Safely infer obvious context without inventing preferences. */
function isExcluded(state: ConversationState, service: TravelServiceKind): boolean {
  return (state.excludedServices ?? []).includes(service);
}

export function inferContext(state: ConversationState): ConversationState {
  const next: ConversationState = {
    ...state,
    requestedServices: [...state.requestedServices],
    excludedServices: [...(state.excludedServices ?? [])],
    missingRequiredFields: [...state.missingRequiredFields],
    conflicts: [...state.conflicts],
    lastPresentedOptions: [...state.lastPresentedOptions],
    selectedOptions: [...state.selectedOptions],
    lastUpdatedFields: [...state.lastUpdatedFields],
  };

  // Never re-add a service the user explicitly removed
  next.requestedServices = next.requestedServices.filter((service) => !isExcluded(next, service));

  if (
    next.accommodationArea &&
    !next.requestedServices.includes('accommodation') &&
    !isExcluded(next, 'accommodation')
  ) {
    next.requestedServices = uniqueServices([...next.requestedServices, 'accommodation']);
  }

  if (
    next.origin &&
    next.destination &&
    next.origin.value !== next.destination.value &&
    next.requestedServices.length === 0 &&
    !isExcluded(next, 'flights')
  ) {
    next.requestedServices = ['flights'];
  }

  if (
    next.origin &&
    next.destination &&
    next.origin.value !== next.destination.value &&
    (next.requestedServices.includes('accommodation') || next.requestedServices.includes('car_hire')) &&
    !next.requestedServices.includes('flights') &&
    !isExcluded(next, 'flights')
  ) {
    next.requestedServices = uniqueServices([...next.requestedServices, 'flights']);
  }

  if (!next.travellers && next.requestedServices.length > 0) {
    next.travellers = inferred({ adults: 1, children: 0, infants: 0, total: 1 });
  } else if (next.travellers && next.travellers.value.infants == null) {
    next.travellers = {
      ...next.travellers,
      value: { ...next.travellers.value, infants: next.travellers.value.infants ?? 0 },
    };
  }

  if (!next.tripPurpose && next.origin && next.destination) {
    next.tripPurpose = inferred('leisure');
  }

  return next;
}
