import type { ApproximateDate, ConversationState } from './types';

export type ClarificationResult = {
  needsClarification: boolean;
  missingRequiredFields: string[];
  questions: string[];
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

/**
 * Find the last weekday in a month (e.g. last Friday of August 2026).
 */
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
  if (!approx) return undefined;
  if (approx.isoDate) return undefined;

  if (approx.kind === 'month_end' && approx.month && approx.year) {
    const weekday = approx.weekday ?? state.departureDate?.value.weekday ?? 5;
    const concrete = findLastWeekdayOfMonth(approx.year, approx.month, weekday);
    const label = formatLongDate(concrete);
    const iso = `${concrete.getFullYear()}-${String(concrete.getMonth() + 1).padStart(2, '0')}-${String(concrete.getDate()).padStart(2, '0')}`;
    return {
      kind: 'suggested',
      isoDate: iso,
      label,
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
    const label = formatLongDate(d);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { kind: 'suggested', isoDate: iso, label, weekday: 5 };
  }

  if (approx.weekday != null && !approx.isoDate && approx.month && approx.year) {
    const concrete = findLastWeekdayOfMonth(approx.year, approx.month, approx.weekday);
    const label = formatLongDate(concrete);
    const iso = `${concrete.getFullYear()}-${String(concrete.getMonth() + 1).padStart(2, '0')}-${String(concrete.getDate()).padStart(2, '0')}`;
    return {
      kind: 'suggested',
      isoDate: iso,
      label,
      weekday: approx.weekday,
      month: approx.month,
      year: approx.year,
      timePreference: state.departureTimePreference?.value,
    };
  }

  return undefined;
}

/**
 * Ask only for genuinely missing information required to proceed.
 */
export function evaluateClarifications(state: ConversationState, now: Date): ClarificationResult {
  const missing: string[] = [];
  const questions: string[] = [];

  const hasTravelIntent =
    state.requestedServices.length > 0 ||
    Boolean(state.destination) ||
    Boolean(state.origin) ||
    Boolean(state.accommodationLocation) ||
    state.explicitItineraryIntent;

  if (!hasTravelIntent) {
    return { needsClarification: false, missingRequiredFields: [], questions: [] };
  }

  const needsDestination =
    state.requestedServices.includes('flights') ||
    state.requestedServices.includes('rail') ||
    state.requestedServices.includes('car_hire') ||
    state.requestedServices.includes('road_trip') ||
    state.requestedServices.includes('hotels') ||
    state.requestedServices.includes('activities') ||
    state.requestedServices.includes('airport_transfers') ||
    state.requestedServices.includes('cruises') ||
    state.requestedServices.includes('camping') ||
    state.requestedServices.includes('four_wd') ||
    state.requestedServices.length === 0;

  if (needsDestination && !state.destination && !(state.requestedServices.includes('cruises') && state.origin)) {
    missing.push('destination');
    questions.push('Which city or destination are you travelling to?');
  }

  if (
    (state.requestedServices.includes('flights') || state.requestedServices.includes('rail')) &&
    !state.origin
  ) {
    missing.push('origin');
    questions.push('Where will you be departing from?');
  }

  const needsDate =
    state.requestedServices.includes('flights') ||
    state.requestedServices.includes('hotels') ||
    state.requestedServices.includes('car_hire') ||
    state.requestedServices.includes('cruises') ||
    state.requestedServices.includes('airport_transfers');

  let suggestedDate: ApproximateDate | undefined;
  if (needsDate) {
    if (!state.departureDate) {
      missing.push('departureDate');
      questions.push('Which date would you like to travel?');
    } else if (!state.departureDate.value.isoDate || state.departureDate.value.kind !== 'absolute') {
      suggestedDate = suggestConcreteDate(state, now);
      if (suggestedDate) {
        missing.push('departureDateConfirmation');
        questions.push(
          `I have everything else — I just need to lock the date. Does ${suggestedDate.label} work for you?`,
        );
      } else {
        missing.push('departureDate');
        questions.push('Could you confirm the exact travel date?');
      }
    }
  }

  // Hotel-only without destination area is already covered by destination
  // Do not ask travellers if inferred default exists
  // Do not re-ask fields that are present

  return {
    needsClarification: missing.length > 0,
    missingRequiredFields: missing,
    questions,
    suggestedDate,
  };
}
