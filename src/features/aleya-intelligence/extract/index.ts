import type { ConversationState } from '../types';
import { extractDatesAndTimes, extractDurationNights, parseAbsoluteDate } from './dates';
import { extractPeoplePatch } from './people';
import {
  applyDestinationIntent,
  classifyDestinationIntent,
  extractAreas,
  extractOrigin,
  resolvePendingDestinationDecision,
} from './places';
import { extractPreferencesPatch } from './preferences';
import { extractServicesPatch } from './services';
import { field, markChanged } from './shared';
import type { ExtractionPatch } from './types';

export type { ExtractionPatch, DateParseContext, DestinationChange, DestinationIntent, ServiceOps } from './types';
export { parseAbsoluteDate } from './dates';
export { isDestinationRetention, hasDestinationReplacementLanguage } from './places';

function mergeFragments(parts: Array<Partial<ExtractionPatch>>): ExtractionPatch {
  const patch: ExtractionPatch = {
    changedFields: [],
    explicitChanges: [],
    pendingLowConfidenceFields: [],
  };

  for (const part of parts) {
    for (const [key, value] of Object.entries(part) as Array<[keyof ExtractionPatch, unknown]>) {
      if (value === undefined) continue;
      if (key === 'changedFields' || key === 'explicitChanges' || key === 'pendingLowConfidenceFields') {
        continue;
      }
      (patch as Record<string, unknown>)[key] = value;
    }
    if (part.changedFields?.length) {
      patch.changedFields = Array.from(new Set([...(patch.changedFields ?? []), ...part.changedFields]));
    }
    if (part.explicitChanges?.length) {
      patch.explicitChanges = Array.from(new Set([...(patch.explicitChanges ?? []), ...part.explicitChanges]));
    }
    if (part.pendingLowConfidenceFields?.length) {
      patch.pendingLowConfidenceFields = Array.from(
        new Set([...(patch.pendingLowConfidenceFields ?? []), ...part.pendingLowConfidenceFields]),
      );
    }
  }

  return patch;
}

/**
 * Deterministic single-pass extraction.
 *
 * 1. Normalize / early-exit meta intents
 * 2. Resolve pending soft-destination decision (does not stop the pass)
 * 3. Classify destination intent once
 * 4. Extract origin, areas, dates, duration, services, people, preferences
 * 5. Assemble one ExtractionPatch — merge happens once in memory.ts
 * 6. Clarification runs only after merge (pipeline.ts)
 */
export function extractRequirements(
  message: string,
  previous?: ConversationState,
  now = new Date(),
): ExtractionPatch {
  const rawText = message.trim();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening|hiya)(?:\s+[A-Za-z]+)?[!,.\s]*$/i.test(rawText)) {
    return { isGreeting: true, changedFields: [] };
  }
  if (/^(thanks|thank you|thankyou|cheers)([!,.\s]*)$/i.test(rawText)) {
    return { isThanks: true, changedFields: [] };
  }
  if (/what can you do|how can you help|who are you|what are you/i.test(rawText)) {
    return { isCapabilityQuestion: true, changedFields: [] };
  }

  const text = rawText
    .replace(/^(hi|hello|hey|good morning|good afternoon|good evening|hiya)(?:\s+[A-Za-z]+)?[!,.]?\s+/i, '')
    .trim();

  // --- Pass: pending destination decision (non-terminating) ---
  const pendingDecision = resolvePendingDestinationDecision(text, previous);
  const pendingFrag: Partial<ExtractionPatch> = { changedFields: [] };
  if (pendingDecision === 'confirm') {
    pendingFrag.confirmPendingDestination = true;
    markChanged(pendingFrag.changedFields!, 'destination');
  } else if (pendingDecision === 'decline') {
    pendingFrag.declinePendingDestination = true;
    markChanged(pendingFrag.changedFields!, 'destination');
  }

  // --- Pass: classify destination once ---
  const destinationIntent = classifyDestinationIntent(text, previous, now);
  const destinationFrag = applyDestinationIntent(
    destinationIntent,
    text,
    previous,
    Boolean(pendingDecision),
  );

  // --- Pass: origin (never stay areas) ---
  const originFrag = extractOrigin(text, previous, now);

  // --- Pass: accommodation areas ---
  const areasFrag = extractAreas(text, destinationIntent, previous);

  // --- Pass: dates, times, duration ---
  const datesFrag = extractDatesAndTimes(text, previous, now);
  const nights = extractDurationNights(text);
  if (nights != null) {
    datesFrag.durationNights = field(nights);
    markChanged(datesFrag.changedFields ?? (datesFrag.changedFields = []), 'durationNights');
  }

  // --- Pass: preferences (airline / hotel / budget / …) ---
  const prefsFrag = extractPreferencesPatch(text);

  // --- Pass: services (after area/duration/prefs known for side-effects) ---
  const previouslyExcluded = new Set(previous?.excludedServices ?? []);
  const servicesFrag = extractServicesPatch(text, {
    hasStayArea: Boolean(areasFrag.accommodationArea),
    hasDuration: nights != null,
    hasHotelPrefs: Boolean(prefsFrag.hotelPreferences),
    previouslyExcluded,
  });

  // --- Pass: travellers / purpose ---
  const peopleFrag = extractPeoplePatch(text, previous);

  return mergeFragments([
    pendingFrag,
    originFrag,
    destinationFrag,
    areasFrag,
    datesFrag,
    prefsFrag,
    servicesFrag,
    peopleFrag,
  ]);
}
