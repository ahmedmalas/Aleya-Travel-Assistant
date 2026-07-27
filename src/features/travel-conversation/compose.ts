/**
 * Reply composition. Post-requirements decisions own search/approval replies.
 * Compose fills summary bodies and mutation acknowledgements.
 */

import { projectRequirementsSummary, summarizeKnown } from './project';
import type { ComposeBranch } from './debugTrace';
import type { PostRequirementsDecision } from './postRequirements';
import { requirementsReady } from './postRequirements';
import type { Clarification, ConversationState, TravelPatch } from './types';

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
  activateSearch: boolean;
  servicesToSearch: ConversationState['services'];
  lastOffer?: ConversationState['lastOffer'];
  phase?: ConversationState['phase'];
};

type ComposeInput = {
  patch: TravelPatch;
  previous: ConversationState;
  state: ConversationState;
  clarification: Clarification;
  travellerName?: string;
  postDecision?: PostRequirementsDecision;
};

export function decideComposeReply(input: ComposeInput): ComposeDecision {
  const { patch, previous, state, clarification, travellerName, postDecision } = input;
  const known = summarizeKnown(state);
  const ready = requirementsReady(state);

  if (postDecision) {
    if (postDecision.action === 'summary') {
      const review = formatTripReview(state);
      if (!ready && clarification.needed && clarification.question) {
        return {
          reply: `${review}\n\nStill needed: ${clarification.question}`,
          branch: 'summary_incomplete',
          activateSearch: false,
          servicesToSearch: [],
          lastOffer: undefined,
          phase: 'requirements',
        };
      }
      return {
        reply: `${review}\n\nShall I start the live search with these details?`,
        branch: 'summary_review',
        activateSearch: false,
        servicesToSearch: [],
        lastOffer: ready
          ? { kind: 'start_search', atTurn: state.turnCount }
          : undefined,
        phase: postDecision.phase,
      };
    }

    if (postDecision.action !== 'mutate' && postDecision.reply) {
      return {
        reply: postDecision.reply,
        branch: postDecision.branch,
        activateSearch: postDecision.activateSearch,
        servicesToSearch: postDecision.servicesToSearch,
        lastOffer: postDecision.lastOffer,
        phase: postDecision.phase,
      };
    }
  }

  if (patch.messageClass === 'greeting') {
    return {
      branch: 'greeting',
      reply: travellerName
        ? `Hi ${travellerName}. Tell me where you want to go and I’ll capture the details.`
        : 'Hi. Tell me where you want to go and I’ll capture the details.',
      activateSearch: false,
      servicesToSearch: [],
    };
  }

  if (patch.messageClass === 'thanks' && !ready) {
    return {
      branch: 'thanks',
      reply: 'You’re welcome. What would you like to adjust next?',
      activateSearch: false,
      servicesToSearch: [],
    };
  }

  if (patch.messageClass === 'new_conversation') {
    return {
      branch: 'new_conversation',
      reply: 'Starting fresh — tell me the trip you have in mind.',
      activateSearch: false,
      servicesToSearch: [],
      lastOffer: undefined,
      phase: 'requirements',
    };
  }

  if (clarification.needed && clarification.question) {
    const lead =
      known.length > 0
        ? `I’ve got ${known.join('; ')}.`
        : 'I’ve started capturing your travel requirements.';
    return {
      branch: 'clarification_question',
      reply: `${lead} ${clarification.question}`,
      activateSearch: false,
      servicesToSearch: [],
      phase: 'requirements',
      lastOffer: undefined,
    };
  }

  const previouslyReady = requirementsReady(previous) && previous.turnCount > 0;

  if (ready && previouslyReady && state.lastChangedFields.length > 0) {
    return {
      branch: 'ack_updated',
      reply: `Updated — ${known.join('; ')}. Shall I start the live search?`,
      activateSearch: false,
      servicesToSearch: [],
      phase: 'ready',
      lastOffer: { kind: 'start_search', atTurn: state.turnCount },
    };
  }

  if (known.length > 0) {
    if (ready) {
      return {
        branch: 'ack_saved_ready',
        reply: `Understood — I’ve saved ${known.join('; ')}. Shall I start the live search when you’re ready for live options?`,
        activateSearch: false,
        servicesToSearch: [],
        phase: 'ready',
        lastOffer: { kind: 'start_search', atTurn: state.turnCount },
      };
    }
    return {
      branch: 'ack_saved_incomplete',
      reply: `Understood — I’ve saved ${known.join('; ')}. Tell me anything to add, change, or remove.`,
      activateSearch: false,
      servicesToSearch: [],
      phase: 'requirements',
      lastOffer: undefined,
    };
  }

  return {
    branch: 'empty_prompt',
    reply:
      'Share a destination, dates, or the services you need (flights, accommodation, car hire) and I’ll take it from there.',
    activateSearch: false,
    servicesToSearch: [],
  };
}

export function composeReply(input: ComposeInput): string {
  return decideComposeReply(input).reply;
}
