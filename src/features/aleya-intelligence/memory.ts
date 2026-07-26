import type { ExtractionPatch } from './extract';
import type { ConversationState, FieldValue } from './types';
import { createEmptyConversationState } from './types';

function preferField<T>(incoming?: FieldValue<T>, existing?: FieldValue<T>): FieldValue<T> | undefined {
  if (!incoming) return existing;
  // Ignore empty string overwrites
  if (typeof incoming.value === 'string' && incoming.value.trim() === '') return existing;
  if (!existing) return incoming;
  if (incoming.source === 'confirmed') return incoming;
  if (existing.source === 'confirmed' && incoming.source === 'inferred') return existing;
  return incoming;
}

/** Merge extraction into prior state; later turns accumulate and can correct. */
export function mergeConversationState(previous: ConversationState | undefined, patch: ExtractionPatch): ConversationState {
  const base = previous ? { ...previous } : createEmptyConversationState();
  const next: ConversationState = {
    ...base,
    requestedServices: [...base.requestedServices],
    missingRequiredFields: [...base.missingRequiredFields],
    turnCount: base.turnCount + 1,
  };

  next.origin = preferField(patch.origin, next.origin);
  next.destination = preferField(patch.destination, next.destination);
  next.departureDate = preferField(patch.departureDate, next.departureDate);
  next.returnDate = preferField(patch.returnDate, next.returnDate);
  next.departureTimePreference = preferField(patch.departureTimePreference, next.departureTimePreference);
  next.returnTimePreference = preferField(patch.returnTimePreference, next.returnTimePreference);
  next.accommodationArea = preferField(patch.accommodationArea, next.accommodationArea);
  next.travellers = preferField(patch.travellers, next.travellers);
  next.tripPurpose = preferField(patch.tripPurpose, next.tripPurpose);
  next.budget = preferField(patch.budget, next.budget);

  if (patch.clearAccommodationArea) {
    next.accommodationArea = undefined;
  }

  if (patch.requestedServices?.length) {
    next.requestedServices = Array.from(new Set([...next.requestedServices, ...patch.requestedServices]));
  }

  if (patch.removeServices?.length) {
    next.requestedServices = next.requestedServices.filter((service) => !patch.removeServices!.includes(service));
  }

  if (patch.explicitItineraryIntent) {
    next.explicitItineraryIntent = true;
  }

  if (patch.isDateConfirmation) {
    next.awaitingDateConfirmation = false;
    if (patch.departureDate) next.departureDate = patch.departureDate;
  }

  return next;
}
