import type { CandidateBundle, DateCandidate, LocationCandidate } from './candidates/types';
import type {
  ApproximateDate,
  ConversationState,
  DepartureDate,
  ExactDate,
  FieldValue,
  ReturnDate,
  TravelPatch,
  TripField,
} from './types';

function explicit<T>(value: T): FieldValue<T> {
  return { value, source: 'explicit', confirmed: true };
}

function inferred<T>(value: T): FieldValue<T> {
  return { value, source: 'inferred', confirmed: false };
}

function bestLocation(
  candidates: LocationCandidate[],
  role: LocationCandidate['roleHint'],
): LocationCandidate | undefined {
  return candidates
    .filter((c) => c.roleHint === role)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

function nextWeekdayAfter(isoDate: string, weekday: number): ReturnDate {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  let guard = 0;
  while (d.getUTCDay() !== weekday && guard < 8) {
    d.setUTCDate(d.getUTCDate() + 1);
    guard += 1;
  }
  const iso = d.toISOString().slice(0, 10);
  return {
    isoDate: iso,
    label: iso,
    weekday,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

function addNights(isoDate: string, nights: number): ReturnDate {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + nights);
  const iso = d.toISOString().slice(0, 10);
  return {
    isoDate: iso,
    label: iso,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

/**
 * Deterministic role assignment → one TravelPatch.
 * Precedence: labelled/cue roles → field the engine is awaiting → confirmed state → inference.
 * `answersField` is supplied by the conversation engine (previous nextRequiredField), not stored on state.
 */
export function assignRoles(
  bundle: CandidateBundle,
  previous: ConversationState,
  answersField?: TripField,
): TravelPatch {
  const patch: TravelPatch = { explicitChanges: [], clearFields: [] };
  const pending = answersField;

  // --- Locations ---
  let origin = bestLocation(bundle.locations, 'origin');
  let destination = bestLocation(bundle.locations, 'destination');
  const accommodation = bestLocation(bundle.locations, 'accommodation');
  const standalone = bundle.locations
    .filter((c) => c.roleHint === 'unspecified')
    .sort((a, b) => b.confidence - a.confidence)[0];

  // Standalone place answers the field the engine asked for
  if (pending === 'origin' && standalone && !origin) {
    origin = { ...standalone, roleHint: 'origin', cue: 'awaiting:origin' };
  }
  if (pending === 'destination' && standalone && !destination) {
    destination = { ...standalone, roleHint: 'destination', cue: 'awaiting:destination' };
  }

  if (origin) {
    patch.origin = explicit(origin.normalized);
    patch.explicitChanges.push('origin');
  }
  if (destination) {
    patch.destination =
      destination.source === 'inferred' ? inferred(destination.normalized) : explicit(destination.normalized);
    patch.explicitChanges.push('destination');
  }
  if (accommodation) {
    patch.accommodationArea = explicit(accommodation.normalized);
    patch.explicitChanges.push('accommodationArea');
  }

  // Never let origin overwrite an already-confirmed destination with the same city
  if (
    patch.origin &&
    previous.destination?.confirmed &&
    patch.origin.value.toLowerCase() === previous.destination.value.toLowerCase() &&
    !patch.destination
  ) {
    // Origin answer while destination confirmed — keep destination
  }

  // Collapse same-city clash: prefer explicit destination over origin when inferred dest
  if (
    patch.origin &&
    patch.destination &&
    patch.origin.value.toLowerCase() === patch.destination.value.toLowerCase()
  ) {
    if (patch.destination.source === 'inferred') {
      delete patch.destination;
      patch.explicitChanges = patch.explicitChanges.filter((f) => f !== 'destination');
    } else {
      delete patch.origin;
      patch.explicitChanges = patch.explicitChanges.filter((f) => f !== 'origin');
    }
  }

  // --- Dates ---
  const exactDep = bundle.dates
    .filter((d): d is DateCandidate & { exact: NonNullable<DateCandidate['exact']> } => Boolean(d.exact))
    .sort((a, b) => b.confidence - a.confidence)[0];
  const approx = bundle.dates
    .filter((d) => d.approximate)
    .sort((a, b) => b.confidence - a.confidence)[0];
  const returnCue = bundle.dates
    .filter((d) => d.roleHint === 'return')
    .sort((a, b) => b.confidence - a.confidence)[0];

  // Exact wins over approximate when both present (clarification answer or full phrase)
  if (exactDep?.exact) {
    const value: ExactDate = {
      kind: 'exact',
      isoDate: exactDep.exact.isoDate,
      label: exactDep.exact.label,
      day: exactDep.exact.day,
      month: exactDep.exact.month,
      year: exactDep.exact.year,
    };
    patch.departureDate = explicit(value);
    patch.explicitChanges.push('departureDate');
  } else if (approx?.approximate && pending !== 'departureDate') {
    const a = approx.approximate;
    const value: ApproximateDate = {
      kind: 'approximate',
      period: a.period,
      month: a.month,
      year: a.year,
      label: a.label,
    };
    patch.departureDate = { value, source: 'explicit', confirmed: false };
    patch.explicitChanges.push('departureDate');
  } else if (approx?.approximate && !exactDep) {
    // Keep approximate if no exact — including first turn mid August
    const a = approx.approximate;
    const value: ApproximateDate = {
      kind: 'approximate',
      period: a.period,
      month: a.month,
      year: a.year,
      label: a.label,
    };
    patch.departureDate = { value, source: 'explicit', confirmed: false };
    patch.explicitChanges.push('departureDate');
  }

  const duration = bundle.durations.sort((a, b) => b.confidence - a.confidence)[0];
  if (duration) {
    patch.durationNights = explicit(duration.nights);
    patch.explicitChanges.push('durationNights');
  }

  const nights = patch.durationNights?.value ?? previous.durationNights?.value;
  const depIso =
    patch.departureDate?.value.kind === 'exact'
      ? patch.departureDate.value.isoDate
      : previous.departureDate?.value.kind === 'exact'
        ? previous.departureDate.value.isoDate
        : undefined;

  if (returnCue) {
    const weekday = returnCue.returnWeekday;
    const weekend = returnCue.weekend;
    if (depIso && weekday != null) {
      patch.returnDate = explicit(nextWeekdayAfter(depIso, weekday));
    } else if (weekday != null) {
      patch.returnDate = {
        value: {
          label: weekend ? `weekend, ${weekdayName(weekday)}` : weekdayName(weekday),
          weekday,
          weekend,
        },
        source: 'explicit',
        confirmed: false,
      };
    }
    patch.explicitChanges.push('returnDate');
  } else if (depIso && nights != null && nights > 0 && patch.departureDate?.value.kind === 'exact') {
    patch.returnDate = inferred(addNights(depIso, nights));
  }

  // If exact departure arrives later and previous return had weekday, assign will be completed in merge via derive

  // --- Services ---
  const adds = bundle.services.filter((s) => s.operation === 'add').map((s) => s.service);
  const removes = bundle.services.filter((s) => s.operation === 'remove').map((s) => s.service);
  if (adds.length) {
    patch.servicesAdd = Array.from(new Set(adds));
    patch.explicitChanges.push('services');
  }
  if (removes.length) {
    patch.servicesRemove = Array.from(new Set(removes));
    patch.explicitChanges.push('services');
  }

  const travellers = bundle.travellers.sort((a, b) => b.confidence - a.confidence)[0];
  if (travellers) {
    patch.travellers = explicit(travellers.count);
    patch.explicitChanges.push('travellers');
  }

  if (bundle.preferences.length) {
    patch.preferencesAdd = bundle.preferences.map((p) => p.value);
    patch.explicitChanges.push('preferences');
  }

  patch.explicitChanges = Array.from(new Set(patch.explicitChanges));
  return patch;
}

function weekdayName(weekday: number): string {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][weekday] ?? 'day';
}

/** Helpers exported for merge return derivation. */
export function deriveReturnFromConstraints(
  departureIso: string,
  previousReturn: ReturnDate | undefined,
  nights: number | undefined,
): ReturnDate | undefined {
  if (previousReturn?.weekday != null) {
    return nextWeekdayAfter(departureIso, previousReturn.weekday);
  }
  if (nights != null && nights > 0) return addNights(departureIso, nights);
  return previousReturn?.isoDate ? previousReturn : undefined;
}

export type { DepartureDate };
