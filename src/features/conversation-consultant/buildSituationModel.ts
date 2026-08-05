import { resolveSync } from '../travel-location-intelligence';
import { CURATED_PLACES } from '../travel-location-intelligence/data/curatedPlaces';
import type {
  ConversationCoreState,
  ConversationStateUpdate,
  OpenClarification,
} from '../conversation-core';
import type { InterpretTravelUtteranceResult } from '../conversation-interpretation/types';
import {
  hasOriginDestinationRoleSplit,
  hasOriginOnlyRole,
} from '../conversation-interpretation/tripStructureSemantics';
import type {
  ConsultantIntent,
  SituationAmbiguity,
  SituationFacts,
  SituationModel,
} from './types';

const PLACE_UPDATE_KEYS = [
  'origin',
  'destination',
  'destinationStops',
  'tripStructure',
  'tripLegs',
  'destinationResolutionStatus',
  'originResolutionStatus',
] as const satisfies ReadonlyArray<keyof ConversationStateUpdate>;

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

function canonicalPlace(name: string): string {
  return resolveSync(name).best?.canonicalName ?? name;
}

function hasTravelGoIntent(folded: string): boolean {
  return /\b(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|visit(?:ing)?|head(?:ing)?|trip\s+to|like\s+to\s+go)\b/.test(
    folded,
  );
}

function stripPlaceWrites(
  update: ConversationStateUpdate,
): ConversationStateUpdate {
  const next: ConversationStateUpdate = { ...update };
  for (const key of PLACE_UPDATE_KEYS) {
    delete next[key];
  }
  return next;
}

function mapIntent(
  interpretation: InterpretTravelUtteranceResult,
  fallback: ConsultantIntent,
): ConsultantIntent {
  switch (interpretation.semantic.intent) {
    case 'confirm':
      return 'confirm';
    case 'correct':
    case 'remove':
    case 'add_service':
      return 'amend';
    case 'provide_info':
      return 'inform';
    default:
      return fallback;
  }
}

function factsFromUpdate(update: ConversationStateUpdate): SituationFacts {
  const facts: SituationFacts = {};
  if (update.origin !== undefined) facts.origin = update.origin;
  if (update.destination !== undefined) facts.destination = update.destination;
  if (update.destinationStops !== undefined) {
    facts.destinationStops = update.destinationStops;
  }
  if (update.tripStructure !== undefined) {
    facts.tripStructure = update.tripStructure;
  }
  if (update.departureDate !== undefined) {
    facts.departureDate = update.departureDate;
  }
  if (update.returnDate !== undefined) facts.returnDate = update.returnDate;
  if (update.adultCount !== undefined) facts.adultCount = update.adultCount;
  if (update.childCount !== undefined) facts.childCount = update.childCount;
  if (update.infantCount !== undefined) facts.infantCount = update.infantCount;
  if (update.flightsRequested !== undefined) {
    facts.flightsRequested = update.flightsRequested;
  }
  if (update.accommodationRequested !== undefined) {
    facts.accommodationRequested = update.accommodationRequested;
  }
  if (update.carHireRequested !== undefined) {
    facts.carHireRequested = update.carHireRequested;
  }
  if (update.activitiesRequested !== undefined) {
    facts.activitiesRequested = update.activitiesRequested;
  }
  if (update.restaurantsRequested !== undefined) {
    facts.restaurantsRequested = update.restaurantsRequested;
  }
  if (update.conversationComplete !== undefined) {
    facts.conversationComplete = update.conversationComplete;
  }
  if (update.searchExecutionRequested !== undefined) {
    facts.searchExecutionRequested = update.searchExecutionRequested;
  }
  if (update.amendmentResumeSearchReady !== undefined) {
    facts.amendmentResumeSearchReady = update.amendmentResumeSearchReady;
  }
  return facts;
}

/**
 * Resolve an open place-role clarification from the user message.
 * Returns null when the utterance does not answer the open question.
 */
export function resolvePlaceRoleClarification(input: {
  message: string;
  clarification: OpenClarification;
}): SituationFacts | null {
  const folded = asciiFold(input.message);
  const trimmed = folded.replace(/[.!?]+$/g, '').trim();
  const subject = asciiFold(input.clarification.subject);
  const places = (input.clarification.placesInOrder ?? []).map(canonicalPlace);
  const subjectCanonical = canonicalPlace(input.clarification.subject);

  const asOrigin =
    /\b(?:origin|depart(?:ing|ure)?|start(?:ing)?(?:\s+from)?|from(?:\s+there)?|leave\s+from|flying\s+from)\b/.test(
      trimmed,
    ) ||
    new RegExp(`\\bfrom\\s+${subject}\\b`).test(trimmed) ||
    /^(?:from|origin|start(?:ing)?)$/.test(trimmed);

  const asFirstDestination =
    /\b(?:first\s+(?:destination|stop|city)|destination|visit(?:ing)?|going\s+to|stop(?:ping)?\s+(?:in|at)|first)\b/.test(
      trimmed,
    ) ||
    /^(?:destination|first|stop|visit(?:ing)?)$/.test(trimmed);

  if (asOrigin && !asFirstDestination) {
    const rest = places.filter((place) => place !== subjectCanonical);
    return {
      origin: subjectCanonical,
      tripStructure: rest.length >= 2 ? 'multi_city' : null,
      destinationStops: rest.length > 0 ? rest : null,
      destination: rest[0] ?? null,
      openClarification: null,
    };
  }

  if (asFirstDestination && !asOrigin) {
    const stops = places.length > 0 ? places : [subjectCanonical];
    return {
      tripStructure: stops.length >= 2 ? 'multi_city' : null,
      destinationStops: stops,
      destination: stops[0] ?? subjectCanonical,
      openClarification: null,
    };
  }

  if (
    places.length >= 2 &&
    (new RegExp(`\\bstarting\\s+from\\s+${subject}\\b`).test(trimmed) ||
      new RegExp(`\\bfrom\\s+${subject}\\b`).test(trimmed))
  ) {
    const rest = places.filter((place) => place !== subjectCanonical);
    return {
      origin: subjectCanonical,
      tripStructure: rest.length >= 2 ? 'multi_city' : null,
      destinationStops: rest.length > 0 ? rest : null,
      destination: rest[0] ?? null,
      openClarification: null,
    };
  }

  return null;
}

function clarificationFactsToUpdate(
  facts: SituationFacts,
): ConversationStateUpdate {
  const update: ConversationStateUpdate = {};
  if (facts.origin !== undefined) update.origin = facts.origin;
  if (facts.destination !== undefined) update.destination = facts.destination;
  if (facts.destinationStops !== undefined) {
    update.destinationStops = facts.destinationStops;
  }
  if (facts.tripStructure !== undefined) {
    update.tripStructure = facts.tripStructure;
  }
  if (facts.openClarification === null) update.openClarification = null;
  return update;
}

/**
 * @deprecated Engine Consolidation — not used by runConsultantTurn.
 * Authoritative SituationModel owner: situationFromSemantic (projects the
 * single interpretSemanticMeaning result; no independent place reconstruction).
 *
 * Legacy builder: uses ITU result + independent curated place lookup.
 */
export function buildSituationModel(input: {
  message: string;
  currentState: ConversationCoreState;
  interpretation: InterpretTravelUtteranceResult;
}): SituationModel {
  const message = input.message;
  const folded = asciiFold(message);
  const placesInOrder = findPlacesInMessage(message).map(canonicalPlace);
  const ambiguities: SituationAmbiguity[] = [];
  const hypotheses: SituationModel['hypotheses'] = [];
  let intent: ConsultantIntent = mapIntent(input.interpretation, 'inform');
  let confidence = Math.max(input.interpretation.semantic.confidence, 0.4);
  let proposedUpdate: ConversationStateUpdate = {
    ...input.interpretation.stateUpdate,
  };

  // Answer an open blocking clarification first.
  if (
    input.currentState.openClarification !== null &&
    input.currentState.openClarification.blocking
  ) {
    const open = input.currentState.openClarification;
    if (open.type === 'place_role') {
      const resolved = resolvePlaceRoleClarification({
        message,
        clarification: open,
      });
      if (resolved !== null) {
        const nonPlace = stripPlaceWrites(input.interpretation.stateUpdate);
        proposedUpdate = {
          ...nonPlace,
          ...clarificationFactsToUpdate(resolved),
        };
        return {
          message,
          intent: 'clarify_answer',
          facts: {
            ...factsFromUpdate(proposedUpdate),
            openClarification: null,
          },
          hypotheses: [],
          ambiguities: [],
          confidence: 0.9,
          placesInOrder:
            open.placesInOrder?.map(canonicalPlace) ?? placesInOrder,
          proposedUpdate,
        };
      }
    }

    // Unresolved — keep clarification blocking; commit no place writes.
    proposedUpdate = stripPlaceWrites(input.interpretation.stateUpdate);
    return {
      message,
      intent: 'clarify_answer',
      facts: factsFromUpdate(proposedUpdate),
      hypotheses: [],
      ambiguities: [
        {
          id: open.id,
          type: open.type,
          subject: open.subject,
          options: open.options,
          reason: 'Open clarification still unanswered.',
          blocking: true,
          placesInOrder: open.placesInOrder,
        },
      ],
      confidence: 0.4,
      placesInOrder,
      proposedUpdate,
    };
  }

  if (
    input.interpretation.semantic.conversationComplete === true ||
    input.interpretation.stateUpdate.conversationComplete === true
  ) {
    intent = 'complete';
  }

  const roleSplit = hasOriginDestinationRoleSplit(message);
  const originOnly = hasOriginOnlyRole(message);
  const goIntent = hasTravelGoIntent(folded);

  // Place-role ambiguity: multiple cities under travel intent without role cues.
  // Clarify-before-write — do not commit the first city as destination/origin.
  const placeRoleUncertain =
    placesInOrder.length >= 2 &&
    goIntent &&
    !roleSplit &&
    !originOnly &&
    input.currentState.origin === null;

  if (placeRoleUncertain) {
    const subject = placesInOrder[0] ?? 'the first city';
    ambiguities.push({
      id: `place-role:${subject}`,
      type: 'place_role',
      subject,
      options: ['origin', 'first_destination'],
      reason:
        'Multiple cities named with travel intent; the first city’s role is uncertain.',
      blocking: true,
      placesInOrder,
    });
    hypotheses.push({
      id: 'journey-places',
      kind: 'journey_places',
      value: placesInOrder.join('→'),
      confidence: 0.7,
    });
    hypotheses.push({
      id: 'trip-structure-multi',
      kind: 'trip_structure',
      value: 'multi_city',
      confidence: 0.65,
    });
    confidence = Math.max(confidence, 0.75);
    proposedUpdate = stripPlaceWrites(proposedUpdate);
  } else if (roleSplit && placesInOrder.length >= 2) {
    // Clear origin/destination roles — override ambiguous place packing.
    const origin = placesInOrder[0]!;
    const stops = placesInOrder.slice(1);
    proposedUpdate = {
      ...proposedUpdate,
      origin,
      originResolutionStatus: 'resolved',
      destination: stops[0] ?? null,
      destinationStops: stops.length > 0 ? stops : null,
      destinationResolutionStatus: stops[0] ? 'resolved' : undefined,
      tripStructure: stops.length >= 2 ? 'multi_city' : proposedUpdate.tripStructure,
    };
    confidence = Math.max(confidence, 0.85);
  }

  return {
    message,
    intent,
    facts: factsFromUpdate(proposedUpdate),
    hypotheses,
    ambiguities,
    confidence,
    placesInOrder,
    proposedUpdate,
  };
}

export function blockingAmbiguity(
  situation: SituationModel,
): SituationAmbiguity | null {
  return situation.ambiguities.find((item) => item.blocking) ?? null;
}

export function clarificationFromAmbiguity(
  ambiguity: SituationAmbiguity,
): OpenClarification {
  const prompt =
    ambiguity.type === 'place_role'
      ? `Are you starting from ${ambiguity.subject}, or is ${ambiguity.subject} your first destination?`
      : `Could you clarify ${ambiguity.subject}?`;

  return {
    id: ambiguity.id,
    type: ambiguity.type,
    subject: ambiguity.subject,
    prompt,
    options: ambiguity.options,
    blocking: true,
    placesInOrder: ambiguity.placesInOrder,
  };
}
