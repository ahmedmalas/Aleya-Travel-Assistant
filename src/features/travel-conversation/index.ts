/**
 * Travel Understanding Engine + Conversation Progression (schema v5)
 *
 * Sole production path:
 *   sendTravelMessage / processTravelTurn → runConversationTurn → domain tools
 */

import { installAleyaBuildIdentity } from './buildIdentity';

/** Temporary: bake inspectable preview identity into the travel-conversation chunk. */
installAleyaBuildIdentity();

export { sendTravelMessage, processTravelTurn, resetConversationRuntime } from './pipeline';
export type { SendTravelMessageInput } from './pipeline';
export { getAleyaBuildIdentity, installAleyaBuildIdentity } from './buildIdentity';
export type { AleyaBuildIdentity } from './buildIdentity';
export {
  captureTurnRuntimeEvidence,
  resolveLiveBuildFingerprint,
} from './turnRuntimeEvidence';
export type { TurnRuntimeEvidence } from './turnRuntimeEvidence';
export {
  getTravelConversation,
  resetTravelConversation,
  hydrateTravelConversation,
  rehydrateTravelConversation,
  useTravelConversation,
  STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
} from './store';
export {
  projectRequirementsSummary,
  summarizeKnown,
} from './project';
export type { RequirementsSummaryView } from './project';
export {
  projectCanonicalSearch,
  projectSearchForm,
  projectSearchRequest,
  buildProviderSearches,
  runLiveSearchFromState,
  getLiveSearchActivationCount,
  getLastLiveSearchActivationId,
  resetLiveSearchActivationTracking,
} from './search-projection';
export type {
  CanonicalSearchProjection,
  SearchFormProjection,
  SearchRequestProjection,
  TravellerCountSource,
  ProviderSearchOpen,
  LiveSearchResult,
} from './search-projection';
export {
  runConversationTurn,
  getConversationTraces,
  clearConversationTraces,
  getSearchSession,
  isSearchActive,
  calculateTripCompleteness,
  wasSearchOffered,
} from './conversation';
export type {
  ConversationTurnResult,
  TripCompleteness,
  MissingRequirement,
  TurnTrace,
  TurnGoal,
} from './conversation';
export {
  CONVERSATION_SCHEMA_VERSION,
  createEmptyConversationState,
} from './types';
export type {
  ConversationState,
  DepartureDate,
  TravelTurnResult,
  TravelServiceKind,
  TripField,
} from './types';
export { tripReadyForSearch } from './tools';
