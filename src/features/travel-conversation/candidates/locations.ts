import {
  findAreasInText,
  matchArea,
  placeCapturePattern,
  resolvePlaceName,
} from '../lexicon';
import type { LocationCandidate } from './types';

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
  const normalized = roleHint === 'accommodation' ? matchArea(raw)?.area ?? resolvePlaceName(raw) : normalizePlace(raw);
  if (!normalized) return;
  if (roleHint === 'origin' && matchArea(raw)) return;
  list.push({ kind: 'location', raw, normalized, roleHint, cue, index, confidence, source });
}

/**
 * Independent location candidate extraction — no state mutation.
 */
export function extractLocationCandidates(text: string): LocationCandidate[] {
  const place = placeCapturePattern();
  const found: LocationCandidate[] = [];

  type Route = {
    re: RegExp;
    cue: string;
    confidence: number;
    destFirst?: boolean;
  };

  const routes: Route[] = [
    {
      re: new RegExp(
        `\\b(?:(?:want\\s+to\\s+)?go(?:ing)?\\s+to|to)\\s+${place}(?:(?!\\b(?:go(?:ing)?\\s+to)\\b)[\\s\\S]){0,120}?\\bdeparting\\s+(?:from\\s+)?${place}\\b`,
        'i',
      ),
      cue: 'go-to-departing',
      confidence: 0.98,
      destFirst: true,
    },
    {
      re: new RegExp(
        `\\b(?:want\\s+)?${place}\\s*,?\\s*leaving\\s+from\\s+${place}\\b`,
        'i',
      ),
      cue: 'want-dest-leaving-from',
      confidence: 0.96,
      destFirst: true,
    },
    {
      re: new RegExp(`\\b${place}\\s+from\\s+${place}\\b`, 'i'),
      cue: 'dest-from-origin',
      confidence: 0.95,
      destFirst: true,
    },
    {
      re: new RegExp(`\\bleaving\\s+${place}\\s+for\\s+${place}\\b`, 'i'),
      cue: 'leaving-for',
      confidence: 0.95,
    },
    {
      re: new RegExp(`\\bdeparting\\s+(?:from\\s+)?${place}\\s+for\\s+${place}\\b`, 'i'),
      cue: 'departing-for',
      confidence: 0.95,
    },
    {
      re: new RegExp(
        `\\b(?:flying|travelling|traveling)\\s+from\\s+${place}\\s+to\\s+${place}\\b`,
        'i',
      ),
      cue: 'flying-from-to',
      confidence: 0.95,
    },
    {
      re: new RegExp(
        `\\bdeparting\\s+(?:from\\s+)?${place}(?:(?!\\bfrom\\b)[\\s\\S]){0,80}?\\b(?:going\\s+to|to)\\s+${place}\\b`,
        'i',
      ),
      cue: 'departing-to',
      confidence: 0.94,
    },
    {
      re: new RegExp(
        `\\bfrom\\s+${place}\\b(?:(?!\\bfrom\\b)[\\s\\S]){0,100}?\\b(?:(?:want\\s+to\\s+)?go(?:ing)?\\s+to|travell?(?:ing)?\\s+to|fly(?:ing)?\\s+to|to)\\s+${place}\\b`,
        'i',
      ),
      cue: 'from-to',
      confidence: 0.93,
    },
    {
      re: new RegExp(`(?:^|[.!?]\\s+)${place}\\s+to\\s+${place}\\b`, 'i'),
      cue: 'x-to-y',
      confidence: 0.9,
    },
  ];

  for (const route of routes) {
    const m = text.match(route.re);
    if (!m?.[1] || !m[2]) continue;
    const originRaw = route.destFirst ? m[2] : m[1];
    const destRaw = route.destFirst ? m[1] : m[2];
    const origin = normalizePlace(originRaw);
    const dest = normalizePlace(destRaw);
    if (!origin || !dest || origin.toLowerCase() === dest.toLowerCase()) continue;
    push(found, originRaw, 'origin', `${route.cue}:origin`, m.index ?? 0, route.confidence);
    push(found, destRaw, 'destination', `${route.cue}:destination`, (m.index ?? 0) + 1, route.confidence);
    break;
  }

  const hasOrigin = found.some((c) => c.roleHint === 'origin');
  const hasDest = found.some((c) => c.roleHint === 'destination');

  if (!hasOrigin) {
    const originCues: Array<{ re: RegExp; cue: string }> = [
      { re: new RegExp(`\\bmy\\s+departure\\s+city\\s+is\\s+${place}\\b`, 'i'), cue: 'departure-city-is' },
      { re: new RegExp(`\\bleaving\\s+from\\s+${place}\\b`, 'i'), cue: 'leaving-from' },
      { re: new RegExp(`\\bdeparting\\s+(?:from\\s+)?${place}\\b`, 'i'), cue: 'departing' },
      { re: new RegExp(`\\bflying\\s+from\\s+${place}\\b`, 'i'), cue: 'flying-from' },
      { re: new RegExp(`\\bfrom\\s+${place}\\b`, 'i'), cue: 'from' },
      { re: new RegExp(`\\bleaving\\s+${place}\\b`, 'i'), cue: 'leaving' },
    ];
    for (const { re, cue } of originCues) {
      const m = text.match(re);
      if (m?.[1]) {
        push(found, m[1], 'origin', cue, m.index ?? 0, 0.85);
        break;
      }
    }
  }

  if (!hasDest) {
    const destCues: Array<{ re: RegExp; cue: string }> = [
      {
        re: new RegExp(
          `\\b(?:want\\s+to\\s+go(?:\\s+to)?|i\\s+want\\s+(?:to\\s+go\\s+to|to\\s+go|)|go(?:ing)?\\s+to|travel(?:ling|ing)?\\s+to|fly(?:ing)?\\s+to)\\s+${place}\\b`,
          'i',
        ),
        cue: 'go-to',
      },
      {
        re: new RegExp(
          `\\b(?:let'?s\\s+)?plan(?:ning)?\\s+(?:(?:a|the|our|my)\\s+)?(?:trip\\s+to\\s+)?${place}\\b`,
          'i',
        ),
        cue: 'plan-place',
      },
      {
        re: new RegExp(
          `\\b(?:look(?:ing)?\\s+at|let'?s\\s+look\\s+at)\\s+(?:(?:a|the|our|my)\\s+)?${place}\\b`,
          'i',
        ),
        cue: 'look-at-place',
      },
      { re: new RegExp(`\\bi\\s+want\\s+${place}\\b`, 'i'), cue: 'i-want-place' },
      { re: new RegExp(`\\bvisit(?:ing)?\\s+${place}\\b`, 'i'), cue: 'visit' },
    ];
    for (const { re, cue } of destCues) {
      const m = text.match(re);
      if (m?.[1]) {
        const origin = found.find((c) => c.roleHint === 'origin')?.normalized;
        const dest = normalizePlace(m[1]);
        if (dest && dest.toLowerCase() !== origin?.toLowerCase()) {
          push(found, m[1], 'destination', cue, m.index ?? 0, 0.85);
          break;
        }
      }
    }
  }

  // Bare "to PLACE" only when origin already known in this pass
  if (!found.some((c) => c.roleHint === 'destination') && found.some((c) => c.roleHint === 'origin')) {
    const bareTo = text.match(new RegExp(`\\bto\\s+${place}\\b`, 'i'));
    if (bareTo?.[1] && !/\b(?:come back|return|back)\s+to\b/i.test(text)) {
      const origin = found.find((c) => c.roleHint === 'origin')!.normalized;
      const dest = normalizePlace(bareTo[1]);
      if (dest && dest.toLowerCase() !== origin.toLowerCase()) {
        push(found, bareTo[1], 'destination', 'bare-to', bareTo.index ?? 0, 0.7);
      }
    }
  }

  // Accommodation areas
  const areas = findAreasInText(text);
  const stay = text.match(
    /\b(?:stay(?:ing)?|hotel|accommodation)\s+(?:in|at)\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i,
  );
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
    if (!found.some((c) => c.roleHint === 'destination')) {
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
  } else if (stay?.[1]) {
    const hit = matchArea(stay[1]);
    if (hit) {
      found.push({
        kind: 'location',
        raw: stay[1],
        normalized: hit.area,
        roleHint: 'accommodation',
        cue: 'stay-in',
        index: stay.index ?? 0,
        confidence: 0.88,
        source: 'explicit',
      });
      if (!found.some((c) => c.roleHint === 'destination')) {
        found.push({
          kind: 'location',
          raw: hit.city,
          normalized: hit.city,
          roleHint: 'destination',
          cue: 'stay-in-city-infer',
          index: stay.index ?? 0,
          confidence: 0.45,
          source: 'inferred',
        });
      }
    }
  }

  // Standalone place / area (clarification replies or fragmented stay area)
  const standalone = text
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  if (
    standalone.length <= 48 &&
    !/\b(?:flights?|accommodation|car\s*hire|returning|staying|nights?|august|january|february|march|april|june|july|september|october|november|december|\d{1,2}[\/\-]\d{1,2})\b/i.test(
      standalone,
    )
  ) {
    const areaHit = matchArea(standalone);
    if (areaHit) {
      if (!found.some((c) => c.roleHint === 'accommodation')) {
        found.push({
          kind: 'location',
          raw: standalone,
          normalized: areaHit.area,
          roleHint: 'accommodation',
          cue: 'standalone-area',
          index: 0,
          confidence: 0.85,
          source: 'explicit',
        });
      }
      if (!found.some((c) => c.roleHint === 'destination')) {
        found.push({
          kind: 'location',
          raw: areaHit.city,
          normalized: areaHit.city,
          roleHint: 'destination',
          cue: 'standalone-area-city-infer',
          index: 0,
          confidence: 0.4,
          source: 'inferred',
        });
      }
    } else {
      const wrapped = standalone.match(
        new RegExp(`^(?:(?:it'?s|from|to|in)\\s+)?${place}(?:\\s+please)?$`, 'i'),
      );
      const name = wrapped?.[1] ? normalizePlace(wrapped[1]) : resolvePlaceName(standalone);
      if (name && !found.some((c) => c.normalized.toLowerCase() === name.toLowerCase())) {
        found.push({
          kind: 'location',
          raw: standalone,
          normalized: name,
          roleHint: 'unspecified',
          cue: 'standalone',
          index: 0,
          confidence: 0.6,
          source: 'explicit',
        });
      }
    }
  }

  return found;
}
