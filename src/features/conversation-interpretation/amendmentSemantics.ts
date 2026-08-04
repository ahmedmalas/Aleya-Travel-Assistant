import type { TravelInterpretationContext } from './buildInterpretationContext';
import {
  emptySemanticInterpretation,
  type TravelSemanticInterpretation,
} from './schema';

/**
 * Amendment semantics — reopen or revise trip fields after (or during) planning.
 *
 * Meaning classes, not phrase patches:
 * - field reopen (change/update X with no replacement) → clear that slot
 * - field replace (change X to Y) → write the new value
 * - service add / remove → capability flags
 *
 * Terminal search-ready state is exited by mapping (conversationComplete false
 * + amendmentResumeSearchReady) so the planner asks only for the reopened slot.
 */

export const REOPENABLE_TRAVEL_FIELDS = [
  'destination',
  'origin',
  'departureDate',
  'returnDate',
  'adultCount',
  'childCount',
  'infantCount',
] as const;

export type ReopenableTravelField = (typeof REOPENABLE_TRAVEL_FIELDS)[number];

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

/** Amendment-request verb / frame class. */
function hasAmendmentFrame(folded: string): boolean {
  return (
    /\b(?:change|update|amend|alter|edit|modify|switch|revise|correct)\b/.test(
      folded,
    ) ||
    /\b(?:can|could|may)\s+we\s+(?:change|update|amend|alter|edit|modify|switch)\b/.test(
      folded,
    ) ||
    /\b(?:i\s+)?(?:want|need|like)\s+to\s+(?:change|update|amend|alter|edit|modify)\b/.test(
      folded,
    ) ||
    /\b(?:different|new)\s+(?:origin|destination|dates?|departure|return|adults?|travellers?|travelers?|guests?|children|infants?)\b/.test(
      folded,
    )
  );
}

function hasServiceAddFrame(folded: string): boolean {
  return (
    /\b(?:add|include|also\s+(?:need|want)|plus)\b/.test(folded) &&
    /\b(?:hotel|hotels|accommodation|stay|stays|flight|flights|car(?:\s+hire)?|rental\s+car)\b/.test(
      folded,
    )
  );
}

function hasServiceRemoveFrame(folded: string): boolean {
  return (
    (/\b(?:remove|drop|cancel|without)\b/.test(folded) ||
      /\bno\s+(?:hotel|hotels|accommodation|flight|flights|car)\b/.test(
        folded,
      )) &&
    /\b(?:hotel|hotels|accommodation|stay|flight|flights|car(?:\s+hire)?|rental\s+car)\b/.test(
      folded,
    )
  );
}

function detectFieldReferences(folded: string): ReopenableTravelField[] {
  const fields: ReopenableTravelField[] = [];

  if (
    /\borigins?\b/.test(folded) ||
    /\bdeparture\s+city\b/.test(folded) ||
    /\b(?:travelling|traveling|flying|leaving|departing)\s+from\b/.test(
      folded,
    )
  ) {
    fields.push('origin');
  }

  if (
    /\bdestinations?\b/.test(folded) ||
    /\b(?:where\s+(?:i'?m|we'?re)\s+going)\b/.test(folded)
  ) {
    fields.push('destination');
  }

  if (
    /\bdeparture\s+dates?\b/.test(folded) ||
    /\bdepart(?:ure)?\s+day\b/.test(folded) ||
    /\bleave\s+dates?\b/.test(folded)
  ) {
    fields.push('departureDate');
  }

  if (
    /\breturn\s+dates?\b/.test(folded) ||
    /\bcoming\s+back\b/.test(folded)
  ) {
    fields.push('returnDate');
  }

  // Collective dates class → both legs.
  if (
    /\b(?:travel\s+)?dates?\b/.test(folded) &&
    !fields.includes('departureDate') &&
    !fields.includes('returnDate')
  ) {
    fields.push('departureDate', 'returnDate');
  }

  if (
    /\b(?:adults?|travellers?|travelers?|guests?|passengers?)\b/.test(folded) ||
    /\btraveller\s+counts?\b/.test(folded) ||
    /\bpassenger\s+counts?\b/.test(folded)
  ) {
    fields.push('adultCount');
  }

  if (/\b(?:children|child|kids?)\b/.test(folded)) {
    fields.push('childCount');
  }

  if (/\b(?:infants?|babies|baby)\b/.test(folded)) {
    fields.push('infantCount');
  }

  return [...new Set(fields)];
}

function detectServiceTargets(folded: string): {
  add: Array<'flights' | 'accommodation' | 'carHire'>;
  remove: Array<'flights' | 'accommodation' | 'carHire'>;
} {
  const add: Array<'flights' | 'accommodation' | 'carHire'> = [];
  const remove: Array<'flights' | 'accommodation' | 'carHire'> = [];
  const wantsAdd = hasServiceAddFrame(folded);
  const wantsRemove = hasServiceRemoveFrame(folded);

  const hotel = /\b(?:hotel|hotels|accommodation|stay|stays)\b/.test(folded);
  const flights = /\b(?:flight|flights)\b/.test(folded);
  const car = /\b(?:car(?:\s+hire)?|rental\s+car)\b/.test(folded);

  if (wantsAdd) {
    if (hotel) add.push('accommodation');
    if (flights) add.push('flights');
    if (car) add.push('carHire');
  }
  if (wantsRemove) {
    if (hotel) remove.push('accommodation');
    if (flights) remove.push('flights');
    if (car) remove.push('carHire');
  }

  return { add, remove };
}

function extractReplacementPlace(folded: string): string | null {
  const toMatch = folded.match(/\b(?:to|for)\s+([a-z][a-z\s'-]{1,48})$/);
  if (!toMatch?.[1]) return null;
  const raw = toMatch[1]
    .replace(/\s+(?:please|thanks|thank\s+you)\b.*$/u, '')
    .trim();
  if (!raw || /^(?:the|a|an)$/.test(raw)) return null;
  if (
    /^(?:change|update|amend|alter|edit|modify|switch|revise|confirm|search)\b/.test(
      raw,
    )
  ) {
    return null;
  }
  return raw.replace(/\b(?:please|thanks|thank\s+you)\b/gu, '').trim() || null;
}

function extractReplacementCount(folded: string): number | null {
  const match = folded.match(
    /\b(?:to|for)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/,
  );
  if (!match?.[1]) return null;
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const raw = match[1];
  if (/^\d+$/.test(raw)) return Number(raw);
  return words[raw] ?? null;
}

function hasConcreteDateToken(folded: string): boolean {
  return /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})\b/.test(
    folded,
  );
}

/**
 * Resolve amendment intent into structured reopen / replace / service changes.
 * Returns null when the utterance is not an amendment.
 *
 * Date replacements with concrete calendar tokens set `pendingDateField` via
 * reopen omission + `dateAmendmentField` preference on ambiguity notes for
 * the offline date parser to fill; see offlineSemanticInterpreter.
 */
export function resolveAmendmentSemantics(
  context: TravelInterpretationContext,
): TravelSemanticInterpretation | null {
  const folded = asciiFold(context.message).replace(/[.!?]+$/g, '').trim();
  if (!folded) return null;

  const service = detectServiceTargets(folded);
  const fields = detectFieldReferences(folded);
  const amendmentFrame = hasAmendmentFrame(folded);
  const hasServiceAmendment =
    service.add.length > 0 || service.remove.length > 0;
  const hasFieldAmendment = amendmentFrame && fields.length > 0;

  if (!hasFieldAmendment && !hasServiceAmendment) {
    return null;
  }

  const semantic = emptySemanticInterpretation();
  semantic.confidence = 0.88;
  semantic.amendmentResumeSearchReady = true;
  semantic.conversationComplete = false;
  semantic.searchExecutionRequested = false;

  if (hasServiceAmendment) {
    if (service.add.length > 0) semantic.intent = 'add_service';
    if (service.remove.length > 0) semantic.intent = 'remove';
    for (const target of service.add) {
      if (target === 'flights') semantic.flightsRequested = true;
      if (target === 'accommodation') semantic.accommodationRequested = true;
      if (target === 'carHire') semantic.carHireRequested = true;
    }
    for (const target of service.remove) {
      if (!semantic.removals.includes(target)) {
        semantic.removals = [...semantic.removals, target];
      }
      if (target === 'flights') semantic.flightsRequested = false;
      if (target === 'accommodation') semantic.accommodationRequested = false;
      if (target === 'carHire') semantic.carHireRequested = false;
    }
  }

  if (hasFieldAmendment) {
    semantic.intent = 'correct';
    const replacementPlace = extractReplacementPlace(folded);
    const replacementCount = extractReplacementCount(folded);
    const reopen: ReopenableTravelField[] = [];
    const concreteDate = hasConcreteDateToken(folded);

    for (const field of fields) {
      const isPlaceField = field === 'origin' || field === 'destination';
      const isCountField =
        field === 'adultCount' ||
        field === 'childCount' ||
        field === 'infantCount';
      const isDateField = field === 'departureDate' || field === 'returnDate';

      if (isPlaceField && replacementPlace) {
        if (field === 'origin') semantic.origin = replacementPlace;
        if (field === 'destination') semantic.destination = replacementPlace;
        continue;
      }

      if (isCountField && replacementCount !== null) {
        if (field === 'adultCount') semantic.adultCount = replacementCount;
        if (field === 'childCount') semantic.childCount = replacementCount;
        if (field === 'infantCount') semantic.infantCount = replacementCount;
        continue;
      }

      if (isDateField && concreteDate) {
        // Offline layer fills ISO date onto this field; do not reopen.
        semantic.ambiguityNotes = [
          ...semantic.ambiguityNotes,
          `dateAmendmentField:${field}`,
        ];
        continue;
      }

      reopen.push(field);
    }

    semantic.reopenFields = reopen;
  }

  return semantic;
}
