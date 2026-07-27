import type { Clarification, ConversationState } from './types';

export type { Clarification };

function hasTravelIntent(state: ConversationState): boolean {
  return Boolean(
    state.origin ||
      state.destination ||
      state.departureDate ||
      state.accommodationArea ||
      state.services.length,
  );
}

/**
 * Clarification runs ONLY after the complete merge.
 * Ask solely for genuinely missing / unresolved information.
 */
export function evaluateClarification(state: ConversationState): Clarification {
  if (!hasTravelIntent(state)) {
    return { needed: false };
  }

  if (!state.destination) {
    return {
      needed: true,
      field: 'destination',
      question: 'Which city or destination are you travelling to?',
    };
  }

  const needsDate =
    state.services.includes('flights') ||
    state.services.includes('accommodation') ||
    state.services.includes('car_hire') ||
    state.services.includes('transfers');

  if (needsDate) {
    const dep = state.departureDate?.value;
    if (!dep) {
      return {
        needed: true,
        field: 'departureDate',
        question: 'Which date would you like to travel?',
      };
    }
    if (dep.kind === 'mid_month') {
      return {
        needed: true,
        field: 'departureDate',
        question: `Which date around mid-${monthName(dep.month)} would you prefer?`,
      };
    }
    if (dep.kind === 'unresolved' || dep.kind === 'month_end') {
      return {
        needed: true,
        field: 'departureDate',
        question:
          dep.kind === 'unresolved'
            ? 'Which date would you like to travel?'
            : `Which exact date around ${dep.label} did you mean?`,
      };
    }
  }

  if (
    (state.services.includes('flights') || state.services.includes('transfers')) &&
    !state.origin
  ) {
    return {
      needed: true,
      field: 'origin',
      question: 'Where will you be departing from?',
    };
  }

  return { needed: false };
}

function monthName(month: number): string {
  return [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][month] ?? 'that month';
}
