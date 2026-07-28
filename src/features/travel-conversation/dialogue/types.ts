import type {
  ClarificationField,
  ConversationState,
  TravelServiceKind,
  TravelPatch,
} from '../types';

export type UserGoal =
  | 'provide_trip_details'
  | 'answer_clarification'
  | 'change_requirement'
  | 'remove_requirement'
  | 'review_trip'
  | 'start_live_search'
  | 'refine_results'
  | 'compare_options'
  | 'request_recommendation'
  | 'ask_pricing'
  | 'request_itinerary'
  | 'request_booking'
  | 'general_travel_question'
  | 'confirm_recommendation'
  | 'reject_option'
  | 'ask_alternatives'
  | 'restart_trip'
  | 'casual_conversation'
  | 'ask_status'
  | 'ask_next_step'
  | 'affirm_offer'
  | 'decline_search';

export type StateAction =
  | { type: 'apply_extract_merge' }
  | { type: 'set_travellers'; count: number }
  | { type: 'set_preference'; value: string }
  | { type: 'set_accommodation_area'; area: string }
  | { type: 'clear_trip' }
  | { type: 'set_offer'; offer: 'start_search' | null };

export type SearchAction =
  | { type: 'start'; services: TravelServiceKind[] }
  | { type: 'refine'; services: TravelServiceKind[]; filters: SearchFilterPatch }
  | { type: 'refresh'; services: TravelServiceKind[] }
  | { type: 'focus'; service: TravelServiceKind }
  | { type: 'end_session' };

export type SearchFilterPatch = {
  accommodation?: {
    area?: string;
    style?: 'luxury' | 'value' | 'family' | 'nice' | 'any';
    near?: string;
  };
  flights?: {
    cabin?: string;
    directOnly?: boolean;
    earlier?: boolean;
    timePref?: string;
  };
  carHire?: { size?: 'smaller' | 'any' };
};

export type ResultReference = {
  service: TravelServiceKind;
  ordinal?: number; // 1-based
  nameHint?: string;
  role: 'select' | 'compare' | 'ask_about' | 'preserve';
};

export type DialogueDecision = {
  userGoals: UserGoal[];
  stateActions: StateAction[];
  searchActions: SearchAction[];
  resultReferences: ResultReference[];
  clarification?: {
    reason: string;
    question: string;
    field?: ClarificationField;
  };
  responsePlan: {
    purpose: string;
    factsToMention: string[];
    factsNotToRepeat: string[];
    nextStep?: string;
    tone?: 'warm' | 'concise' | 'helpful';
  };
};

export type TranscriptTurn = {
  role: 'user' | 'aleya';
  text: string;
  at: string;
};

export type SearchResultItem = {
  id: string;
  service: TravelServiceKind;
  label: string;
  summary: string;
  /** Never invent live prices — labels are planning placeholders only. */
  planningNote: string;
};

export type ActiveSearchSession = {
  id: string;
  startedAt: string;
  conversationId: string;
  providersQueried: TravelServiceKind[];
  filters: SearchFilterPatch;
  results: SearchResultItem[];
  focusService?: TravelServiceKind;
  selected?: { service: TravelServiceKind; id: string; label: string };
};

export type ConversationContext = {
  userMessage: string;
  normalizedMessage: string;
  recentTurns: TranscriptTurn[];
  trip: ConversationState;
  unresolved?: { field: ClarificationField; question: string };
  searchSession: ActiveSearchSession | null;
  lastOffer?: ConversationState['lastOffer'];
  lastQuestion?: string;
  preferences: string[];
  recentChanges: string[];
  currentAim: string;
};

export type ActionExecutionResult = {
  state: ConversationState;
  patch: TravelPatch;
  searchSession: ActiveSearchSession | null;
  activateSearch: boolean;
  continueSearch: boolean;
  servicesToSearch: TravelServiceKind[];
  selectedResult?: SearchResultItem;
  inventedNothing: true;
};

export type DialogueTrace = {
  at: string;
  userMessage: string;
  userGoals: UserGoal[];
  contextUsed: {
    recentTurnCount: number;
    tripFields: string[];
    searchActive: boolean;
    lastOffer?: string;
    lastQuestion?: string;
    currentAim: string;
  };
  actionsExecuted: {
    state: StateAction['type'][];
    search: SearchAction['type'][];
  };
  responsePlan: DialogueDecision['responsePlan'];
  replyPreview: string;
  canonicalModifiedByValidatedActionsOnly: true;
  inventedPricesAvailabilityOrBookings: false;
};

export type DialogueTurnResult = {
  state: ConversationState;
  reply: string;
  decision: DialogueDecision;
  trace: DialogueTrace;
  activateSearch: boolean;
  continueSearch: boolean;
  servicesToSearch: TravelServiceKind[];
  searchSessionActive: boolean;
  searchPerformed: boolean;
};
