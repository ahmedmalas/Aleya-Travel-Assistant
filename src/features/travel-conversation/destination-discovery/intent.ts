import {
  extractLocationSpans,
  resolveSync,
} from '../../travel-location-intelligence';
import type { ConversationState } from '../types';
import { catalogueByPlaceName, DISCOVERY_CATALOGUE } from './catalogue';
import type { DestinationDiscoveryState, DiscoveryCandidate } from './types';

const DISCOVERY_INTENT_RE =
  /\b(?:where\s+should\s+i\s+go|help\s+me\s+choose(?:\s+a\s+destination)?|recommend\s+(?:me\s+)?(?:a\s+)?(?:somewhere|destination|place)|find\s+me\s+(?:a\s+)?(?:place|somewhere|destination)|somewhere\b|i\s+want\s+(?:a\s+(?:relaxing\s+)?(?:beach\s+)?holiday|to\s+go\s+somewhere)|beach\s+holiday|city\s+break|tropical)\b/i;

const SOFT_SOMEWHERE_RE =
  /\bsomewhere\b|\bwhere\s+should\s+i\s+go\b|\bhelp\s+me\s+choose\b|\brecommend\s+(?:me\s+)?(?:a\s+)?(?:somewhere|destination|place)\b|\bfind\s+me\s+(?:a\s+)?(?:place|somewhere|destination)\b|\bbeach\s+holiday\b|\bcity\s+break\b/i;

const EMPTY_ACK_RE =
  /^(thanks|thank\s+you|got\s+it|okay|ok|sure|cool|great|perfect|yes|yeah|yep)[.!]?$/i;

export function isEmptyAcknowledgement(text: string): boolean {
  return EMPTY_ACK_RE.test(text.trim());
}

export function isSoftDiscoveryPhrase(text: string): boolean {
  return SOFT_SOMEWHERE_RE.test(text) || DISCOVERY_INTENT_RE.test(text);
}

function resolvedPlaceName(query: string): { name: string; confidence: number } | null {
  const { candidates, best, ambiguityDetected } = resolveSync(query, {
    allowFuzzy: true,
    roleHint: 'destination',
  });
  const place = best ?? (!ambiguityDetected ? candidates[0]?.place : undefined);
  if (!place) return null;
  return { name: place.canonicalName, confidence: place.confidence ?? candidates[0]?.score ?? 0 };
}

/**
 * True when the message names a resolvable place as a booking destination,
 * not a soft "somewhere …" discovery phrase.
 */
export function hasExplicitNamedDestination(text: string): boolean {
  if (/\bsomewhere\b/i.test(text)) {
    // "somewhere like Fiji" is discovery-like; plain "somewhere tropical" is not named.
    if (!/\bsomewhere\s+(?:like|near|in)\s+/i.test(text)) return false;
  }

  const spans = extractLocationSpans(text);
  for (const span of spans) {
    if (span.roleHint !== 'destination' && span.roleHint !== 'unspecified') continue;
    const raw = span.raw.trim();
    if (/^somewhere\b/i.test(raw)) continue;
    if (/^(a\s+)?place\b/i.test(raw)) continue;
    if (
      /\b(tropical|relax|quiet|warm|beach\s+holiday|city\s+break|kayaking|clear\s+water)\b/i.test(
        raw,
      )
    ) {
      continue;
    }
    const hit = resolvedPlaceName(raw);
    if (!hit || hit.confidence < 0.7) continue;

    // "under six hours from Sydney" — origin cue, not destination
    if (
      new RegExp(`\\b(?:hours?\\s+from|from)\\s+${hit.name}\\b`, 'i').test(text) ||
      (span.cue.includes('from') && !span.cue.includes('to'))
    ) {
      continue;
    }
    return true;
  }

  // Strong booking phrasing: "flights to Gold Coast", "go to Melbourne"
  const booking = text.match(
    /\b(?:flights?\s+to|go(?:ing)?\s+to|travel(?:ling|ing)?\s+to|fly(?:ing)?\s+to|visit(?:ing)?)\s+([A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*){0,3})(?:\s+(?:on|from|for|in|at|next|this|with|and|returning|departing)\b|[.,!]|$)/i,
  );
  if (booking?.[1] && !/\bsomewhere\b/i.test(booking[1])) {
    const hit = resolvedPlaceName(booking[1].trim());
    if (hit && hit.confidence >= 0.75) return true;
  }

  return false;
}

export function looksLikeDiscoveryIntent(text: string, state: ConversationState): boolean {
  if (state.discovery?.mode === 'active') return true;
  if (hasExplicitNamedDestination(text) && !isSoftDiscoveryPhrase(text)) return false;
  return isSoftDiscoveryPhrase(text) || DISCOVERY_INTENT_RE.test(text);
}

export function matchSelectionFromMessage(
  text: string,
  discovery: DestinationDiscoveryState | undefined,
): { placeName: string; candidateId?: string } | null {
  if (!discovery || (discovery.mode !== 'active' && discovery.mode !== 'selected')) {
    // Allow selection only while discovering
  }
  if (!discovery || discovery.mode !== 'active') return null;

  const lowered = text.toLowerCase();
  const candidates: DiscoveryCandidate[] = discovery.recommendations;

  for (const c of candidates) {
    const name = c.placeName.toLowerCase();
    if (
      lowered.includes(name) &&
      /\b(let'?s\s+do|go\s+with|choose|pick|sounds?\s+best|option|book|take)\b/i.test(text)
    ) {
      return { placeName: c.placeName, candidateId: c.id };
    }
    if (
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text) &&
      /\b(yes|yeah|that\s+one|perfect)\b/i.test(text)
    ) {
      return { placeName: c.placeName, candidateId: c.id };
    }
  }

  const letsMatch = text.match(
    /\b(?:let'?s\s+do|go\s+with|choose|i(?:'| a)?ll\s+take)\s+([A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*)?)/i,
  );
  if (letsMatch?.[1]) {
    const place = letsMatch[1].trim();
    const fromRec = candidates.find((c) => c.placeName.toLowerCase() === place.toLowerCase());
    const fromCat = catalogueByPlaceName(place);
    const hit = resolvedPlaceName(place);
    if (fromRec || fromCat || hit) {
      return {
        placeName: fromRec?.placeName ?? fromCat?.placeName ?? hit!.name,
        candidateId: fromRec?.id ?? fromCat?.id,
      };
    }
  }

  const option = text.match(/\bthe\s+([A-Za-z][A-Za-z\s]{1,30}?)\s+option\b/i);
  if (option?.[1]) {
    const place = option[1].trim();
    const fromRec = candidates.find((c) => c.placeName.toLowerCase() === place.toLowerCase());
    if (fromRec) return { placeName: fromRec.placeName, candidateId: fromRec.id };
    const fromCat = catalogueByPlaceName(place);
    if (fromCat) return { placeName: fromCat.placeName, candidateId: fromCat.id };
  }

  return null;
}

export function matchRejectedRecommendation(
  text: string,
  discovery: DestinationDiscoveryState | undefined,
): string[] {
  if (!discovery?.recommendations.length) return [];
  if (!/\b(don'?t\s+like\s+any|none\s+of\s+(?:those|them)|not\s+interested)\b/i.test(text)) {
    return [];
  }
  return discovery.recommendations.map((r) => r.id);
}

/** Exported for tests / debugging. */
export { DISCOVERY_CATALOGUE };
