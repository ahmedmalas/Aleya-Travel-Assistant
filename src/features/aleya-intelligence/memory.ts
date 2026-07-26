import type { ExtractionPatch } from './extract';
import type { ConversationState, FieldValue } from './types';
import { createEmptyConversationState } from './types';

function preferField<T>(incoming?: FieldValue<T>, existing?: FieldValue<T>): FieldValue<T> | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;
  // Confirmed always wins over inferred; newer confirmed replaces older confirmed
  if (incoming.source === 'confirmed') return incoming;
  if (existing.source === 'confirmed' && incoming.source === 'inferred') return existing;
  return incoming;
}

function mergeLists(existing: string[], incoming?: string[]): string[] {
  if (!incoming?.length) return existing;
  return Array.from(new Set([...existing, ...incoming]));
}

/**
 * Merge a new extraction into prior conversation state (later turns accumulate).
 */
export function mergeConversationState(previous: ConversationState | undefined, patch: ExtractionPatch): ConversationState {
  const base = previous ? { ...previous } : createEmptyConversationState();

  const next: ConversationState = {
    ...base,
    intermediateDestinations: [...base.intermediateDestinations],
    requestedServices: [...base.requestedServices],
    accommodationPreferences: [...base.accommodationPreferences],
    carHireRequirements: [...base.carHireRequirements],
    vehiclePreferences: [...base.vehiclePreferences],
    flightPreferences: [...base.flightPreferences],
    activities: [...base.activities],
    campingRequirements: [...base.campingRequirements],
    fourWdRequirements: [...base.fourWdRequirements],
    cruiseRequirements: [...base.cruiseRequirements],
    businessRequirements: [...base.businessRequirements],
    accessibility: [...base.accessibility],
    pets: [...base.pets],
    loyaltyPreferences: [...base.loyaltyPreferences],
    rawMentions: [...base.rawMentions],
    missingRequiredFields: [...base.missingRequiredFields],
    turnCount: base.turnCount + 1,
  };

  next.origin = preferField(patch.origin, next.origin);
  next.destination = preferField(patch.destination, next.destination);
  next.departureDate = preferField(patch.departureDate, next.departureDate);
  next.returnDate = preferField(patch.returnDate, next.returnDate);
  next.departureTimePreference = preferField(patch.departureTimePreference, next.departureTimePreference);
  next.returnTimePreference = preferField(patch.returnTimePreference, next.returnTimePreference);
  next.travellers = preferField(patch.travellers, next.travellers);
  next.tripPurpose = preferField(patch.tripPurpose, next.tripPurpose);
  next.accommodationLocation = preferField(patch.accommodationLocation, next.accommodationLocation);
  next.budget = preferField(patch.budget, next.budget);

  if (patch.intermediateDestinations?.length) {
    const names = new Set(next.intermediateDestinations.map((d) => d.value.toLowerCase()));
    for (const dest of patch.intermediateDestinations) {
      if (!names.has(dest.value.toLowerCase())) next.intermediateDestinations.push(dest);
    }
  }

  if (patch.requestedServices?.length) {
    next.requestedServices = Array.from(new Set([...next.requestedServices, ...patch.requestedServices]));
  }

  next.accommodationPreferences = mergeLists(next.accommodationPreferences, patch.accommodationPreferences);
  next.carHireRequirements = mergeLists(next.carHireRequirements, patch.carHireRequirements);
  next.vehiclePreferences = mergeLists(next.vehiclePreferences, patch.vehiclePreferences);
  next.flightPreferences = mergeLists(next.flightPreferences, patch.flightPreferences);
  next.activities = mergeLists(next.activities, patch.activities);
  next.campingRequirements = mergeLists(next.campingRequirements, patch.campingRequirements);
  next.fourWdRequirements = mergeLists(next.fourWdRequirements, patch.fourWdRequirements);
  next.cruiseRequirements = mergeLists(next.cruiseRequirements, patch.cruiseRequirements);
  next.businessRequirements = mergeLists(next.businessRequirements, patch.businessRequirements);
  next.accessibility = mergeLists(next.accessibility, patch.accessibility);
  next.pets = mergeLists(next.pets, patch.pets);
  next.loyaltyPreferences = mergeLists(next.loyaltyPreferences, patch.loyaltyPreferences);

  if (patch.explicitItineraryIntent) {
    next.explicitItineraryIntent = true;
  }

  if (patch.rawMentions?.length) {
    next.rawMentions = [...next.rawMentions, ...patch.rawMentions];
  }

  if (patch.isDateConfirmation) {
    next.awaitingDateConfirmation = false;
    if (patch.departureDate?.value.isoDate || patch.departureDate?.value.kind === 'absolute') {
      next.departureDate = patch.departureDate;
    }
  }

  return next;
}
