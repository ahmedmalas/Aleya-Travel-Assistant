import type { ConversationState, RequirementConflict } from './types';

export type ValidationResult = {
  conflicts: RequirementConflict[];
  impossible: RequirementConflict[];
  ambiguous: RequirementConflict[];
  /** Fields that should not be silently committed. */
  askBeforeCommit: string[];
  question?: string;
};

function samePlace(a?: string, b?: string): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

/** Detect conflicts, impossible combinations, and ambiguity — ask only when needed. */
export function validateRequirements(
  state: ConversationState,
  options?: { pendingLowConfidenceFields?: string[] },
): ValidationResult {
  const conflicts: RequirementConflict[] = [];
  const impossible: RequirementConflict[] = [];
  const ambiguous: RequirementConflict[] = [];
  const askBeforeCommit = [...(options?.pendingLowConfidenceFields ?? [])];

  if (state.origin && state.destination && samePlace(state.origin.value, state.destination.value)) {
    impossible.push({
      field: 'destination',
      message: 'Origin and destination are the same place.',
      previousValue: state.origin.value,
      incomingValue: state.destination.value,
    });
  }

  if (
    state.departureDate?.value.isoDate &&
    state.returnDate?.value.isoDate &&
    state.returnDate.value.isoDate < state.departureDate.value.isoDate
  ) {
    impossible.push({
      field: 'returnDate',
      message: 'Return date is before departure date.',
      previousValue: state.departureDate.value.isoDate,
      incomingValue: state.returnDate.value.isoDate,
    });
  }

  if (state.travellers) {
    const { adults, children, infants, total } = state.travellers.value;
    if (adults < 0 || children < 0 || infants < 0) {
      impossible.push({ field: 'travellers', message: 'Traveller counts cannot be negative.' });
    }
    if (adults + children + infants !== total) {
      ambiguous.push({
        field: 'travellers',
        message: 'Traveller totals do not add up.',
        incomingValue: String(total),
      });
    }
    if (infants > 0 && adults < 1) {
      impossible.push({
        field: 'travellers',
        message: 'Infants require at least one adult.',
      });
    }
  }

  // Conflicting time signals when date-embedded preference disagrees with explicit preference
  if (
    state.departureDate?.value.timePreference &&
    state.departureTimePreference &&
    state.departureDate.value.timePreference !== state.departureTimePreference.value &&
    state.departureDate.value.timePreference !== 'flexible' &&
    state.departureTimePreference.value !== 'flexible'
  ) {
    const a = state.departureDate.value.timePreference;
    const b = state.departureTimePreference.value;
    const opposing =
      (a === 'morning' && (b === 'evening' || b === 'after_5pm')) ||
      (b === 'morning' && (a === 'evening' || a === 'after_5pm'));
    if (opposing) {
      conflicts.push({
        field: 'departureTimePreference',
        message: 'Outbound time preferences conflict.',
        previousValue: a,
        incomingValue: b,
      });
    }
  }

  if (state.awaitingDestinationConfirmation && state.pendingDestination) {
    askBeforeCommit.push('destination');
    ambiguous.push({
      field: 'destination',
      message: 'Soft destination candidate awaits confirmation.',
      previousValue: state.destination?.value,
      incomingValue: state.pendingDestination.value,
    });
  } else {
    for (const field of askBeforeCommit) {
      if (field === 'destination' && state.destination) {
        ambiguous.push({
          field: 'destination',
          message: 'Destination was mentioned uncertainly.',
          incomingValue: state.destination.value,
        });
      }
    }
  }

  let question: string | undefined;
  if (impossible[0]) {
    question =
      impossible[0].field === 'destination'
        ? 'Origin and destination look the same — which city should be the destination?'
        : impossible[0].field === 'returnDate'
          ? 'The return date looks earlier than departure — which dates did you mean?'
          : impossible[0].field === 'travellers'
            ? 'Could you confirm how many adults, children, and infants are travelling?'
            : 'One of those details looks impossible — could you confirm it?';
  } else if (conflicts[0]) {
    question = `I noticed a conflict on ${conflicts[0].field.replace(/([A-Z])/g, ' $1').toLowerCase()} — which should I keep?`;
  } else if (state.awaitingDestinationConfirmation && state.pendingDestination && state.destination) {
    question = samePlace(state.pendingDestination.value, state.destination.value)
      ? `Just to confirm — is ${state.pendingDestination.value} the destination you want?`
      : `Are you thinking of changing your destination to ${state.pendingDestination.value}, or would you like to keep ${state.destination.value}?`;
  } else if (state.awaitingDestinationConfirmation && state.pendingDestination && !state.destination) {
    question = `Just to confirm — is ${state.pendingDestination.value} the destination you want?`;
  } else if (ambiguous[0]?.field === 'destination') {
    question = `Just to confirm — is ${ambiguous[0].incomingValue} the destination you want?`;
  }

  return { conflicts, impossible, ambiguous, askBeforeCommit, question };
}
