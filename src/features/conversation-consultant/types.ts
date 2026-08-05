/**
 * Consultant turn types — SituationModel, ConsultantAct.
 * OpenClarification lives on conversation-core canonical state.
 */

import type {
  ConversationStateUpdate,
  OpenClarification,
} from '../conversation-core';

export type { OpenClarification };

export type ConsultantIntent =
  | 'inform'
  | 'correct'
  | 'confirm'
  | 'amend'
  | 'complete'
  | 'clarify_answer'
  | 'unknown';

export type SituationAmbiguityType =
  | 'place_role'
  | 'trip_structure'
  | 'date_anchor'
  | 'generic';

export type SituationAmbiguity = {
  id: string;
  type: SituationAmbiguityType;
  subject: string;
  options: string[];
  reason: string;
  blocking: boolean;
  /** Ordered places related to this ambiguity (journey candidates). */
  placesInOrder?: string[];
};

export type SituationHypothesis = {
  id: string;
  kind: 'trip_structure' | 'journey_places' | 'service' | 'other';
  value: string;
  confidence: number;
};

export type SituationFacts = {
  origin?: string | null;
  destination?: string | null;
  destinationStops?: string[] | null;
  tripStructure?: 'one_way' | 'return' | 'multi_city' | null;
  departureDate?: string | null;
  returnDate?: string | null;
  adultCount?: number | null;
  childCount?: number | null;
  infantCount?: number | null;
  flightsRequested?: boolean | null;
  accommodationRequested?: boolean | null;
  carHireRequested?: boolean | null;
  activitiesRequested?: boolean | null;
  restaurantsRequested?: boolean | null;
  conversationComplete?: boolean | null;
  searchExecutionRequested?: boolean | null;
  amendmentResumeSearchReady?: boolean | null;
  openClarification?: OpenClarification | null;
};

export type SituationModel = {
  message: string;
  intent: ConsultantIntent;
  /** Facts safe to commit this turn (clarify-before-write already applied). */
  facts: SituationFacts;
  hypotheses: SituationHypothesis[];
  ambiguities: SituationAmbiguity[];
  confidence: number;
  /** Places mentioned this turn, message order, canonicalised when known. */
  placesInOrder: string[];
  /**
   * Validated ConversationStateUpdate after clarify-before-write filtering.
   * Source of truth for commits (includes non-place interpretation fields).
   */
  proposedUpdate: ConversationStateUpdate;
};

export type ConsultantActKind =
  | 'clarify'
  | 'ask'
  | 'confirm'
  | 'amend'
  | 'summarise'
  | 'execute';

export type ConsultantAskTopic =
  | 'destination'
  | 'destinationStops'
  | 'origin'
  | 'departureDate'
  | 'returnDate'
  | 'adultCount'
  | 'childCount'
  | 'infantCount'
  | 'services'
  | 'optional';

export type ConsultantAct = {
  kind: ConsultantActKind;
  /** Human-facing reply body produced by the governor. */
  reply: string;
  /** For ask acts — readiness gap being addressed (not a form slot driver). */
  askTopic?: ConsultantAskTopic;
  clarification?: OpenClarification;
  confidence: number;
};
