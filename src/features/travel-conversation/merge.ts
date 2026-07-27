import { deriveReturnFromConstraints } from './assign';
import type { ConversationState, FieldValue, TravelPatch } from './types';
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

/** Stage 6 — Single merge into canonical state. */
export function mergeTravelState(
  previous: ConversationState | undefined,
  patch: TravelPatch,
  now: Date,
  messageSnippet: string,
): ConversationState {
  const base = previous
    ? {
        ...previous,
        services: [...previous.services],
        excludedServices: [...previous.excludedServices],
        preferences: [...previous.preferences],
        changeHistory: [...previous.changeHistory],
      }
    : createEmptyConversationState();

  const changed: string[] = [];
  const explicit = patch.explicitChanges;
  const next: ConversationState = {
    ...base,
    turnCount: base.turnCount + 1,
    updatedAt: now.toISOString(),
    lastChangedFields: [],
  };

  for (const field of patch.clearFields) {
    if (field === 'departureDate') next.departureDate = undefined;
    if (field === 'returnDate') next.returnDate = undefined;
    if (field === 'origin') next.origin = undefined;
    if (field === 'destination') next.destination = undefined;
    changed.push(field);
  }

  next.origin = prefer(patch.origin, next.origin, 'origin', explicit, changed);
  next.destination = prefer(patch.destination, next.destination, 'destination', explicit, changed);
  next.departureDate = prefer(patch.departureDate, next.departureDate, 'departureDate', explicit, changed);
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
  next.travellers = prefer(patch.travellers, next.travellers, 'travellers', explicit, changed);

  if (patch.returnDate && explicit.includes('returnDate')) {
    next.returnDate = prefer(patch.returnDate, next.returnDate, 'returnDate', explicit, changed);
  } else if (patch.returnDate && !next.returnDate) {
    next.returnDate = prefer(patch.returnDate, next.returnDate, 'returnDate', explicit, changed);
  }

  // Exact departure invalidates ISO return until re-derived
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
        weekend: next.returnDate.value.weekend,
      },
      confirmed: false,
    };
    changed.push('returnDate');
  }

  const depIso =
    next.departureDate?.value.kind === 'exact' ? next.departureDate.value.isoDate : undefined;
  if (depIso && (changed.includes('departureDate') || changed.includes('durationNights'))) {
    const derived = deriveReturnFromConstraints(
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
    next.excludedServices = Array.from(
      new Set([...next.excludedServices, ...patch.servicesRemove]),
    );
    changed.push('services');
  }
  if (patch.servicesAdd?.length) {
    const before = next.services.join(',');
    next.services = Array.from(new Set([...next.services, ...patch.servicesAdd]));
    next.excludedServices = next.excludedServices.filter((s) => !patch.servicesAdd!.includes(s));
    if (next.services.join(',') !== before) changed.push('services');
  }

  if (patch.preferencesAdd?.length) {
    next.preferences = Array.from(new Set([...next.preferences, ...patch.preferencesAdd]));
    changed.push('preferences');
  }

  next.lastChangedFields = Array.from(new Set(changed));
  if (next.lastChangedFields.length) {
    next.changeHistory = [
      ...next.changeHistory,
      {
        turn: next.turnCount,
        fields: next.lastChangedFields,
        snippet: messageSnippet.slice(0, 120),
      },
    ].slice(-40);
  }

  // pendingClarification owned by pipeline after merge
  next.pendingClarification = base.pendingClarification;
  return next;
}
