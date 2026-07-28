/** Travel Understanding Engine — schema v7 (structured locations + destination discovery). */

export const CONVERSATION_SCHEMA_VERSION = 7 as const;

export type DestinationDiscoveryState =
  import('./destination-discovery').DestinationDiscoveryState;

export type StoredTravelLocation = import('../travel-location-intelligence').StoredTravelLocation;

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

/**
 * Trip field identity for role assignment when the engine is awaiting an answer.
 * Domain tool input — not a dialogue planner.
 */
export type TripField =
  | 'origin'
  | 'destination'
  | 'departureDate'
  | 'returnDate'
  | 'services'
  | 'tripType';

/** Canonical trip requirements — facts only. No dialogue orchestration. */
export type ConversationState = {
  schemaVersion: typeof CONVERSATION_SCHEMA_VERSION;
  conversationId: string;
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  /** Structured geography for origin (optional; string fields remain canonical display). */
  originPlace?: StoredTravelLocation;
  /** Structured geography for destination. */
  destinationPlace?: StoredTravelLocation;
  /** Structured accommodation locality (suburb / neighbourhood / beach). */
  accommodationPlace?: StoredTravelLocation;
  departureDate?: FieldValue<DepartureDate>;
  returnDate?: FieldValue<ReturnDate>;
  durationNights?: FieldValue<number>;
  accommodationArea?: FieldValue<string>;
  services: TravelServiceKind[];
  excludedServices: TravelServiceKind[];
  travellers?: FieldValue<number>;
  preferences: string[];
  /** Destination-discovery session; absent/inactive = named-destination booking. */
  discovery?: DestinationDiscoveryState;
  changeHistory: Array<{ turn: number; fields: string[]; snippet: string }>;
  turnCount: number;
  updatedAt: string;
  lastChangedFields: string[];
};

export type TravelPatch = {
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  originPlace?: StoredTravelLocation;
  destinationPlace?: StoredTravelLocation;
  accommodationPlace?: StoredTravelLocation;
  departureDate?: FieldValue<DepartureDate>;
  returnDate?: FieldValue<ReturnDate>;
  durationNights?: FieldValue<number>;
  accommodationArea?: FieldValue<string>;
  servicesAdd?: TravelServiceKind[];
  servicesRemove?: TravelServiceKind[];
  travellers?: FieldValue<number>;
  preferencesAdd?: string[];
  discovery?: DestinationDiscoveryState;
  explicitChanges: string[];
  clearFields: string[];
};

export type TravelTurnResult = {
  state: ConversationState;
  reply: string;
  /** True only when a brand-new live search session starts. */
  activateSearch: boolean;
  /** True when refining/refreshing an existing search session. */
  continueSearch: boolean;
  servicesToSearch: TravelServiceKind[];
  searchPerformed: boolean;
  searchSessionActive: boolean;
  /** Full progression turn (context → actions → next step → reply). */
  progression: import('./conversation/contracts').ConversationTurnResult;
  /** Temporary PR #29: same-call runtime evidence for the visible reply. */
  runtimeEvidence: import('./turnRuntimeEvidence').TurnRuntimeEvidence;
};

export function createEmptyConversationState(conversationId?: string): ConversationState {
  return {
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    conversationId: conversationId ?? `conv-${Math.random().toString(36).slice(2, 10)}`,
    services: [],
    excludedServices: [],
    preferences: [],
    changeHistory: [],
    turnCount: 0,
    updatedAt: new Date().toISOString(),
    lastChangedFields: [],
  };
}
