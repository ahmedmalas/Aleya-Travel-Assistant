/**
 * Travel Understanding Engine (schema v5)
 *
 * Pipeline:
 * normalise → classify → extract candidates → assign roles → merge once
 * → clear resolved clarification → validate → compose → project → persist
 *
 * One engine. One canonical store. No legacy fallbacks.
 */

export { sendTravelMessage, processTravelTurn } from './pipeline';
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
