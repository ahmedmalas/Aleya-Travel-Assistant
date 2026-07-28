/**
 * Agent-style travel consultant — sole production conversation path.
 *
 * User message → context → multi-goal decision → validate → execute → observe → respond
 */

import type {
  ClarificationField,
  ConversationState,
  TravelServiceKind,
} from '../types';

export type TravelService = TravelServiceKind;

export type SearchFilter = {
  key: string;
  value: string;
};

export type ValidatedTripChange =
  | { field: 'origin' | 'destination' | 'accommodationArea'; value: string }
  | { field: 'travellers'; value: number }
  | { field: 'durationNights'; value: number }
  | { field: 'preference'; value: string };

export type ConsultantGoal =
  | { type: 'add_service'; service: TravelService }
  | { type: 'remove_service'; service: TravelService }
  | { type: 'update_trip'; changes: ValidatedTripChange[] }
  | { type: 'start_search'; services?: TravelService[] }
  | { type: 'refine_search'; target: TravelService; filters: SearchFilter[] }
  | { type: 'show_summary' }
  | { type: 'answer_question'; question: string }
  | { type: 'start_new_trip' }
  | { type: 'decline_search' }
  | { type: 'capture_details' };

export type ValidatedAction =
  | { type: 'clear_trip' }
  | { type: 'apply_extract_merge' }
  | { type: 'add_service'; service: TravelService }
  | { type: 'remove_service'; service: TravelService }
  | { type: 'set_travellers'; count: number }
  | { type: 'set_duration_nights'; nights: number }
  | { type: 'set_accommodation_area'; area: string }
  | { type: 'set_offer'; offer: 'start_search' | null }
  | { type: 'start_search'; services: TravelService[] }
  | { type: 'refine_search'; services: TravelService[]; filters: Record<string, string> }
  | { type: 'end_search_session' }
  | { type: 'select_result'; service: TravelService; ordinal: number };

export type ConsultantTurnDecision = {
  understoodMeaning: string;
  goals: ConsultantGoal[];
  actionSequence: ValidatedAction[];
  clarification?: {
    needed: boolean;
    reason?: string;
    question?: string;
    field?: ClarificationField;
  };
  responsePlan: {
    acknowledge?: string;
    actionsCompleted: string[];
    resultSummary?: string;
    nextUsefulStep?: string;
    avoidRepeating: string[];
  };
};

export type TranscriptTurn = {
  role: 'user' | 'aleya';
  text: string;
  at: string;
};

export type SearchResultItem = {
  id: string;
  service: TravelService;
  label: string;
  summary: string;
  planningNote: string;
};

export type ActiveSearchSession = {
  id: string;
  startedAt: string;
  conversationId: string;
  providersQueried: TravelService[];
  filters: Record<string, string>;
  results: SearchResultItem[];
  focusService?: TravelService;
  selected?: { service: TravelService; id: string; label: string };
};

export type ConsultantContext = {
  userMessage: string;
  normalizedMessage: string;
  recentTurns: TranscriptTurn[];
  trip: ConversationState;
  lastAleyaReply?: string;
  lastOffer?: ConversationState['lastOffer'];
  lastQuestion?: string;
  searchSession: ActiveSearchSession | null;
  unresolved?: { field: ClarificationField; question: string };
  preferences: string[];
};

export type ActionObservation = {
  stateBefore: ConversationState;
  stateAfter: ConversationState;
  servicesAdded: TravelService[];
  servicesRemoved: TravelService[];
  activateSearch: boolean;
  continueSearch: boolean;
  servicesToSearch: TravelService[];
  searchSession: ActiveSearchSession | null;
  selectedResult?: SearchResultItem;
  inventedNothing: true;
  providerActions: Array<{ kind: string; detail: string }>;
};

export type ConsultantTrace = {
  at: string;
  userMessage: string;
  understoodMeaning: string;
  goals: ConsultantGoal[];
  contextUsed: {
    recentTurnCount: number;
    tripFields: string[];
    services: TravelService[];
    lastOffer?: string;
    lastQuestion?: string;
    searchActive: boolean;
  };
  actionSequence: ValidatedAction['type'][];
  actionsCompleted: string[];
  stateBeforeServices: TravelService[];
  stateAfterServices: TravelService[];
  providerActions: Array<{ kind: string; detail: string }>;
  replyPreview: string;
  inventedServicesOnTurn: false | true;
  inventedPricesAvailabilityOrBookings: false;
  canonicalModifiedByValidatedActionsOnly: true;
};

export type ConsultantTurnResult = {
  state: ConversationState;
  reply: string;
  decision: ConsultantTurnDecision;
  observation: ActionObservation;
  trace: ConsultantTrace;
  activateSearch: boolean;
  continueSearch: boolean;
  servicesToSearch: TravelService[];
  searchSessionActive: boolean;
  searchPerformed: boolean;
};
