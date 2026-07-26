import type { ConversationState, TravelServiceKind } from './types';

export type RoutedServices = {
  services: TravelServiceKind[];
  searchReady: boolean;
  generateItinerary: boolean;
};

/**
 * Route confirmed requirements to the appropriate travel services.
 */
export function routeServices(state: ConversationState): RoutedServices {
  const services = Array.from(new Set(state.requestedServices));

  // Coherent bundles: flights + hotel + car when all requested
  const hasLocation = Boolean(state.destination) || (services.includes('cruises') && Boolean(state.origin));
  const searchReady =
    hasLocation &&
    Boolean(state.departureDate?.value.isoDate) &&
    state.departureDate?.value.kind === 'absolute' &&
    !state.awaitingDateConfirmation &&
    services.some((s) =>
      ['flights', 'hotels', 'car_hire', 'airport_transfers', 'activities', 'cruises', 'rail'].includes(s),
    );

  return {
    services,
    searchReady,
    generateItinerary: state.explicitItineraryIntent === true,
  };
}

export function planModeFromState(state: ConversationState):
  | 'complete'
  | 'family'
  | 'accessible'
  | 'business'
  | 'romantic'
  | 'adventure'
  | 'low-cost'
  | 'luxury'
  | 'leisure' {
  const purpose = state.tripPurpose?.value;
  if (state.accessibility.length) return 'accessible';
  if (purpose === 'family') return 'family';
  if (purpose === 'business' || purpose === 'recurring_business') return 'business';
  if (purpose === 'romantic') return 'romantic';
  if (purpose === 'adventure') return 'adventure';
  if (purpose === 'budget' || state.budget?.value.style === 'budget') return 'low-cost';
  if (purpose === 'luxury' || state.budget?.value.style === 'luxury') return 'luxury';
  if (purpose === 'leisure') return 'leisure';
  return 'complete';
}
