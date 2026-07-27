/** Travel Understanding Engine — schema v5 (clean rebuild). */

export const CONVERSATION_SCHEMA_VERSION = 5 as const;

export type TravelServiceKind =
  | 'flights'
  | 'accommodation'
  | 'car_hire'
  | 'transfers'
  | 'activities';

export type FieldSource = 'explicit' | 'inferred';

export type FieldValue<T> = {
  value: T;
  source: FieldSource;
  confirmed: boolean;
};

export type ExactDate = {
  kind: 'exact';
  isoDate: string;
  label: string;
  day: number;
  month: number;
  year: number;
};

export type ApproximateDate = {
  kind: 'approximate';
  period: 'early' | 'mid' | 'late';
  month: number;
  year: number;
  label: string;
};

export type UnresolvedDate = {
  kind: 'unresolved';
  label: string;
  month?: number;
  year?: number;
};

export type DepartureDate = ExactDate | ApproximateDate | UnresolvedDate;

export type ReturnDate = {
  isoDate?: string;
  label: string;
  weekday?: number;
  weekend?: boolean;
  day?: number;
  month?: number;
  year?: number;
};

export type ClarificationField = 'origin' | 'destination' | 'departureDate' | 'returnDate';

/**
 * Base message classes from classify. Post-requirements decisions may remap
 * natural approvals to start_search before compose.
 */
export type MessageClass =
  | 'greeting'
  | 'thanks'
  | 'new_conversation'
  | 'clarification_answer'
  | 'travel_request'
  | 'explicit_change'
  | 'explicit_removal'
  | 'summary'
  | 'final_confirmation'
  | 'start_search'
  | 'booking_generation'
  | 'itinerary_generation'
  | 'pricing_request'
  | 'hotel_recommendation'
  | 'flight_recommendation'
  | 'decline_search'
  | 'rejection'
  | 'general_conversation';

/** Readiness only — not a conversation controller. */
export type ConversationPhase = 'requirements' | 'ready' | 'locked';

/** Last assistant-offered action — enables human continuity. */
export type AssistantOffer = {
  kind: 'start_search';
  atTurn: number;
};

export type ConversationState = {
  schemaVersion: typeof CONVERSATION_SCHEMA_VERSION;
  conversationId: string;
  phase: ConversationPhase;
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  departureDate?: FieldValue<DepartureDate>;
  returnDate?: FieldValue<ReturnDate>;
  durationNights?: FieldValue<number>;
  accommodationArea?: FieldValue<string>;
  services: TravelServiceKind[];
  excludedServices: TravelServiceKind[];
  travellers?: FieldValue<number>;
  preferences: string[];
  pendingClarification?: ClarificationField;
  /** When set, short approvals ("go ahead", "ready…") continue this offer. */
  lastOffer?: AssistantOffer;
  changeHistory: Array<{ turn: number; fields: string[]; snippet: string }>;
  turnCount: number;
  updatedAt: string;
  lastChangedFields: string[];
};

export type TravelPatch = {
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  departureDate?: FieldValue<DepartureDate>;
  returnDate?: FieldValue<ReturnDate>;
  durationNights?: FieldValue<number>;
  accommodationArea?: FieldValue<string>;
  servicesAdd?: TravelServiceKind[];
  servicesRemove?: TravelServiceKind[];
  travellers?: FieldValue<number>;
  preferencesAdd?: string[];
  explicitChanges: string[];
  clearFields: string[];
  messageClass?: MessageClass;
};

export type Clarification = {
  needed: boolean;
  field?: ClarificationField;
  question?: string;
};

export type TravelTurnResult = {
  state: ConversationState;
  reply: string;
  clarification: Clarification;
  /** True only on the turn that starts live search. */
  activateSearch: boolean;
  servicesToSearch: TravelServiceKind[];
  searchPerformed: boolean;
};

export function createEmptyConversationState(conversationId?: string): ConversationState {
  return {
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    conversationId: conversationId ?? `conv-${Math.random().toString(36).slice(2, 10)}`,
    phase: 'requirements',
    services: [],
    excludedServices: [],
    preferences: [],
    changeHistory: [],
    turnCount: 0,
    updatedAt: new Date().toISOString(),
    lastChangedFields: [],
  };
}
