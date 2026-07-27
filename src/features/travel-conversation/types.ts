/** Travel Conversation Engine — schema v3 (clean rebuild). */

export const CONVERSATION_SCHEMA_VERSION = 3 as const;

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
  /** True when the user stated or confirmed this value. */
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

export type MidMonthDate = {
  kind: 'mid_month';
  month: number;
  year: number;
  label: string;
};

export type MonthEndDate = {
  kind: 'month_end';
  month: number;
  year: number;
  label: string;
  weekday?: number;
};

export type UnresolvedDate = {
  kind: 'unresolved';
  label: string;
  month?: number;
  year?: number;
};

export type DepartureDate = ExactDate | MidMonthDate | MonthEndDate | UnresolvedDate;

export type ReturnDate = {
  isoDate?: string;
  label: string;
  weekday?: number;
  day?: number;
  month?: number;
  year?: number;
};

export type ConversationState = {
  schemaVersion: typeof CONVERSATION_SCHEMA_VERSION;
  conversationId: string;
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  departureDate?: FieldValue<DepartureDate>;
  returnDate?: FieldValue<ReturnDate>;
  accommodationArea?: FieldValue<string>;
  durationNights?: FieldValue<number>;
  services: TravelServiceKind[];
  turnCount: number;
  updatedAt: string;
  /** Internal: fields changed on the last turn. */
  lastChangedFields: string[];
};

export type ExtractionPatch = {
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  departureDate?: FieldValue<DepartureDate>;
  returnDate?: FieldValue<ReturnDate>;
  accommodationArea?: FieldValue<string>;
  durationNights?: FieldValue<number>;
  servicesAdd?: TravelServiceKind[];
  servicesRemove?: TravelServiceKind[];
  /** Fields the user explicitly set or corrected this turn. */
  explicitChanges: string[];
  /** Clear these fields entirely (e.g. forget that date). */
  clearFields: string[];
  isGreeting?: boolean;
  isThanks?: boolean;
  isNewConversation?: boolean;
};

export type Clarification = {
  needed: boolean;
  field?: string;
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
    services: [],
    turnCount: 0,
    updatedAt: new Date().toISOString(),
    lastChangedFields: [],
  };
}
