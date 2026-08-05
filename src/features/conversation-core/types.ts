/**
 * Canonical first-principles conversation-core state.
 *
 * Phase 2C increments turnCount once per completed user-assistant pair.
 * No travel intelligence, persistence, or schema lineage.
 */

/** Reserved for a later persistence piece — not used in this phase. */
export const CONVERSATION_CORE_STORAGE_NAMESPACE =
  'aleya-travel:conversation-core:first-principles' as const;

export type ConversationCoreStatus = 'empty' | 'active';

/** Itinerary shape for single-destination vs multi-city planning. */
export type TripStructureKind = 'one_way' | 'return' | 'multi_city';

/** One ordered hop in a multi-city (or derived single-destination) itinerary. */
export type ConversationTripLeg = {
  origin: string | null;
  destination: string | null;
  departureDate: string | null;
};

/**
 * First-class blocking clarification held on canonical state until answered.
 * Distinct from forbidden legacy `pendingClarification`.
 */
export type OpenClarification = {
  id: string;
  type: 'place_role' | 'trip_structure' | 'date_anchor' | 'generic';
  subject: string;
  prompt: string;
  options: string[];
  blocking: boolean;
  placesInOrder?: string[];
  /** Optional lineage when a clarification was narrowed (architecture Phase 3+). */
  parentClarificationId?: string | null;
  /** How many clarification attempts in this lineage (defaults to 1 when omitted). */
  attemptCount?: number;
};

/** Chronological transcript memory only — not intelligence. */
export type ConversationTranscriptEntry =
  | {
      id: string;
      role: 'user';
      message: string;
      timestamp: string;
    }
  | {
      id: string;
      role: 'assistant';
      message: string;
      timestamp: string;
    };

export type ConversationCoreState = {
  conversationId: string;
  status: ConversationCoreStatus;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
  /** Derived conversation age in milliseconds from createdAt. */
  ageMs: number;
  /** Explicitly supplied destination only — never extracted from message text. */
  destination: string | null;
  /** Explicitly supplied origin only — never extracted from message text. */
  origin: string | null;
  /**
   * Explicit itinerary shape. When multi_city, destinationStops / tripLegs
   * are authoritative for ordered cities; destination mirrors the first stop.
   */
  tripStructure: TripStructureKind | null;
  /**
   * Ordered destination cities for multi-city itineraries. Null when unused.
   */
  destinationStops: string[] | null;
  /**
   * Ordered trip legs derived from origin + destinationStops (and dates when
   * known). Null when unused.
   */
  tripLegs: ConversationTripLeg[] | null;
  /** Explicitly supplied departure date only — never extracted from message text. */
  departureDate: string | null;
  /** Explicitly supplied return date only — never extracted from message text. */
  returnDate: string | null;
  /** Explicitly supplied adult count only — never extracted from message text. */
  adultCount: number | null;
  /** Explicitly supplied child count only — never extracted from message text. */
  childCount: number | null;
  /** Explicitly supplied infant count only — never extracted from message text. */
  infantCount: number | null;
  /** Explicitly supplied flights request flag only — never detected from message text. */
  flightsRequested: boolean | null;
  /** Explicitly supplied accommodation request flag only — never detected from message text. */
  accommodationRequested: boolean | null;
  /** Explicitly supplied car-hire request flag only — never detected from message text. */
  carHireRequested: boolean | null;
  /** Explicitly supplied activities request flag only — never detected from message text. */
  activitiesRequested: boolean | null;
  /** Explicitly supplied restaurants request flag only — never detected from message text. */
  restaurantsRequested: boolean | null;
  /** Explicit dining preference text when restaurants are in scope — never inferred from unrelated mentions. */
  restaurantPreference: string | null;
  /** Explicitly supplied nearby-discovery request flag only — never detected from message text. */
  nearbyDiscoveryRequested: boolean | null;
  /** Explicitly supplied beaches request flag only — never detected from message text. */
  beachesRequested: boolean | null;
  /** Explicitly supplied camping request flag only — never detected from message text. */
  campingRequested: boolean | null;
  /** Explicitly supplied kayaking request flag only — never detected from message text. */
  kayakingRequested: boolean | null;
  /** Explicitly supplied 4WD request flag only — never detected from message text. */
  fourWheelDriveRequested: boolean | null;
  /** Explicitly supplied scenic-drives request flag only — never detected from message text. */
  scenicDrivesRequested: boolean | null;
  /** Explicitly supplied attractions request flag only — never detected from message text. */
  attractionsRequested: boolean | null;
  /** Explicitly supplied snow-activities request flag only — never detected from message text. */
  snowActivitiesRequested: boolean | null;
  /** Explicitly supplied hiking/walking request flag only — never detected from message text. */
  hikingWalkingRequested: boolean | null;
  /** Explicitly supplied fishing request flag only — never detected from message text. */
  fishingRequested: boolean | null;
  /** Explicitly supplied diving/snorkelling request flag only — never detected from message text. */
  divingSnorkellingRequested: boolean | null;
  /** Explicitly supplied wineries/food-trails request flag only — never detected from message text. */
  wineriesFoodTrailsRequested: boolean | null;
  /** Canonical events/festivals capability — extracted from clear affirmative requests. */
  eventsFestivalsRequested: boolean | null;
  /** Explicitly supplied wildlife request flag only — never detected from message text. */
  wildlifeRequested: boolean | null;
  /** Explicitly supplied national-parks request flag only — never detected from message text. */
  nationalParksRequested: boolean | null;
  /** Explicitly supplied tours request flag only — never detected from message text. */
  toursRequested: boolean | null;
  /** Explicitly supplied nightlife request flag only — never detected from message text. */
  nightlifeRequested: boolean | null;
  /** Explicitly supplied shopping request flag only — never detected from message text. */
  shoppingRequested: boolean | null;
  /** Explicitly supplied wellness request flag only — never detected from message text. */
  wellnessRequested: boolean | null;
  /** Explicitly supplied family-activities request flag only — never detected from message text. */
  familyActivitiesRequested: boolean | null;
  /** Explicitly supplied accessible-travel request flag only — never detected from message text. */
  accessibleTravelRequested: boolean | null;
  /**
   * Explicit conversation-completion flag from semantic interpretation.
   * When true, optional follow-ups stop and the planner moves to trip
   * summary / search readiness. Never inferred from message text here.
   */
  conversationComplete: boolean | null;
  /**
   * Explicit search-execution request from semantic interpretation.
   * When true, the planner leaves trip-ready summary and advances to
   * search execution. Never inferred from message text here.
   */
  searchExecutionRequested: boolean | null;
  /**
   * When true, an amendment reopened planning; once core trip fields (and
   * required passenger counts) are present again, mapping restores
   * conversationComplete / search-ready. Never inferred from message text here.
   */
  amendmentResumeSearchReady: boolean | null;
  /**
   * Blocking clarification the consultant is waiting on. While set, the
   * turn governor prefers resolving this over ladder-style asks.
   */
  openClarification: OpenClarification | null;
  /**
   * Opaque conversational dialogue ownership (last move, obligations, thread).
   * Owned by the dialogue layer — not a travel field and not a slot ladder.
   * Shape is defined in conversation-architecture/dialogue; core stores only.
   */
  dialogueState: unknown | null;
  /**
   * TLI enrichment status for destination. Unresolved/ambiguous places
   * remain in `destination` but are unsafe for provider search.
   */
  destinationResolutionStatus:
    | 'resolved'
    | 'unresolved'
    | 'ambiguous'
    | null;
  /**
   * TLI enrichment status for origin. Unresolved/ambiguous places remain
   * in `origin` but are unsafe for provider search.
   */
  originResolutionStatus: 'resolved' | 'unresolved' | 'ambiguous' | null;
  transcript: ConversationTranscriptEntry[];
};

/**
 * Sole public boundary for explicit travel-field updates.
 *
 * Every property is optional. Omitted properties preserve prior state.
 * Explicit `null` / `false` values are stored as supplied — never inferred
 * from message text.
 */
export type ConversationStateUpdate = {
  destination?: string | null;
  origin?: string | null;
  tripStructure?: TripStructureKind | null;
  destinationStops?: string[] | null;
  tripLegs?: ConversationTripLeg[] | null;
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
  restaurantPreference?: string | null;
  nearbyDiscoveryRequested?: boolean | null;
  beachesRequested?: boolean | null;
  campingRequested?: boolean | null;
  kayakingRequested?: boolean | null;
  fourWheelDriveRequested?: boolean | null;
  scenicDrivesRequested?: boolean | null;
  attractionsRequested?: boolean | null;
  snowActivitiesRequested?: boolean | null;
  hikingWalkingRequested?: boolean | null;
  fishingRequested?: boolean | null;
  divingSnorkellingRequested?: boolean | null;
  wineriesFoodTrailsRequested?: boolean | null;
  eventsFestivalsRequested?: boolean | null;
  wildlifeRequested?: boolean | null;
  nationalParksRequested?: boolean | null;
  toursRequested?: boolean | null;
  nightlifeRequested?: boolean | null;
  shoppingRequested?: boolean | null;
  wellnessRequested?: boolean | null;
  familyActivitiesRequested?: boolean | null;
  accessibleTravelRequested?: boolean | null;
  conversationComplete?: boolean | null;
  searchExecutionRequested?: boolean | null;
  amendmentResumeSearchReady?: boolean | null;
  openClarification?: OpenClarification | null;
  dialogueState?: unknown | null;
  destinationResolutionStatus?:
    | 'resolved'
    | 'unresolved'
    | 'ambiguous'
    | null;
  originResolutionStatus?: 'resolved' | 'unresolved' | 'ambiguous' | null;
};

/**
 * Output contract for a future travel-state extraction layer.
 *
 * Contains only the existing explicit update boundary. No metadata,
 * confidence, intents, spans, warnings, or runtime behaviour.
 */
export type ConversationStateExtractionResult = {
  stateUpdate: ConversationStateUpdate;
};

/**
 * Input contract for a future travel-state extraction layer.
 *
 * Contains only the current user message and canonical state. No locale,
 * metadata, options, profile, or provider context.
 */
export type ConversationStateExtractionInput = {
  message: string;
  currentState: ConversationCoreState;
};

/**
 * Public interface every future travel-state extractor must implement.
 *
 * Contract only — no implementation, instantiation, or runtime wiring.
 */
export interface ConversationStateExtractor {
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult;
}

export type CreateInitialConversationCoreStateInput = {
  conversationId: string;
  now: Date;
};

/**
 * Sole public initial-state factory.
 *
 * Deterministic for identical inputs. Does not read time or ID from globals.
 */
export function createInitialConversationCoreState(
  input: CreateInitialConversationCoreStateInput,
): ConversationCoreState {
  const instant = input.now.toISOString();
  return {
    conversationId: input.conversationId,
    status: 'empty',
    turnCount: 0,
    createdAt: instant,
    updatedAt: instant,
    ageMs: 0,
    destination: null,
    origin: null,
    tripStructure: null,
    destinationStops: null,
    tripLegs: null,
    departureDate: null,
    returnDate: null,
    adultCount: null,
    childCount: null,
    infantCount: null,
    flightsRequested: null,
    accommodationRequested: null,
    carHireRequested: null,
    activitiesRequested: null,
    restaurantsRequested: null,
    restaurantPreference: null,
    nearbyDiscoveryRequested: null,
    beachesRequested: null,
    campingRequested: null,
    kayakingRequested: null,
    fourWheelDriveRequested: null,
    scenicDrivesRequested: null,
    attractionsRequested: null,
    snowActivitiesRequested: null,
    hikingWalkingRequested: null,
    fishingRequested: null,
    divingSnorkellingRequested: null,
    wineriesFoodTrailsRequested: null,
    eventsFestivalsRequested: null,
    wildlifeRequested: null,
    nationalParksRequested: null,
    toursRequested: null,
    nightlifeRequested: null,
    shoppingRequested: null,
    wellnessRequested: null,
    familyActivitiesRequested: null,
    accessibleTravelRequested: null,
    conversationComplete: null,
    searchExecutionRequested: null,
    amendmentResumeSearchReady: null,
    openClarification: null,
    dialogueState: null,
    destinationResolutionStatus: null,
    originResolutionStatus: null,
    transcript: [],
  };
}
