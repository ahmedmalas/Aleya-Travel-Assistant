/**
 * Stages 5–6 — Known / missing requirements and nextRequiredField.
 * Architectural progression driver. Not a phrase ban-list.
 */

import type { ConversationState } from '../types';
import type { MissingRequirement, TripCompleteness } from './contracts';

const QUESTIONS: Record<MissingRequirement['id'], string> = {
  destination: 'Where would you like to travel?',
  origin: 'Where will you be travelling from?',
  departureDate: 'Which date would you like to travel?',
  tripType: 'Is this one-way, or will you be returning?',
  services:
    'Are you looking for flights only, or would you like accommodation or car hire as well?',
};

function exactDepartLabel(state: ConversationState): string | undefined {
  const dep = state.departureDate?.value;
  if (!dep) return undefined;
  if (dep.kind === 'exact') return dep.isoDate;
  if (dep.kind === 'approximate') return dep.label;
  return dep.label;
}

/**
 * Priority (mandatory):
 * 1 destination → 2 origin → 3 exact departureDate → 4 tripType → 5 services (only when others done)
 */
export function calculateTripCompleteness(
  state: ConversationState,
  tripType?: 'one_way' | 'return',
): TripCompleteness {
  const known: TripCompleteness['known'] = {
    origin: state.origin?.value,
    destination: state.destination?.value,
    departureDate: exactDepartLabel(state),
    returnDate: state.returnDate?.value?.isoDate ?? state.returnDate?.value?.label,
    services: [...state.services],
    travellers: state.travellers?.value,
    accommodationArea: state.accommodationArea?.value,
    tripType:
      tripType ??
      (state.preferences.includes('one-way')
        ? 'one_way'
        : state.returnDate?.value?.isoDate
          ? 'return'
          : undefined),
  };

  const missing: MissingRequirement[] = [];
  const discoveryActive = state.discovery?.mode === 'active';

  // Active discovery may legitimately have no destination yet — booking destination
  // is not the next required field until discovery selects one.
  if (!known.destination && !discoveryActive) {
    missing.push({ id: 'destination', priority: 1, question: QUESTIONS.destination });
  }
  if (!known.origin) {
    missing.push({ id: 'origin', priority: 2, question: QUESTIONS.origin });
  }

  const dep = state.departureDate?.value;
  const hasExactDate = Boolean(dep && dep.kind === 'exact');
  if (!hasExactDate) {
    missing.push({ id: 'departureDate', priority: 3, question: QUESTIONS.departureDate });
  }

  if (known.destination && known.origin && hasExactDate && !known.tripType) {
    missing.push({ id: 'tripType', priority: 4, question: QUESTIONS.tripType });
  }

  if (
    known.destination &&
    known.origin &&
    hasExactDate &&
    known.tripType &&
    known.services.length === 0
  ) {
    missing.push({ id: 'services', priority: 5, question: QUESTIONS.services });
  }

  missing.sort((a, b) => a.priority - b.priority);

  const readyToSearch = Boolean(
    known.destination && known.origin && hasExactDate,
  );

  return {
    known,
    missing,
    nextRequiredField: missing[0] ?? null,
    readyToSearch,
  };
}

export function questionFor(id: MissingRequirement['id']): string {
  return QUESTIONS[id];
}
