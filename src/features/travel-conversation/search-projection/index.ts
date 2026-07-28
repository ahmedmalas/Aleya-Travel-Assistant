/**
 * Canonical-state → live-search projection (rebuild).
 *
 * Architecture:
 *   ConversationState
 *     → projectCanonicalSearch()     // sole authority
 *     → buildProviderSearches()      // flights / hotels / cars
 *     → runLiveSearchFromState()     // one activation
 *
 * Parser, extraction, merge, and post-requirements routing are out of scope.
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
} from './activateLiveSearch';
export type {
  CanonicalSearchProjection,
  SearchFormProjection,
  SearchRequestProjection,
  TravellerCountSource,
  ProviderSearchOpen,
  LiveSearchResult,
} from './types';
