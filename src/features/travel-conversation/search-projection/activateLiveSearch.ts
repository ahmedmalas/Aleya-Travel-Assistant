/**
 * Single entry for live search activation.
 * Projects canonical state once, then opens every selected provider search
 * from that same payload. No manual re-entry.
 */

import type { ConversationState, TravelServiceKind } from '../types';
import { projectCanonicalSearch } from './projectFromCanonical';
import {
  buildProviderSearches,
  type ProviderHandoffOptions,
} from './providerHandoff';
import type { LiveSearchResult } from './types';

let activationCount = 0;
let lastActivationId: number | null = null;

function openUrl(url: string): void {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function getLiveSearchActivationCount(): number {
  return activationCount;
}

export function getLastLiveSearchActivationId(): number | null {
  return lastActivationId;
}

export function resetLiveSearchActivationTracking(): void {
  activationCount = 0;
  lastActivationId = null;
}

/**
 * Run live provider searches from canonical conversation state.
 * Projects once; every service shares origin/destination/dates/travellers.
 */
export function runLiveSearchFromState(
  state: ConversationState,
  services: TravelServiceKind[],
  options?: ProviderHandoffOptions & { openWindows?: boolean },
): LiveSearchResult {
  const projection = projectCanonicalSearch(state);
  const openWindows = options?.openWindows !== false;
  const target = services.length > 0 ? services : projection.services;

  const handoff = buildProviderSearches(projection, target, {
    currency: options?.currency,
    cabinClass: options?.cabinClass,
    accommodationQuery:
      options?.accommodationQuery ?? state.accommodationArea?.value,
  });

  activationCount += 1;
  const activationId = activationCount;
  lastActivationId = activationId;

  if (openWindows) {
    for (const search of handoff.searches) {
      openUrl(search.url);
    }
  }

  if (
    openWindows &&
    typeof document !== 'undefined' &&
    handoff.searches.some((s) => s.service === 'flights')
  ) {
    document.getElementById('flight-search')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  return {
    projection,
    opened: handoff.searches.map((s) => s.service),
    providerSearches: handoff.searches,
    unavailable: handoff.unavailable,
    activationId,
  };
}
