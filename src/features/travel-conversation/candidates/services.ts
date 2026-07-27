import type { TravelServiceKind } from '../types';
import type { ServiceCandidate, TravellerCandidate, PreferenceCandidate } from './types';

const SERVICE_PATTERNS: Array<{ kind: TravelServiceKind; re: RegExp }> = [
  { kind: 'flights', re: /\bflights?\b/i },
  { kind: 'accommodation', re: /\b(?:accommodation|hotels?|stay|stays)\b/i },
  { kind: 'car_hire', re: /\b(?:car hire|rental car|hire car|car rental)\b/i },
  { kind: 'transfers', re: /\btransfers?\b/i },
  { kind: 'activities', re: /\bactivities\b/i },
];

function servicesIn(fragment: string): TravelServiceKind[] {
  return SERVICE_PATTERNS.filter((s) => s.re.test(fragment)).map((s) => s.kind);
}

/**
 * Clause-scoped service add/remove candidates.
 */
export function extractServiceCandidates(text: string): ServiceCandidate[] {
  const found: ServiceCandidate[] = [];
  const lower = text.toLowerCase();

  // Split lightly on "and" / commas when an operation verb is present
  const removeMatches = [
    ...text.matchAll(
      /\b(?:remove|forget|don'?t need|do not need|without|no)\s+([^.;]+?)(?=(?:\band\s+add\b)|[.;]|$)/gi,
    ),
  ];
  for (const m of removeMatches) {
    const fragment = m[1] ?? '';
    // "No flights, keep the hotel" — only remove flights from the no-clause
    const keepSplit = fragment.split(/\bkeep\b/i)[0] ?? fragment;
    for (const service of servicesIn(keepSplit)) {
      found.push({
        kind: 'service',
        service,
        operation: 'remove',
        raw: m[0]!,
        index: m.index ?? 0,
        confidence: 0.92,
        source: 'explicit',
      });
    }
  }

  const addMatches = [
    ...text.matchAll(/\b(?:i need|need|looking for|want|book|include|add)\s+([^.;]+)/gi),
  ];
  for (const m of addMatches) {
    for (const service of servicesIn(m[1] ?? '')) {
      // Skip if this add is inside a remove-only "no X" already handled — still allow "add car hire"
      found.push({
        kind: 'service',
        service,
        operation: 'add',
        raw: m[0]!,
        index: m.index ?? 0,
        confidence: 0.9,
        source: 'explicit',
      });
    }
  }

  // Whole-message service mentions with travel intent when no add clause found
  if (!found.some((c) => c.operation === 'add') && /\b(?:need|flights?|hotel|accommodation|car hire)\b/i.test(lower)) {
    for (const service of servicesIn(text)) {
      if (found.some((c) => c.service === service && c.operation === 'remove')) continue;
      found.push({
        kind: 'service',
        service,
        operation: 'add',
        raw: service,
        index: 0,
        confidence: 0.75,
        source: 'explicit',
      });
    }
  }

  // "keep the hotel" retention
  if (/\bkeep\s+(?:the\s+)?(?:hotel|accommodation|stay)\b/i.test(text)) {
    found.push({
      kind: 'service',
      service: 'accommodation',
      operation: 'add',
      raw: 'keep hotel',
      index: lower.indexOf('keep'),
      confidence: 0.88,
      source: 'explicit',
    });
  }

  return found;
}

export function extractTravellerCandidates(text: string): TravellerCandidate[] {
  const m = text.match(/\b(\d+)\s+(?:adults?|travellers?|people|persons?)\b/i);
  if (!m) return [];
  return [
    {
      kind: 'travellers',
      count: Number(m[1]),
      raw: m[0]!,
      index: m.index ?? 0,
      confidence: 0.85,
      source: 'explicit',
    },
  ];
}

export function extractPreferenceCandidates(text: string): PreferenceCandidate[] {
  const found: PreferenceCandidate[] = [];
  if (/\bnice hotel\b/i.test(text)) {
    found.push({
      kind: 'preference',
      value: 'nice hotel',
      raw: 'nice hotel',
      index: text.toLowerCase().indexOf('nice hotel'),
      confidence: 0.7,
      source: 'explicit',
    });
  }
  if (/\bmorning\b/i.test(text) && /\b(?:flight|depart|leave)\b/i.test(text)) {
    found.push({
      kind: 'preference',
      value: 'morning departure',
      raw: 'morning',
      index: text.toLowerCase().indexOf('morning'),
      confidence: 0.65,
      source: 'explicit',
    });
  }
  return found;
}
