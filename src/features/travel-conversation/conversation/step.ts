/**
 * Stage 10 — Decide the next conversational step from completeness + observations.
 * Ranked missing requirements drive the step — never a generic clarification.
 * Publishes structured option sets when asking option-based questions.
 */

import type {
  ConversationalStep,
  ExecutedResult,
  MissingRequirement,
  ProviderObservation,
  TripCompleteness,
  TurnGoal,
} from './contracts';
import { questionTextFor } from '../destination-discovery';
import { setAwaitingField, setSearchOffered } from './runtime';
import type { ConversationState, TripField } from '../types';
import {
  buildServicesOptionSet,
  buildTripTypeOptionSet,
  clearActiveOptionSet,
  replaceActiveOptionSet,
} from '../contextual-reference';
import { consumePendingLocationAmbiguity } from '../locationAmbiguityPending';

function toTripField(id: MissingRequirement['id']): TripField | undefined {
  if (id === 'origin') return 'origin';
  if (id === 'destination') return 'destination';
  if (id === 'departureDate') return 'departureDate';
  if (id === 'tripType') return 'tripType';
  if (id === 'services') return 'services';
  return undefined;
}

function publishOptionsFor(field: MissingRequirement): void {
  if (field.id === 'services') {
    replaceActiveOptionSet(buildServicesOptionSet(field.question));
    return;
  }
  if (field.id === 'tripType') {
    replaceActiveOptionSet(buildTripTypeOptionSet(field.question));
    return;
  }
  // Non-option questions must not leave a stale set active.
  clearActiveOptionSet();
}

export function decideNextStep(input: {
  goals: TurnGoal[];
  completeness: TripCompleteness;
  provider: ProviderObservation;
  executed: ExecutedResult[];
  servicesJustAdded: string[];
  state?: ConversationState;
}): ConversationalStep {
  const { goals, completeness, provider, executed } = input;
  const next = completeness.nextRequiredField;
  const discovery = input.state?.discovery;

  const ambiguity = consumePendingLocationAmbiguity();
  if (ambiguity) {
    replaceActiveOptionSet(ambiguity.optionSet);
    setAwaitingField('destination');
    setSearchOffered(false);
    return {
      kind: 'ask_missing_field',
      field: {
        id: 'destination',
        priority: 1,
        question: ambiguity.question,
      },
    };
  }

  // Destination discovery steps win over booking missing-destination prompts
  if (discovery?.mode === 'active') {
    clearActiveOptionSet();
    setAwaitingField(undefined);
    setSearchOffered(false);
    if (
      executed.some(
        (r) =>
          (r.type === 'recommend_destinations' ||
            r.type === 'refine_destination_recommendations') &&
          r.ok,
      ) &&
      discovery.recommendations.length
    ) {
      return {
        kind: 'recommend_destinations',
        candidates: discovery.recommendations,
      };
    }
    if (
      executed.some((r) => r.type === 'ask_discovery_question') &&
      discovery.pendingQuestionId
    ) {
      return {
        kind: 'ask_discovery_question',
        questionId: discovery.pendingQuestionId,
        question: questionTextFor(discovery.pendingQuestionId, discovery.criteria),
      };
    }
    if (discovery.recommendations.length) {
      return {
        kind: 'recommend_destinations',
        candidates: discovery.recommendations,
      };
    }
    if (discovery.pendingQuestionId) {
      return {
        kind: 'ask_discovery_question',
        questionId: discovery.pendingQuestionId,
        question: questionTextFor(discovery.pendingQuestionId, discovery.criteria),
      };
    }
  }

  if (provider.activateSearch) {
    setAwaitingField(undefined);
    clearActiveOptionSet();
    setSearchOffered(false);
    return {
      kind: 'report_search_started',
      services: provider.servicesToSearch,
      launchResults: provider.launchResults ?? [],
    };
  }

  if (provider.continueSearch) {
    setAwaitingField(undefined);
    return {
      kind: 'report_search_refined',
      services: provider.servicesToSearch,
    };
  }

  const searchBlocked = executed.some(
    (r) => r.type === 'start_search' && !r.ok,
  );
  if (searchBlocked && next) {
    setAwaitingField(toTripField(next.id));
    publishOptionsFor(next);
    setSearchOffered(false);
    return { kind: 'ask_missing_field', field: next };
  }

  const areaQ = goals.find((g) => g.kind === 'answer_area_question');
  if (areaQ && areaQ.kind === 'answer_area_question') {
    const answer =
      areaQ.topic === 'docklands'
        ? 'Docklands works well for many visitors — trams and walking cover the waterfront and links into the CBD. A hire car helps more if you’re planning day trips further out.'
        : 'Happy to factor that into the stay.';
    setAwaitingField(next ? toTripField(next.id) : undefined);
    if (next) publishOptionsFor(next);
    else clearActiveOptionSet();
    return { kind: 'answer_then_continue', answer, continueWith: next };
  }

  if (goals.some((g) => g.kind === 'decline_search')) {
    setSearchOffered(false);
    setAwaitingField(next ? toTripField(next.id) : undefined);
    if (next) publishOptionsFor(next);
    else clearActiveOptionSet();
    if (input.servicesJustAdded.length && next) {
      return {
        kind: 'acknowledge_and_continue',
        note: `No problem — I’ve added ${formatServices(input.servicesJustAdded)}.`,
        continueWith: next,
      };
    }
    return {
      kind: 'acknowledge_and_continue',
      note: 'No problem — I won’t search yet.',
      continueWith: next,
    };
  }

  if (next) {
    setAwaitingField(toTripField(next.id));
    publishOptionsFor(next);
    setSearchOffered(false);
    if (input.servicesJustAdded.length) {
      return {
        kind: 'acknowledge_and_continue',
        note: `I’ve added ${formatServices(input.servicesJustAdded)}.`,
        continueWith: next,
      };
    }
    if (goals.some((g) => g.kind === 'start_new_trip')) {
      const dest = completeness.known.destination;
      return {
        kind: 'acknowledge_and_continue',
        note: dest
          ? `Absolutely — let’s look at ${dest}.`
          : 'Of course — let’s start fresh.',
        continueWith: next,
      };
    }
    // Destination-only / origin-only / date-only / services / trip type
    return { kind: 'ask_missing_field', field: next };
  }

  // Complete enough to offer search (once)
  setAwaitingField(undefined);
  clearActiveOptionSet();
  setSearchOffered(true);
  return { kind: 'offer_search' };
}

function formatServices(services: string[]): string {
  const labels = services.map((s) =>
    s === 'car_hire' ? 'car hire' : s === 'accommodation' ? 'accommodation' : s,
  );
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}
