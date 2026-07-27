import type { ConversationState, ExtractionPatch } from '../types';
import { extractLocations } from '../locations';
import { extractDates } from './dates';
import { extractDuration, extractServices } from './services';

function mergePatches(parts: Array<Partial<ExtractionPatch>>): ExtractionPatch {
  const patch: ExtractionPatch = { explicitChanges: [], clearFields: [] };
  for (const part of parts) {
    if (part.origin) patch.origin = part.origin;
    if (part.destination) patch.destination = part.destination;
    if (part.departureDate) patch.departureDate = part.departureDate;
    if (part.returnDate) patch.returnDate = part.returnDate;
    if (part.accommodationArea) patch.accommodationArea = part.accommodationArea;
    if (part.durationNights) patch.durationNights = part.durationNights;
    if (part.servicesAdd?.length) {
      patch.servicesAdd = Array.from(new Set([...(patch.servicesAdd ?? []), ...part.servicesAdd]));
    }
    if (part.servicesRemove?.length) {
      patch.servicesRemove = Array.from(
        new Set([...(patch.servicesRemove ?? []), ...part.servicesRemove]),
      );
    }
    if (part.explicitChanges?.length) {
      patch.explicitChanges = Array.from(
        new Set([...patch.explicitChanges, ...part.explicitChanges]),
      );
    }
    if (part.clearFields?.length) {
      patch.clearFields = Array.from(new Set([...patch.clearFields, ...part.clearFields]));
    }
    if (part.isGreeting) patch.isGreeting = true;
    if (part.isThanks) patch.isThanks = true;
    if (part.isNewConversation) patch.isNewConversation = true;
  }
  return patch;
}

/**
 * Single extraction pass — identifies all supplied values and explicit changes.
 * Location roles consult previous.pendingClarification before any defaults.
 * Does not merge into state; does not clarify.
 */
export function extractTravelRequirements(
  message: string,
  previous: ConversationState,
  now: Date,
): ExtractionPatch {
  const raw = message.trim();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.\s]*$/i.test(raw)) {
    return { isGreeting: true, explicitChanges: [], clearFields: [] };
  }
  if (/^(thanks|thank you|cheers)[!,.\s]*$/i.test(raw)) {
    return { isThanks: true, explicitChanges: [], clearFields: [] };
  }
  if (/\b(?:start over|new (?:trip|conversation)|clear (?:everything|requirements))\b/i.test(raw)) {
    return { isNewConversation: true, explicitChanges: [], clearFields: [] };
  }

  const text = raw.replace(
    /^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.]?\s+/i,
    '',
  );

  const duration = extractDuration(text);
  const locations = extractLocations(text, {
    pendingClarification: previous.pendingClarification,
  });
  const dates = extractDates(text, now, duration);
  const services = extractServices(text);

  const durationPatch: Partial<ExtractionPatch> = { explicitChanges: [], clearFields: [] };
  if (duration != null) {
    durationPatch.durationNights = { value: duration, source: 'explicit', confirmed: true };
    durationPatch.explicitChanges = ['durationNights'];
  }

  return mergePatches([locations, durationPatch, dates, services]);
}
