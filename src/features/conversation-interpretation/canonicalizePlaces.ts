import { resolveSync } from '../travel-location-intelligence';
import type { TravelSemanticInterpretation } from './schema';

/**
 * Canonicalise place fields through travel-location-intelligence.
 * Rejects place strings that do not resolve to a known place.
 */
export function canonicalizeSemanticPlaces(
  semantic: TravelSemanticInterpretation,
): { semantic: TravelSemanticInterpretation; warnings: string[] } {
  const warnings: string[] = [];
  const next: TravelSemanticInterpretation = { ...semantic };

  if (typeof next.destination === 'string' && next.destination.length > 0) {
    const resolved = resolveSync(next.destination);
    if (resolved.best) {
      next.destination = resolved.best.canonicalName;
    } else if (resolved.ambiguityDetected) {
      warnings.push(`Ambiguous destination: ${next.destination}`);
      next.destination = null;
      next.ambiguityNotes = [
        ...next.ambiguityNotes,
        `Ambiguous destination: ${semantic.destination}`,
      ];
      next.confidence = Math.min(next.confidence, 0.4);
    } else {
      warnings.push(`Unresolved destination: ${next.destination}`);
      next.destination = null;
      next.confidence = Math.min(next.confidence, 0.35);
    }
  }

  if (typeof next.origin === 'string' && next.origin.length > 0) {
    const resolved = resolveSync(next.origin);
    if (resolved.best) {
      next.origin = resolved.best.canonicalName;
    } else if (resolved.ambiguityDetected) {
      warnings.push(`Ambiguous origin: ${next.origin}`);
      next.origin = null;
      next.ambiguityNotes = [
        ...next.ambiguityNotes,
        `Ambiguous origin: ${semantic.origin}`,
      ];
      next.confidence = Math.min(next.confidence, 0.4);
    } else {
      warnings.push(`Unresolved origin: ${next.origin}`);
      next.origin = null;
      next.confidence = Math.min(next.confidence, 0.35);
    }
  }

  return { semantic: next, warnings };
}
