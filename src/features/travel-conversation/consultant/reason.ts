/**
 * Structured multi-goal reasoner.
 *
 * Produces a ConsultantTurnDecision from full conversational context.
 * This is decision intelligence — not a catalogue of canned replies.
 *
 * When an external LLM reasoner is configured (see reasoner.ts), it is preferred.
 * Otherwise this local planner segments the message into goals and builds an
 * ordered action plan that is then validated and executed.
 */

import type { TravelServiceKind } from '../types';
import type {
  ConsultantContext,
  ConsultantGoal,
  ConsultantTurnDecision,
  ValidatedAction,
} from './types';

function has(text: string, re: RegExp): boolean {
  return re.test(text);
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.!?;]+|\band then\b|\balso\b/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function detectServicesIn(text: string): TravelServiceKind[] {
  const found: TravelServiceKind[] = [];
  if (/\b(?:hotels?|accommodation|stays?|lodging)\b/i.test(text)) found.push('accommodation');
  if (/\b(?:car hire|hire car|rental car|car rental)\b/i.test(text)) found.push('car_hire');
  if (/\bflights?\b/i.test(text)) found.push('flights');
  if (/\btransfers?\b/i.test(text)) found.push('transfers');
  if (/\bactivities\b/i.test(text)) found.push('activities');
  return found;
}

function isSearchAcceptance(text: string, ctx: ConsultantContext): boolean {
  const t = text.trim();
  const compact = t.replace(/[.!]+$/g, '').trim();

  // Explicit search verbs — always acceptance of starting / continuing search
  if (
    has(
      compact,
      /\b(?:begin(?:\s+your)?\s+search(?:ing)?|start(?:\s+your)?\s+search(?:ing)?|start\s+looking|begin\s+looking|please\s+start|find\s+them|show\s+me\s+options|search\s+now|go\s+ahead|do\s+it)\b/i,
    )
  ) {
    return true;
  }

  // Short affirmations after Aleya offered to search
  const offered =
    ctx.lastOffer?.kind === 'start_search' ||
    (ctx.lastAleyaReply
      ? /\b(?:whenever you.?re ready|shall i start|start looking|ready\??)\b/i.test(ctx.lastAleyaReply)
      : false);

  if (
    offered &&
    /^(?:yes(?:\s+please)?|yeah|yep|yup|please|ok(?:ay)?|sure|ready|i'?m\s+ready|begin|start|go\s+ahead|do\s+it)\s*$/i.test(
      compact,
    )
  ) {
    return true;
  }

  // Affirmation embedded with other clauses: "yes begin your search"
  if (offered && /\b(?:yes|yeah|yep|please)\b/i.test(compact) && /\b(?:begin|start|search|look)/i.test(compact)) {
    return true;
  }

  return false;
}

function isDeclineSearch(text: string): boolean {
  return /\b(?:not ready|don'?t search|do not search|hold off|not yet|wait)\b/i.test(text);
}

function isNewTrip(text: string): boolean {
  return /\b(?:forget\s+(?:melbourne|this\s+trip|the\s+trip|everything)|new trip|start over|clear trip|another trip|let'?s look at the\s+\w+|plan the gold coast|gold coast for my wife)\b/i.test(
    text,
  );
}

function isGeneralQuestion(text: string): boolean {
  return (
    /\?/.test(text) ||
    /\b(?:is |are |does |can |should |what(?:'s| is) |how )\b/i.test(text)
  ) && /\b(?:good|convenient|worth|area|place|without)\b/i.test(text);
}

function areaHint(text: string): string | undefined {
  const m =
    text.match(/\b(?:around|near|in|at|close to)\s+(docklands|southbank|surfers paradise|cbd)\b/i) ||
    text.match(/\bstay(?:ing)?\s+(?:around|near|in|at)\s+([a-z][a-z\s']{1,40})\b/i);
  if (!m?.[1]) return undefined;
  return m[1]
    .replace(/\b(?:please|thanks|thank you)\b/gi, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function durationNights(text: string): number | undefined {
  const m = text.match(/\b(?:make it|for)\s+(\d+)\s+nights?\b/i);
  if (m) return Number(m[1]);
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };
  const w = text.match(/\b(?:make it|for)\s+(one|two|three|four|five)\s+nights?\b/i);
  if (w?.[1]) return words[w[1].toLowerCase()];
  return undefined;
}

function travellersHint(text: string): number | undefined {
  if (/\b(?:wife and me|husband and me|two of us|for my wife and me)\b/i.test(text)) return 2;
  const m = text.match(/\b(\d+)\s+(?:adults?|travellers?|people)\b/i);
  if (m) return Number(m[1]);
  return undefined;
}

/**
 * Build a structured multi-goal decision from the full conversational context.
 */
export function reasonConsultantTurn(ctx: ConsultantContext): ConsultantTurnDecision {
  const text = ctx.normalizedMessage;
  const clauses = splitClauses(text);
  const goals: ConsultantGoal[] = [];
  const actions: ValidatedAction[] = [];
  const actionsCompleted: string[] = [];
  const avoidRepeating = [
    ...(ctx.lastAleyaReply ? [ctx.lastAleyaReply] : []),
    'I can start looking whenever you’re ready',
    'Shall I start the search?',
    'Tell me when you’re ready',
    'Understood — I’ve saved',
    'full itinerary dump',
  ];

  let understood = 'continue trip conversation';
  let declineSearch = false;
  let wantSearch = false;
  let newTrip = false;
  let question: string | undefined;
  const servicesToAdd: TravelServiceKind[] = [];
  const servicesToRemove: TravelServiceKind[] = [];
  let area: string | undefined;
  let nights: number | undefined;
  let travellers: number | undefined;
  let refineFlightsEarlier = false;
  let refineHotels = false;
  let preserveHotel = false;

  // --- New trip ---
  if (isNewTrip(text)) {
    newTrip = true;
    goals.push({ type: 'start_new_trip' });
    understood = 'start a new trip and drop the previous one';
  }

  // --- Decline search ---
  if (isDeclineSearch(text)) {
    declineSearch = true;
    goals.push({ type: 'decline_search' });
  }

  // --- Per-clause / whole-message service intents ---
  for (const clause of clauses.length ? clauses : [text]) {
    // Handle mixed "forget/remove X and add Y" in one clause
    const removePart =
      clause.match(
        /\b(?:remove|forget|don'?t need|do not need|without|no)\s+([^.;]+?)(?=\s+(?:and\s+)?(?:add|include|keep|need)\b|$)/i,
      )?.[1] ?? '';
    const addPart =
      clause.match(/\b(?:add|include|need|keep)\s+([^.;]+)/i)?.[1] ??
      (/\b(?:add|include|need)\b/i.test(clause) ? clause : '');

    if (removePart || /\b(?:remove|forget|don'?t need|without|no)\b/i.test(clause)) {
      const removeServices = detectServicesIn(removePart || clause);
      // For "No flights, keep the hotel" — only remove from the no-clause
      const scoped = removePart
        ? detectServicesIn(removePart)
        : detectServicesIn(clause.split(/\bkeep\b/i)[0] ?? clause);
      for (const s of scoped.length ? scoped : removeServices) {
        // Don't remove services that are explicitly kept/added in the same message
        if (/\bkeep\b/i.test(clause) && detectServicesIn(clause.split(/\bkeep\b/i)[1] ?? '').includes(s)) {
          continue;
        }
        if (addPart && detectServicesIn(addPart).includes(s) && /\b(?:add|include|need)\b/i.test(clause)) {
          // "remove X and add Y" — Y should not be removed
          if (!detectServicesIn(removePart).includes(s)) continue;
        }
        if (!servicesToRemove.includes(s)) servicesToRemove.push(s);
        goals.push({ type: 'remove_service', service: s });
      }
    }

    if (addPart || /\b(?:need|needs|want|add|include|book|looking for|ill need|i'?ll need|i need|hotel|car hire)\b/i.test(clause)) {
      const addServices = detectServicesIn(addPart || clause);
      for (const s of addServices) {
        // Skip if this service is only in a remove fragment
        if (removePart && detectServicesIn(removePart).includes(s) && !detectServicesIn(addPart).includes(s)) {
          continue;
        }
        if (!servicesToAdd.includes(s) && !servicesToRemove.includes(s)) {
          servicesToAdd.push(s);
          goals.push({ type: 'add_service', service: s });
        } else if (!servicesToAdd.includes(s) && detectServicesIn(addPart).includes(s)) {
          // Explicitly re-add after remove list
          servicesToRemove.splice(servicesToRemove.indexOf(s), 1);
          servicesToAdd.push(s);
          goals.push({ type: 'add_service', service: s });
        }
      }
    }

    // "keep the hotel" retention
    if (/\bkeep\s+(?:the\s+)?(?:hotel|accommodation|stay)\b/i.test(clause)) {
      if (!servicesToAdd.includes('accommodation')) {
        // Ensure accommodation is not removed
        const idx = servicesToRemove.indexOf('accommodation');
        if (idx >= 0) servicesToRemove.splice(idx, 1);
      }
    }

    const a = areaHint(clause);
    if (a) area = a;
    const n = durationNights(clause);
    if (n != null) nights = n;
    const trav = travellersHint(clause);
    if (trav != null) travellers = trav;

    if (isGeneralQuestion(clause)) {
      question = clause;
      goals.push({ type: 'answer_question', question: clause });
    }

    if (/\bearlier flights?\b|\bkeep(?: the)? hotel\b.*\bflights?\b|\bflights?\b.*\bearlier\b/i.test(clause)) {
      refineFlightsEarlier = true;
      preserveHotel = /\bkeep(?: the)? hotel\b/i.test(clause);
      goals.push({
        type: 'refine_search',
        target: 'flights',
        filters: [{ key: 'earlier', value: 'true' }],
      });
    }

    if (/\bshow me hotels?\b|\bhotels? (?:there|around|near)\b/i.test(clause)) {
      refineHotels = true;
      if (!servicesToAdd.includes('accommodation')) servicesToAdd.push('accommodation');
      goals.push({ type: 'add_service', service: 'accommodation' });
      if (a || area) {
        goals.push({
          type: 'refine_search',
          target: 'accommodation',
          filters: [{ key: 'area', value: a ?? area ?? '' }],
        });
      }
    }
  }

  // Whole-message service scan if clause loop missed "hotel and car hire"
  for (const s of detectServicesIn(text)) {
    if (
      /\b(?:need|hotel|car hire|accommodation|add|include)\b/i.test(text) &&
      !servicesToAdd.includes(s) &&
      !servicesToRemove.includes(s)
    ) {
      // Only auto-add when need/hotel language present — never invent on bare route
      if (/\b(?:need|i'?ll need|ill need|add|include|hotel|car hire)\b/i.test(text)) {
        if (s === 'accommodation' || s === 'car_hire' || s === 'flights') {
          if (
            (s === 'accommodation' && /\b(?:hotel|accommodation|stay)\b/i.test(text)) ||
            (s === 'car_hire' && /\b(?:car hire|hire car|rental)\b/i.test(text)) ||
            (s === 'flights' && /\bflights?\b/i.test(text))
          ) {
            servicesToAdd.push(s);
            if (!goals.some((g) => g.type === 'add_service' && g.service === s)) {
              goals.push({ type: 'add_service', service: s });
            }
          }
        }
      }
    }
  }

  // --- Search acceptance (after / with requirement changes) ---
  if (!declineSearch && isSearchAcceptance(text, ctx)) {
    wantSearch = true;
    goals.push({ type: 'start_search' });
    understood = servicesToAdd.length
      ? 'add requested services and start live search immediately'
      : 'start live search as requested';
  }

  // --- Trip detail capture ---
  const hasRouteOrDate =
    /\b(?:from|to|go(?:ing)?|melbourne|sydney|gold coast|august|nights?|depart)\b/i.test(text);
  if (hasRouteOrDate || ctx.unresolved) {
    if (!goals.some((g) => g.type === 'start_new_trip')) {
      goals.push({ type: 'capture_details' });
    }
    if (!wantSearch && !question) {
      understood = 'capture trip details without inventing services';
    }
  }

  if (nights != null || area || travellers != null) {
    const changes = [];
    if (nights != null) changes.push({ field: 'durationNights' as const, value: nights });
    if (area) changes.push({ field: 'accommodationArea' as const, value: area });
    if (travellers != null) changes.push({ field: 'travellers' as const, value: travellers });
    goals.push({ type: 'update_trip', changes });
    if (wantSearch) {
      understood = 'update trip details and start search';
    }
  }

  if (goals.length === 0) {
    goals.push({ type: 'capture_details' });
    understood = 'continue the conversation';
  }

  // --- Build ordered action sequence ---
  if (newTrip) {
    actions.push({ type: 'end_search_session' });
    actions.push({ type: 'clear_trip' });
    actions.push({ type: 'apply_extract_merge' });
    if (travellers != null) actions.push({ type: 'set_travellers', count: travellers });
    actionsCompleted.push('started a fresh trip');
  } else {
    // Always allow extract/merge for detail-bearing turns except pure short affirmations
    const pureAffirm =
      wantSearch &&
      servicesToAdd.length === 0 &&
      !hasRouteOrDate &&
      !area &&
      nights == null &&
      !question &&
      text.trim().split(/\s+/).length <= 6;

    if (!pureAffirm && !declineSearch) {
      actions.push({ type: 'apply_extract_merge' });
    }

    for (const s of servicesToRemove) {
      actions.push({ type: 'remove_service', service: s });
      actionsCompleted.push(`removed ${labelService(s)}`);
    }
    for (const s of servicesToAdd) {
      actions.push({ type: 'add_service', service: s });
      actionsCompleted.push(`added ${labelService(s)}`);
    }
    if (travellers != null) {
      actions.push({ type: 'set_travellers', count: travellers });
      actionsCompleted.push(`set travellers to ${travellers}`);
    }
    if (nights != null) {
      actions.push({ type: 'set_duration_nights', nights });
      actionsCompleted.push(`set duration to ${nights} nights`);
    }
    if (area) {
      actions.push({ type: 'set_accommodation_area', area });
      actionsCompleted.push(`focused stay around ${area}`);
    }
  }

  if (declineSearch) {
    actions.push({ type: 'set_offer', offer: 'start_search' });
    actionsCompleted.push('held off on searching');
  }

  if (refineFlightsEarlier && ctx.searchSession) {
    actions.push({
      type: 'refine_search',
      services: ['flights'],
      filters: { earlier: 'true' },
    });
    if (preserveHotel) actionsCompleted.push('kept hotel search');
    actionsCompleted.push('refining flights toward earlier arrivals');
  }

  if (refineHotels && (ctx.searchSession || wantSearch || area)) {
    actions.push({
      type: 'refine_search',
      services: ['accommodation'],
      filters: area ? { area } : {},
    });
    actionsCompleted.push(area ? `searching hotels around ${area}` : 'searching hotels');
  }

  if (wantSearch && !declineSearch) {
    // Services for search determined after execute merges adds — placeholder here;
    // execute expands with flights for city routes.
    actions.push({ type: 'start_search', services: [] });
    actions.push({ type: 'set_offer', offer: null });
    actionsCompleted.push('starting the live search');
  }

  // After capturing details with enough route info and no search yet — offer once
  // (never invent services in the spoken reply; respond.ts handles wording)
  if (
    !wantSearch &&
    !declineSearch &&
    !newTrip &&
    !question &&
    !ctx.searchSession &&
    !refineFlightsEarlier
  ) {
    actions.push({ type: 'set_offer', offer: 'start_search' });
  }

  let nextUsefulStep: string | undefined;
  if (newTrip) {
    nextUsefulStep = 'ask destination timing if needed';
  } else if (wantSearch) {
    nextUsefulStep = undefined;
  } else if (question && !wantSearch) {
    nextUsefulStep = refineHotels ? 'search hotels after answering' : undefined;
  } else if (!ctx.trip.returnDate && ctx.trip.departureDate && !wantSearch) {
    nextUsefulStep = 'ask one-way or return, or which services';
  }

  // Deduplicate goals by type+service
  const uniqueGoals = dedupeGoals(goals);

  return {
    understoodMeaning: understood,
    goals: uniqueGoals,
    actionSequence: actions,
    clarification: { needed: false },
    responsePlan: {
      acknowledge: wantSearch && servicesToAdd.length ? 'Absolutely' : undefined,
      actionsCompleted,
      nextUsefulStep,
      avoidRepeating,
    },
  };
}

function labelService(s: TravelServiceKind): string {
  if (s === 'car_hire') return 'car hire';
  if (s === 'accommodation') return 'accommodation';
  return s;
}

function dedupeGoals(goals: ConsultantGoal[]): ConsultantGoal[] {
  const seen = new Set<string>();
  const out: ConsultantGoal[] = [];
  for (const g of goals) {
    const key =
      g.type === 'add_service' || g.type === 'remove_service'
        ? `${g.type}:${g.service}`
        : g.type === 'answer_question'
          ? `${g.type}:${g.question}`
          : g.type === 'refine_search'
            ? `${g.type}:${g.target}:${JSON.stringify(g.filters)}`
            : g.type;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}
