import {
  findAreasInText,
  matchArea,
  placeCapturePattern,
  resolvePlaceName,
} from '../lexicon';
import type { ExtractionPatch, FieldValue } from '../types';

function explicitPlace(name: string): FieldValue<string> {
  return { value: name, source: 'explicit', confirmed: true };
}

function normalizeCaptured(raw: string): string | undefined {
  const area = matchArea(raw);
  if (area) return area.city;
  return resolvePlaceName(raw);
}

/**
 * Extract origin + destination in one deterministic pass.
 * Origin cues (from / leaving / X to Y) always win over destination for that slot.
 */
export function extractPlaces(text: string): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { explicitChanges: [], clearFields: [] };
  const place = placeCapturePattern();
  const lower = text; // keep original for case-sensitive Gold Coast etc.; patterns use /i

  // --- Destination replacement (hard) ---
  const instead = lower.match(
    new RegExp(
      `\\b(?:no[,.]?\\s+)?(?:go to|travel to|fly to|make it)\\s+${place}\\s+instead\\b`,
      'i',
    ),
  );
  const changeDest = lower.match(
    new RegExp(
      `\\b(?:change|switch)\\s+(?:the\\s+)?destination\\s+to\\s+${place}|\\bdestination\\s+is\\s+${place}|\\bnot\\s+${place}\\s*[—\\-–,:]\\s*${place}`,
      'i',
    ),
  );
  if (instead?.[1]) {
    const dest = normalizeCaptured(instead[1]);
    if (dest) {
      patch.destination = explicitPlace(dest);
      patch.explicitChanges = [...(patch.explicitChanges ?? []), 'destination'];
    }
  } else if (changeDest) {
    // last capture is the new destination when "Not X — Y"
    const groups = changeDest.filter((_, i) => i > 0 && typeof changeDest[i] === 'string') as string[];
    const raw = groups[groups.length - 1];
    const dest = raw ? normalizeCaptured(raw) : undefined;
    if (dest) {
      patch.destination = explicitPlace(dest);
      patch.explicitChanges = [...(patch.explicitChanges ?? []), 'destination'];
    }
  }

  // --- Route: (from)? X to Y ---
  const route = lower.match(
    new RegExp(
      `\\b(?:(?:flying|travelling|traveling|going)\\s+)?(?:from\\s+)?${place}\\s+to\\s+${place}\\b`,
      'i',
    ),
  );
  if (route?.[1] && route[2]) {
    const origin = normalizeCaptured(route[1]);
    const dest = normalizeCaptured(route[2]);
    if (origin && dest && origin.toLowerCase() !== dest.toLowerCase()) {
      patch.origin = explicitPlace(origin);
      if (!patch.destination) patch.destination = explicitPlace(dest);
      patch.explicitChanges = [
        ...new Set([...(patch.explicitChanges ?? []), 'origin', 'destination']),
      ];
    }
  }

  // --- Explicit origin: From X / leaving X / departing from X ---
  if (!patch.origin) {
    const fromPatterns = [
      new RegExp(`\\bfrom\\s+${place}\\b`, 'i'),
      new RegExp(`\\bleaving\\s+${place}\\b`, 'i'),
      new RegExp(`\\bdeparting\\s+from\\s+${place}\\b`, 'i'),
      new RegExp(`\\bflying\\s+from\\s+${place}\\b`, 'i'),
      new RegExp(`\\bleaving\\s+${place}\\s+for\\b`, 'i'),
    ];
    for (const re of fromPatterns) {
      const m = lower.match(re);
      if (m?.[1]) {
        const origin = normalizeCaptured(m[1]);
        // Do not treat stay-area names as origin
        if (origin && !matchArea(m[1])) {
          patch.origin = explicitPlace(origin);
          patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'origin'])];
          break;
        }
      }
    }
  }

  // --- Explicit destination: go to / want to go to / visit ---
  if (!patch.destination) {
    const toPatterns = [
      new RegExp(`\\b(?:want to go|i want to go|go|going|travel|fly|flying)\\s+to\\s+${place}\\b`, 'i'),
      new RegExp(`\\bvisit(?:ing)?\\s+${place}\\b`, 'i'),
    ];
    for (const re of toPatterns) {
      const m = lower.match(re);
      if (m?.[1]) {
        const dest = normalizeCaptured(m[1]);
        if (dest && dest.toLowerCase() !== patch.origin?.value.toLowerCase()) {
          patch.destination = explicitPlace(dest);
          patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'destination'])];
          break;
        }
      }
    }
  }

  // Bare "to Gold Coast" when origin already known from "From X,"
  if (!patch.destination && patch.origin) {
    const bareTo = lower.match(new RegExp(`\\bto\\s+${place}\\b`, 'i'));
    if (bareTo?.[1]) {
      const dest = normalizeCaptured(bareTo[1]);
      if (
        dest &&
        dest.toLowerCase() !== patch.origin.value.toLowerCase() &&
        !/\b(?:come back|return|back)\s+to\b/i.test(lower)
      ) {
        patch.destination = explicitPlace(dest);
        patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'destination'])];
      }
    }
  }

  // Accommodation area
  const areas = findAreasInText(text);
  const stayIn = lower.match(
    /\b(?:stay(?:ing)?|hotel|accommodation)\s+(?:in|at)\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i,
  );
  if (areas[0]) {
    patch.accommodationArea = explicitPlace(areas[0].area);
    patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'accommodationArea'])];
    if (!patch.destination) {
      patch.destination = { value: areas[0].city, source: 'inferred', confirmed: false };
      patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'destination'])];
    }
  } else if (stayIn?.[1]) {
    const areaHit = matchArea(stayIn[1]);
    if (areaHit) {
      patch.accommodationArea = explicitPlace(areaHit.area);
      patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'accommodationArea'])];
      if (!patch.destination) {
        patch.destination = { value: areaHit.city, source: 'inferred', confirmed: false };
      }
    }
  }

  return patch;
}
