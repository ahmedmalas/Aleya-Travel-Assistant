/**
 * Travel Understanding Engine (schema v5)
 *
 * Pipeline:
 * normalise → classify intent → extract/assign/merge (when mutating)
 * → readiness phase → compose from intent → project → persist
 *
 * Phase is readiness only. Intent always wins over phase.
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
export { isExplicitSearchRequest } from './ui/searchActivation';
export {
  classifyIntent,
  isSoftAffirmMessage,
  resolveReadinessPhase,
} from './intentRouter';
