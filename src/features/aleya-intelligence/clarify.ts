import type { ApproximateDate, ConversationState } from './types';
import type { ValidationResult } from './validate';

export type ClarificationResult = {
  needsClarification: boolean;
  missingRequiredFields: string[];
  /** At most one precise question. */
  question?: string;
  suggestedDate?: ApproximateDate;
};

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Last weekday in a 1-indexed month (e.g. last Friday of August 2026). */
export function findLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0));
  const result = new Date(lastDay);
  while (result.getUTCDay() !== weekday) {
    result.setUTCDate(result.getUTCDate() - 1);
  }
  return new Date(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate());
}

export function suggestConcreteDate(state: ConversationState, now: Date): ApproximateDate | undefined {
  const approx = state.departureDate?.value;
  if (!approx || approx.isoDate) return undefined;

  if ((approx.kind === 'month_end' || approx.weekday != null) && approx.month && approx.year) {
    const weekday = approx.weekday ?? 5;
    const concrete = findLastWeekdayOfMonth(approx.year, approx.month, weekday);
    const iso = `${concrete.getFullYear()}-${String(concrete.getMonth() + 1).padStart(2, '0')}-${String(concrete.getDate()).padStart(2, '0')}`;
    return {
      kind: 'suggested',
      isoDate: iso,
      label: formatLongDate(concrete),
      weekday,
      month: approx.month,
      year: approx.year,
      timePreference: state.departureTimePreference?.value ?? approx.timePreference,
    };
  }

  if (approx.kind === 'weekend') {
    const d = new Date(now);
    const day = d.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFriday + (approx.label.includes('next') ? 7 : 0));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { kind: 'suggested', isoDate: iso, label: formatLongDate(d), weekday: 5 };
  }

  return undefined;
}

function hasTravelIntent(state: ConversationState): boolean {
  return (
    state.requestedServices.length > 0 ||
    Boolean(state.destination) ||
    Boolean(state.origin) ||
    Boolean(state.accommodationArea) ||
    state.explicitItineraryIntent
  );
}

/** Ask only for genuinely missing information — one precise question. */
export function evaluateClarifications(
  state: ConversationState,
  now: Date,
  validation?: ValidationResult,
): ClarificationResult {
  if (!hasTravelIntent(state)) {
    return { needsClarification: false, missingRequiredFields: [] };
  }

  // Impossible / conflicting combinations take priority over soft missing fields
  if (validation?.question && (validation.impossible.length > 0 || validation.conflicts.length > 0)) {
    return {
      needsClarification: true,
      missingRequiredFields: validation.impossible.concat(validation.conflicts).map((c) => c.field),
      question: validation.question,
    };
  }

  // Soft/pending destination must be confirmed before other soft asks
  if (state.awaitingDestinationConfirmation && state.pendingDestination) {
    const sameAsCurrent =
      state.destination &&
      state.destination.value.toLowerCase() === state.pendingDestination.value.toLowerCase();
    const question =
      validation?.question && validation.ambiguous.some((a) => a.field === 'destination')
        ? validation.question
        : state.destination && !sameAsCurrent
          ? `Are you thinking of changing your destination to ${state.pendingDestination.value}, or would you like to keep ${state.destination.value}?`
          : `Just to confirm — is ${state.pendingDestination.value} the destination you want?`;
    return {
      needsClarification: true,
      missingRequiredFields: ['confirm:destination'],
      question,
    };
  }

  if (!state.destination) {
    return {
      needsClarification: true,
      missingRequiredFields: ['destination'],
      question: 'Which city or destination are you travelling to?',
    };
  }

  // Low-confidence destination confirmation when stored as tentative destination
  if (
    validation?.question &&
    validation.ambiguous.some((a) => a.field === 'destination') &&
    state.destination.confidenceLevel === 'low'
  ) {
    return {
      needsClarification: true,
      missingRequiredFields: ['confirm:destination'],
      question: validation.question,
    };
  }

  const needsDate =
    state.requestedServices.includes('flights') ||
    state.requestedServices.includes('accommodation') ||
    state.requestedServices.includes('car_hire') ||
    state.requestedServices.includes('transfers') ||
    Boolean(state.departureTimePreference);

  if (needsDate) {
    if (!state.departureDate) {
      return {
        needsClarification: true,
        missingRequiredFields: ['departureDate'],
        question: 'Which date would you like to travel?',
      };
    }

    // Concrete ISO dates (absolute or resolved relative like "next week") need no further ask.
    // Approximate kinds without isoDate still need a precise confirmation (Phase 1 behaviour).
    const hasConcreteDate = Boolean(state.departureDate.value.isoDate);
    const approxNeedsConfirm =
      !hasConcreteDate &&
      state.departureDate.value.kind !== 'absolute' &&
      (state.departureDate.value.kind === 'month_end' ||
        state.departureDate.value.kind === 'relative' ||
        state.departureDate.value.kind === 'weekend' ||
        state.departureDate.value.kind === 'suggested' ||
        state.departureDate.value.weekday != null);

    if (approxNeedsConfirm) {
      // Only suggest a concrete Friday when the user already named a weekday.
      if (state.departureDate.value.weekday != null) {
        const suggestedDate = suggestConcreteDate(state, now);
        if (suggestedDate) {
          return {
            needsClarification: true,
            missingRequiredFields: ['departureDateConfirmation'],
            suggestedDate,
            question: `Which Friday did you mean — does ${suggestedDate.label} work?`,
          };
        }
      }
      return {
        needsClarification: true,
        missingRequiredFields: ['departureDate'],
        question: 'Which date would you like to travel?',
      };
    }
  }

  if (
    (state.requestedServices.includes('flights') || state.requestedServices.includes('transfers')) &&
    !state.origin
  ) {
    return {
      needsClarification: true,
      missingRequiredFields: ['origin'],
      question: 'Where will you be departing from?',
    };
  }

  return { needsClarification: false, missingRequiredFields: [] };
}
