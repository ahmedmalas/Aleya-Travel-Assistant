/**
 * Multi-intent service recognition.
 *
 * Scans one utterance for every recognised travel service (not first-match-only).
 * Tolerates minor spelling mistakes via edit-distance against a service lexicon.
 * Not a catalogue of phrase-specific travel grammar patches.
 */

export type RecognizedTravelService =
  | 'flights'
  | 'accommodation'
  | 'carHire'
  | 'activities'
  | 'restaurants';

type ServiceLexiconEntry = {
  id: RecognizedTravelService;
  /** Canonical surface forms (1–3 tokens). */
  forms: readonly string[];
};

const SERVICE_LEXICON: readonly ServiceLexiconEntry[] = [
  { id: 'flights', forms: ['flight', 'flights'] },
  {
    id: 'accommodation',
    forms: ['hotel', 'hotels', 'accommodation', 'lodging'],
  },
  {
    id: 'carHire',
    forms: [
      'car hire',
      'car rental',
      'hire car',
      'rent a car',
      'rental car',
      'rental cars',
      'vehicle hire',
    ],
  },
  {
    id: 'activities',
    forms: ['activity', 'activities', 'things to do'],
  },
  {
    id: 'restaurants',
    forms: ['restaurant', 'restaurants', 'dining', 'places to eat'],
  },
] as const;

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

function tokenize(folded: string): string[] {
  return folded
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/** Classic Levenshtein distance for short service tokens/forms. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );
  for (let i = 0; i < rows; i += 1) matrix[i]![0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[a.length]![b.length]!;
}

function maxEditsFor(form: string): number {
  const len = form.replace(/\s+/g, '').length;
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  return 2;
}

function windowMatchesForm(windowTokens: string[], form: string): boolean {
  const formTokens = form.split(/\s+/);
  if (windowTokens.length !== formTokens.length) return false;
  for (let i = 0; i < formTokens.length; i += 1) {
    const left = windowTokens[i] ?? '';
    const right = formTokens[i] ?? '';
    const allowed = maxEditsFor(right);
    if (editDistance(left, right) > allowed) return false;
  }
  return true;
}

function isRemovalContext(folded: string, startIndex: number): boolean {
  const prefix = folded.slice(Math.max(0, startIndex - 24), startIndex);
  return /\b(?:remove|cancel|without|no|not)\b\s*$/.test(prefix.trimEnd());
}

/**
 * Recognise every travel service mentioned in the message.
 * Returns a de-duplicated set; empty when none match.
 */
export function recognizeTravelServicesInMessage(
  message: string,
): Set<RecognizedTravelService> {
  const folded = asciiFold(message);
  const tokens = tokenize(folded);
  const found = new Set<RecognizedTravelService>();
  if (tokens.length === 0) return found;

  // Rebuild approximate token start offsets in folded text for removal context.
  const tokenStarts: number[] = [];
  let cursor = 0;
  for (const token of tokens) {
    const at = folded.indexOf(token, cursor);
    tokenStarts.push(at === -1 ? cursor : at);
    cursor = (at === -1 ? cursor : at) + token.length;
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (isRemovalContext(folded, tokenStarts[i] ?? 0)) continue;
    for (const entry of SERVICE_LEXICON) {
      if (found.has(entry.id)) continue;
      for (const form of entry.forms) {
        const width = form.split(/\s+/).length;
        if (i + width > tokens.length) continue;
        const window = tokens.slice(i, i + width);
        if (windowMatchesForm(window, form)) {
          found.add(entry.id);
          break;
        }
      }
    }
  }

  return found;
}

export function applyRecognizedServicesToSemantic(input: {
  services: Set<RecognizedTravelService>;
  flightsRequested: boolean | null;
  accommodationRequested: boolean | null;
  carHireRequested: boolean | null;
  activitiesRequested: boolean | null;
  restaurantsRequested: boolean | null;
}): {
  flightsRequested: boolean | null;
  accommodationRequested: boolean | null;
  carHireRequested: boolean | null;
  activitiesRequested: boolean | null;
  restaurantsRequested: boolean | null;
  any: boolean;
} {
  let {
    flightsRequested,
    accommodationRequested,
    carHireRequested,
    activitiesRequested,
    restaurantsRequested,
  } = input;
  let any = false;
  if (input.services.has('flights')) {
    flightsRequested = true;
    any = true;
  }
  if (input.services.has('accommodation')) {
    accommodationRequested = true;
    any = true;
  }
  if (input.services.has('carHire')) {
    carHireRequested = true;
    any = true;
  }
  if (input.services.has('activities')) {
    activitiesRequested = true;
    any = true;
  }
  if (input.services.has('restaurants')) {
    restaurantsRequested = true;
    any = true;
  }
  return {
    flightsRequested,
    accommodationRequested,
    carHireRequested,
    activitiesRequested,
    restaurantsRequested,
    any,
  };
}
