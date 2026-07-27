/**
 * Travel Conversation Engine (schema v4)
 *
 * One canonical ConversationState owns the full lifecycle:
 * read active clarification → extract → assign location roles → merge once
 * → clear resolved clarification → validate → compose → project → persist
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
  ConversationState,
  DepartureDate,
  TravelTurnResult,
  TravelServiceKind,
} from './types';
