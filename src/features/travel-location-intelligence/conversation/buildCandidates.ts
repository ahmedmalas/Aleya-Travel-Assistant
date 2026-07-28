import { looksLikeNonPlace } from '../classify';
import type { LocationOperation, LocationRole, LocationSpan } from '../types';

const TRAILING_STOP =
  /\s+(?:please|thanks|thank you|from|on|for|and|with|instead|in\s+\d|tomorrow|today|next|this|return|one-?way|mid|early|late).*$/i;

/** Verbs / intent phrases that must never be treated as place names in route patterns. */
const INTENT_LEFT =
  /^(?:i|we|you|they|want|need|like|love|going|go|fly|flying|travel|travelling|traveling|plan|planning|book|booking|leave|leaving|depart|departing|from|to|a|an|my|our|and|or|not|change|switch|make|set|actually|let'?s)\b/i;

const INTENT_PHRASE =
  /\b(?:want|need|like|going|fly(?:ing)?|travel(?:ling|ing)?|plan(?:ning)?|book(?:ing)?|leave|leaving|depart(?:ing)?|change|switch|instead)\b/i;

function cleanSpan(raw: string): string {
  return raw
    .replace(/^(?:go(?:ing)?\s+to|go(?:ing)?|to|from|in|at|visit(?:ing)?)\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(TRAILING_STOP, '')
    .replace(/\s+instead\b.*$/i, '')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

function looksLikePlaceSpan(raw: string): boolean {
  const cleaned = cleanSpan(raw);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 64) return false;
  if (looksLikeNonPlace(cleaned)) return false;
  if (INTENT_LEFT.test(cleaned)) return false;
  if (INTENT_PHRASE.test(cleaned)) return false;
  // Reject multi-word spans that still start with pronouns / auxiliaries
  if (/^(?:i|we|you|they)\b/i.test(cleaned)) return false;
  return true;
}

function push(
  spans: LocationSpan[],
  raw: string,
  roleHint: LocationRole,
  cue: string,
  index: number,
  operation: LocationOperation,
  confidence: number,
): boolean {
  const cleaned = cleanSpan(raw);
  if (!looksLikePlaceSpan(cleaned)) return false;
  if (spans.some((s) => s.raw.toLowerCase() === cleaned.toLowerCase() && s.roleHint === roleHint)) {
    return false;
  }
  spans.push({ raw: cleaned, roleHint, cue, index, operation, confidence });
  return true;
}

function hasRole(spans: LocationSpan[], role: LocationRole): boolean {
  return spans.some((s) => s.roleHint === role);
}

function isDestinationIntentMessage(text: string): boolean {
  return /\b(?:(?:i\s+)?(?:want|need)\s+to\s+go(?:\s+to)?|go(?:ing)?\s+to|visit(?:ing)?|fly(?:ing)?\s+to|travel(?:ling|ing)?\s+to)\b/i.test(
    text,
  );
}

/**
 * Extract free-text location spans from natural language without requiring a lexicon regex.
 * Resolution happens later via the location intelligence providers.
 */
export function extractLocationSpans(text: string): LocationSpan[] {
  const spans: LocationSpan[] = [];

  // Destination replacement — semantic operation
  const replacePatterns: Array<{ re: RegExp; cue: string }> = [
    {
      re: /\b(?:change|switch|update|set)\s+(?:(?:it|the)\s+)*(?:destination\s+)?(?:to|for)\s+(.+)$/i,
      cue: 'change-destination-to',
    },
    {
      re: /\b(?:change|switch)\s+it\s+(?:the\s+)?destination\s+to\s+(.+)$/i,
      cue: 'change-it-the-destination-to',
    },
    {
      re: /\b(?:make|set)\s+it\s+(.+?)\s+instead\b/i,
      cue: 'make-it-instead',
    },
    {
      re: /\bactually\s+(.+)$/i,
      cue: 'actually-place',
    },
    {
      re: /\bwe'?re\s+going\s+to\s+(.+?)\s+now\b/i,
      cue: 'going-now',
    },
    {
      re: /\bi\s+changed\s+my\s+mind[,]?\s*(.+)$/i,
      cue: 'changed-mind',
    },
    {
      re: /\bnot\s+([A-Za-z][A-Za-z\s']{1,40}?)\s+(?:anymore|any more)[,.]?\s*(.+)$/i,
      cue: 'not-anymore',
    },
    {
      // Same-clause only: "forget Brisbane, go to Cairns" — not "Forget X. Let's go to Y" new-trip.
      re: /\bforget\s+([A-Za-z][A-Za-z\s']{1,40}?)[,;]?\s+(?:and\s+)?go\s+to\s+(.+)$/i,
      cue: 'forget-go-to',
    },
  ];

  for (const { re, cue } of replacePatterns) {
    const m = text.match(re);
    if (!m) continue;
    if (cue === 'not-anymore' || cue === 'forget-go-to') {
      const next = m[2];
      if (
        next &&
        push(spans, next, 'destination', cue, m.index ?? 0, 'replace_destination', 0.95)
      ) {
        break;
      }
    } else if (
      m[1] &&
      push(spans, m[1], 'destination', cue, m.index ?? 0, 'replace_destination', 0.95)
    ) {
      break;
    }
  }

  const destinationIntent = isDestinationIntentMessage(text);

  // Destination intent cues first — prevents "I want to go to X" matching as X-to-Y routes.
  // Stop place capture before route/date/stay trailers so "Gold Coast departing Melbourne" stays intact.
  const DEST_STOP =
    String.raw`(?:\s+(?:departing|leaving|from|on|staying|for|and|with|returning|instead|mid|early|late|in\s+\d)|[.!?]|$)`;
  const ORIGIN_STOP =
    String.raw`(?:\s+(?:mid|early|late|staying|for|and|with|on|returning|going|go(?:ing)?\s+to|instead)|[.!?]|$)`;
  if (!hasRole(spans, 'destination')) {
    const destCues: Array<{ re: RegExp; cue: string }> = [
      {
        re: new RegExp(
          String.raw`\b(?:i\s+)?(?:want|need)\s+to\s+go(?:\s+to)?\s+(.+?)${DEST_STOP}`,
          'i',
        ),
        cue: 'want-go-to',
      },
      {
        re: new RegExp(String.raw`\bgo(?:ing)?\s+to\s+(.+?)${DEST_STOP}`, 'i'),
        cue: 'go-to',
      },
      {
        re: new RegExp(String.raw`\bvisit(?:ing)?\s+(.+?)${DEST_STOP}`, 'i'),
        cue: 'visit',
      },
      {
        re: new RegExp(String.raw`\bfly(?:ing)?\s+to\s+(.+?)${DEST_STOP}`, 'i'),
        cue: 'fly-to',
      },
      {
        re: new RegExp(String.raw`\bflights?\s+to\s+(.+?)${DEST_STOP}`, 'i'),
        cue: 'flights-to',
      },
      {
        re: new RegExp(String.raw`\btravel(?:ling|ing)?\s+to\s+(.+?)${DEST_STOP}`, 'i'),
        cue: 'travel-to',
      },
      {
        re: new RegExp(
          String.raw`\b(?:let'?s\s+)?plan(?:ning)?\s+(?:(?:a|the|our|my)\s+)?(?:trip\s+to\s+)?(.+?)${DEST_STOP}`,
          'i',
        ),
        cue: 'plan-place',
      },
    ];
    for (const { re, cue } of destCues) {
      const m = text.match(re);
      if (m?.[1]) {
        push(spans, m[1], 'destination', cue, m.index ?? 0, 'set', 0.9);
        break;
      }
    }
  }

  // Explicit route patterns (flying from A to B)
  const ROUTE_TAIL_EARLY =
    String.raw`(?:\s+(?:on|for|departing|leaving|returning|mid|early|late|staying|with|and)|[.!?]|$)`;
  const route = text.match(
    new RegExp(
      String.raw`\b(?:flying|travelling|traveling)\s+from\s+(.+?)\s+to\s+(.+?)${ROUTE_TAIL_EARLY}`,
      'i',
    ),
  );
  if (route?.[1] && route[2]) {
    push(spans, route[1], 'origin', 'flying-from-to', route.index ?? 0, 'set', 0.96);
    if (!hasRole(spans, 'destination')) {
      push(spans, route[2], 'destination', 'flying-from-to', (route.index ?? 0) + 1, 'set', 0.96);
    }
  }

  const fromTo = text.match(
    new RegExp(String.raw`\bfrom\s+(.+?)\s+to\s+(.+?)${ROUTE_TAIL_EARLY}`, 'i'),
  );
  if (fromTo?.[1] && fromTo[2] && !spans.some((s) => s.cue === 'flying-from-to')) {
    push(spans, fromTo[1], 'origin', 'from-to', fromTo.index ?? 0, 'set', 0.93);
    if (!hasRole(spans, 'destination')) {
      push(spans, fromTo[2], 'destination', 'from-to', (fromTo.index ?? 0) + 1, 'set', 0.93);
    }
  }

  // "Gold Coast departing Melbourne" / "want Gold Coast, leaving from Melbourne"
  const destLeaving = text.match(
    /\b(?:(?:i\s+)?want\s+)?(.+?)\s*,?\s*(?:leaving|departing)\s+from\s+(.+?)(?:[.!?]|$)/i,
  );
  if (destLeaving?.[1] && destLeaving[2] && !hasRole(spans, 'destination')) {
    push(spans, destLeaving[1], 'destination', 'dest-leaving-from', destLeaving.index ?? 0, 'set', 0.94);
    push(spans, destLeaving[2], 'origin', 'dest-leaving-from', (destLeaving.index ?? 0) + 1, 'set', 0.94);
  }

  const goDeparting = text.match(
    new RegExp(
      String.raw`\bgo(?:ing)?\s+to\s+(.+?)\s+departing\s+(?:from\s+)?(.+?)${ORIGIN_STOP}`,
      'i',
    ),
  );
  if (goDeparting?.[1] && goDeparting[2]) {
    if (!hasRole(spans, 'destination')) {
      push(spans, goDeparting[1], 'destination', 'go-departing', goDeparting.index ?? 0, 'set', 0.94);
    }
    push(spans, goDeparting[2], 'origin', 'go-departing', (goDeparting.index ?? 0) + 1, 'set', 0.94);
  }

  // "Gold Coast from Melbourne" — skip when the message is already a destination-intent phrase
  if (!destinationIntent && !hasRole(spans, 'origin') && !hasRole(spans, 'destination')) {
    const destFrom = text.match(/\b(.+?)\s+from\s+(.+?)(?:[.!?]|$)/i);
    if (
      destFrom?.[1] &&
      destFrom[2] &&
      looksLikePlaceSpan(destFrom[1]) &&
      looksLikePlaceSpan(destFrom[2]) &&
      !/^(?:leaving|departing|flying|travelling|traveling|from)\b/i.test(destFrom[1].trim())
    ) {
      push(spans, destFrom[1], 'destination', 'dest-from', destFrom.index ?? 0, 'set', 0.92);
      push(spans, destFrom[2], 'origin', 'dest-from', (destFrom.index ?? 0) + 1, 'set', 0.92);
    }
  }

  // "Leaving Melbourne for Gold Coast" / "departing from Melbourne for Gold Coast"
  const leavingFor = text.match(
    /\b(?:leaving|departing)\s+(?:from\s+)?(.+?)\s+for\s+(.+?)(?:[.!?]|$)/i,
  );
  if (leavingFor?.[1] && leavingFor[2] && !hasRole(spans, 'origin')) {
    push(spans, leavingFor[1], 'origin', 'leaving-for', leavingFor.index ?? 0, 'set', 0.94);
    if (!hasRole(spans, 'destination')) {
      push(spans, leavingFor[2], 'destination', 'leaving-for', (leavingFor.index ?? 0) + 1, 'set', 0.94);
    }
  }

  // Bare "Sydney to Melbourne on 28 August" — never for "I want to go to …"
  const ROUTE_TAIL =
    String.raw`(?:\s+(?:on|for|departing|leaving|returning|mid|early|late|staying|with|and)|[.!?]|$)`;
  if (!destinationIntent && !hasRole(spans, 'origin') && !hasRole(spans, 'destination')) {
    const xToY = text.match(
      new RegExp(
        String.raw`(?:^|[.!?]\s+)([A-Za-z][A-Za-z\s']{1,40}?)\s+to\s+([A-Za-z][A-Za-z\s']{1,40}?)${ROUTE_TAIL}`,
        'i',
      ),
    );
    if (
      xToY?.[1] &&
      xToY[2] &&
      looksLikePlaceSpan(xToY[1]) &&
      looksLikePlaceSpan(xToY[2])
    ) {
      push(spans, xToY[1], 'origin', 'x-to-y', xToY.index ?? 0, 'set', 0.9);
      push(spans, xToY[2], 'destination', 'x-to-y', (xToY.index ?? 0) + 1, 'set', 0.9);
    }
  }

  if (!destinationIntent && !hasRole(spans, 'origin') && !hasRole(spans, 'destination')) {
    const startXY = text.match(
      new RegExp(
        String.raw`^([A-Za-z][A-Za-z\s']{1,40}?)\s+to\s+([A-Za-z][A-Za-z\s']{1,40}?)${ROUTE_TAIL}`,
        'i',
      ),
    );
    if (
      startXY?.[1] &&
      startXY[2] &&
      looksLikePlaceSpan(startXY[1]) &&
      looksLikePlaceSpan(startXY[2])
    ) {
      push(spans, startXY[1], 'origin', 'x-to-y-start', 0, 'set', 0.9);
      push(spans, startXY[2], 'destination', 'x-to-y-start', 1, 'set', 0.9);
    }
  }

  const codeRoute = text.match(/\b([A-Za-z]{3})\s+to\s+([A-Za-z]{3})\b/);
  if (codeRoute?.[1] && codeRoute[2]) {
    if (!hasRole(spans, 'origin')) {
      push(spans, codeRoute[1], 'origin', 'iata-to-iata', codeRoute.index ?? 0, 'set', 0.97);
    }
    if (!hasRole(spans, 'destination')) {
      push(spans, codeRoute[2], 'destination', 'iata-to-iata', (codeRoute.index ?? 0) + 1, 'set', 0.97);
    }
  }

  // Origin cues
  if (!hasRole(spans, 'origin')) {
    const originCues: Array<{ re: RegExp; cue: string }> = [
      { re: /\b(?:i'?m\s+)?leav(?:e|ing)\s+from\s+(.+?)(?:[.!?]|$)/i, cue: 'leaving-from' },
      {
        re: new RegExp(String.raw`\bdeparting\s+(?:from\s+)?(.+?)${ORIGIN_STOP}`, 'i'),
        cue: 'departing',
      },
      { re: /\bflying\s+from\s+(.+?)(?:\s+to\b|[.!?]|$)/i, cue: 'flying-from' },
      { re: /\bmy\s+departure\s+city\s+is\s+(.+?)(?:[.!?]|$)/i, cue: 'departure-city-is' },
      // "… to Gold Coast from Melbourne" / "go melbourne from sydney"
      {
        re: new RegExp(String.raw`\bfrom\s+(.+?)${ORIGIN_STOP}`, 'i'),
        cue: 'trailing-from',
      },
    ];
    for (const { re, cue } of originCues) {
      const m = text.match(re);
      if (m?.[1]) {
        push(spans, m[1], 'origin', cue, m.index ?? 0, 'set', 0.88);
        break;
      }
    }
  }

  // Accommodation
  const stay = text.match(
    /\b(?:stay(?:ing)?|hotel|accommodation)\s+(?:in|at)\s+(.+?)(?:[.!?]|$)/i,
  );
  if (stay?.[1]) {
    push(spans, stay[1], 'accommodation', 'stay-in', stay.index ?? 0, 'set_accommodation', 0.9);
  }

  // Nearby / activity centre
  const near = text.match(
    /\b(?:activities|things to do|beaches|camping|kayaking|restaurants|attractions|scenic drives|4wd|four\s*wheel)\s+(?:in|near|around|from)\s+(.+?)(?:[.!?]|$)/i,
  );
  if (near?.[1]) {
    push(spans, near[1], 'activity', 'nearby-activity', near.index ?? 0, 'set', 0.85);
  }

  // Standalone place answer
  const standalone = text
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  if (
    spans.length === 0 &&
    standalone.length <= 48 &&
    !/\b(?:flights?|accommodation|car\s*hire|returning|staying|nights?|august|january|february|march|april|june|july|september|october|november|december|\d{1,2}[\/\-]\d{1,2}|all\s+the\s+above|all\s+please)\b/i.test(
      standalone,
    )
  ) {
    const wrapped = standalone.replace(/^(?:it'?s|from|to|in)\s+/i, '').replace(/\s+please$/i, '');
    push(spans, wrapped, 'unspecified', 'standalone', 0, 'set', 0.7);
  }

  return spans;
}
