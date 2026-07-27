import { deriveReturn } from './extract/dates';
import type { ConversationState, ExtractionPatch, FieldValue } from './types';
import { createEmptyConversationState } from './types';

function prefer<T>(
  incoming: FieldValue<T> | undefined,
  existing: FieldValue<T> | undefined,
  fieldName: string,
  explicitChanges: string[],
  changed: string[],
): FieldValue<T> | undefined {
  if (!incoming) return existing;
  const explicit = explicitChanges.includes(fieldName);
  if (existing?.confirmed && !explicit && incoming.source === 'inferred') {
    return existing;
  }
  if (
    existing?.confirmed &&
    !explicit &&
    JSON.stringify(existing.value) !== JSON.stringify(incoming.value) &&
    !incoming.confirmed
  ) {
    return existing;
  }
  if (!existing || JSON.stringify(existing.value) !== JSON.stringify(incoming.value)) {
    changed.push(fieldName);
  }
  return incoming;
}

/** One merge per turn into canonical conversation state. */
export function mergeTravelState(
  previous: ConversationState | undefined,
  patch: ExtractionPatch,
  now: Date,
): ConversationState {
  if (patch.isNewConversation) {
    return createEmptyConversationState();
  }

  const base = previous ? { ...previous, services: [...previous.services] } : createEmptyConversationState();
  const changed: string[] = [];
  const explicit = patch.explicitChanges;

  const next: ConversationState = {
    ...base,
    turnCount: base.turnCount + 1,
    updatedAt: now.toISOString(),
    lastChangedFields: [],
  };

  for (const field of patch.clearFields) {
    if (field === 'departureDate') {
      next.departureDate = undefined;
      changed.push('departureDate');
    }
    if (field === 'returnDate') {
      next.returnDate = undefined;
      changed.push('returnDate');
    }
    if (field === 'origin') {
      next.origin = undefined;
      changed.push('origin');
    }
    if (field === 'destination') {
      next.destination = undefined;
      changed.push('destination');
    }
  }

  next.origin = prefer(patch.origin, next.origin, 'origin', explicit, changed);
  next.destination = prefer(patch.destination, next.destination, 'destination', explicit, changed);
  next.departureDate = prefer(
    patch.departureDate,
    next.departureDate,
    'departureDate',
    explicit,
    changed,
  );

  // Exact return ISO is invalid once departure is no longer an exact date.
  if (
    next.departureDate &&
    next.departureDate.value.kind !== 'exact' &&
    next.returnDate?.value.isoDate
  ) {
    next.returnDate = {
      ...next.returnDate,
      value: {
        label: next.returnDate.value.label,
        weekday: next.returnDate.value.weekday,
      },
      confirmed: false,
    };
    changed.push('returnDate');
  }
  next.accommodationArea = prefer(
    patch.accommodationArea,
    next.accommodationArea,
    'accommodationArea',
    explicit,
    changed,
  );
  next.durationNights = prefer(
    patch.durationNights,
    next.durationNights,
    'durationNights',
    explicit,
    changed,
  );

  // Return: explicit patch wins; else derive from new exact departure + nights/weekday
  if (patch.returnDate && explicit.includes('returnDate')) {
    next.returnDate = prefer(patch.returnDate, next.returnDate, 'returnDate', explicit, changed);
  } else if (patch.returnDate && !next.returnDate) {
    next.returnDate = prefer(patch.returnDate, next.returnDate, 'returnDate', explicit, changed);
  }

  const depIso =
    next.departureDate?.value.kind === 'exact' ? next.departureDate.value.isoDate : undefined;
  if (depIso && (changed.includes('departureDate') || changed.includes('durationNights'))) {
    const derived = deriveReturn(
      depIso,
      next.returnDate?.value ?? patch.returnDate?.value,
      next.durationNights?.value,
    );
    if (derived?.isoDate) {
      const prevIso = next.returnDate?.value.isoDate;
      next.returnDate = {
        value: derived,
        source: patch.returnDate?.source === 'explicit' ? 'explicit' : 'inferred',
        confirmed: Boolean(derived.weekday != null || patch.returnDate?.confirmed),
      };
      if (prevIso !== derived.isoDate) changed.push('returnDate');
    }
  } else if (patch.returnDate) {
    next.returnDate = prefer(patch.returnDate, next.returnDate, 'returnDate', explicit, changed);
  }

  if (patch.servicesRemove?.length) {
    next.services = next.services.filter((s) => !patch.servicesRemove!.includes(s));
    changed.push('services');
  }
  if (patch.servicesAdd?.length) {
    const before = next.services.join(',');
    next.services = Array.from(new Set([...next.services, ...patch.servicesAdd]));
    if (next.services.join(',') !== before) changed.push('services');
  }

  next.lastChangedFields = Array.from(new Set(changed));
  return next;
}
