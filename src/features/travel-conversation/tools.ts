/** Small internal helpers preserved as tools for the dialogue layer. */

import { evaluateClarification } from './clarify';
import type { ConversationState, TravelServiceKind } from './types';

export function requirementsReady(state: ConversationState): boolean {
  return Boolean(state.destination) && !evaluateClarification(state).needed;
}

export function servicesForSearch(state: ConversationState): TravelServiceKind[] {
  if (state.services.length > 0) return [...state.services];
  return ['flights'];
}
