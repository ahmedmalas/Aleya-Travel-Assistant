/**
 * Conversation progression contracts — sole orchestration types.
 * Defined from first principles. Not mapped from consultant.
 */

import type { ConversationState, TravelServiceKind, TripField } from '../types';

export type TravelService = TravelServiceKind;

export type MissingRequirementId =
  | 'destination'
  | 'origin'
  | 'departureDate'
  | 'tripType'
  | 'services';

export type MissingRequirement = {
  id: MissingRequirementId;
  priority: number;
  question: string;
};

export type KnownTripFacts = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  services: TravelService[];
  travellers?: number;
  accommodationArea?: string;
  tripType?: 'one_way' | 'return';
};

export type TripCompleteness = {
  known: KnownTripFacts;
  missing: MissingRequirement[];
  nextRequiredField: MissingRequirement | null;
  readyToSearch: boolean;
};

export type UserObjective =
  | 'collect_trip_requirements'
  | 'discover_destination'
  | 'authorise_search'
  | 'refine_active_search'
  | 'change_trip'
  | 'ask_destination_advice';

export type TurnGoal =
  | { kind: 'provide_trip_facts' }
  | { kind: 'provide_discovery_criteria' }
  | {
      kind: 'select_discovery_destination';
      placeName: string;
      candidateId?: string;
    }
  | { kind: 'reject_discovery_recommendations' }
  | { kind: 'add_services'; services: TravelService[] }
  | { kind: 'remove_services'; services: TravelService[] }
  | { kind: 'set_travellers'; count: number }
  | { kind: 'set_nights'; nights: number }
  | { kind: 'set_area'; area: string }
  | { kind: 'set_trip_type'; value: 'one_way' | 'return' }
  | { kind: 'authorise_search' }
  | { kind: 'decline_search' }
  | { kind: 'refine_flights'; filters: Record<string, string> }
  | { kind: 'refine_hotels'; filters: Record<string, string> }
  | { kind: 'start_new_trip' }
  | { kind: 'answer_area_question'; topic: string };

export type PlannedAction =
  | { type: 'reset_trip_preserving_preferences' }
  | { type: 'end_search_session' }
  | { type: 'apply_validated_trip_changes' }
  | { type: 'collect_discovery_criteria' }
  | { type: 'ask_discovery_question'; questionId: string }
  | { type: 'recommend_destinations' }
  | { type: 'refine_destination_recommendations' }
  | {
      type: 'resolve_selected_destination';
      placeName: string;
      candidateId?: string;
    }
  | { type: 'transition_to_booking' }
  | { type: 'add_services'; services: TravelService[] }
  | { type: 'remove_services'; services: TravelService[] }
  | { type: 'set_travellers'; count: number }
  | { type: 'set_nights'; nights: number }
  | { type: 'set_area'; area: string }
  | { type: 'set_trip_type'; value: 'one_way' | 'return' }
  | { type: 'start_search' }
  | { type: 'refine_search'; services: TravelService[]; filters: Record<string, string> };

export type ExecutedResult = {
  type: string;
  detail: string;
  ok: boolean;
};

export type ProviderObservation = {
  activateSearch: boolean;
  continueSearch: boolean;
  servicesToSearch: TravelService[];
  resultsSummary?: string;
  /** Verified provider launch outcomes — required before describing search start. */
  launchResults?: import('../search-projection/types').ProviderLaunchResult[];
};

export type ConversationalStep =
  | { kind: 'ask_missing_field'; field: MissingRequirement }
  | {
      kind: 'ask_discovery_question';
      questionId: string;
      question: string;
    }
  | {
      kind: 'recommend_destinations';
      candidates: import('../destination-discovery').DiscoveryCandidate[];
    }
  | { kind: 'offer_search' }
  | {
      kind: 'report_search_started';
      services: TravelService[];
      launchResults: import('../search-projection/types').ProviderLaunchResult[];
    }
  | { kind: 'report_search_refined'; services: TravelService[] }
  | { kind: 'answer_then_continue'; answer: string; continueWith?: MissingRequirement | null }
  | { kind: 'acknowledge_and_continue'; note: string; continueWith: MissingRequirement | null };

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
};

export type ConversationContext = {
  userMessage: string;
  normalizedMessage: string;
  recentTurns: TranscriptTurn[];
  trip: ConversationState;
  lastAleyaReply?: string;
  /** Field the previous turn asked for — domain hint for assignRoles. */
  awaitingField?: TripField;
  /** Structured options from the latest option-based Aleya question. */
  activeOptionSet?: import('../contextual-reference').ActiveOptionSet | null;
  searchSession: ActiveSearchSession | null;
  searchPreviouslyOffered: boolean;
  tripType?: 'one_way' | 'return';
  now: Date;
};

export type TurnTrace = {
  at: string;
  userMessage: string;
  objective: UserObjective;
  goals: TurnGoal['kind'][];
  knownFacts: KnownTripFacts;
  missingRequirements: MissingRequirementId[];
  nextRequiredField: MissingRequirementId | null;
  plannedActions: PlannedAction['type'][];
  executedResults: ExecutedResult[];
  conversationalStep: ConversationalStep['kind'];
  stateBefore: {
    origin?: string;
    destination?: string;
    services: TravelService[];
  };
  stateAfter: {
    origin?: string;
    destination?: string;
    services: TravelService[];
  };
  reply: string;
};

export type ConversationTurnResult = {
  state: ConversationState;
  reply: string;
  objective: UserObjective;
  goals: TurnGoal[];
  completeness: TripCompleteness;
  nextRequiredField: MissingRequirement | null;
  plannedActions: PlannedAction[];
  executedResults: ExecutedResult[];
  provider: ProviderObservation;
  conversationalStep: ConversationalStep;
  trace: TurnTrace;
  /** Temporary PR #29 preview: per-turn runtime identity from this call. */
  runtimeEvidence: import('../turnRuntimeEvidence').TurnRuntimeEvidence;
  activateSearch: boolean;
  continueSearch: boolean;
  servicesToSearch: TravelService[];
  searchSessionActive: boolean;
  searchPerformed: boolean;
};
