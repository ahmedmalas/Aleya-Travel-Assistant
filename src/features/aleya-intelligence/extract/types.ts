import type {
  ApproximateDate,
  FieldValue,
  TimePreference,
  TravellerCounts,
  TravelServiceKind,
  TripPurposeKind,
} from '../types';

/** Single-turn extraction result — merged into conversation state once. */
export type ExtractionPatch = {
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  departureDate?: FieldValue<ApproximateDate>;
  returnDate?: FieldValue<ApproximateDate>;
  departureTimePreference?: FieldValue<TimePreference>;
  returnTimePreference?: FieldValue<TimePreference>;
  dateFlexibility?: FieldValue<'strict' | 'flexible' | 'plus_minus_days'>;
  requestedServices?: TravelServiceKind[];
  removeServices?: TravelServiceKind[];
  accommodationArea?: FieldValue<string>;
  clearAccommodationArea?: boolean;
  durationNights?: FieldValue<number>;
  travellers?: FieldValue<TravellerCounts>;
  tripPurpose?: FieldValue<TripPurposeKind>;
  budget?: FieldValue<{
    amount?: number;
    currency?: string;
    style?: 'budget' | 'mid' | 'luxury';
    relative?: 'cheaper' | 'more_expensive';
  }>;
  roomRequirements?: FieldValue<{ rooms?: number; beds?: string; connecting?: boolean; notes?: string }>;
  airlinePreferences?: FieldValue<{ airlines?: string[]; cabin?: string; directOnly?: boolean; notes?: string }>;
  hotelPreferences?: FieldValue<{ stars?: number; brands?: string[]; amenities?: string[]; notes?: string }>;
  activities?: FieldValue<string[]>;
  dietaryRequirements?: FieldValue<string[]>;
  accessibility?: FieldValue<string[]>;
  loyaltyMemberships?: FieldValue<string[]>;
  specialRequests?: FieldValue<string[]>;
  transportNotes?: FieldValue<string>;
  explicitItineraryIntent?: boolean;
  isGreeting?: boolean;
  isThanks?: boolean;
  isCapabilityQuestion?: boolean;
  isDateConfirmation?: boolean;
  confirmedDateLabel?: string;
  pendingLowConfidenceFields?: string[];
  changedFields?: string[];
  confirmPendingDestination?: boolean;
  declinePendingDestination?: boolean;
  /**
   * Fields the user explicitly changed this turn.
   * Merge may overwrite confirmed state only for these fields.
   */
  explicitChanges?: string[];
};

export type DateParseContext = {
  month?: number;
  year?: number;
};

export type DestinationChange = {
  destination: string;
  area?: string;
};

export type DestinationIntent =
  | { kind: 'none' }
  | { kind: 'retain' }
  | { kind: 'soft'; place: string }
  | { kind: 'hard'; place: string; area?: string }
  | { kind: 'assign'; place: string; area?: string; source: 'confirmed' | 'inferred' };

export type ServiceOps = {
  removeServices: TravelServiceKind[];
  addServices: TravelServiceKind[];
};
