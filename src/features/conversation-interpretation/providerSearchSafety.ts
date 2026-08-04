import type { ConversationCoreState } from '../conversation-core';
import type { PlaceResolutionStatus } from './placeResolution';

/**
 * Provider search may only run against TLI-resolved places.
 * Unresolved / ambiguous places stay in conversation state but block search construction.
 */
export function isPlaceStatusSafeForProviderSearch(
  status: PlaceResolutionStatus | undefined,
): boolean {
  return status === 'resolved';
}

export function canSafelyConstructProviderSearch(
  state: Pick<
    ConversationCoreState,
    | 'destination'
    | 'origin'
    | 'destinationResolutionStatus'
    | 'originResolutionStatus'
  >,
): boolean {
  if (state.destination === null || state.origin === null) return false;
  return (
    isPlaceStatusSafeForProviderSearch(state.destinationResolutionStatus) &&
    isPlaceStatusSafeForProviderSearch(state.originResolutionStatus)
  );
}
