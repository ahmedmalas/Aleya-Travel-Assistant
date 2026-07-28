import {
  resolveLocationsForMessageSync,
  type LocationResolutionPass,
} from '../../travel-location-intelligence';
import {
  findAreasInText,
  matchArea,
  placeCapturePattern,
  resolvePlaceName,
} from '../lexicon';
import type { LocationCandidate } from './types';

let lastLocationPass: LocationResolutionPass | null = null;

export function getLastLocationResolutionPass(): LocationResolutionPass | null {
  return lastLocationPass;
}

export function clearLastLocationResolutionPass(): void {
  lastLocationPass = null;
}

function normalizePlace(raw: string): string | undefined {
  const area = matchArea(raw);
  if (area) return area.city;
  return resolvePlaceName(raw);
}

function push(
  list: LocationCandidate[],
  raw: string,
  roleHint: LocationCandidate['roleHint'],
  cue: string,
  index: number,
  confidence: number,
  source: LocationCandidate['source'] = 'explicit',
): void {
  const normalized =
    roleHint === 'accommodation'
      ? matchArea(raw)?.area ?? resolvePlaceName(raw)
      : normalizePlace(raw);
  if (!normalized) return;
  if (roleHint === 'origin' && matchArea(raw)) return;
  if (list.some((c) => c.normalized.toLowerCase() === normalized.toLowerCase() && c.roleHint === roleHint)) {
    return;
  }
  list.push({ kind: 'location', raw, normalized, roleHint, cue, index, confidence, source });
}

/**
 * Location candidate extraction — provider-backed intelligence first, lexicon fallback.
 */
export function extractLocationCandidates(
  text: string,
  awaitingField?: string,
  previous?: { origin?: string; destination?: string },
): LocationCandidate[] {
  const intelligence = resolveLocationsForMessageSync({
    message: text,
    awaitingField,
    destinationBefore: previous?.destination,
    originBefore: previous?.origin,
  });
  lastLocationPass = intelligence;

  const found: LocationCandidate[] = [...intelligence.candidates];

  // If intelligence already resolved destination/origin, skip lexicon duplicate work
  // but still allow lexicon area detection for accommodation when missing.
  const hasOrigin = found.some((c) => c.roleHint === 'origin');
  const hasDest = found.some((c) => c.roleHint === 'destination');
  const hasAccom = found.some((c) => c.roleHint === 'accommodation');

  if (!hasAccom) {
    const areas = findAreasInText(text);
    if (areas[0]) {
      found.push({
        kind: 'location',
        raw: areas[0].area,
        normalized: areas[0].area,
        roleHint: 'accommodation',
        cue: 'area-lexicon',
        index: areas[0].index,
        confidence: 0.9,
        source: 'explicit',
      });
      if (!hasDest) {
        found.push({
          kind: 'location',
          raw: areas[0].city,
          normalized: areas[0].city,
          roleHint: 'destination',
          cue: 'area-city-infer',
          index: areas[0].index,
          confidence: 0.45,
          source: 'inferred',
        });
      }
    }
  }

  // Lexicon fallback for classic route cues when intelligence found nothing useful
  if (!hasOrigin && !hasDest && !intelligence.ambiguity) {
    const place = placeCapturePattern();
    const route = text.match(
      new RegExp(
        `\\b(?:flying|travelling|traveling)\\s+from\\s+${place}\\s+to\\s+${place}\\b`,
        'i',
      ),
    );
    if (route?.[1] && route[2]) {
      push(found, route[1], 'origin', 'lexicon-flying-from-to', route.index ?? 0, 0.95);
      push(found, route[2], 'destination', 'lexicon-flying-from-to', (route.index ?? 0) + 1, 0.95);
    }
  }

  return found;
}
