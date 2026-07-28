/**
 * Stage 10 — Decide the next conversational step from completeness + observations.
 * Ranked missing requirements drive the step — never a generic clarification.
 */

import type {
  ConversationalStep,
  ExecutedResult,
  MissingRequirement,
  ProviderObservation,
  TripCompleteness,
  TurnGoal,
} from './contracts';
import { setAwaitingField, setSearchOffered } from './runtime';
import type { TripField } from '../types';

function toTripField(id: MissingRequirement['id']): TripField | undefined {
  if (id === 'origin' || id === 'destination' || id === 'departureDate') return id;
  return undefined;
}

export function decideNextStep(input: {
  goals: TurnGoal[];
  completeness: TripCompleteness;
  provider: ProviderObservation;
  executed: ExecutedResult[];
  servicesJustAdded: string[];
}): ConversationalStep {
  const { goals, completeness, provider, executed } = input;
  const next = completeness.nextRequiredField;

  if (provider.activateSearch) {
    setAwaitingField(undefined);
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
    return { kind: 'answer_then_continue', answer, continueWith: next };
  }

  if (goals.some((g) => g.kind === 'decline_search')) {
    setSearchOffered(false);
    setAwaitingField(next ? toTripField(next.id) : undefined);
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
    // Destination-only / origin-only / date-only: ask the ranked field
    return { kind: 'ask_missing_field', field: next };
  }

  // Complete enough to offer search (once)
  setAwaitingField(undefined);
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
