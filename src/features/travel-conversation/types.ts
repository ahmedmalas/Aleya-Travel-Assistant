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

export type MessageClass =
  | 'greeting'
  | 'thanks'
  | 'new_conversation'
  | 'clarification_answer'
  | 'travel_request'
  | 'explicit_change'
  | 'explicit_removal'
  | 'summary'
  | 'confirmation'
  | 'rejection'
  | 'non_travel';

/** Conversation workflow phase — requirements gathering through planning. */
export type ConversationPhase =
  | 'requirements'
  | 'review'
  | 'confirmation'
  | 'planning';

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
  searchPerformed: false;
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
