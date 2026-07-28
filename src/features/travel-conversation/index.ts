/**
 * Travel Understanding Engine + Consultant Agent (schema v5)
 *
 * Sole production conversation path:
 *   normalize → consultant agent loop (context → reason → validate → execute → respond)
 *
 * Internal tools (do not speak for Aleya):
 *   extract / assign / merge / clarify / search-projection / search session
 */

export { sendTravelMessage, processTravelTurn, resetConversationRuntime } from './pipeline';
export type { SendTravelMessageInput } from './pipeline';
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
  runConsultantTurn,
  resetConsultantRuntime,
  getConsultantTraces,
  clearConsultantTraces,
  getSearchSession,
  isSearchActive,
  assertHumanReply,
} from './consultant';
export type {
  ConsultantTurnDecision,
  ConsultantTurnResult,
  ConsultantTrace,
  ConsultantGoal,
  ConsultantContext,
  ActionObservation,
} from './consultant';
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
export { evaluateClarification } from './clarify';
export { requirementsReady } from './tools';
