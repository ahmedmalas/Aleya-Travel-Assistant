import { findAreaMentions, findPlacesInText, matchAreaName, PLACES } from '../places';
import type { ConversationState } from '../types';
import type { DestinationChange, DestinationIntent, ExtractionPatch } from './types';
import {
  DESTINATION_CHANGE_STOPWORDS,
  PLACE_CAPTURE,
  PLACE_STOPWORDS,
  escapeRegExp,
  field,
  markChanged,
  resolvePlaceName,
} from './shared';
import { awaitingExactDepartureDate, looksLikeDateConfirmation } from './dates';

function normalizeDestinationCandidate(raw: string): DestinationChange | undefined {
  const trimmed = raw.trim().replace(/[.,!?;:]+$/g, '').trim();
  if (!trimmed || DESTINATION_CHANGE_STOPWORDS.has(trimmed.toLowerCase())) return undefined;
  const area = matchAreaName(trimmed);
  if (area) return { destination: area.city, area: area.area };
  const name = resolvePlaceName(trimmed);
  if (!name || DESTINATION_CHANGE_STOPWORDS.has(name.toLowerCase())) return undefined;
  const known = PLACES.some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!known) return undefined;
  return { destination: name };
}

export function isDestinationRetention(text: string, previous?: ConversationState): boolean {
  const t = text.toLowerCase();
  if (/\bnot\s+[a-z][a-z\s]+?\s+anymore\b/.test(t)) return false;
  if (/\bnot\s+[a-z][a-z\s]+?\s*[—\-,:]+\s*[a-z]/.test(t) && /\b(?:change|make)\b/.test(t)) return false;
  if (
    /\b(?:make (?:the\s+)?destination|change (?:the\s+)?destination|go to\b[\s\S]{0,40}\binstead|instead of)\b/.test(t)
  ) {
    return false;
  }
  if (/\bkeep\s+(?:looking|searching|thinking|exploring|checking)\b/.test(t)) return false;

  const current = previous?.destination?.value?.toLowerCase();
  if (
    /\bkeep\s+(?:the\s+)?(?:current\s+)?destination\b/.test(t) ||
    /\bkeep\s+it\s+as\b/.test(t) ||
    /\bleave\s+.+\s+as it is\b/.test(t) ||
    /\bdo not change\b/.test(t) ||
    /\bdon'?t change\b/.test(t) ||
    /\bdo not make it\b/.test(t) ||
    /\bdon'?t make it\b/.test(t)
  ) {
    return true;
  }
  if (current) {
    const cur = escapeRegExp(current);
    if (
      new RegExp(`\\bkeep\\s+(?:it\\s+as\\s+)?${cur}\\b`).test(t) ||
      new RegExp(`\\bstay with\\s+${cur}\\b`).test(t) ||
      new RegExp(`\\bleave\\s+${cur}\\s+as it is\\b`).test(t)
    ) {
      return true;
    }
  }
  const notPlace = t.match(/\bnot\s+([a-z][a-z]*(?:\s+[a-z][a-z]*)?)\b/);
  if (notPlace?.[1] && !/\banymore\b/.test(t)) {
    const negated = notPlace[1].toLowerCase();
    if (!current || negated !== current) return true;
    if (current && new RegExp(`\\bkeep\\s+(?:it\\s+as\\s+)?${escapeRegExp(current)}\\b`).test(t)) {
      return true;
    }
  }
  return false;
}

export function hasDestinationReplacementLanguage(text: string, previous?: ConversationState): boolean {
  if (isDestinationRetention(text, previous)) return false;
  return /\b(?:change of plans|instead(?:\s+of)?|actually\s+(?:make it|change|switch)|make it\b|make (?:the\s+)?destination|change (?:the\s+)?destination|destination is|destination to|go to\b[\s\S]{0,40}\binstead|not\s+[A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?\s*(?:anymore|[—\-,:]))/i.test(
    text,
  );
}

export function isSoftDestinationPreference(text: string): boolean {
  return /\b(?:actually\s+prefer|actually\s+like|prefer|might be better|is nicer|maybe|perhaps|thinking of|possibly|not sure)\b/i.test(
    text,
  );
}

function matchIsNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 32), matchIndex).toLowerCase();
  return (
    /\b(?:do not|don'?t|never)\s+(?:change|make|switch)?\s*$/.test(before) ||
    /\b(?:do not|don'?t|never)\s*$/.test(before)
  );
}

export function extractDestinationChange(
  text: string,
  previous?: ConversationState,
): DestinationChange | undefined {
  if (/\b(?:one|a|1)\s+day\s+(?:earlier|later)\b/i.test(text)) return undefined;
  if (isDestinationRetention(text, previous)) return undefined;

  // Punctuation between negated place and replacement (em/en dash, hyphen, colon, comma)
  const dash = '(?:\\u2014|\\u2013|[-:,])';
  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: new RegExp(`\\b(?:actually\\s+)?make it\\s+${PLACE_CAPTURE}\\s*(?:instead)?\\b`), group: 1 },
    { re: new RegExp(`\\b(?:actually\\s+)?make\\s+(?:the\\s+)?destination\\s+${PLACE_CAPTURE}`), group: 1 },
    {
      re: new RegExp(`\\b(?:actually\\s+)?(?:change|switch)\\s+(?:the\\s+)?destination\\s+to\\s+(.+?)(?:\\.|$)`, 'i'),
      group: 1,
    },
    { re: new RegExp(`\\bdestination\\s+is\\s+(.+?)(?:\\.|$)`, 'i'), group: 1 },
    { re: new RegExp(`\\b(?:actually\\s+)?(?:change|switch)\\s+(?:it\\s+)?to\\s+${PLACE_CAPTURE}`), group: 1 },
    { re: new RegExp(`\\b(?:go to|travel to|fly to|going to)\\s+${PLACE_CAPTURE}\\s+instead of\\b`), group: 1 },
    { re: new RegExp(`\\b${PLACE_CAPTURE}\\s+instead of\\b`), group: 1 },
    // "Brisbane instead" and "Brisbane options instead"
    { re: new RegExp(`\\b${PLACE_CAPTURE}\\s+(?:\\w+\\s+){0,3}instead\\b`), group: 1 },
    { re: new RegExp(`\\binstead(?:\\s+make it|\\s+to)\\s+${PLACE_CAPTURE}`), group: 1 },
    // "Not Adelaide anymore — Brisbane" / "Not Melbourne — Gold Coast"
    // Use [Nn]ot so case-sensitive PLACE_CAPTURE still works (no /i on the whole regex).
    {
      re: new RegExp(`\\b[Nn]ot\\s+${PLACE_CAPTURE}\\s+anymore\\s*${dash}?\\s*${PLACE_CAPTURE}`),
      group: 2,
    },
    {
      re: new RegExp(`\\b[Nn]ot\\s+${PLACE_CAPTURE}\\s*${dash}\\s*${PLACE_CAPTURE}`),
      group: 2,
    },
    {
      re: new RegExp(
        `\\bchange of plans\\b[\\s\\S]{0,120}?\\b(?:go to|travel to|fly to|make it)\\s+${PLACE_CAPTURE}`,
      ),
      group: 1,
    },
    { re: new RegExp(`\\bchange of plans\\b[\\s\\S]{0,120}?\\bto\\s+${PLACE_CAPTURE}`), group: 1 },
  ];

  for (const { re, group } of patterns) {
    const match = text.match(re);
    if (!match?.[group]) continue;
    if (match.index != null && matchIsNegated(text, match.index)) continue;
    const candidate = normalizeDestinationCandidate(match[group]!);
    if (candidate) return candidate;
  }
  return undefined;
}

export function resolvePendingDestinationDecision(
  text: string,
  previous?: ConversationState,
): 'confirm' | 'decline' | undefined {
  if (!previous?.awaitingDestinationConfirmation || !previous.pendingDestination) return undefined;
  const t = text.trim().toLowerCase();
  const pending = previous.pendingDestination.value.toLowerCase();
  const current = previous.destination?.value.toLowerCase() ?? '';
  const keepLooking = /\bkeep\s+(?:looking|searching|thinking|exploring|checking)\b/.test(t);

  if (!keepLooking) {
    if (/\b(?:don'?t change|do not change)\b/.test(t) || (/^(no|nope|nah)\b/.test(t) && !t.includes(pending))) {
      return 'decline';
    }
    if (current && new RegExp(`\\b(?:keep|stay with|stay in)\\s+${current}\\b`, 'i').test(t)) {
      return 'decline';
    }
    if (/\bkeep\s+(?:the\s+)?(?:current\s+)?destination\b/.test(t)) return 'decline';
  }

  if (
    /^(yes|yep|yeah|correct|confirm|that works|sounds good|please do|change it|switch)\b/.test(t) ||
    new RegExp(`\\b(?:change|switch|go)\\s+to\\s+${pending}\\b`, 'i').test(t) ||
    t === pending ||
    new RegExp(`^(?:yes[,.]?\\s*)?${pending}\\b`, 'i').test(t)
  ) {
    return 'confirm';
  }
  return undefined;
}

function pendingPlaceClarification(previous?: ConversationState): 'origin' | 'destination' | undefined {
  const missing = previous?.missingRequiredFields ?? [];
  if (missing.includes('origin')) return 'origin';
  if (missing.includes('destination')) return 'destination';
  return undefined;
}

/** Short place replies for clarification — never stay areas. */
export function extractClarificationPlaceReply(text: string): string | undefined {
  const cleaned = text.trim().replace(/[.!?]+$/, '').trim();
  if (!cleaned || cleaned.length > 80) return undefined;
  if (matchAreaName(cleaned) || findAreaMentions(cleaned).length > 0) return undefined;

  const prefixed = cleaned.match(/^(?:from|leaving from|departing from|flying from)\s+(.+)$/i);
  if (prefixed?.[1]) {
    const name = resolvePlaceName(prefixed[1].replace(/\s+Airport$/i, '').trim());
    if (name && !PLACE_STOPWORDS.has(name.toLowerCase()) && !DESTINATION_CHANGE_STOPWORDS.has(name.toLowerCase())) {
      return name;
    }
  }

  const airport = cleaned.match(/^(.+?)\s+Airport$/i);
  if (airport?.[1]) {
    const name = resolvePlaceName(airport[1].trim());
    if (name && !PLACE_STOPWORDS.has(name.toLowerCase())) return name;
  }

  const places = findPlacesInText(cleaned);
  if (places.length === 1) {
    const place = places[0]!;
    const escaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bare = new RegExp(
      `^(?:from\\s+|leaving\\s+from\\s+|departing\\s+from\\s+|flying\\s+from\\s+)?${escaped}(?:\\s+Airport)?$`,
      'i',
    );
    if (bare.test(cleaned) || cleaned.toLowerCase() === place.name.toLowerCase()) {
      return place.name;
    }
  }

  if (/^[A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?$/.test(cleaned)) {
    const name = resolvePlaceName(cleaned);
    if (name && !PLACE_STOPWORDS.has(name.toLowerCase()) && !DESTINATION_CHANGE_STOPWORDS.has(name.toLowerCase())) {
      return name;
    }
  }
  return undefined;
}

/**
 * Classify destination intent once — assemble uses this instead of layered ifs.
 */
export function classifyDestinationIntent(
  text: string,
  previous: ConversationState | undefined,
  now: Date,
): DestinationIntent {
  if (isDestinationRetention(text, previous)) return { kind: 'retain' };

  const hard = extractDestinationChange(text, previous);
  if (hard) {
    const soft = isSoftDestinationPreference(text);
    const explicitHard = /\b(?:make it|make (?:the\s+)?destination|change (?:the\s+)?destination|change it to|destination is|destination to|not\s+[a-z][a-z\s]+?\s+anymore|instead of|change of plans)\b/i.test(
      text,
    );
    if (soft && previous?.destination && !explicitHard) {
      return { kind: 'soft', place: hard.destination };
    }
    return { kind: 'hard', place: hard.destination, area: hard.area };
  }

  // Soft preference with a bare place mention
  if (isSoftDestinationPreference(text) && previous?.destination) {
    const places = findPlacesInText(text);
    const candidate = places.find(
      (p) => p.name.toLowerCase() !== previous.destination!.value.toLowerCase(),
    );
    if (candidate && !hasDestinationReplacementLanguage(text, previous)) {
      return { kind: 'soft', place: candidate.name };
    }
  }

  const toMatch = text.match(
    /\b(?:travel to|go to|going to|fly to|visit(?:ing)?|change destination to|destination to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
  );
  if (toMatch?.[1]) {
    const raw = toMatch[1];
    const isReturnPhrase =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${raw.split(/\s+/)[0]}`, 'i').test(text);
    if (!isReturnPhrase) {
      const name = resolvePlaceName(raw);
      const areas = findAreaMentions(text);
      if (name && !areas.some((a) => a.area.toLowerCase() === name.toLowerCase())) {
        return { kind: 'assign', place: name, source: 'confirmed' };
      }
    }
  }

  const explicitTo = text.match(/\bto\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (explicitTo?.[1] && !isDestinationRetention(text, previous)) {
    const name = resolvePlaceName(explicitTo[1]);
    const isReturnOnly =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${explicitTo[1].split(/\s+/)[0]}`, 'i').test(text);
    const areas = findAreaMentions(text);
    if (
      name &&
      !isReturnOnly &&
      !areas.some((a) => a.area.toLowerCase() === name.toLowerCase()) &&
      explicitTo.index != null &&
      !matchIsNegated(text, explicitTo.index) &&
      !/\bdo not change\b|\bdon'?t change\b/i.test(text)
    ) {
      // "to X" only assigns when no confirmed destination, or hard replace language present
      if (!previous?.destination || hasDestinationReplacementLanguage(text, previous)) {
        return { kind: 'assign', place: name, source: 'confirmed' };
      }
      // First-turn / same-turn: "go to Gold Coast from Melbourne" already handled by toMatch.
      // Bare "to" with existing dest must not silently overwrite.
      if (!previous.destination) {
        return { kind: 'assign', place: name, source: 'confirmed' };
      }
    }
  }

  // Area-only mentions imply parent city when destination unset
  const areas = findAreaMentions(text);
  if (areas.length && !previous?.destination) {
    return { kind: 'assign', place: areas[0]!.city, area: areas[0]!.area, source: 'inferred' };
  }

  // Bare known place when no destination yet
  const places = findPlacesInText(text);
  const originFromText = text.match(
    /\b(?:leaving|departing|flying)?\s*from\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i,
  );
  const originName = originFromText
    ? resolvePlaceName(originFromText[1]!.replace(/\s+Airport$/i, '')).toLowerCase()
    : previous?.origin?.value?.toLowerCase();

  if (!previous?.destination && places.length > 0) {
    const preferred =
      places.find((p) => p.name === 'Melbourne' && p.name.toLowerCase() !== originName) ??
      places.find((p) => p.name.toLowerCase() !== originName) ??
      places[0];
    if (preferred && preferred.name.toLowerCase() !== originName) {
      return { kind: 'assign', place: preferred.name, source: 'confirmed' };
    }
  }

  // Date-pending bare place is origin, not destination — handled in extractOrigin
  void now;
  void looksLikeDateConfirmation;
  return { kind: 'none' };
}

export function extractOrigin(
  text: string,
  previous: ConversationState | undefined,
  now: Date,
): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { changedFields: [], explicitChanges: [] };
  const changed = patch.changedFields!;
  const explicit = patch.explicitChanges!;

  const fromMatch = text.match(
    /\b(?:leaving|departing|flying)?\s*from\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i,
  );
  if (fromMatch) {
    const raw = fromMatch[1]!.replace(/\s+Airport$/i, '');
    // Reject time/weekday phrases ("from Friday afternoon")
    if (
      !/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night|work)\b/i.test(
        raw,
      )
    ) {
      patch.origin = field(resolvePlaceName(raw));
      markChanged(changed, 'origin');
      explicit.push('origin');
    }
  }

  const backToMatch = text.match(
    /\b(?:come back|return|back)\s+to\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i,
  );
  if (backToMatch) {
    const raw = backToMatch[1]!;
    if (
      !/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night)\b/i.test(
        raw,
      )
    ) {
      // "come back to Sydney" is the home/origin city for the return leg
      patch.origin = field(resolvePlaceName(raw));
      markChanged(changed, 'origin');
      explicit.push('origin');
    }
  }

  const pendingField = pendingPlaceClarification(previous);
  if (pendingField === 'origin' && !patch.origin) {
    const clarificationPlace = extractClarificationPlaceReply(text);
    if (clarificationPlace) {
      patch.origin = field(clarificationPlace);
      markChanged(changed, 'origin');
      explicit.push('origin');
    }
  }

  // Bare city/airport while date pending → origin (stay areas excluded in extractClarificationPlaceReply)
  const placeReply = !pendingField ? extractClarificationPlaceReply(text) : undefined;
  const datePending =
    Boolean(previous?.destination) &&
    awaitingExactDepartureDate(previous) &&
    !looksLikeDateConfirmation(text, previous, now);
  if (placeReply && datePending && !hasDestinationReplacementLanguage(text, previous)) {
    // Bare city/airport while awaiting a date answers/corrects origin even when
    // a prior origin exists (e.g. Sydney → Melbourne Airport).
    patch.origin = field(placeReply);
    markChanged(changed, 'origin');
    explicit.push('origin');
  }

  return patch;
}

export function extractAreas(
  text: string,
  destinationIntent: DestinationIntent,
  previous?: ConversationState,
): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { changedFields: [], explicitChanges: [] };
  const changed = patch.changedFields!;
  const explicit = patch.explicitChanges!;
  const areas = findAreaMentions(text);

  const inMatch = text.match(
    /\b(?:hotel|stay|resort|accommodation|staying)\s+(?:in\s+|at\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
  );

  if (destinationIntent.kind === 'hard' && destinationIntent.area) {
    patch.accommodationArea = field(destinationIntent.area, 'confirmed');
    markChanged(changed, 'accommodationArea');
    explicit.push('accommodationArea');
  } else if (areas.length > 0) {
    patch.accommodationArea = field(areas[0]!.area);
    markChanged(changed, 'accommodationArea');
    explicit.push('accommodationArea');
  } else if (inMatch?.[1]) {
    const areaHit = matchAreaName(inMatch[1]);
    if (areaHit) {
      patch.accommodationArea = field(areaHit.area);
      markChanged(changed, 'accommodationArea');
      explicit.push('accommodationArea');
    }
  }

  if (!patch.accommodationArea && !/\bstay with (?:family|friends|relatives)\b/i.test(text)) {
    const freeform = text.match(
      /\b(?:stay|hotel|accommodation|base(?:\s+us)?)\s+(?:near|in|around|at)\s+(?:the\s+)?([A-Za-z][A-Za-z]+(?:\s+[A-Za-z][A-Za-z]+)?)/i,
    );
    if (freeform?.[1]) {
      const raw = freeform[1].trim();
      const lower = raw.toLowerCase();
      if (
        !PLACE_STOPWORDS.has(lower) &&
        !DESTINATION_CHANGE_STOPWORDS.has(lower) &&
        !['family', 'friends', 'relatives', 'home', 'there', 'here'].includes(lower) &&
        !PLACES.some((p) => p.name.toLowerCase() === lower || p.aliases.includes(lower))
      ) {
        const knownArea = matchAreaName(raw);
        patch.accommodationArea = field(
          knownArea?.area ?? raw.replace(/^\w/, (c) => c.toUpperCase()),
        );
        markChanged(changed, 'accommodationArea');
        explicit.push('accommodationArea');
      }
    }
  }

  // Clear stale city-bound area when destination city hard-changes without a new area
  if (
    (destinationIntent.kind === 'hard' || destinationIntent.kind === 'assign') &&
    previous?.accommodationArea &&
    !patch.accommodationArea
  ) {
    const newCity =
      destinationIntent.kind === 'hard' || destinationIntent.kind === 'assign'
        ? destinationIntent.place
        : undefined;
    const previousAreaMeta = matchAreaName(previous.accommodationArea.value);
    if (newCity && previousAreaMeta && previousAreaMeta.city !== newCity) {
      patch.clearAccommodationArea = true;
      markChanged(changed, 'accommodationArea');
    }
  }

  return patch;
}

export function applyDestinationIntent(
  intent: DestinationIntent,
  text: string,
  previous: ConversationState | undefined,
  destinationDecisionHandled: boolean,
): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { changedFields: [], explicitChanges: [], pendingLowConfidenceFields: [] };
  if (destinationDecisionHandled) return patch;

  const changed = patch.changedFields!;
  const explicit = patch.explicitChanges!;

  if (intent.kind === 'retain' || intent.kind === 'none') return patch;

  if (intent.kind === 'soft') {
    patch.destination = field(intent.place, 'inferred');
    patch.pendingLowConfidenceFields = ['destination'];
    markChanged(changed, 'destination');
    return patch;
  }

  if (intent.kind === 'hard') {
    patch.destination = field(intent.place, 'confirmed');
    markChanged(changed, 'destination');
    explicit.push('destination');
    return patch;
  }

  if (intent.kind === 'assign') {
    const previousDest = previous?.destination?.value?.toLowerCase();
    const nextDest = intent.place.toLowerCase();
    // Same place — nothing to change (retention / no-op).
    if (previousDest && previousDest === nextDest) return patch;
    // "go to / travel to / fly to / visit X" is an explicit destination statement.
    // Retention language is handled earlier via classify → retain.
    // Do not silently keep a stale vault/seed destination over a clear "go to X".
    patch.destination = field(intent.place, intent.source);
    markChanged(changed, 'destination');
    explicit.push('destination');
  }

  return patch;
}
