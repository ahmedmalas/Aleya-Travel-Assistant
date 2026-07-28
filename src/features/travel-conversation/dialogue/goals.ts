import type { ConversationContext, SearchFilterPatch, UserGoal } from './types';

export type GoalAnalysis = {
  goals: UserGoal[];
  searchFilters: SearchFilterPatch;
  focusService?: 'flights' | 'accommodation' | 'car_hire';
  resultOrdinal?: number;
  resultService?: 'flights' | 'accommodation' | 'car_hire';
  preserveFlights?: boolean;
  preserveHotel?: boolean;
  areaHint?: string;
  newTripHint?: boolean;
  generalQuestion?: string;
};

function has(text: string, re: RegExp) {
  return re.test(text);
}

/**
 * Context-aware goal understanding — uses full conversation context, not only
 * the latest sentence in isolation.
 */
export function analyzeGoals(ctx: ConversationContext): GoalAnalysis {
  const text = ctx.normalizedMessage;
  const lower = text.toLowerCase();
  const goals = new Set<UserGoal>();
  const searchFilters: SearchFilterPatch = {};
  let focusService: GoalAnalysis['focusService'];
  let resultOrdinal: number | undefined;
  let resultService: GoalAnalysis['resultService'];
  let areaHint: string | undefined;
  let generalQuestion: string | undefined;

  // Affirmation of Aleya’s search offer
  if (
    ctx.lastOffer?.kind === 'start_search' &&
    /^(?:yes(?: please)?|yeah|yep|yup|please|go ahead|ok(?:ay)?|sure|do it|sounds good|perfect)\s*[!.]*$/i.test(
      text.trim(),
    )
  ) {
    goals.add('affirm_offer');
    goals.add('start_live_search');
  }

  if (has(lower, /\b(?:new trip|start over|clear trip|another trip|plan the gold coast|gold coast for my wife)\b/)) {
    goals.add('restart_trip');
  }

  if (has(lower, /\b(?:summary|what have you got|review(?: the)? trip|show me everything)\b/)) {
    goals.add('review_trip');
  }

  if (
    has(lower, /\b(?:search(?: for)?(?: my)? trip|start (?:looking|searching)|find (?:everything|options)|show (?:me )?(?:the )?options)\b/) ||
    (/^(?:search now|start searching|begin search)\s*[!.]*$/i.test(text.trim()))
  ) {
    goals.add('start_live_search');
  }

  if (has(lower, /\b(?:don'?t search|not ready|hold off|not yet)\b/)) {
    goals.add('decline_search');
  }

  // Hotel / accommodation refinements
  const hotelCue = has(lower, /\b(?:hotels?|accommodation|stays?|lodging)\b/);
  const areaMatch =
    lower.match(/\b(?:around|near|in|at|close to)\s+(docklands|southbank|surfers paradise|cbd|melbourne|sydney)\b/i) ||
    lower.match(/\b(?:around|near|in|at|close to)\s+([a-z][a-z\s']{1,40})\b/i);
  if (areaMatch?.[1]) {
    areaHint = areaMatch[1]
      .replace(/\b(?:please|thanks|thank you)\b/gi, '')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (hotelCue || (areaHint && ctx.searchSession)) {
    goals.add(ctx.searchSession ? 'refine_results' : 'provide_trip_details');
    focusService = 'accommodation';
    searchFilters.accommodation = {
      ...(areaHint ? { area: areaHint } : {}),
    };
  }

  if (has(lower, /\b(?:luxury|luxurious|5[- ]?star|upscale)\b/) && (hotelCue || ctx.searchSession?.focusService === 'accommodation' || has(lower, /\bsomething\b/))) {
    goals.add('refine_results');
    focusService = 'accommodation';
    searchFilters.accommodation = {
      ...searchFilters.accommodation,
      style: has(lower, /\b(?:not (?:too )?expensive|good value|reasonable|value)\b/)
        ? 'value'
        : 'luxury',
    };
    if (has(lower, /\b(?:not (?:too )?expensive|good value|reasonable|value)\b/)) {
      searchFilters.accommodation.style = 'value';
    }
  }

  if (has(lower, /\b(?:cheaper|less expensive|budget|good value|not too expensive|not ridiculously expensive)\b/)) {
    goals.add('refine_results');
    if (!focusService) focusService = ctx.searchSession?.focusService ?? 'accommodation';
    if (focusService === 'accommodation') {
      searchFilters.accommodation = { ...searchFilters.accommodation, style: 'value' };
    }
  }

  if (has(lower, /\b(?:nice|lovely)\b/) && (hotelCue || has(lower, /\bsomething\b/))) {
    goals.add('refine_results');
    focusService = 'accommodation';
    searchFilters.accommodation = { ...searchFilters.accommodation, style: 'nice' };
  }

  // Flights
  if (has(lower, /\b(?:flights?|direct flights?|earlier|arrive earlier|morning|business class|qantas)\b/)) {
    if (has(lower, /\b(?:only|just)\b.*\bflights?\b|\bflights?\b.*\b(?:only|now)\b/)) {
      goals.add('refine_results');
      focusService = 'flights';
    } else if (has(lower, /\b(?:earlier|arrive earlier|better flights|direct)\b/)) {
      goals.add('refine_results');
      focusService = 'flights';
      searchFilters.flights = {
        earlier: has(lower, /earlier/),
        directOnly: has(lower, /direct/),
      };
    } else if (hotelCue && has(lower, /\bkeep(?: the)?(?: same)? flights?\b/)) {
      goals.add('refine_results');
      // preserve flights handled below
    }
  }

  if (has(lower, /\bkeep(?: the)?(?: same)? flights?\b|\bflights? (?:unchanged|the same)\b/)) {
    goals.add('refine_results');
  }

  if (has(lower, /\b(?:car hire|hire car|rental car|smaller car)\b/)) {
    goals.add(ctx.searchSession ? 'refine_results' : 'provide_trip_details');
    if (has(lower, /smaller/)) {
      searchFilters.carHire = { size: 'smaller' };
      goals.add('refine_results');
      focusService = 'car_hire';
    }
  }

  // Result references — never treat bare dates/night counts as ordinals
  const ordinalMatch = lower.match(
    /\b(?:the\s+)?(first|second|third|1st|2nd|3rd|[1-9])(?:\s+(hotel|flight|car|option|one))\b/,
  );
  const bareOrdinal =
    !ordinalMatch &&
    /\b(?:the\s+)?(first|second|third|1st|2nd|3rd)\b/.test(lower) &&
    /\b(?:one|option|that|hotel|flight|car)\b/.test(lower);
  if (
    ordinalMatch ||
    bareOrdinal ||
    has(lower, /\b(?:that one|those flights|the hotel you just|the cheaper hotel)\b/)
  ) {
    goals.add('confirm_recommendation');
    const map: Record<string, number> = {
      first: 1,
      '1st': 1,
      second: 2,
      '2nd': 2,
      third: 3,
      '3rd': 3,
    };
    if (ordinalMatch) {
      resultOrdinal = map[ordinalMatch[1]] ?? Number(ordinalMatch[1]);
      const svc = ordinalMatch[2];
      if (svc?.startsWith('hotel')) resultService = 'accommodation';
      else if (svc?.startsWith('flight')) resultService = 'flights';
      else if (svc?.startsWith('car')) resultService = 'car_hire';
      else if (ctx.searchSession?.focusService) resultService = ctx.searchSession.focusService;
      else resultService = 'accommodation';
    } else if (bareOrdinal) {
      const word = lower.match(/\b(first|second|third|1st|2nd|3rd)\b/)?.[1];
      resultOrdinal = word ? map[word] : undefined;
      resultService = ctx.searchSession?.focusService ?? 'accommodation';
    }
    if (has(lower, /\bbetter flights?|earlier\b/)) {
      goals.add('refine_results');
      focusService = 'flights';
      searchFilters.flights = { ...searchFilters.flights, earlier: true };
    }
  }

  if (has(lower, /\bbook\b/)) {
    goals.add('request_booking');
  }

  if (has(lower, /\bitinerary|day[- ]by[- ]day\b/)) {
    goals.add('request_itinerary');
  }

  // General questions (not state updates)
  if (
    has(lower, /\b(?:is |are |does |can |should |what(?:'s| is) |how )\b/) &&
    has(lower, /\?|good place|convenient|without a car|worth/)
  ) {
    goals.add('general_travel_question');
    generalQuestion = text;
  }

  if (has(lower, /\b(?:hi|hello|hey|thanks|thank you)\b/) && text.trim().split(/\s+/).length <= 4) {
    goals.add('casual_conversation');
  }

  if (has(lower, /\b(?:what are you doing|what(?:'s| is) next|where are we up to)\b/)) {
    goals.add('ask_status');
    goals.add('ask_next_step');
  }

  // Requirement changes
  if (has(lower, /\b(?:actually|change|make it|instead|switch|update)\b/)) {
    goals.add('change_requirement');
  }
  if (has(lower, /\b(?:remove|forget|don'?t need|without)\b/)) {
    goals.add('remove_requirement');
  }

  // Providing details / clarification answers
  if (ctx.unresolved && text.trim().split(/\s+/).length <= 6 && !goals.has('restart_trip')) {
    goals.add('answer_clarification');
  }

  if (
    has(lower, /\b(?:want to go|need|looking for|travelling|traveling|flights?|hotel|nights?|august|from )\b/) &&
    !goals.has('affirm_offer')
  ) {
    goals.add('provide_trip_details');
  }

  if (has(lower, /\bwife and me|two (?:of us|people|travellers|adults)|for (?:my )?wife\b/)) {
    goals.add('provide_trip_details');
  }

  if (goals.size === 0) {
    if (ctx.searchSession) goals.add('ask_next_step');
    else goals.add('provide_trip_details');
  }

  return {
    goals: [...goals],
    searchFilters,
    focusService,
    resultOrdinal,
    resultService,
    preserveFlights: has(lower, /\bkeep(?: the)?(?: same)? flights?\b/),
    preserveHotel: has(lower, /\bkeep(?: the)?(?: same)? hotel\b/),
    areaHint,
    newTripHint: goals.has('restart_trip'),
    generalQuestion,
  };
}
