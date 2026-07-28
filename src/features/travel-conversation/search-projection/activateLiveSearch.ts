/**
 * Search activation entry — browser-safe provider launch.
 *
 * Replaces the deferred multi-popup loop. At most one automatic open from the
 * current user gesture; remaining providers stay ready_for_user.
 */

import type { ConversationState, TravelServiceKind } from '../types';
import {
  launchProviderSearches,
  type LaunchProviderOptions,
} from './providerLaunch';
import type { LiveSearchResult } from './types';

export {
  getLiveSearchActivationCount,
  getLastLiveSearchActivationId,
  resetLiveSearchActivationTracking,
  getActiveSearchLaunchSession,
  launchProviderSearches,
  openProviderLaunchAction,
  tryOpenProviderUrl,
  defaultProviderLauncher,
  describeProviderLaunchReply,
  summarizeLaunchResults,
  providerDisplayName,
} from './providerLaunch';
export type {
  LaunchProviderOptions,
  ProviderLaunchBatch,
} from './providerLaunch';

/**
 * Run live provider search activation from canonical state.
 * Does not fire multiple popups. Prefer reading `launchResults`.
 */
export function runLiveSearchFromState(
  state: ConversationState,
  services: TravelServiceKind[],
  options?: LaunchProviderOptions & { openWindows?: boolean },
): LiveSearchResult {
  const allowAutoOpen = options?.openWindows !== false;
  // At most one automatic open — never a multi-popup loop.
  const openFirst = allowAutoOpen && options?.openFirst !== false;

  const batch = launchProviderSearches(state, services, {
    currency: options?.currency,
    cabinClass: options?.cabinClass,
    accommodationQuery: options?.accommodationQuery,
    openFirst,
  });

  return {
    projection: batch.projection,
    opened: batch.results
      .filter((r) => r.status === 'opened')
      .map((r) => r.service),
    providerSearches: batch.results
      .filter((r) => r.url)
      .map((r) => ({
        service: r.service,
        url: r.url,
        destinationLabel: r.destinationLabel,
        departDate: r.departDate,
        returnDate: r.returnDate,
        adults: batch.projection.adults,
        travellerSource: batch.projection.travellerSource,
      })),
    unavailable: batch.results
      .filter((r) => r.status === 'failed')
      .map((r) => ({
        service: r.service,
        reason: r.reason ?? 'unavailable',
      })),
    activationId: batch.activationId,
    launchResults: batch.results,
  };
}
