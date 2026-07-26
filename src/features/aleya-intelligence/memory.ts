import { mayCommitField } from './confidence';
import type { ExtractionPatch } from './extract';
import type { ConversationState, FieldValue } from './types';
import { createEmptyConversationState } from './types';

function preferField<T>(
  incoming: FieldValue<T> | undefined,
  existing: FieldValue<T> | undefined,
  fieldName: string,
  updated: string[],
  askFields: string[],
): FieldValue<T> | undefined {
  if (!incoming) return existing;
  if (typeof incoming.value === 'string' && incoming.value.trim() === '') return existing;

  const decision = mayCommitField(
    incoming as FieldValue<unknown>,
    existing as FieldValue<unknown> | undefined,
  );

  if (decision === 'ask') {
    askFields.push(fieldName);
    // Retain existing; do not silently overwrite with low-confidence values
    return existing ?? incoming;
  }

  if (decision === 'retain' && existing) return existing;

  if (existing && JSON.stringify(existing.value) !== JSON.stringify(incoming.value)) {
    updated.push(fieldName);
  } else if (!existing) {
    updated.push(fieldName);
  }
  return incoming;
}

function mergeStringLists(
  incoming?: FieldValue<string[]>,
  existing?: FieldValue<string[]>,
): FieldValue<string[]> | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;
  const merged = Array.from(new Set([...existing.value, ...incoming.value]));
  return {
    ...incoming,
    value: merged,
  };
}

function isSoftDestination(patch: ExtractionPatch): boolean {
  return (
    patch.destination?.confidenceLevel === 'low' ||
    Boolean(patch.pendingLowConfidenceFields?.includes('destination'))
  );
}

/** Merge extraction into prior state; later turns accumulate and can correct one field at a time. */
export function mergeConversationState(
  previous: ConversationState | undefined,
  patch: ExtractionPatch,
): ConversationState {
  const base = previous ? { ...previous } : createEmptyConversationState();
  const updated: string[] = [];
  const askFields: string[] = [...(patch.pendingLowConfidenceFields ?? [])];
  const next: ConversationState = {
    ...base,
    requestedServices: [...base.requestedServices],
    missingRequiredFields: [...base.missingRequiredFields],
    conflicts: [...base.conflicts],
    lastPresentedOptions: [...base.lastPresentedOptions],
    selectedOptions: [...base.selectedOptions],
    turnCount: base.turnCount + 1,
    lastUpdatedFields: [],
    awaitingDestinationConfirmation: base.awaitingDestinationConfirmation,
    pendingDestination: base.pendingDestination,
  };

  // Pending destination confirm / decline (Blocker 2)
  if (patch.confirmPendingDestination && next.pendingDestination) {
    next.destination = {
      ...next.pendingDestination,
      source: 'confirmed',
      confidence: 0.95,
      confidenceLevel: 'high',
    };
    next.pendingDestination = undefined;
    next.awaitingDestinationConfirmation = false;
    updated.push('destination');
  } else if (patch.declinePendingDestination) {
    // If the only destination was the soft candidate itself, clear it too
    if (
      next.pendingDestination &&
      next.destination &&
      next.pendingDestination.value.toLowerCase() === next.destination.value.toLowerCase()
    ) {
      next.destination = undefined;
    }
    next.pendingDestination = undefined;
    next.awaitingDestinationConfirmation = false;
  } else if (patch.destination) {
    const incoming = patch.destination;
    const existing = next.destination;
    const soft = isSoftDestination(patch);

    if (existing && soft && incoming.value.toLowerCase() !== existing.value.toLowerCase()) {
      // Keep confirmed destination; hold soft candidate for confirmation
      next.pendingDestination = incoming;
      next.awaitingDestinationConfirmation = true;
      askFields.push('destination');
    } else if (!existing && soft) {
      // First soft mention: store tentatively and ask before treating as firm
      next.destination = incoming;
      next.awaitingDestinationConfirmation = true;
      next.pendingDestination = incoming;
      askFields.push('destination');
      updated.push('destination');
    } else {
      next.destination = preferField(incoming, existing, 'destination', updated, askFields);
      if (incoming.confidenceLevel !== 'low') {
        next.pendingDestination = undefined;
        next.awaitingDestinationConfirmation = false;
      }
    }
  }

  next.origin = preferField(patch.origin, next.origin, 'origin', updated, askFields);
  next.departureDate = preferField(patch.departureDate, next.departureDate, 'departureDate', updated, askFields);
  next.returnDate = preferField(patch.returnDate, next.returnDate, 'returnDate', updated, askFields);
  next.departureTimePreference = preferField(
    patch.departureTimePreference,
    next.departureTimePreference,
    'departureTimePreference',
    updated,
    askFields,
  );
  next.returnTimePreference = preferField(
    patch.returnTimePreference,
    next.returnTimePreference,
    'returnTimePreference',
    updated,
    askFields,
  );
  next.dateFlexibility = preferField(patch.dateFlexibility, next.dateFlexibility, 'dateFlexibility', updated, askFields);
  next.accommodationArea = preferField(
    patch.accommodationArea,
    next.accommodationArea,
    'accommodationArea',
    updated,
    askFields,
  );
  next.durationNights = preferField(
    patch.durationNights,
    next.durationNights,
    'durationNights',
    updated,
    askFields,
  );
  next.travellers = preferField(patch.travellers, next.travellers, 'travellers', updated, askFields);
  next.tripPurpose = preferField(patch.tripPurpose, next.tripPurpose, 'tripPurpose', updated, askFields);
  next.budget = preferField(patch.budget, next.budget, 'budget', updated, askFields);
  next.roomRequirements = preferField(patch.roomRequirements, next.roomRequirements, 'roomRequirements', updated, askFields);
  next.airlinePreferences = preferField(
    patch.airlinePreferences,
    next.airlinePreferences,
    'airlinePreferences',
    updated,
    askFields,
  );
  next.hotelPreferences = preferField(
    patch.hotelPreferences,
    next.hotelPreferences,
    'hotelPreferences',
    updated,
    askFields,
  );
  next.transportNotes = preferField(patch.transportNotes, next.transportNotes, 'transportNotes', updated, askFields);

  next.activities = mergeStringLists(patch.activities, next.activities);
  next.dietaryRequirements = mergeStringLists(patch.dietaryRequirements, next.dietaryRequirements);
  next.accessibility = mergeStringLists(patch.accessibility, next.accessibility);
  next.loyaltyMemberships = mergeStringLists(patch.loyaltyMemberships, next.loyaltyMemberships);
  next.specialRequests = mergeStringLists(patch.specialRequests, next.specialRequests);

  if (patch.clearAccommodationArea) {
    next.accommodationArea = undefined;
    updated.push('accommodationArea');
  }

  if (patch.requestedServices?.length) {
    const before = next.requestedServices.join(',');
    next.requestedServices = Array.from(new Set([...next.requestedServices, ...patch.requestedServices]));
    if (next.requestedServices.join(',') !== before) updated.push('requestedServices');
  }

  if (patch.removeServices?.length) {
    next.requestedServices = next.requestedServices.filter((service) => !patch.removeServices!.includes(service));
    updated.push('requestedServices');
  }

  if (patch.explicitItineraryIntent) {
    next.explicitItineraryIntent = true;
    updated.push('explicitItineraryIntent');
  }

  if (patch.isDateConfirmation) {
    next.awaitingDateConfirmation = false;
    if (patch.departureDate) next.departureDate = patch.departureDate;
  }

  next.lastUpdatedFields = Array.from(new Set([...updated, ...(patch.changedFields ?? [])]));
  if (askFields.length) {
    next.missingRequiredFields = Array.from(
      new Set([...next.missingRequiredFields, ...askFields.map((f) => `confirm:${f}`)]),
    );
  }

  return next;
}
