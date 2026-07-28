/**
 * Conversation progression engine — sole production conversation path.
 *
 * sendTravelMessage / processTravelTurn → runConversationTurn → domain tools
 */

export { runConversationTurn } from './turn';
export {
  resetConversationRuntime,
  getConversationTraces,
  clearConversationTraces,
  getSearchSession,
  isSearchActive,
  getTripType,
  wasSearchOffered,
  getAwaitingField,
  getTranscript,
} from './runtime';
export { calculateTripCompleteness, questionFor } from './completeness';

export type {
  ConversationTurnResult,
  ConversationContext,
  TripCompleteness,
  MissingRequirement,
  TurnGoal,
  PlannedAction,
  TurnTrace,
  ConversationalStep,
  ActiveSearchSession,
} from './contracts';
