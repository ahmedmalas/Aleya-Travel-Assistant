/** Aleya Intelligence Layer — shared conversation state and pipeline types. */

export type FieldSource = 'confirmed' | 'inferred';

export type FieldValue<T> = {
  value: T;
  source: FieldSource;
};

export type TravelServiceKind =
  | 'flights'
  | 'hotels'
  | 'car_hire'
  | 'airport_transfers'
  | 'activities'
  | 'cruises'
  | 'rail'
  | 'coaches'
  | 'camping'
  | 'four_wd'
  | 'caravan'
  | 'road_trip'
  | 'itinerary';

export type TripPurposeKind =
  | 'leisure'
  | 'business'
  | 'recurring_business'
  | 'family'
  | 'group'
  | 'luxury'
  | 'budget'
  | 'romantic'
  | 'adventure'
  | 'road_trip'
  | 'camping'
  | 'cruise'
  | 'multi_city'
  | 'international';

export type TimePreference =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'after_5pm'
  | 'flexible';

export type ApproximateDate = {
  kind: 'absolute' | 'relative' | 'month_end' | 'month_start' | 'weekend' | 'suggested';
  /** ISO date when known (YYYY-MM-DD). */
  isoDate?: string;
  /** Human phrase as provided or suggested, e.g. "end of August" or "Friday, 28 August 2026". */
  label: string;
  /** Optional weekday constraint, 0=Sun … 6=Sat. */
  weekday?: number;
  month?: number;
  year?: number;
  timePreference?: TimePreference;
};

export type TravellerCounts = {
  adults: number;
  children: number;
  total: number;
};

export type ConversationState = {
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  intermediateDestinations: FieldValue<string>[];
  departureDate?: FieldValue<ApproximateDate>;
  returnDate?: FieldValue<ApproximateDate>;
  departureTimePreference?: FieldValue<TimePreference>;
  returnTimePreference?: FieldValue<TimePreference>;
  travellers?: FieldValue<TravellerCounts>;
  tripPurpose?: FieldValue<TripPurposeKind>;
  requestedServices: TravelServiceKind[];
  accommodationLocation?: FieldValue<string>;
  accommodationPreferences: string[];
  carHireRequirements: string[];
  vehiclePreferences: string[];
  flightPreferences: string[];
  budget?: FieldValue<{ amount?: number; currency?: string; style?: 'budget' | 'mid' | 'luxury' }>;
  activities: string[];
  campingRequirements: string[];
  fourWdRequirements: string[];
  cruiseRequirements: string[];
  businessRequirements: string[];
  accessibility: string[];
  pets: string[];
  loyaltyPreferences: string[];
  explicitItineraryIntent: boolean;
  missingRequiredFields: string[];
  lastSuggestedDate?: ApproximateDate;
  awaitingDateConfirmation: boolean;
  turnCount: number;
  rawMentions: string[];
};

export type PipelineStage =
  | 'understand'
  | 'extract'
  | 'infer'
  | 'store'
  | 'clarify'
  | 'search'
  | 'compare'
  | 'recommend'
  | 'book'
  | 'continue';

export type OfferSummary = {
  service: TravelServiceKind;
  id: string;
  title: string;
  detail: string;
  priceLabel?: string;
  providerId: string;
  isBookableLive: boolean;
};

export type SearchBundle = {
  flights: OfferSummary[];
  hotels: OfferSummary[];
  carHire: OfferSummary[];
  transfers: OfferSummary[];
  activities: OfferSummary[];
  cruises: OfferSummary[];
  rail: OfferSummary[];
  warnings: string[];
};

export type RecommendationBundle = {
  primary: OfferSummary[];
  rationale: string[];
};

export type IntelligenceResult = {
  stage: PipelineStage;
  state: ConversationState;
  reply: string;
  clarifications: string[];
  search?: SearchBundle;
  recommendations?: RecommendationBundle;
  itineraryRequested: boolean;
  shouldGenerateItinerary: boolean;
  planModeHint?:
    | 'complete'
    | 'family'
    | 'accessible'
    | 'business'
    | 'romantic'
    | 'adventure'
    | 'low-cost'
    | 'luxury'
    | 'leisure';
};

export type ProcessMessageInput = {
  message: string;
  previousState?: ConversationState;
  /** Injectable clock for deterministic date suggestions in tests. */
  now?: Date;
  travellerName?: string;
  currency?: string;
  /** When false, skip provider gateway calls (unit tests for clarify path). */
  runSearch?: boolean;
};

export function createEmptyConversationState(): ConversationState {
  return {
    intermediateDestinations: [],
    requestedServices: [],
    accommodationPreferences: [],
    carHireRequirements: [],
    vehiclePreferences: [],
    flightPreferences: [],
    activities: [],
    campingRequirements: [],
    fourWdRequirements: [],
    cruiseRequirements: [],
    businessRequirements: [],
    accessibility: [],
    pets: [],
    loyaltyPreferences: [],
    explicitItineraryIntent: false,
    missingRequiredFields: [],
    awaitingDateConfirmation: false,
    turnCount: 0,
    rawMentions: [],
  };
}
