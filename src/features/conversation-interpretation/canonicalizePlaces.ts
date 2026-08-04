import { resolveSync } from '../travel-location-intelligence';
import type { TravelSemanticInterpretation } from './schema';
import type { PlaceResolutionStatus } from './placeResolution';

function displayNormalizePlace(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  // Light display normalisation only — not a curated place catalogue.
  return trimmed
    .split(' ')
    .map((token) => {
      let out = '';
      let cap = true;
      for (let i = 0; i < token.length; i += 1) {
        const ch = token.charAt(i);
        if (ch === '-' || ch === "'") {
          out += ch;
          cap = true;
          continue;
        }
        const code = ch.charCodeAt(0);
        if (cap && code >= 97 && code <= 122) {
          out += String.fromCharCode(code - 32);
          cap = false;
        } else if (!cap && code >= 65 && code <= 90) {
          out += String.fromCharCode(code + 32);
        } else {
          out += ch;
          if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
            cap = false;
          }
        }
      }
      return out;
    })
    .join(' ');
}

function enrichPlaceField(
  raw: string,
  field: 'destination' | 'origin',
): {
  value: string;
  status: PlaceResolutionStatus;
  warning?: string;
  ambiguityNote?: string;
} {
  const resolved = resolveSync(raw);
  if (resolved.best) {
    return {
      value: resolved.best.canonicalName,
      status: 'resolved',
    };
  }
  if (resolved.ambiguityDetected) {
    return {
      value: displayNormalizePlace(raw),
      status: 'ambiguous',
      warning: `Ambiguous ${field}: ${raw}`,
      ambiguityNote: `Ambiguous ${field}: ${raw}`,
    };
  }
  return {
    value: displayNormalizePlace(raw),
    status: 'unresolved',
    warning: `Unresolved ${field} retained pending validation: ${raw}`,
  };
}

/**
 * TLI enrichment / canonicalisation for interpreted places.
 *
 * Owns enrichment and ambiguity/unresolved flags only.
 * Does not erase a shape-valid place merely because local TLI coverage is incomplete.
 * Semantic interpretation remains the owner of user meaning.
 */
export function canonicalizeSemanticPlaces(
  semantic: TravelSemanticInterpretation,
): { semantic: TravelSemanticInterpretation; warnings: string[] } {
  const warnings: string[] = [];
  const next: TravelSemanticInterpretation = {
    ...semantic,
    ambiguityNotes: [...semantic.ambiguityNotes],
  };

  if (typeof next.destination === 'string' && next.destination.length > 0) {
    const enriched = enrichPlaceField(next.destination, 'destination');
    next.destination = enriched.value;
    next.destinationResolutionStatus = enriched.status;
    if (enriched.warning) warnings.push(enriched.warning);
    if (enriched.ambiguityNote) {
      next.ambiguityNotes.push(enriched.ambiguityNote);
    }
    if (enriched.status !== 'resolved') {
      next.confidence = Math.min(next.confidence, 0.7);
    }
  }

  if (typeof next.origin === 'string' && next.origin.length > 0) {
    const enriched = enrichPlaceField(next.origin, 'origin');
    next.origin = enriched.value;
    next.originResolutionStatus = enriched.status;
    if (enriched.warning) warnings.push(enriched.warning);
    if (enriched.ambiguityNote) {
      next.ambiguityNotes.push(enriched.ambiguityNote);
    }
    if (enriched.status !== 'resolved') {
      next.confidence = Math.min(next.confidence, 0.7);
    }
  }

  return { semantic: next, warnings };
}
