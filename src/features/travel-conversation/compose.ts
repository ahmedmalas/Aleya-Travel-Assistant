/**
 * Intent → reply. Phase is never used to trap or ignore the user.
 * Only stage_query reports readiness status.
 */

import { projectRequirementsSummary, summarizeKnown } from './project';
import { evaluateClarification } from './clarify';
import type { ComposeBranch } from './debugTrace';
import type { Clarification, ConversationState, MessageClass, TravelPatch } from './types';

function requirementsReady(state: ConversationState): boolean {
  return Boolean(state.destination) && !evaluateClarification(state).needed;
}

function formatTripReview(state: ConversationState): string {
  const view = projectRequirementsSummary(state);
  const lines: string[] = [];
  if (view.origin) lines.push(`• Origin: ${view.origin}`);
  if (view.destination) lines.push(`• Destination: ${view.destination}`);
  if (view.departing) lines.push(`• Departing: ${view.departing}`);
  if (view.returning) lines.push(`• Returning: ${view.returning}`);
  if (view.accommodation) lines.push(`• Stay: ${view.accommodation}`);
  if (view.duration) lines.push(`• Duration: ${view.duration}`);
  if (view.serviceLabels.length) {
    lines.push(`• Services: ${view.serviceLabels.join(', ')}`);
  }
  if (lines.length === 0) {
    return 'I don’t have trip details yet. Share a destination, dates, or the services you need and I’ll capture them.';
  }
  return `Here’s what I’ve got for your trip:\n${lines.join('\n')}`;
}

function nextStepHint(state: ConversationState): string {
  if (!requirementsReady(state)) {
    return 'Share a destination, dates, or services and I’ll keep capturing them.';
  }
  if (state.phase === 'locked') {
    return 'Say search now to query live providers, or start over for a new trip.';
  }
  return 'Ask for a summary, say go ahead or search now, or tell me what to change.';
}

export type ComposeDecision = {
  reply: string;
  branch: ComposeBranch;
};

type ComposeInput = {
  patch: TravelPatch;
  previous: ConversationState;
  state: ConversationState;
  clarification: Clarification;
  travellerName?: string;
};

function intentOf(patch: TravelPatch): MessageClass {
  return patch.messageClass ?? 'general_conversation';
}

function needsClarificationGate(
  clarification: Clarification,
  state: ConversationState,
): ComposeDecision | null {
  if (!clarification.needed || !clarification.question) return null;
  const known = summarizeKnown(state);
  const lead =
    known.length > 0
      ? `Almost — I’ve got ${known.join('; ')}.`
      : 'Almost ready.';
  return {
    branch: 'needs_clarification',
    reply: `${lead} ${clarification.question}`,
  };
}

/** Reply from intent first — never from phase idle traps. */
export function decideComposeReply(input: ComposeInput): ComposeDecision {
  const { patch, previous, state, clarification, travellerName } = input;
  const intent = intentOf(patch);
  const known = summarizeKnown(state);
  const ready = requirementsReady(state);

  switch (intent) {
    case 'greeting':
      return {
        branch: 'greeting',
        reply: travellerName
          ? `Hi ${travellerName}. Tell me where you want to go and I’ll capture the details.`
          : 'Hi. Tell me where you want to go and I’ll capture the details.',
      };

    case 'thanks':
      return {
        branch: 'thanks',
        reply: ready
          ? `You’re welcome. ${nextStepHint(state)}`
          : 'You’re welcome. What would you like to adjust next?',
      };

    case 'new_conversation':
      return {
        branch: 'new_conversation',
        reply: 'Starting fresh — tell me the trip you have in mind.',
      };

    case 'summary': {
      const review = formatTripReview(state);
      if (!ready && clarification.needed && clarification.question) {
        return {
          branch: 'summary_incomplete',
          reply: `${review}\n\nStill needed: ${clarification.question}`,
        };
      }
      return {
        branch: 'summary_review',
        reply: `${review}\n\nTell me what to change, say search now when you want live options, or lock it in when you’re happy.`,
      };
    }

    case 'soft_affirm': {
      const gated = needsClarificationGate(clarification, state);
      if (gated) return { ...gated, branch: 'soft_affirm_needs_clarification' };
      const trip = known.length > 0 ? ` (${known.join('; ')})` : '';
      return {
        branch: 'soft_affirm_ready',
        reply: `Perfect — your requirements look complete${trip}. I won’t invent prices or bookings. What would you like next: search now, a summary, or a change?`,
      };
    }

    case 'final_confirmation': {
      const gated = needsClarificationGate(clarification, state);
      if (gated) return { ...gated, branch: 'final_confirmation_needs_clarification' };
      return {
        branch: 'final_confirmation_locked',
        reply:
          'All confirmed. Your travel requirements are locked in and ready for search.',
      };
    }

    case 'start_search': {
      const gated = needsClarificationGate(clarification, state);
      if (gated) return gated;
      if (!ready) {
        return {
          branch: 'start_search_incomplete',
          reply:
            known.length > 0
              ? `I’ve got ${known.join('; ')}, but I still need a bit more before searching. ${clarification.question ?? 'Share the missing details.'}`
              : 'Share a destination and dates first, then say search now.',
        };
      }
      return {
        branch: 'start_search',
        reply:
          'Opening search with your saved requirements. I’ll use live travel providers — I won’t invent prices or bookings.',
      };
    }

    case 'booking_generation':
      return {
        branch: 'booking_generation',
        reply:
          'I can’t invent or fabricate bookings. Say search now to pull live options from travel providers; once real results are available I can propose an itinerary from those — not made-up ones.',
      };

    case 'itinerary_generation':
      return {
        branch: 'itinerary_generation',
        reply:
          'I can build an itinerary from real search results, but I don’t invent day plans without live options. Say search now to fetch flights and stays first, then ask me to build the itinerary.',
      };

    case 'pricing_request':
      return {
        branch: 'pricing_request',
        reply:
          'I don’t invent prices. Say search now and I’ll project your requirements into live provider search so you can see real rates.',
      };

    case 'hotel_recommendation':
      return {
        branch: 'hotel_recommendation',
        reply:
          ready
            ? 'I can recommend hotels from live search results — not invented ones. Say search hotels or search now and I’ll project your stay requirements into hotel search.'
            : 'Tell me the destination and stay details first, then say search hotels so I can use live results.',
      };

    case 'flight_recommendation':
      return {
        branch: 'flight_recommendation',
        reply:
          ready
            ? 'I can recommend flights from live search results — not invented ones. Say find flights or search now and I’ll project your route into flight search.'
            : 'Tell me origin, destination, and dates first, then say find flights so I can use live results.',
      };

    case 'stage_query':
      if (state.phase === 'locked') {
        return {
          branch: 'stage_query',
          reply:
            'Your requirements are locked in and ready for search. Say search now, or start over for a new trip.',
        };
      }
      if (ready || state.phase === 'ready') {
        return {
          branch: 'stage_query',
          reply:
            'Requirements are complete and ready. You can ask for a summary, lock them in, say search now, or tell me what to change.',
        };
      }
      return {
        branch: 'stage_query',
        reply:
          known.length > 0
            ? `Still gathering requirements — I’ve got ${known.join('; ')}. ${clarification.question ?? 'Tell me what’s missing.'}`
            : 'Still gathering requirements. Share a destination, dates, or the services you need.',
      };

    case 'rejection':
      return {
        branch: 'rejection',
        reply:
          known.length > 0
            ? `Okay — I’ve still got ${known.join('; ')}. What would you like to change?`
            : 'Okay. What would you like to change?',
      };

    case 'clarification_answer':
    case 'travel_request':
    case 'explicit_change':
    case 'explicit_removal':
    case 'general_conversation':
    default:
      break;
  }

  if (clarification.needed && clarification.question) {
    const lead =
      known.length > 0
        ? `I’ve got ${known.join('; ')}.`
        : 'I’ve started capturing your travel requirements.';
    return {
      branch: 'clarification_question',
      reply: `${lead} ${clarification.question}`,
    };
  }

  const previouslyReady =
    requirementsReady(previous) && previous.turnCount > 0;

  if (ready && previouslyReady && state.lastChangedFields.length > 0) {
    return {
      branch: 'ack_updated',
      reply: `Updated — ${known.join('; ')}. ${nextStepHint(state)}`,
    };
  }

  if (ready && previouslyReady && state.lastChangedFields.length === 0) {
    return {
      branch: 'ack_still_have',
      reply: `I’ve still got your trip details. ${nextStepHint(state)}`,
    };
  }

  if (known.length > 0) {
    if (ready) {
      return {
        branch: 'ack_saved_ready',
        reply: `Understood — I’ve saved ${known.join('; ')}. Ask for a summary whenever you want to review, or say search now when you’re ready for live options.`,
      };
    }
    return {
      branch: 'ack_saved_incomplete',
      reply: `Understood — I’ve saved ${known.join('; ')}. I won’t invent bookings or prices. Tell me anything to add, change, or remove.`,
    };
  }

  return {
    branch: 'empty_prompt',
    reply:
      'Share a destination, dates, or the services you need (flights, accommodation, car hire) and I’ll take it from there.',
  };
}

export function composeReply(input: ComposeInput): string {
  return decideComposeReply(input).reply;
}
