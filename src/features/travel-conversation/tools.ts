/** Domain readiness helper — not a dialogue planner. */

import { calculateTripCompleteness } from './conversation/completeness';
import { getTripType } from './conversation/runtime';
import type { ConversationState, TravelServiceKind } from './types';

export function tripReadyForSearch(state: ConversationState): boolean {
  return calculateTripCompleteness(state, getTripType()).readyToSearch;
}

/** Never invent accommodation or car hire — flights only as search default. */
export function servicesForSearch(state: ConversationState): TravelServiceKind[] {
  if (state.services.length > 0) return [...state.services];
  return ['flights'];
}
