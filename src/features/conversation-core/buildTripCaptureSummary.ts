import type { ConversationCoreState } from './types';

/**
 * Deterministic trip capture summary for completion / search-readiness replies.
 * Pure formatting from canonical state — no message inspection.
 */
export function buildTripCaptureSummary(state: ConversationCoreState): string {
  const lines: string[] = [];

  if (state.destination !== null) {
    lines.push(`Destination: ${state.destination}`);
  }
  if (state.origin !== null) {
    lines.push(`Origin: ${state.origin}`);
  }
  if (state.departureDate !== null) {
    lines.push(`Depart: ${state.departureDate}`);
  }
  if (state.returnDate !== null) {
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
