import type { ExtractionPatch, TravelServiceKind } from '../types';

const SERVICE_PATTERNS: Array<{ kind: TravelServiceKind; re: RegExp }> = [
  { kind: 'flights', re: /\bflights?\b/i },
  { kind: 'accommodation', re: /\b(?:accommodation|hotel|hotels|stay|stays)\b/i },
  { kind: 'car_hire', re: /\b(?:car hire|rental car|hire car|car rental)\b/i },
  { kind: 'transfers', re: /\btransfers?\b/i },
  { kind: 'activities', re: /\bactivities\b/i },
];

function servicesIn(text: string): TravelServiceKind[] {
  return SERVICE_PATTERNS.filter((s) => s.re.test(text)).map((s) => s.kind);
}

export function extractServices(text: string): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { explicitChanges: [], clearFields: [] };
  const lower = text.toLowerCase();

  const removeClause = text.match(
    /\b(?:remove|forget|don'?t need|do not need|without|no)\s+([^.;]+)/i,
  );
  if (removeClause?.[1]) {
    const removed = servicesIn(removeClause[1]);
    if (removed.length) {
      patch.servicesRemove = removed;
      patch.explicitChanges = [...(patch.explicitChanges ?? []), 'services'];
    }
  }

  const needClause = text.match(
    /\b(?:i need|need|looking for|want|book|include)\s+([^.;]+)/i,
  );
  const addFromNeed = needClause?.[1] ? servicesIn(needClause[1]) : [];
  const addFromWhole = servicesIn(text);

  // Prefer clause-scoped adds; fall back to whole-message service mentions with travel intent
  const adds = addFromNeed.length
    ? addFromNeed
    : /\b(?:need|flights?|hotel|accommodation|car hire)\b/i.test(lower)
      ? addFromWhole
      : [];

  if (adds.length) {
    const removeSet = new Set(patch.servicesRemove ?? []);
    patch.servicesAdd = adds.filter((s) => !removeSet.has(s));
    if (patch.servicesAdd.length) {
      patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'services'])];
    }
  }

  // Side-effect: stay area / nights implies accommodation interest when services mentioned elsewhere
  if (
    /\b(?:stay(?:ing)? in|hotel in|for\s+\d+\s+nights?|for\s+(?:three|four|five|two|one)\s+nights?)\b/i.test(
      lower,
    ) &&
    (patch.servicesAdd?.length || /\b(?:flights?|car hire)\b/i.test(lower))
  ) {
    const list = new Set(patch.servicesAdd ?? []);
    list.add('accommodation');
    patch.servicesAdd = Array.from(list);
    patch.explicitChanges = [...new Set([...(patch.explicitChanges ?? []), 'services'])];
  }

  return patch;
}

export function extractDuration(text: string): number | undefined {
  const numeric = text.match(/\bfor\s+(\d+)\s+nights?\b/i);
  if (numeric) return Number(numeric[1]);
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  };
  const worded = text.match(/\bfor\s+(one|two|three|four|five|six|seven)\s+nights?\b/i);
  if (worded?.[1]) return words[worded[1].toLowerCase()];
  return undefined;
}
