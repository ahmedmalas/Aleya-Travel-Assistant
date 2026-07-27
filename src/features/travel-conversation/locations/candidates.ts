import {
  findAreasInText,
  matchArea,
  placeCapturePattern,
  resolvePlaceName,
} from '../lexicon';
import type { LocationCandidate } from './types';

function normalizeCaptured(raw: string): string | undefined {
  const area = matchArea(raw);
  if (area) return area.city;
  return resolvePlaceName(raw);
}

function pushCandidate(
  list: LocationCandidate[],
  raw: string,
  roleHint: LocationCandidate['roleHint'],
  strength: number,
  source: string,
): void {
  const normalized = normalizeCaptured(raw);
  if (!normalized) return;
  // Stay-area tokens must not become origin/destination via origin cues
  if (roleHint === 'origin' && matchArea(raw)) return;
  list.push({ raw, normalized, roleHint, strength, source });
}

/**
 * Collect every location mention with a cue-derived role hint.
 * Does not assign final roles and does not consult clarification state.
 */
export function extractLocationCandidates(text: string): LocationCandidate[] {
  const place = placeCapturePattern();
  const found: LocationCandidate[] = [];

  // Destination hard replacements
  const instead = text.match(
    new RegExp(
      `\\b(?:no[,.]?\\s+)?(?:go to|travel to|fly to|make it)\\s+${place}\\s+instead\\b`,
      'i',
    ),
  );
  if (instead?.[1]) {
    pushCandidate(found, instead[1], 'destination', 100, 'instead');
  }

  const changeDest = text.match(
    new RegExp(
      `\\b(?:change|switch)\\s+(?:the\\s+)?destination\\s+to\\s+${place}|\\bdestination\\s+is\\s+${place}|\\bnot\\s+${place}\\s*[—\\-–,:]\\s*${place}`,
      'i',
    ),
  );
  if (changeDest) {
    const groups = changeDest.filter((g, i) => i > 0 && typeof g === 'string') as string[];
    const raw = groups[groups.length - 1];
    if (raw) pushCandidate(found, raw, 'destination', 100, 'destination-change');
  }

  // Route pairs — capture BOTH roles; never treat departure city as destination.
  const routePatterns: Array<{
    re: RegExp;
    source: string;
    strength: number;
    /** When true, capture group 1 is destination and group 2 is origin. */
    destFirst?: boolean;
  }> = [
    {
      // I want to go to Gold Coast departing Melbourne / ... and departing from Melbourne
      re: new RegExp(
        `\\b(?:(?:want\\s+to\\s+)?go(?:ing)?\\s+to|travell?(?:ing)?\\s+to|fly(?:ing)?\\s+to)\\s+${place}(?:(?!\\b(?:go(?:ing)?\\s+to|to)\\b)[\\s\\S]){0,100}?\\bdeparting\\s+(?:from\\s+)?${place}\\b`,
        'i',
      ),
      source: 'go-to-departing',
      strength: 96,
      destFirst: true,
    },
    {
      re: new RegExp(
        `\\bleaving\\s+${place}\\s+for\\s+${place}\\b`,
        'i',
      ),
      source: 'leaving-for',
      strength: 95,
    },
    {
      re: new RegExp(
        `\\b(?:flying|travelling|traveling)\\s+from\\s+${place}\\s+to\\s+${place}\\b`,
        'i',
      ),
      source: 'flying-from-to',
      strength: 95,
    },
    {
      re: new RegExp(
        `\\bdeparting\\s+(?:from\\s+)?${place}(?:(?!\\bfrom\\b)[\\s\\S]){0,80}?\\b(?:going\\s+to|to)\\s+${place}\\b`,
        'i',
      ),
      source: 'departing-going-to',
      strength: 95,
    },
    {
      // From Melbourne, I want to go to Gold Coast / From Melbourne to Gold Coast
      re: new RegExp(
        `\\bfrom\\s+${place}\\b(?:(?!\\bfrom\\b)[\\s\\S]){0,100}?\\b(?:(?:want\\s+to\\s+)?go(?:ing)?\\s+to|travell?(?:ing)?\\s+to|fly(?:ing)?\\s+to|to)\\s+${place}\\b`,
        'i',
      ),
      source: 'from-flexible-to',
      strength: 90,
    },
    {
      // "Melbourne to Gold Coast" — require start/punctuation so "want to go" cannot invert roles
      re: new RegExp(`(?:^|[.!?]\\s+)${place}\\s+to\\s+${place}\\b`, 'i'),
      source: 'x-to-y',
      strength: 85,
    },
  ];

  for (const { re, source, strength, destFirst } of routePatterns) {
    const m = text.match(re);
    if (m?.[1] && m?.[2]) {
      const originRaw = destFirst ? m[2] : m[1];
      const destRaw = destFirst ? m[1] : m[2];
      const origin = normalizeCaptured(originRaw);
      const dest = normalizeCaptured(destRaw);
      if (origin && dest && origin.toLowerCase() !== dest.toLowerCase()) {
        pushCandidate(found, originRaw, 'origin', strength, `${source}:origin`);
        pushCandidate(found, destRaw, 'destination', strength, `${source}:destination`);
        break;
      }
    }
  }

  // Solo origin cues — "departing Melbourne" must never become destination
  const originSolo: Array<{ re: RegExp; source: string }> = [
    { re: new RegExp(`\\bmy\\s+departure\\s+city\\s+is\\s+${place}\\b`, 'i'), source: 'departure-city-is' },
    { re: new RegExp(`\\bi'?m\\s+leaving\\s+from\\s+${place}\\b`, 'i'), source: 'im-leaving-from' },
    { re: new RegExp(`\\bleaving\\s+from\\s+${place}\\b`, 'i'), source: 'leaving-from' },
    { re: new RegExp(`\\bdeparting\\s+(?:from\\s+)?${place}\\b`, 'i'), source: 'departing' },
    { re: new RegExp(`\\bflying\\s+from\\s+${place}\\b`, 'i'), source: 'flying-from' },
    { re: new RegExp(`\\bfrom\\s+${place}\\b`, 'i'), source: 'from' },
    { re: new RegExp(`\\bleaving\\s+${place}\\b`, 'i'), source: 'leaving' },
  ];
  const hasOrigin = found.some((c) => c.roleHint === 'origin');
  if (!hasOrigin) {
    for (const { re, source } of originSolo) {
      const m = text.match(re);
      if (m?.[1]) {
        pushCandidate(found, m[1], 'origin', 70, source);
        break;
      }
    }
  }

  // Solo destination cues
  const destSolo: Array<{ re: RegExp; source: string }> = [
    {
      re: new RegExp(
        `\\b(?:want\\s+to\\s+go|i\\s+want\\s+to\\s+go|go(?:ing)?|travel(?:ling|ing)?|fly(?:ing)?)\\s+to\\s+${place}\\b`,
        'i',
      ),
      source: 'go-to',
    },
    { re: new RegExp(`\\bvisit(?:ing)?\\s+${place}\\b`, 'i'), source: 'visit' },
  ];
  const hasDest = found.some((c) => c.roleHint === 'destination');
  if (!hasDest) {
    for (const { re, source } of destSolo) {
      const m = text.match(re);
      if (m?.[1]) {
        const dest = normalizeCaptured(m[1]);
        const origin = found.find((c) => c.roleHint === 'origin')?.normalized;
        if (dest && dest.toLowerCase() !== origin?.toLowerCase()) {
          pushCandidate(found, m[1], 'destination', 70, source);
          break;
        }
      }
    }
  }

  // Bare "to PLACE" only when origin already established in this pass
  if (!found.some((c) => c.roleHint === 'destination') && found.some((c) => c.roleHint === 'origin')) {
    const bareTo = text.match(new RegExp(`\\bto\\s+${place}\\b`, 'i'));
    if (bareTo?.[1] && !/\b(?:come back|return|back)\s+to\b/i.test(text)) {
      const origin = found.find((c) => c.roleHint === 'origin')!.normalized;
      const dest = normalizeCaptured(bareTo[1]);
      if (dest && dest.toLowerCase() !== origin.toLowerCase()) {
        pushCandidate(found, bareTo[1], 'destination', 60, 'bare-to');
      }
    }
  }

  // Accommodation areas
  const areas = findAreasInText(text);
  const stayIn = text.match(
    /\b(?:stay(?:ing)?|hotel|accommodation)\s+(?:in|at)\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i,
  );
  if (areas[0]) {
    found.push({
      raw: areas[0].area,
      normalized: areas[0].area,
      roleHint: 'accommodation',
      strength: 80,
      source: 'area-lexicon',
    });
    if (!found.some((c) => c.roleHint === 'destination')) {
      found.push({
        raw: areas[0].city,
        normalized: areas[0].city,
        roleHint: 'destination',
        strength: 40,
        source: 'area-city-infer',
      });
    }
  } else if (stayIn?.[1]) {
    const areaHit = matchArea(stayIn[1]);
    if (areaHit) {
      found.push({
        raw: stayIn[1],
        normalized: areaHit.area,
        roleHint: 'accommodation',
        strength: 80,
        source: 'stay-in',
      });
      if (!found.some((c) => c.roleHint === 'destination')) {
        found.push({
          raw: areaHit.city,
          normalized: areaHit.city,
          roleHint: 'destination',
          strength: 40,
          source: 'stay-in-city-infer',
        });
      }
    }
  }

  return found;
}

/**
 * True when the message is essentially a single place name (clarification reply).
 */
export function parseStandalonePlace(text: string): string | undefined {
  const cleaned = text
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  if (!cleaned || cleaned.length > 48) return undefined;

  // Reject multi-intent travel sentences
  if (
    /\b(?:flights?|accommodation|car\s*hire|returning|staying|nights?|august|january|february|march|april|june|july|september|october|november|december|\d{1,2}[\/\-]\d{1,2})\b/i.test(
      cleaned,
    )
  ) {
    return undefined;
  }

  // Allow light wrappers around a place
  const wrapped = cleaned.match(
    new RegExp(
      `^(?:(?:it'?s|from|to|in)\\s+)?${placeCapturePattern()}(?:\\s+please)?$`,
      'i',
    ),
  );
  if (wrapped?.[1]) {
    return normalizeCaptured(wrapped[1]);
  }

  return resolvePlaceName(cleaned) ?? matchArea(cleaned)?.city;
}
