import type { ConversationCoreState } from './types';

/**
 * Deterministic trip capture summary for completion / search-readiness replies.
 * Pure formatting from canonical state — no message inspection.
 */
export function buildTripCaptureSummary(state: ConversationCoreState): string {
  const lines: string[] = [];

  if (state.tripStructure === 'multi_city') {
    lines.push('Trip: multi-city');
    if (state.origin !== null) {
      lines.push(`Origin: ${state.origin}`);
    }
    const stops = state.destinationStops ?? [];
    if (stops.length > 0) {
      lines.push(`Destinations: ${stops.join(' → ')}`);
    }
    if (state.tripLegs && state.tripLegs.length > 0) {
      const legText = state.tripLegs
        .map((leg, index) => {
          const from = leg.origin ?? 'TBC';
          const to = leg.destination ?? 'TBC';
          const when = leg.departureDate ? ` (${leg.departureDate})` : '';
          return `${index + 1}. ${from} → ${to}${when}`;
        })
        .join('; ');
      lines.push(`Legs: ${legText}`);
    }
  } else {
    if (state.tripStructure === 'one_way') {
      lines.push('Trip: one-way');
    } else if (state.tripStructure === 'return') {
      lines.push('Trip: return');
    }
    if (state.destination !== null) {
      lines.push(`Destination: ${state.destination}`);
    }
    if (state.origin !== null) {
      lines.push(`Origin: ${state.origin}`);
    }
  }

  if (state.departureDate !== null) {
    lines.push(`Depart: ${state.departureDate}`);
  }
  if (
    state.returnDate !== null &&
    state.tripStructure !== 'one_way' &&
    state.tripStructure !== 'multi_city'
  ) {
    lines.push(`Return: ${state.returnDate}`);
  }

  const travellers: string[] = [];
  if (state.adultCount !== null) {
    travellers.push(
      `${state.adultCount} adult${state.adultCount === 1 ? '' : 's'}`,
    );
  }
  if (state.childCount !== null && state.childCount > 0) {
    travellers.push(
      `${state.childCount} child${state.childCount === 1 ? '' : 'ren'}`,
    );
  }
  if (state.infantCount !== null && state.infantCount > 0) {
    travellers.push(
      `${state.infantCount} infant${state.infantCount === 1 ? '' : 's'}`,
    );
  }
  if (travellers.length > 0) {
    lines.push(`Travellers: ${travellers.join(', ')}`);
  }

  const services: string[] = [];
  if (state.flightsRequested === true) services.push('flights');
  if (state.accommodationRequested === true) services.push('accommodation');
  if (state.carHireRequested === true) services.push('car hire');
  if (state.activitiesRequested === true) services.push('activities');
  if (state.restaurantsRequested === true) {
    services.push(
      state.restaurantPreference
        ? `dining (${state.restaurantPreference})`
        : 'dining',
    );
  }
  if (services.length > 0) {
    lines.push(`Services: ${services.join(', ')}`);
  }

  if (lines.length === 0) {
    return 'I have your trip preferences noted.';
  }
  return lines.join('\n');
}
