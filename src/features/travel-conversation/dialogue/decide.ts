import { evaluateClarification } from '../clarify';
import type { TravelServiceKind } from '../types';
import type { GoalAnalysis } from './goals';
import type {
  ConversationContext,
  DialogueDecision,
  ResultReference,
  SearchAction,
  StateAction,
} from './types';

function servicesFor(ctx: ConversationContext): TravelServiceKind[] {
  if (ctx.trip.services.length > 0) return [...ctx.trip.services];
  return ['flights', 'accommodation', 'car_hire'];
}

function tripReady(ctx: ConversationContext): boolean {
  const c = evaluateClarification(ctx.trip);
  return Boolean(ctx.trip.destination) && !c.needed;
}

/**
 * Build a structured DialogueDecision from context + goals.
 * Prose is never produced here — only facts and actions.
 */
export function decideDialogue(
  ctx: ConversationContext,
  analysis: GoalAnalysis,
): DialogueDecision {
  const stateActions: StateAction[] = [];
  const searchActions: SearchAction[] = [];
  const resultReferences: ResultReference[] = [];
  const factsToMention: string[] = [];
  const factsNotToRepeat: string[] = [
    'full itinerary dump',
    'phase',
    'schema',
    'intent labels',
  ];
  let purpose = 'continue_naturally';
  let nextStep: string | undefined;
  let clarification: DialogueDecision['clarification'];

  const goals = analysis.goals;

  // New trip — end session, clear, then capture whatever this message already contains
  if (goals.includes('restart_trip')) {
    stateActions.push({ type: 'clear_trip' });
    searchActions.push({ type: 'end_session' });
    stateActions.push({ type: 'apply_extract_merge' });
    purpose = 'welcome_new_trip';
    factsToMention.push('starting a fresh trip');
    if (/\bwife and me|two\b/i.test(ctx.normalizedMessage)) {
      stateActions.push({ type: 'set_travellers', count: 2 });
      factsToMention.push('two travellers');
    }
    nextStep = 'Where would you like to go, and roughly when?';
    return {
      userGoals: goals,
      stateActions,
      searchActions,
      resultReferences,
      responsePlan: { purpose, factsToMention, factsNotToRepeat, nextStep, tone: 'warm' },
    };
  }

  // Always allow extract/merge for detail-bearing turns (except pure affirmations / questions)
  const skipExtract =
    goals.includes('affirm_offer') ||
    goals.includes('casual_conversation') ||
    (goals.includes('general_travel_question') && !goals.includes('provide_trip_details'));

  if (!skipExtract) {
    stateActions.push({ type: 'apply_extract_merge' });
  }

  if (/\bwife and me|two (?:of us|people|travellers|adults)\b/i.test(ctx.normalizedMessage)) {
    stateActions.push({ type: 'set_travellers', count: 2 });
  }

  if (analysis.areaHint) {
    stateActions.push({ type: 'set_accommodation_area', area: analysis.areaHint });
  }

  // General travel question — answer, don't mutate search
  if (goals.includes('general_travel_question') && !goals.includes('refine_results')) {
    purpose = 'answer_travel_question';
    factsToMention.push(analysis.generalQuestion ?? ctx.userMessage);
    return {
      userGoals: goals,
      stateActions: stateActions.filter((a) => a.type !== 'apply_extract_merge'),
      searchActions: [],
      resultReferences,
      responsePlan: {
        purpose,
        factsToMention,
        factsNotToRepeat,
        tone: 'helpful',
      },
    };
  }

  // Affirm / start search
  if (goals.includes('start_live_search') || goals.includes('affirm_offer')) {
    if (!tripReady(ctx) && !goals.includes('provide_trip_details')) {
      const missing = evaluateClarification(ctx.trip);
      purpose = 'need_detail_before_search';
      clarification = {
        reason: 'missing_requirements',
        question: missing.question ?? 'What else should I know before I look?',
        field: missing.field,
      };
      nextStep = clarification.question;
    } else if (ctx.searchSession) {
      purpose = 'search_already_active';
      factsToMention.push('search already running');
      nextStep = 'How would you like to refine the results?';
    } else {
      purpose = 'start_search';
      searchActions.push({ type: 'start', services: servicesFor(ctx) });
      stateActions.push({ type: 'set_offer', offer: null });
      factsToMention.push('starting live search');
    }
  }

  // Refinements while search active (or hotel request that should start accommodation focus)
  if (goals.includes('refine_results')) {
    const services = analysis.focusService
      ? [analysis.focusService]
      : (['accommodation'] as TravelServiceKind[]);
    if (ctx.searchSession) {
      purpose = 'refine_active_search';
      searchActions.push({
        type: 'refine',
        services,
        filters: analysis.searchFilters,
      });
      if (analysis.focusService) {
        searchActions.push({ type: 'focus', service: analysis.focusService });
      }
      factsToMention.push(`refining ${services.join(' & ')}`);
      if (analysis.areaHint) factsToMention.push(`area ${analysis.areaHint}`);
      if (analysis.searchFilters.accommodation?.style) {
        factsToMention.push(`style ${analysis.searchFilters.accommodation.style}`);
      }
      if (analysis.preserveFlights) factsToMention.push('keeping flights unchanged');
    } else if (tripReady(ctx)) {
      // User asked for hotels before formally starting — start then refine
      purpose = 'start_then_refine';
      searchActions.push({ type: 'start', services: servicesFor(ctx) });
      searchActions.push({
        type: 'refine',
        services,
        filters: analysis.searchFilters,
      });
      factsToMention.push('looking at accommodation');
      if (analysis.areaHint) factsToMention.push(`around ${analysis.areaHint}`);
    }
  }

  // Result reference / booking
  if (
    (goals.includes('confirm_recommendation') || goals.includes('request_booking')) &&
    analysis.resultOrdinal &&
    analysis.resultService
  ) {
    resultReferences.push({
      service: analysis.resultService,
      ordinal: analysis.resultOrdinal,
      role: goals.includes('request_booking') ? 'select' : 'select',
    });
    purpose = goals.includes('request_booking') ? 'booking_handoff' : 'note_selection';
    factsToMention.push(`selected ${analysis.resultService} #${analysis.resultOrdinal}`);
    if (goals.includes('refine_results') && analysis.focusService === 'flights') {
      // already added refine above
      factsToMention.push('looking for earlier flights');
    }
  }

  // Requirement change after search → refresh
  if (goals.includes('change_requirement') && ctx.searchSession && !goals.includes('refine_results')) {
    purpose = 'refresh_after_change';
    searchActions.push({
      type: 'refresh',
      services: servicesFor(ctx),
    });
    factsToMention.push('updating dates or details');
    factsToMention.push('refreshing affected searches');
  }

  // Providing / clarifying details
  if (
    goals.includes('provide_trip_details') ||
    goals.includes('answer_clarification') ||
    goals.includes('change_requirement')
  ) {
    if (!searchActions.length && !goals.includes('start_live_search')) {
      purpose = purpose === 'continue_naturally' ? 'capture_details' : purpose;
    }
  }

  if (goals.includes('review_trip')) {
    purpose = 'review_trip';
    factsToMention.push('trip overview requested');
  }

  if (goals.includes('decline_search')) {
    purpose = 'decline_search';
    stateActions.push({ type: 'set_offer', offer: 'start_search' });
    factsToMention.push('waiting until you’re ready');
  }

  if (goals.includes('casual_conversation')) {
    purpose = 'casual';
  }

  if (goals.includes('request_itinerary')) {
    purpose = 'itinerary_after_search';
    if (!ctx.searchSession && tripReady(ctx)) {
      searchActions.push({ type: 'start', services: servicesFor(ctx) });
      factsToMention.push('search first, then shape an itinerary from real options');
    }
  }

  // After capture, if ready and no search yet — offer once (not a command menu)
  const willBeReady = tripReady(ctx) || goals.includes('answer_clarification');
  if (
    (purpose === 'capture_details' || purpose === 'continue_naturally') &&
    willBeReady &&
    !ctx.searchSession &&
    !searchActions.some((a) => a.type === 'start') &&
    !goals.includes('decline_search') &&
    !goals.includes('general_travel_question')
  ) {
    // Clarification may still be needed after merge — decide.ts runs before execute.
    // Offer is set post-execute in orchestrate if still ready.
    stateActions.push({ type: 'set_offer', offer: 'start_search' });
    nextStep = nextStep ?? 'I can start looking whenever you’re ready.';
  }

  // Missing origin etc. — one question
  if (!clarification && !ctx.searchSession && purpose === 'capture_details') {
    // Placeholder — orchestrate fills from post-merge clarification
  }

  return {
    userGoals: goals,
    stateActions,
    searchActions,
    resultReferences,
    clarification,
    responsePlan: {
      purpose,
      factsToMention,
      factsNotToRepeat,
      nextStep,
      tone: 'warm',
    },
  };
}
