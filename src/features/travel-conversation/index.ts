/**
 * Travel Understanding Engine + Conversational Consultant (schema v5)
 *
 * Sole production dialogue path:
 *   normalize → dialogue orchestration (context → goals → decide → execute → NLG)
 *
 * Internal tools (do not speak for Aleya):
 *   extract / assign / merge / clarify / search-projection / search memory
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
  runDialogueTurn,
  resetDialogueRuntime,
  getDialogueTraces,
  clearDialogueTraces,
  getSearchMemory,
  isSearchActive,
  assertHumanReply,
} from './dialogue';
export type {
  DialogueDecision,
  DialogueTurnResult,
  DialogueTrace,
  UserGoal,
  ConversationContext,
} from './dialogue';
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
