/**
 * Post-requirements decision layer (rebuild).
 *
 * Once requirements are complete, natural human approval starts live search.
 * Continuity: if Aleya offered search, short approvals continue that offer.
 *
 * Does not touch parser, extraction, merge, or canonical trip fields.
 */

import { evaluateClarification } from './clarify';
import type { ComposeBranch } from './debugTrace';
import { summarizeKnown } from './project';
import type {
  Clarification,
  ConversationPhase,
  ConversationState,
  MessageClass,
  TravelServiceKind,
} from './types';

export type PostRequirementsAction =
  | 'start_search'
  | 'summary'
  | 'itinerary'
  | 'booking'
  | 'restart'
  | 'decline_search'
  | 'mutate'
  | 'answer'
  | 'lock'
  | 'clarify';

export type PostRequirementsDecision = {
  action: PostRequirementsAction;
  messageClass: MessageClass;
  reply: string;
  branch: ComposeBranch;
  activateSearch: boolean;
  servicesToSearch: TravelServiceKind[];
  phase: ConversationPhase;
  /** Offer written onto state after this turn (undefined clears). */
  lastOffer?: ConversationState['lastOffer'];
};

const SUMMARY_RE =
  /^(?:show me (?:what you(?:'?ve| have)? got|the trip|everything|a summary)|let'?s review(?: it)?|what have you got|give me a (?:summary|recap)|review (?:the )?(?:trip|it)|summar(?:y|ise|ize)(?:\s+(?:the\s+)?(?:trip|it))?)\s*[!.?]*$/i;

const DECLINE_SEARCH_RE =
  /^(?:i'?m not ready(?: yet)?|not ready(?: yet)?|don'?t search(?: yet)?|do not search(?: yet)?|hold off|wait(?: a (?:sec|second|moment))?|not yet)\s*[!.?]*$/i;

const FINAL_LOCK_RE =
  /^(?:(?:yes[,.]?\s+)?(?:all(?:\s+good\s+and)?\s+)?confirmed|everything(?:'s| is)\s+confirmed|that'?s all confirmed|finali[sz]e it|lock it in)$/i;

/**
 * Natural search-approval phrases — once requirements are complete these
 * must start live search (not ask another menu question).
 */
const SEARCH_APPROVAL_RE =
  /^(?:(?:please\s+)?(?:search now|start searching|begin search|search for me)|ready for live options|i'?m ready(?: for (?:live )?options)?|ready|go ahead|proceed|continue|start|let'?s do it|find them|show me the options|show me what'?s available|book it|let'?s book|find my flights|find everything|find flights|show flights|search hotels|search accommodation|find hotels|search car hire|yes(?: please)?|yep|yeah|do it|ok(?:ay)?(?: then)?|sounds good|perfect)\s*[!.?]*$/i;

/** Continuity approvals after Aleya offered search (short yes/ready forms). */
const CONTINUITY_APPROVAL_RE =
  /^(?:ready(?: for live options)?|i'?m ready|go ahead|proceed|continue|start|let'?s do it|yes(?: please)?|yep|yeah|do it|ok(?:ay)?(?: then)?|perfect|sounds good|search(?: now)?|find them|show me(?: the options)?)\s*[!.?]*$/i;

const BOOKING_INVENT_RE =
  /\b(?:invent(?:\s+(?:the|a|my))?\s+booking|fabricate(?:\s+(?:the|a|my))?\s+booking|make up(?:\s+(?:the|a|my))?\s+booking|fake(?:\s+(?:the|a|my))?\s+booking)\b/i;

const BOOKING_FLOW_RE =
  /^(?:book it|let'?s book|book (?:them|everything|it all))\s*[!.?]*$/i;

const ITINERARY_RE =
  /\b(?:build|create|make|generate|draft)\s+(?:me\s+)?(?:an?\s+|my\s+)?itinerary\b|\bday[- ]by[- ]day\s+plan\b/i;

const MUTATION_HINT_RE =
  /\b(?:change|switch|instead|remove|forget|don'?t need|do not need|without|no more|but|make it|actually)\b/i;

const CLAUSE_SPLIT_RE = /\s*[,;]+\s*|\s+\band\b\s+|\s+\bthen\b\s+|\s+\bbut\b\s+/i;

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/[\u2018\u2019\u2032']/g, "'")
    .replace(/[.!?]+$/g, '')
    .trim();
}

export function requirementsReady(state: ConversationState): boolean {
  return Boolean(state.destination) && !evaluateClarification(state).needed;
}

export function servicesForSearch(state: ConversationState): TravelServiceKind[] {
  if (state.services.length > 0) return [...state.services];
  return ['flights'];
}

/** True when the whole message is natural search approval (no mutation clauses). */
export function isSearchApprovalMessage(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (DECLINE_SEARCH_RE.test(normalized)) return false;
  if (SUMMARY_RE.test(normalized)) return false;
  if (FINAL_LOCK_RE.test(normalized)) return false;
  if (MUTATION_HINT_RE.test(normalized) && !SEARCH_APPROVAL_RE.test(normalized)) {
    return false;
  }
  // Affirm + mutation ("go ahead and change…") must not start search.
  if (MUTATION_HINT_RE.test(normalized)) {
    const clauses = normalized
      .split(CLAUSE_SPLIT_RE)
      .map((part) => part.trim())
      .filter(Boolean);
    if (clauses.length >= 2) return false;
    if (!SEARCH_APPROVAL_RE.test(normalized)) return false;
    // Single clause that still mutates ("continue but remove car hire" split may be 1 if regex differs)
    if (/\b(?:change|remove|forget|switch)\b/i.test(normalized)) return false;
  }
  return SEARCH_APPROVAL_RE.test(normalized);
}

export function isDeclineSearchMessage(text: string): boolean {
  return DECLINE_SEARCH_RE.test(normalizeText(text));
}

function continuesSearchOffer(text: string, previous: ConversationState): boolean {
  if (previous.lastOffer?.kind !== 'start_search') return false;
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (MUTATION_HINT_RE.test(normalized) && !CONTINUITY_APPROVAL_RE.test(normalized)) {
    return false;
  }
  if (MUTATION_HINT_RE.test(normalized)) {
    const clauses = normalized
      .split(CLAUSE_SPLIT_RE)
      .map((part) => part.trim())
      .filter(Boolean);
    if (clauses.length >= 2) return false;
    if (/\b(?:change|remove|forget|switch)\b/i.test(normalized)) return false;
  }
  return CONTINUITY_APPROVAL_RE.test(normalized);
}

function formatSearchReply(state: ConversationState, services: TravelServiceKind[]): string {
  const known = summarizeKnown(state);
  const trip = known.length > 0 ? ` (${known.join('; ')})` : '';
  const labels = services.map((service) => {
    if (service === 'flights') return 'flights';
    if (service === 'accommodation') return 'accommodation';
    if (service === 'car_hire') return 'car hire';
    return service.replace(/_/g, ' ');
  });
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Starting live search for ${list}${trip}. I’m projecting your saved requirements into the providers now — no need to re-enter anything.`;
}

function offerSearchReply(state: ConversationState): string {
  const known = summarizeKnown(state);
  const trip = known.length > 0 ? ` (${known.join('; ')})` : '';
  return `Your requirements look complete${trip}. Shall I start the live search?`;
}

/**
 * Decide what happens after requirements are (or aren't) complete.
 * Call this every turn; mutate path returns action 'mutate' for extract/merge.
 */
export function decidePostRequirements(input: {
  text: string;
  previous: ConversationState;
  state: ConversationState;
  clarification: Clarification;
  baseClass: MessageClass;
}): PostRequirementsDecision {
  const { text, previous, clarification } = input;
  const state = input.state;
  const ready = requirementsReady(state);
  const services = servicesForSearch(state);
  const normalized = normalizeText(text);

  if (input.baseClass === 'new_conversation') {
    return {
      action: 'restart',
      messageClass: 'new_conversation',
      reply: 'Starting fresh — tell me the trip you have in mind.',
      branch: 'new_conversation',
      activateSearch: false,
      servicesToSearch: [],
      phase: 'requirements',
      lastOffer: undefined,
    };
  }

  if (SUMMARY_RE.test(normalized) || input.baseClass === 'summary') {
    return {
      action: 'summary',
      messageClass: 'summary',
      reply: '', // compose fills summary body
      branch: 'summary_review',
      activateSearch: false,
      servicesToSearch: [],
      phase: ready ? (previous.phase === 'locked' ? 'locked' : 'ready') : 'requirements',
      lastOffer: ready
        ? { kind: 'start_search', atTurn: state.turnCount }
        : undefined,
    };
  }

  if (isDeclineSearchMessage(text)) {
    return {
      action: 'decline_search',
      messageClass: 'decline_search',
      reply: ready
        ? 'Okay — I won’t start the search yet. Tell me when you’re ready for live options, or what you’d like to change.'
        : 'Okay. Tell me what you’d like to adjust.',
      branch: 'decline_search',
      activateSearch: false,
      servicesToSearch: [],
      phase: ready ? (previous.phase === 'locked' ? 'locked' : 'ready') : 'requirements',
      lastOffer: ready
        ? { kind: 'start_search', atTurn: state.turnCount }
        : undefined,
    };
  }

  if (FINAL_LOCK_RE.test(normalized) || input.baseClass === 'final_confirmation') {
    if (!ready) {
      return {
        action: 'clarify',
        messageClass: 'final_confirmation',
        reply: clarification.question
          ? `Almost ready. ${clarification.question}`
          : 'Almost ready — share the missing trip details first.',
        branch: 'final_confirmation_needs_clarification',
        activateSearch: false,
        servicesToSearch: [],
        phase: 'requirements',
        lastOffer: undefined,
      };
    }
    return {
      action: 'lock',
      messageClass: 'final_confirmation',
      reply:
        'All confirmed. Your travel requirements are locked in. Shall I start the live search?',
      branch: 'final_confirmation_locked',
      activateSearch: false,
      servicesToSearch: [],
      phase: 'locked',
      lastOffer: { kind: 'start_search', atTurn: state.turnCount },
    };
  }

  // Mutations always win over approval phrasing.
  if (
    input.baseClass === 'explicit_change' ||
    input.baseClass === 'explicit_removal' ||
    input.baseClass === 'travel_request' ||
    input.baseClass === 'clarification_answer' ||
    (MUTATION_HINT_RE.test(normalized) && !isSearchApprovalMessage(text))
  ) {
    return {
      action: 'mutate',
      messageClass: input.baseClass,
      reply: '',
      branch: 'ack_updated',
      activateSearch: false,
      servicesToSearch: [],
      phase: ready ? 'ready' : 'requirements',
      lastOffer: undefined,
    };
  }

  if (BOOKING_INVENT_RE.test(normalized)) {
    return {
      action: 'booking',
      messageClass: 'booking_generation',
      reply:
        'I can’t invent or fabricate bookings. I’ll start a live search with your saved requirements so we can use real provider options.',
      branch: 'booking_generation',
      activateSearch: ready,
      servicesToSearch: ready ? services : [],
      phase: ready ? (previous.phase === 'locked' ? 'locked' : 'ready') : 'requirements',
      lastOffer: ready ? undefined : { kind: 'start_search', atTurn: state.turnCount },
    };
  }

  if (ITINERARY_RE.test(normalized) || input.baseClass === 'itinerary_generation') {
    if (!ready) {
      return {
        action: 'itinerary',
        messageClass: 'itinerary_generation',
        reply:
          'I can build an itinerary from real search results once your requirements are complete. Share the missing details first.',
        branch: 'itinerary_generation',
        activateSearch: false,
        servicesToSearch: [],
        phase: 'requirements',
        lastOffer: undefined,
      };
    }
    return {
      action: 'itinerary',
      messageClass: 'itinerary_generation',
      reply:
        'I don’t invent day plans. Starting live search with your saved requirements first — once real options are back I can shape an itinerary from those.',
      branch: 'itinerary_generation',
      activateSearch: true,
      servicesToSearch: services,
      phase: previous.phase === 'locked' ? 'locked' : 'ready',
      lastOffer: undefined,
    };
  }

  const approval =
    isSearchApprovalMessage(text) ||
    continuesSearchOffer(text, previous) ||
    BOOKING_FLOW_RE.test(normalized) ||
    input.baseClass === 'start_search' ||
    input.baseClass === 'hotel_recommendation' ||
    input.baseClass === 'flight_recommendation' ||
    input.baseClass === 'pricing_request';

  if (approval) {
    if (!ready) {
      const known = summarizeKnown(state);
      return {
        action: 'clarify',
        messageClass: 'start_search',
        reply:
          known.length > 0
            ? `I’ve got ${known.join('; ')}, but I still need a bit more before searching. ${clarification.question ?? 'Share the missing details.'}`
            : 'Share a destination and dates first, then I can start the live search.',
        branch: 'start_search_incomplete',
        activateSearch: false,
        servicesToSearch: [],
        phase: 'requirements',
        lastOffer: undefined,
      };
    }

    return {
      action: 'start_search',
      messageClass: 'start_search',
      reply: formatSearchReply(state, services),
      branch: 'start_search',
      activateSearch: true,
      servicesToSearch: services,
      phase: previous.phase === 'locked' ? 'locked' : 'ready',
      lastOffer: undefined,
    };
  }

  if (
    input.baseClass === 'greeting' ||
    input.baseClass === 'thanks' ||
    input.baseClass === 'rejection' ||
    input.baseClass === 'general_conversation'
  ) {
    if (ready) {
      return {
        action: 'answer',
        messageClass: input.baseClass,
        reply: offerSearchReply(state),
        branch: 'search_offer',
        activateSearch: false,
        servicesToSearch: [],
        phase: previous.phase === 'locked' ? 'locked' : 'ready',
        lastOffer: { kind: 'start_search', atTurn: state.turnCount },
      };
    }
    return {
      action: 'answer',
      messageClass: input.baseClass,
      reply: '',
      branch: 'empty_prompt',
      activateSearch: false,
      servicesToSearch: [],
      phase: 'requirements',
      lastOffer: undefined,
    };
  }

  // Default when ready: offer search (no command menu).
  if (ready && state.lastChangedFields.length === 0 && previous.turnCount > 0) {
    return {
      action: 'answer',
      messageClass: input.baseClass,
      reply: offerSearchReply(state),
      branch: 'search_offer',
      activateSearch: false,
      servicesToSearch: [],
      phase: previous.phase === 'locked' ? 'locked' : 'ready',
      lastOffer: { kind: 'start_search', atTurn: state.turnCount },
    };
  }

  return {
    action: 'mutate',
    messageClass: input.baseClass,
    reply: '',
    branch: 'ack_saved_ready',
    activateSearch: false,
    servicesToSearch: [],
    phase: ready ? 'ready' : 'requirements',
    lastOffer: ready
      ? { kind: 'start_search', atTurn: state.turnCount }
      : undefined,
  };
}
