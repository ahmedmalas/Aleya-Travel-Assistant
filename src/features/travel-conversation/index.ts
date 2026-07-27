/**
 * Travel Understanding Engine (schema v5)
 *
 * Pipeline:
 * normalise → classify → extract/assign/merge (when mutating)
 * → post-requirements decision → compose → project → persist
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
  projectSearchForm,
  projectSearchRequest,
  summarizeKnown,
} from './project';
export type {
  RequirementsSummaryView,
  SearchFormProjection,
  SearchRequestProjection,
} from './project';
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
export { runLiveSearchFromState } from './ui/runLiveSearch';
export type { LiveSearchResult } from './ui/runLiveSearch';
