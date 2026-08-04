import { resolveSync } from '../travel-location-intelligence';
import { CURATED_PLACES } from '../travel-location-intelligence/data/curatedPlaces';
import {
  emptySemanticInterpretation,
  type TravelSemanticInterpretation,
} from './schema';
import type { ActiveTravelRequirement } from './types';
import type { ConversationCoreState, ConversationTranscriptEntry } from '../conversation-core';
import { buildInterpretationContext } from './buildInterpretationContext';
import { resolveAmendmentSemantics } from './amendmentSemantics';
import { resolveContextualCompletionSemantics } from './contextualCompletionSemantics';
import { resolveContextualConfirmationSemantics } from './contextualConfirmationSemantics';
import { resolveContextualTemporalSemantics } from './contextualTemporalSemantics';
import {
  applyRecognizedServicesToSemantic,
  recognizeTravelServicesInMessage,
} from './serviceRecognitionSemantics';
import { resolveTravellerCountSemantics } from './travellerCountSemantics';

/**
 * Offline semantic adapter — place-aware slot filling via travel-location-intelligence
 * and active missing-requirement context. Not an expansion of the legacy cue
 * extractor catalogue. Used when AI is unavailable and as a local primary for tests.
 */

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

function findPlacesInMessage(message: string): string[] {
  const folded = asciiFold(message);
  const hits: Array<{ name: string; index: number; length: number }> = [];

  for (const place of CURATED_PLACES) {
    const candidates = [place.canonicalName, ...place.aliases];
    for (const candidate of candidates) {
      const needle = asciiFold(candidate);
      if (needle.length < 3) continue;
      const index = folded.indexOf(needle);
      if (index === -1) continue;
      // Word-ish boundary: previous/next chars not letters.
      const before = index === 0 ? ' ' : folded.charAt(index - 1);
      const after =
        index + needle.length >= folded.length
          ? ' '
          : folded.charAt(index + needle.length);
      if (/[a-z]/.test(before) || /[a-z]/.test(after)) continue;
      hits.push({
        name: place.canonicalName,
        index,
        length: needle.length,
      });
    }
  }

  hits.sort((a, b) => a.index - b.index || b.length - a.length);
  const unique: string[] = [];
  for (const hit of hits) {
    if (!unique.includes(hit.name)) unique.push(hit.name);
  }
  return unique;
}

function parseIsoLikeDate(message: string, now: Date): string | null {
  // 28th of August / 28 August / August 28
  const monthMap: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  const folded = asciiFold(message);
  const ordinal = folded.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
  );
  const alt = folded.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  let day: number | null = null;
  let month: number | null = null;
  if (ordinal) {
    day = Number(ordinal[1]);
    month = monthMap[ordinal[2] ?? ''] ?? null;
  } else if (alt) {
    month = monthMap[alt[1] ?? ''] ?? null;
    day = Number(alt[2]);
  }
  if (day === null || month === null || day < 1 || day > 31) return null;

  let year = now.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    year += 1;
  }
  const iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  return iso;
}

function parseNightCount(message: string): number | null {
  const folded = asciiFold(message);
  const match = folded.match(
    /\b(?:for\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+nights?\b/,
  );
  if (!match) return null;
  const raw = match[1] ?? '';
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
  if (/^\d+$/.test(raw)) return Number(raw);
  return words[raw] ?? null;
}

function parseTimePreference(message: string): string | null {
  const folded = asciiFold(message);
  if (/\bin the morning\b/.test(folded)) return 'morning';
  if (/\bin the afternoon\b/.test(folded)) return 'afternoon';
  if (/\bin the evening\b/.test(folded) || /\bat night\b/.test(folded)) {
    return 'evening';
  }
  const after = folded.match(/\bafter\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (after) {
    return `after ${after[1]}${after[2] ? `:${after[2]}` : ''}${after[3] ? ` ${after[3]}` : ''}`;
  }
  return null;
}

export function interpretOfflineSemantic(input: {
  message: string;
  currentState: ConversationCoreState;
  activeRequirement: ActiveTravelRequirement;
  recentHistory?: ConversationTranscriptEntry[];
  now?: Date;
}): TravelSemanticInterpretation {
  const now = input.now ?? new Date();
  const message = input.message;
  const folded = asciiFold(message);

  // Contextual temporal / reference semantics first (consultant-style anchors).
  const context = buildInterpretationContext({
    message: input.message,
    currentState: input.currentState,
    activeRequirement: input.activeRequirement,
    recentHistory: input.recentHistory,
    now,
  });
  // Confirm-to-search before optional completion so "confirmed" advances
  // planning → search execution instead of re-closing optional Q&A.
  const contextualConfirmation = resolveContextualConfirmationSemantics(context);
  if (contextualConfirmation !== null) {
    return contextualConfirmation;
  }

  // Amendments exit search-ready / search-execution terminal states and reopen
  // only the named slots (or apply in-utterance replacements / service changes).
  const amendment = resolveAmendmentSemantics(context);
  if (amendment !== null) {
    const dateFieldNote = amendment.ambiguityNotes.find((note) =>
      note.startsWith('dateAmendmentField:'),
    );
    if (dateFieldNote) {
      const field = dateFieldNote.slice('dateAmendmentField:'.length);
      const date = parseIsoLikeDate(message, now);
      if (date !== null) {
        if (field === 'returnDate') amendment.returnDate = date;
        else amendment.departureDate = date;
      } else {
        // No parseable date → reopen the targeted date slot(s).
        if (field === 'returnDate' || field === 'departureDate') {
          amendment.reopenFields = [
            ...new Set([
              ...amendment.reopenFields,
              field as 'departureDate' | 'returnDate',
            ]),
          ];
        }
      }
    }
    return amendment;
  }

  const contextualCompletion = resolveContextualCompletionSemantics(context);
  if (contextualCompletion !== null) {
    return contextualCompletion;
  }

  const contextual = resolveContextualTemporalSemantics(context);
  if (contextual !== null) {
    return contextual;
  }

  const semantic = emptySemanticInterpretation();
  semantic.confidence = 0.55;
  semantic.intent = 'provide_info';

  const places = findPlacesInMessage(message);
  const isCorrection =
    /\b(?:actually|instead|make that|change (?:it|that) to|not .+[,])/i.test(
      message,
    );
  if (isCorrection) semantic.intent = 'correct';

  if (/\bremove (?:the )?car\b/.test(folded) || /\bno car\b/.test(folded)) {
    semantic.intent = 'remove';
    semantic.removals = ['carHire'];
    semantic.carHireRequested = false;
    semantic.confidence = 0.8;
  }

  // Multi-intent service scan: preserve every recognised service from one utterance.
  const recognizedServices = recognizeTravelServicesInMessage(message);
  if (recognizedServices.size > 0 && !semantic.removals.includes('carHire')) {
    const applied = applyRecognizedServicesToSemantic({
      services: recognizedServices,
      flightsRequested: semantic.flightsRequested,
      accommodationRequested: semantic.accommodationRequested,
      carHireRequested: semantic.carHireRequested,
      activitiesRequested: semantic.activitiesRequested,
      restaurantsRequested: semantic.restaurantsRequested,
    });
    semantic.flightsRequested = applied.flightsRequested;
    semantic.accommodationRequested = applied.accommodationRequested;
    semantic.carHireRequested = applied.carHireRequested;
    semantic.activitiesRequested = applied.activitiesRequested;
    semantic.restaurantsRequested = applied.restaurantsRequested;
    if (applied.any) {
      if (recognizedServices.size > 1) semantic.intent = 'add_service';
      semantic.confidence = Math.max(semantic.confidence, 0.82);
    }
  }

  const nightCount = parseNightCount(message);
  if (nightCount !== null) {
    semantic.nightCount = nightCount;
    semantic.confidence = Math.max(semantic.confidence, 0.7);
  }

  const timePref = parseTimePreference(message);
  if (timePref !== null) {
    semantic.departureTimePreference = timePref;
    semantic.confidence = Math.max(semantic.confidence, 0.65);
  }

  const date = parseIsoLikeDate(message, now);
  if (date !== null) {
    if (
      input.activeRequirement === 'returnDate' &&
      input.currentState.departureDate !== null
    ) {
      semantic.returnDate = date;
    } else {
      semantic.departureDate = date;
    }
    semantic.confidence = Math.max(semantic.confidence, 0.75);
  }

  // Traveller counts via meaning classes (self-party, zero-quantity, cardinals).
  const travellerCounts = resolveTravellerCountSemantics({
    message,
    activeRequirement: input.activeRequirement,
  });
  if (travellerCounts !== null) {
    if (travellerCounts.adultCount !== undefined) {
      semantic.adultCount = travellerCounts.adultCount;
    }
    if (travellerCounts.childCount !== undefined) {
      semantic.childCount = travellerCounts.childCount;
    }
    if (travellerCounts.infantCount !== undefined) {
      semantic.infantCount = travellerCounts.infantCount;
    }
    semantic.confidence = Math.max(semantic.confidence, 0.85);
  }

  // Place role assignment using active requirement + travel cues.
  if (places.length > 0) {
    const fromMatch = folded.match(
      /\b(?:from|leaving from|departing from|travelling from|traveling from|flying from)\s+([a-z][a-z\s'-]{1,40})/,
    );
    const goMatch = folded.match(
      /\b(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|visit(?:ing)?|head(?:ing)?|to)\s+(?!from\b)([a-z][a-z\s'-]{1,40})/,
    );
    const thinkingMatch = folded.match(/\bthinking(?:\s+about)?\s+([a-z][a-z\s'-]{1,40})/);
    const soundsMatch = folded.match(
      /\b([a-z][a-z\s'-]{1,40})\s+sounds\s+good\b/,
    );

    const resolveNamed = (raw: string | undefined): string | null => {
      if (!raw) return null;
      const clipped = raw.replace(/\s+(?:from|to|on|for|in|after|before)\b.*$/, '').trim();
      if (!clipped) return null;
      const found = findPlacesInMessage(clipped);
      if (found[0]) return found[0] ?? null;
      const resolved = resolveSync(clipped);
      return resolved.best?.canonicalName ?? null;
    };

    let destination: string | null = null;
    let origin: string | null = null;

    if (fromMatch) {
      origin = resolveNamed(fromMatch[1] ?? undefined);
    }
    if (goMatch) {
      destination = resolveNamed(goMatch[1] ?? undefined);
    }
    if (thinkingMatch && destination === null) {
      destination = resolveNamed(thinkingMatch[1] ?? undefined);
    }
    if (soundsMatch && destination === null) {
      destination = resolveNamed(soundsMatch[1] ?? undefined);
    }

    if (isCorrection && places.length > 0 && destination === null) {
      destination = places[places.length - 1] ?? null;
    }

    if (destination === null && origin === null) {
      if (input.activeRequirement === 'destination') {
        destination = places[0] ?? null;
      } else if (input.activeRequirement === 'origin') {
        origin = places[0] ?? null;
      } else if (input.currentState.destination === null) {
        destination = places[0] ?? null;
      } else if (input.currentState.origin === null) {
        origin = places[0] ?? null;
      } else {
        destination = places[0] ?? null;
        semantic.intent = isCorrection ? 'correct' : 'provide_info';
      }
    }

    // Bare "travelling from X" with origin set and no destination cue.
    if (
      origin !== null &&
      destination === null &&
      /\b(?:travelling|traveling|flying|leaving|departing)\s+from\b/.test(folded) &&
      !/\b(?:go(?:ing)?|to|visit)\b/.test(folded.replace(/\bfrom\b.*$/, ''))
    ) {
      // keep origin only
    }

    if (destination !== null) {
      const resolved = resolveSync(destination);
      semantic.destination = resolved.best?.canonicalName ?? destination;
      semantic.confidence = Math.max(semantic.confidence, 0.72);
    }
    if (origin !== null) {
      const resolved = resolveSync(origin);
      semantic.origin = resolved.best?.canonicalName ?? origin;
      semantic.confidence = Math.max(semantic.confidence, 0.72);
    }
  }

  if (
    semantic.destination === null &&
    semantic.origin === null &&
    semantic.departureDate === null &&
    semantic.returnDate === null &&
    semantic.adultCount === null &&
    semantic.childCount === null &&
    semantic.infantCount === null &&
    semantic.flightsRequested === null &&
    semantic.accommodationRequested === null &&
    semantic.carHireRequested === null &&
    semantic.removals.length === 0 &&
    semantic.nightCount === null &&
    semantic.departureTimePreference === null &&
    semantic.conversationComplete !== true
  ) {
    semantic.intent = 'unknown';
    semantic.confidence = 0.1;
  }

  return semantic;
}
