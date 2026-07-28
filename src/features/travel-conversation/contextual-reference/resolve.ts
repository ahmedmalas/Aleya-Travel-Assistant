/**
 * General semantic contextual-reference resolver.
 *
 * Resolves deixis / selection language against the *active structured option set*.
 * Not a phrase-by-phrase alias table for services. Not tied to a fixed option count.
 *
 * Deterministic structure:
 *  1. Detect selection intent against presented options
 *  2. Interpret quantifiers, ordinals, ranges, inclusions, exclusions
 *  3. Match option labels / aliases from the active set only
 *  4. Return ContextualReferenceResolution for validation
 */

import type {
  ActiveOptionSet,
  ConversationalOption,
  ContextualReferenceResolution,
} from './types';

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  '1st': 1,
  '2nd': 2,
  '3rd': 3,
  '4th': 4,
  '5th': 5,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function optionByPosition(
  options: ConversationalOption[],
  position: number,
): ConversationalOption | undefined {
  return options.find((o) => o.position === position);
}

function lastPosition(options: ConversationalOption[]): number {
  return Math.max(...options.map((o) => o.position), 0);
}

/** Aliases derived from the option itself — never a global service dictionary. */
function optionMatchTerms(option: ConversationalOption): string[] {
  const terms = new Set<string>();
  const label = normalize(option.label);
  terms.add(label);
  terms.add(normalize(String(option.id)));
  terms.add(normalize(String(option.value)));
  // singular/plural light normalize
  if (label.endsWith('s')) terms.add(label.slice(0, -1));
  else terms.add(`${label}s`);
  // car hire / rental shorthand when label contains car
  if (/\bcar\b/.test(label)) {
    terms.add('car');
    terms.add('cars');
    terms.add('rental car');
    terms.add('hire car');
  }
  if (/\baccommodation\b/.test(label) || /\bhotel\b/.test(label)) {
    terms.add('hotel');
    terms.add('hotels');
    terms.add('stay');
    terms.add('accommodation');
  }
  if (/\bflight\b/.test(label)) {
    terms.add('flight');
    terms.add('flights');
  }
  return [...terms].filter(Boolean);
}

function findOptionsMentioned(
  text: string,
  options: ConversationalOption[],
): ConversationalOption[] {
  const found: ConversationalOption[] = [];
  for (const option of options) {
    const terms = optionMatchTerms(option).sort((a, b) => b.length - a.length);
    for (const term of terms) {
      if (!term) continue;
      const re = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (re.test(text)) {
        found.push(option);
        break;
      }
    }
  }
  return found;
}

function parseOrdinalToken(token: string): number | null {
  if (ORDINAL_WORDS[token] != null) return ORDINAL_WORDS[token]!;
  const m = token.match(/^(\d+)(?:st|nd|rd|th)?$/);
  if (m) return Number(m[1]);
  return null;
}

/**
 * Extract positional selections: first, last, second option, first two, last two, …
 */
function resolvePositional(
  text: string,
  options: ConversationalOption[],
): { ids: string[]; matched: boolean } {
  const ids = new Set<string>();
  let matched = false;
  const n = options.length;
  const last = lastPosition(options);

  // "the first two" / "first 2" / "the last two"
  const range = text.match(
    /\b(?:the\s+)?(first|last)\s+(\d+|one|two|three|four|five)\b/,
  );
  if (range) {
    matched = true;
    const countWord = range[2]!;
    const count =
      { one: 1, two: 2, three: 3, four: 4, five: 5 }[countWord] ?? Number(countWord);
    if (range[1] === 'first') {
      for (let p = 1; p <= Math.min(count, n); p += 1) {
        const o = optionByPosition(options, p);
        if (o) ids.add(o.id);
      }
    } else {
      for (let p = Math.max(1, last - count + 1); p <= last; p += 1) {
        const o = optionByPosition(options, p);
        if (o) ids.add(o.id);
      }
    }
  }

  // "the first one/option", "the second option", "the last one"
  const ordinals = [
    ...text.matchAll(
      /\b(?:the\s+)?(first|second|third|fourth|fifth|last|\d+(?:st|nd|rd|th)?)\s*(?:one|option|choice)?\b/g,
    ),
  ];
  for (const m of ordinals) {
    // Skip if already consumed as part of "first two"
    if (range && m.index != null && m.index >= (range.index ?? 0) && m.index < (range.index ?? 0) + range[0]!.length) {
      continue;
    }
    const token = m[1]!;
    if (token === 'last') {
      matched = true;
      const o = optionByPosition(options, last);
      if (o) ids.add(o.id);
      continue;
    }
    const pos = parseOrdinalToken(token);
    if (pos != null) {
      matched = true;
      const o = optionByPosition(options, pos);
      if (o) ids.add(o.id);
    }
  }

  // "those two" / "those three" / "just those two" when count matches mode
  const those = text.match(/\b(?:just\s+)?those\s+(two|three|four|\d+)\b/);
  if (those && !range) {
    matched = true;
    const count =
      { two: 2, three: 3, four: 4 }[those[1]!] ?? Number(those[1]);
    for (let p = 1; p <= Math.min(count, n); p += 1) {
      const o = optionByPosition(options, p);
      if (o) ids.add(o.id);
    }
  }

  return { ids: [...ids], matched };
}

function isUniversalSelect(text: string, optionCount: number): boolean {
  if (
    /\b(all(?:\s+of)?(?:\s+them|\s+the\s+above)?|everything(?:\s+you\s+mentioned)?|include\s+them\s+all|all\s+the\s+options)\b/.test(
      text,
    )
  ) {
    return true;
  }
  if (/\bboth(?:\s+(?:please|are\s+fine|work|fine))?\b/.test(text) && optionCount === 2) {
    return true;
  }
  if (/\beither(?:\s+is\s+fine|\s+works|\s+one)?\b/.test(text) && optionCount === 2) {
    // "either is fine" for binary preference → accept both as fine (multi) or defer;
    // treat as selecting all presented options when selectionMode allows later.
    return true;
  }
  if (/\byes,?\s*those\s+(two|three|four|\d+)\b/.test(text)) {
    return true;
  }
  return false;
}

function isNoneSelect(text: string): boolean {
  return /\b(none(?:\s+of\s+them)?|neither|no\s+thanks|nothing)\b/.test(text);
}

function splitExclusion(text: string): { base: string; excludedMentions: string } {
  const m = text.match(
    /\b(?:everything|all(?:\s+of\s+them)?|all\s+the\s+above)\s+except\s+(.+)$/i,
  );
  if (m) {
    return { base: 'everything', excludedMentions: m[1] ?? '' };
  }
  const m2 = text.match(/\bexcept\s+(.+)$/i);
  if (m2 && /\b(all|everything|them)\b/.test(text)) {
    return { base: 'everything', excludedMentions: m2[1] ?? '' };
  }
  return { base: text, excludedMentions: '' };
}

/**
 * True when the utterance is attempting to answer via reference / selection
 * language relative to the active options (not a pure unrelated fact dump).
 */
export function looksLikeContextualSelection(
  message: string,
  optionSet: ActiveOptionSet,
): boolean {
  const text = normalize(message);
  if (!text) return false;
  if (isNoneSelect(text) || isUniversalSelect(text, optionSet.options.length)) return true;
  if (/\b(first|second|third|last|those\s+\d+|except|either|both)\b/.test(text)) {
    return true;
  }
  if (findOptionsMentioned(text, optionSet.options).length > 0) {
    // Option labels alone can be explicit — still resolvable against the set.
    return true;
  }
  // Numeric answer for traveller / room counts when options are numeric labels
  if (
    optionSet.options.some((o) => /^\d+$/.test(normalize(o.label))) &&
    /\b\d+\b/.test(text)
  ) {
    return true;
  }
  return false;
}

export function resolveContextualReference(
  message: string,
  optionSet: ActiveOptionSet | null,
): ContextualReferenceResolution {
  if (!optionSet || optionSet.options.length === 0) {
    return {
      resolved: false,
      selectedOptionIds: [],
      excludedOptionIds: [],
      confidence: 0,
      explanation: 'No active option set.',
    };
  }

  const text = normalize(message);
  if (!looksLikeContextualSelection(message, optionSet)) {
    return {
      resolved: false,
      sourceOptionSetId: optionSet.id,
      selectedOptionIds: [],
      excludedOptionIds: [],
      confidence: 0,
      explanation: 'Message does not reference the active options.',
    };
  }

  const options = optionSet.options;
  const { base, excludedMentions } = splitExclusion(text);

  if (isNoneSelect(text)) {
    return {
      resolved: true,
      sourceOptionSetId: optionSet.id,
      selectedOptionIds: [],
      excludedOptionIds: options.map((o) => o.id),
      confidence: 0.92,
      explanation: 'User declined all presented options.',
    };
  }

  const excluded = excludedMentions
    ? findOptionsMentioned(excludedMentions, options)
    : [];
  const excludedIds = new Set(excluded.map((o) => o.id));

  const selected = new Set<string>();
  let confidence = 0.7;
  const parts: string[] = [];

  const universal = isUniversalSelect(base, options.length) || base === 'everything';
  if (universal) {
    for (const o of options) {
      if (!excludedIds.has(o.id)) selected.add(o.id);
    }
    confidence = 0.95;
    parts.push('universal selection against active options');
  }

  const positional = resolvePositional(base, options);
  if (positional.matched) {
    for (const id of positional.ids) {
      if (!excludedIds.has(id)) selected.add(id);
    }
    confidence = Math.max(confidence, 0.9);
    parts.push('positional selection');
  }

  const mentioned = findOptionsMentioned(base, options);
  if (mentioned.length) {
    for (const o of mentioned) {
      if (!excludedIds.has(o.id)) selected.add(o.id);
    }
    confidence = Math.max(confidence, 0.88);
    parts.push('option-label match');
  }

  // Numeric label match: "two" / "2" → option labelled 2 / two
  const numWord = text.match(/\b(one|two|three|four|five|\d+)\b/);
  if (numWord && optionSet.options.some((o) => o.category === 'traveller' || /^\d+|one|two|three/.test(normalize(o.label)))) {
    const map: Record<string, string> = {
      one: '1',
      two: '2',
      three: '3',
      four: '4',
      five: '5',
    };
    const raw = numWord[1]!;
    const asNum = map[raw] ?? raw;
    for (const o of options) {
      const label = normalize(o.label);
      if (label === raw || label === asNum || String(o.value) === asNum || String(o.value) === raw) {
        selected.add(o.id);
        confidence = Math.max(confidence, 0.9);
        parts.push('numeric option match');
      }
    }
  }

  // "either is fine" on binary preference with single mode → pick first as acceptable default
  if (
    /\beither(?:\s+is\s+fine|\s+works)?\b/.test(text) &&
    optionSet.selectionMode === 'single' &&
    options.length === 2 &&
    selected.size === 0
  ) {
    selected.add(options[0]!.id);
    confidence = 0.75;
    parts.push('either-is-fine → first acceptable');
  }

  if (selected.size === 0 && excludedIds.size === 0 && !universal) {
    return {
      resolved: false,
      sourceOptionSetId: optionSet.id,
      selectedOptionIds: [],
      excludedOptionIds: [],
      confidence: 0,
      explanation: 'Could not bind reference to active options.',
    };
  }

  // Single-mode: if multiple selected, keep first by position unless explicit labels named one
  let finalIds = [...selected];
  if (optionSet.selectionMode === 'single' && finalIds.length > 1) {
    const ordered = options
      .filter((o) => finalIds.includes(o.id))
      .sort((a, b) => a.position - b.position);
    // Prefer explicitly mentioned labels if exactly one mention
    if (mentioned.length === 1) {
      finalIds = [mentioned[0]!.id];
    } else if (positional.ids.length === 1) {
      finalIds = [positional.ids[0]!];
    } else {
      finalIds = ordered[0] ? [ordered[0].id] : finalIds.slice(0, 1);
    }
    parts.push('single-selection mode');
  }

  return {
    resolved: true,
    sourceOptionSetId: optionSet.id,
    selectedOptionIds: finalIds,
    excludedOptionIds: [...excludedIds],
    confidence,
    explanation: parts.join('; ') || 'resolved against active options',
  };
}
