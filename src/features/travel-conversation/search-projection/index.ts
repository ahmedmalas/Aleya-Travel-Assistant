/**
 * Canonical-state → live-search projection + browser-safe launch.
 *
 * Architecture:
 *   ConversationState
 *     → projectCanonicalSearch()     // sole authority
 *     → buildProviderSearches()      // flights / hotels / cars
 *     → launchProviderSearches()     // at most one auto-open + ready_for_user
 */

export {
  projectCanonicalSearch,
  projectSearchForm,
  projectSearchRequest,
} from './projectFromCanonical';
export { buildProviderSearches } from './providerHandoff';
export type { ProviderHandoffOptions, ProviderHandoffResult } from './providerHandoff';
export {
  runLiveSearchFromState,
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
} from './activateLiveSearch';
export type { LaunchProviderOptions, ProviderLaunchBatch } from './activateLiveSearch';
export type {
  CanonicalSearchProjection,
  SearchFormProjection,
  SearchRequestProjection,
  TravellerCountSource,
  ProviderSearchOpen,
  LiveSearchResult,
  ProviderLaunchResult,
  ProviderLaunchStatus,
  SearchLaunchSession,
} from './types';
