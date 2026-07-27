import { projectRequirementsSummary, summarizeKnown } from './project';
import { evaluateClarification } from './clarify';
import type { ComposeBranch } from './debugTrace';
import type { Clarification, ConversationState, TravelPatch } from './types';

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

export type ComposeDecision = {
  reply: string;
  branch: ComposeBranch;
};

/** Stage 9 — Reply from final merged canonical state only. */
export function decideComposeReply(input: {
  patch: TravelPatch;
  previous: ConversationState;
  state: ConversationState;
  clarification: Clarification;
  travellerName?: string;
}): ComposeDecision {
  const { patch, previous, state, clarification, travellerName } = input;

  if (patch.messageClass === 'greeting') {
    return {
      branch: 'greeting',
      reply: travellerName
        ? `Hi ${travellerName}. Tell me where you want to go and I’ll capture the details.`
        : 'Hi. Tell me where you want to go and I’ll capture the details.',
    };
  }
  if (patch.messageClass === 'thanks') {
    return {
      branch: 'thanks',
      reply: 'You’re welcome. What would you like to adjust next?',
    };
  }
  if (patch.messageClass === 'new_conversation') {
    return {
      branch: 'new_conversation',
      reply: 'Starting fresh — tell me the trip you have in mind.',
    };
  }

  if (patch.messageClass === 'summary') {
    const review = formatTripReview(state);
    if (!requirementsReady(state) && clarification.needed && clarification.question) {
      return {
        branch: 'summary_incomplete',
        reply: `${review}\n\nStill needed: ${clarification.question}`,
      };
    }
    return {
      branch: 'summary_review',
      reply: `${review}\n\nTell me what to change, or say go ahead when you’re ready to continue.`,
    };
  }

  if (patch.messageClass === 'confirmation') {
    if (clarification.needed && clarification.question) {
      const known = summarizeKnown(state);
      const lead =
        known.length > 0
          ? `Almost — I’ve got ${known.join('; ')}.`
          : 'Almost ready.';
      return {
        branch: 'confirmation_needs_clarification',
        reply: `${lead} ${clarification.question}`,
      };
    }
    const known = summarizeKnown(state);
    const trip = known.length > 0 ? ` (${known.join('; ')})` : '';
    return {
      branch: 'confirmation_planning',
      reply: `Perfect — moving into planning and search next${trip}. I won’t invent prices or bookings; the next step uses the requirements we’ve confirmed.`,
    };
  }

  if (patch.messageClass === 'final_confirmation') {
    if (clarification.needed && clarification.question) {
      const known = summarizeKnown(state);
      const lead =
        known.length > 0
          ? `Almost — I’ve got ${known.join('; ')}.`
          : 'Almost ready.';
      return {
        branch: 'final_confirmation_needs_clarification',
        reply: `${lead} ${clarification.question}`,
      };
    }
    return {
      branch: 'final_confirmation_locked',
      reply:
        'All confirmed. Your travel requirements are locked in and ready for search.',
    };
  }

  const known = summarizeKnown(state);

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

  const ready = requirementsReady(state);
  const alreadyAcknowledged =
    ready &&
    (previous.phase === 'requirements' ||
      previous.phase === 'review' ||
      previous.phase === 'confirmation' ||
      previous.phase === 'planning' ||
      previous.phase === 'confirmed') &&
    previous.turnCount > 0 &&
    requirementsReady(previous);

  if (patch.messageClass === 'rejection') {
    return {
      branch: 'rejection',
      reply:
        known.length > 0
          ? `Okay — I’ve still got ${known.join('; ')}. What would you like to change?`
          : 'Okay. What would you like to change?',
    };
  }

  if (ready && state.phase === 'confirmed') {
    return {
      branch: 'confirmed_idle',
      reply:
        'Your travel requirements are locked in and ready for search. Say start over if you want to begin a new trip.',
    };
  }

  if (ready && state.phase === 'planning') {
    return {
      branch: 'planning_idle',
      reply:
        known.length > 0
          ? `We’re in planning with ${known.join('; ')}. Tell me what to adjust, or ask for a summary.`
          : 'We’re ready to plan — share any remaining details you want included.',
    };
  }

  if (ready && alreadyAcknowledged && state.lastChangedFields.length === 0) {
    return {
      branch: 'ack_still_have',
      reply:
        'I’ve still got your trip details. Ask for a summary to review them, or say go ahead when you’re ready to continue.',
    };
  }

  if (ready && alreadyAcknowledged && state.lastChangedFields.length > 0) {
    return {
      branch: 'ack_updated',
      reply: `Updated — ${known.join('; ')}. Ask for a summary to review, or say go ahead when you’re ready.`,
    };
  }

  if (known.length > 0) {
    if (ready) {
      return {
        branch: 'ack_saved_ready',
        reply: `Understood — I’ve saved ${known.join('; ')}. Ask for a summary whenever you want to review, or say go ahead when you’re ready to continue.`,
      };
    }
    return {
      branch: 'ack_saved_incomplete',
      reply: `Understood — I’ve saved ${known.join('; ')}. I won’t build an itinerary unless you ask for one. Tell me anything to add, change, or remove.`,
    };
  }

  return {
    branch: 'empty_prompt',
    reply:
      'Share a destination, dates, or the services you need (flights, accommodation, car hire) and I’ll take it from there.',
  };
}

export function composeReply(input: {
  patch: TravelPatch;
  previous: ConversationState;
  state: ConversationState;
  clarification: Clarification;
  travellerName?: string;
}): string {
  return decideComposeReply(input).reply;
}
