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

/**
 * Stage 8 — Clarification from final merged state only.
 * One question at a time; never ask for already-supplied facts.
 */
export function evaluateClarification(state: ConversationState): Clarification {
  if (!hasTravelIntent(state)) return { needed: false };

  if (!state.destination) {
    return {
      needed: true,
      field: 'destination',
      question: 'Where would you like to go?',
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
    if (dep.kind === 'approximate') {
      const label =
        dep.period === 'mid'
          ? `mid-${monthName(dep.month)}`
          : dep.period === 'early'
            ? `early ${monthName(dep.month)}`
            : `late ${monthName(dep.month)}`;
      return {
        needed: true,
        field: 'departureDate',
        question: `Which date around ${label} would you prefer?`,
      };
    }
    if (dep.kind === 'unresolved') {
      return {
        needed: true,
        field: 'departureDate',
        question: 'Which date would you like to travel?',
      };
    }
  }

  if (!state.origin) {
    return {
      needed: true,
      field: 'origin',
      question: 'Where will you be departing from?',
    };
  }

  return { needed: false };
}
