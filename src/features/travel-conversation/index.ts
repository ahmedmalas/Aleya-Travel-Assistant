/**
 * Travel Understanding Engine (schema v5)
 *
 * Pipeline:
 * normalise → classify → extract/assign/merge (when mutating)
 * → post-requirements decision → compose → persist
 *
 * Live search handoff:
 * ConversationState → search-projection (sole authority) → providers
 *
 * Post-requirements owns natural search approval and continuity.
 */

export { sendTravelMessage, processTravelTurn } from './pipeline';
export type { SendTravelMessageInput } from './pipeline';
export {
  clearComposeTraces,
  getComposeTraces,
  pushComposeTrace,
} from './debugTrace';
export type { ComposeBranch, ComposeTraceEntry } from './debugTrace';
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
  CONVERSATION_SCHEMA_VERSION,
  createEmptyConversationState,
} from './types';
export type {
  ClarificationField,
  ConversationPhase,
  ConversationState,
  DepartureDate,
  TravelTurnResult,
  TravelServiceKind,
} from './types';
export {
  decidePostRequirements,
  isSearchApprovalMessage,
  isDeclineSearchMessage,
  requirementsReady,
  servicesForSearch,
} from './postRequirements';
