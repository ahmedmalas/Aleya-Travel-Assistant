import type { ApproximateDate, ConversationState, FieldValue, TravelServiceKind } from './types';

function inferred<T>(value: T): FieldValue<T> {
  return { value, source: 'inferred' };
}

function uniqueServices(services: TravelServiceKind[]): TravelServiceKind[] {
  return Array.from(new Set(services));
}

/**
 * Safely infer obvious context without inventing user preferences.
 */
export function inferContext(state: ConversationState): ConversationState {
  const next: ConversationState = {
    ...state,
    requestedServices: [...state.requestedServices],
    accommodationPreferences: [...state.accommodationPreferences],
    carHireRequirements: [...state.carHireRequirements],
    vehiclePreferences: [...state.vehiclePreferences],
    flightPreferences: [...state.flightPreferences],
    activities: [...state.activities],
    campingRequirements: [...state.campingRequirements],
    fourWdRequirements: [...state.fourWdRequirements],
    cruiseRequirements: [...state.cruiseRequirements],
    businessRequirements: [...state.businessRequirements],
    accessibility: [...state.accessibility],
    pets: [...state.pets],
    loyaltyPreferences: [...state.loyaltyPreferences],
    intermediateDestinations: [...state.intermediateDestinations],
    rawMentions: [...state.rawMentions],
    missingRequiredFields: [...state.missingRequiredFields],
  };

  // Hotel at a neighbourhood implies hotels service
  if (next.accommodationLocation && !next.requestedServices.includes('hotels')) {
    next.requestedServices = uniqueServices([...next.requestedServices, 'hotels']);
  }

  // Car hire mention already extracted; if flights + car hire, keep alignment requirement
  if (next.requestedServices.includes('car_hire') && next.requestedServices.includes('flights')) {
    if (!next.carHireRequirements.includes('align_to_flight_schedule')) {
      next.carHireRequirements = [...next.carHireRequirements, 'align_to_flight_schedule'];
    }
  }

  // If travel between cities mentioned with times, assume flights unless road/rail/cruise only
  const groundOnly =
    next.requestedServices.includes('road_trip') ||
    next.requestedServices.includes('rail') ||
    next.requestedServices.includes('coaches') ||
    next.requestedServices.includes('cruises');
  if (next.origin && next.destination && next.origin.value !== next.destination.value && !groundOnly) {
    if (!next.requestedServices.includes('flights') && next.requestedServices.length === 0) {
      next.requestedServices = ['flights'];
    } else if (
      !next.requestedServices.includes('flights') &&
      (next.requestedServices.includes('hotels') || next.requestedServices.includes('car_hire'))
    ) {
      next.requestedServices = uniqueServices([...next.requestedServices, 'flights']);
    }
  }

  // Default travellers when any trip service requested
  if (!next.travellers && next.requestedServices.length > 0) {
    next.travellers = inferred({ adults: 1, children: 0, total: 1 });
  }

  // Domestic AU leisure default when both cities are present and no purpose
  if (!next.tripPurpose && next.origin && next.destination) {
    next.tripPurpose = inferred('leisure');
  }

  // Return date kind relative: if departure absolute and return afternoon only, leave return soft
  if (next.departureDate?.value.isoDate && next.returnTimePreference && !next.returnDate?.value.isoDate) {
    const soft: ApproximateDate = {
      kind: 'relative',
      label: `return ${next.returnTimePreference.value}`,
      timePreference: next.returnTimePreference.value,
    };
    next.returnDate = next.returnDate ?? inferred(soft);
  }

  // Road trip implies car
  if (next.tripPurpose?.value === 'road_trip' || next.requestedServices.includes('road_trip')) {
    next.requestedServices = uniqueServices([...next.requestedServices, 'car_hire']);
  }

  // Camping / 4WD implications
  if (next.requestedServices.includes('camping') && !next.campingRequirements.length) {
    next.campingRequirements = ['camping'];
  }
  if (next.requestedServices.includes('four_wd') && !next.vehiclePreferences.includes('4WD')) {
    next.vehiclePreferences = [...next.vehiclePreferences, '4WD'];
  }

  return next;
}
