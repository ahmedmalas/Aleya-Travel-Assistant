import type { ExtractionPatch } from './extract';
import type { ConfidenceLevel, FieldValue } from './types';

export function confidenceLevelFromScore(score: number): ConfidenceLevel {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

export function withConfidence<T>(
  value: T,
  source: 'confirmed' | 'inferred',
  score: number,
): FieldValue<T> {
  const clamped = Math.max(0, Math.min(1, score));
  return {
    value,
    source,
    confidence: clamped,
    confidenceLevel: confidenceLevelFromScore(clamped),
  };
}

function scoreFromText(message: string, strongHints: RegExp[], weakHints: RegExp[]): number {
  const lower = message.toLowerCase();
  if (strongHints.some((re) => re.test(lower))) return 0.92;
  if (weakHints.some((re) => re.test(lower))) return 0.55;
  return 0.75;
}

/** Attach internal confidence to extracted fields without changing values. */
export function applyConfidenceToPatch(patch: ExtractionPatch, message: string): ExtractionPatch {
  const next: ExtractionPatch = { ...patch };
  const changeIntent = /\b(?:actually|instead|change|make it|switch|update|prefer)\b/i.test(message);

  const annotate = <T>(field: FieldValue<T> | undefined, base: number): FieldValue<T> | undefined => {
    if (!field) return undefined;
    const score = field.source === 'inferred' ? Math.min(base, 0.6) : changeIntent ? Math.max(base, 0.9) : base;
    return withConfidence(field.value, field.source, score);
  };

  next.origin = annotate(
    patch.origin,
    scoreFromText(message, [/\bfrom\b/, /\bdepart(?:ing)? from\b/], [/\bmaybe from\b/, /\bpossibly from\b/]),
  );
  next.destination = annotate(
    patch.destination,
    scoreFromText(
      message,
      [
        /\b(?:travel|go(?:ing)?|fly|flights?|visit|change destination|make it|instead)\b/,
        /\bto\s+[A-Z]/,
      ],
      [/\bmaybe\b/, /\bthinking of\b/, /\bpossibly\b/, /\bnot sure\b/],
    ),
  );
  next.departureDate = annotate(patch.departureDate, patch.isDateConfirmation ? 0.95 : 0.85);
  next.returnDate = annotate(patch.returnDate, 0.8);
  next.departureTimePreference = annotate(patch.departureTimePreference, 0.85);
  next.returnTimePreference = annotate(patch.returnTimePreference, 0.85);
  next.accommodationArea = annotate(patch.accommodationArea, 0.9);
  next.travellers = annotate(patch.travellers, 0.9);
  next.tripPurpose = annotate(patch.tripPurpose, 0.7);
  next.budget = annotate(patch.budget, 0.75);
  next.dateFlexibility = annotate(patch.dateFlexibility, 0.8);
  next.roomRequirements = annotate(patch.roomRequirements, 0.85);
  next.airlinePreferences = annotate(patch.airlinePreferences, 0.85);
  next.hotelPreferences = annotate(patch.hotelPreferences, 0.85);
  next.activities = annotate(patch.activities, 0.8);
  next.dietaryRequirements = annotate(patch.dietaryRequirements, 0.9);
  next.accessibility = annotate(patch.accessibility, 0.9);
  next.loyaltyMemberships = annotate(patch.loyaltyMemberships, 0.9);
  next.specialRequests = annotate(patch.specialRequests, 0.85);
  next.transportNotes = annotate(patch.transportNotes, 0.8);

  // Ambiguous soft destination phrasing → low confidence (ask before hard commit)
  if (next.destination && /\b(?:maybe|might|thinking of|possibly|not sure)\b/i.test(message)) {
    next.destination = withConfidence(next.destination.value, 'inferred', 0.35);
    next.pendingLowConfidenceFields = Array.from(
      new Set([...(next.pendingLowConfidenceFields ?? []), 'destination']),
    );
  }

  return next;
}

/** Whether an incoming field may overwrite an existing one. */
export function mayCommitField(
  incoming?: FieldValue<unknown>,
  existing?: FieldValue<unknown>,
): 'commit' | 'retain' | 'ask' {
  if (!incoming) return 'retain';
  const level = incoming.confidenceLevel ?? confidenceLevelFromScore(incoming.confidence ?? 0.75);
  if (level === 'low') return 'ask';
  if (!existing) return 'commit';
  if (level === 'high') return 'commit';
  if (existing.source === 'confirmed' && incoming.source === 'inferred') return 'retain';
  if (level === 'medium') return 'commit';
  return 'retain';
}
