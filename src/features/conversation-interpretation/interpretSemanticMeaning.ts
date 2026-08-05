/**
 * Shared Semantic Interpretation — single meaning owner for the governed engine.
 *
 * Emits architecture SemanticInterpretation (deltas + stance). General
 * capabilities: places, temporal, amendment/control, travel relations
 * (routing/transit/stopover/avoid/hub/compare), conversational control
 * (complete/summary/proceed/decline/confirm/reject). Meaning only.
 * Not a transcript cue catalogue.
 *
 * Temporary compatibility: `interpretDiagnosticSemantic` re-exports this.
 */

import type { ConversationCoreState } from '../conversation-core';
import {
  emptyReferencedEntity,
  type ReferencedEntity,
} from '../conversation-architecture/clarification';
import {
  emptySemanticInterpretationResult,
  type SemanticDelta,
  type SemanticInterpretation,
} from '../conversation-architecture/semanticInterpretation';
import { CURATED_PLACES } from '../travel-location-intelligence/data/curatedPlaces';
import { buildInterpretationContext } from './buildInterpretationContext';
import { resolveCalendarDateIso } from './calendarDateSemantics';
import { resolveConversationalControlSemantics } from './conversationalControlSemantics';
import { resolveContextualTemporalSemantics } from './contextualTemporalSemantics';
import { deriveActiveTravelRequirement } from './deriveActiveRequirement';
import { isShapeValidPlaceName } from './placeResolution';
import { resolveTravelRelationSemantics } from './travelRelationSemantics';

function asciiFold(value: string): string {
  let out = '';
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += normalized.charAt(i);
  }
  return out;
}

function placeEntity(name: string, extras: Partial<ReferencedEntity> = {}): ReferencedEntity {
  return emptyReferencedEntity({
    surface: name,
    resolvedHint: name,
    entityKindHint: 'place',
    ...extras,
  });
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function candidatePlaces(state: ConversationCoreState): string[] {
  const names = new Set<string>();
  for (const place of CURATED_PLACES) {
    names.add(place.canonicalName);
    for (const alias of place.aliases) names.add(alias);
  }
  if (state.origin) names.add(state.origin);
  if (state.destination) names.add(state.destination);
  for (const stop of state.destinationStops ?? []) names.add(stop);
  for (const place of state.openClarification?.placesInOrder ?? []) {
    names.add(place);
  }
  if (state.openClarification?.subject) {
    names.add(state.openClarification.subject);
  }
  return [...names];
}

type PlaceHit = { name: string; index: number; length: number };

function pushHit(
  hits: PlaceHit[],
  name: string,
  index: number,
  length: number,
): void {
  if (index < 0 || !name) return;
  hits.push({ name, index, length });
}

function resolveCanonicalPlaceName(
  raw: string,
  state: ConversationCoreState,
): string {
  const needle = asciiFold(raw);
  const curated = CURATED_PLACES.find(
    (p) =>
      asciiFold(p.canonicalName) === needle ||
      p.aliases.some((a) => asciiFold(a) === needle),
  );
  if (curated) return curated.canonicalName;
  const fromState = candidatePlaces(state).find(
    (p) => asciiFold(p) === needle,
  );
  return fromState ?? titleCaseWords(raw.trim());
}

function findKnownPlaceHits(
  message: string,
  state: ConversationCoreState,
): PlaceHit[] {
  const folded = asciiFold(message);
  const hits: PlaceHit[] = [];

  for (const candidate of candidatePlaces(state)) {
    const needle = asciiFold(candidate);
    if (needle.length < 3) continue;
    let from = 0;
    while (from <= folded.length - needle.length) {
      const index = folded.indexOf(needle, from);
      if (index === -1) break;
      const before = index === 0 ? ' ' : folded.charAt(index - 1);
      const after =
        index + needle.length >= folded.length
          ? ' '
          : folded.charAt(index + needle.length);
      if (/[a-z]/.test(before) || /[a-z]/.test(after)) {
        from = index + 1;
        continue;
      }
      pushHit(
        hits,
        resolveCanonicalPlaceName(candidate, state),
        index,
        needle.length,
      );
      from = index + needle.length;
    }
  }
  return hits;
}

/**
 * Capture shape-valid place tokens from travel frames without a city catalogue.
 * Returns hits with message offsets so merge order follows utterance order.
 */
function captureFramePlaceHits(
  message: string,
  state: ConversationCoreState,
): PlaceHit[] {
  const folded = asciiFold(message);
  const hits: PlaceHit[] = [];
  const push = (raw: string | undefined, index: number) => {
    if (!raw || index < 0) return;
    const trimmed = raw.trim().replace(/[.!?]+$/g, '');
    if (trimmed.length < 2) return;
    // Prefer the original message slice so accents (e.g. Bogotá) survive folding.
    const originalSlice = message.slice(index, index + trimmed.length).trim();
    const surface =
      originalSlice.length >= 2 &&
      asciiFold(originalSlice) === asciiFold(trimmed)
        ? originalSlice
        : titleCaseWords(trimmed);
    if (!isShapeValidPlaceName(surface) && !isShapeValidPlaceName(trimmed)) {
      return;
    }
    pushHit(
      hits,
      resolveCanonicalPlaceName(surface, state),
      index,
      asciiFold(trimmed).length,
    );
  };

  const listMatch = folded.match(
    /\b(?:want to go|like to go|go to|visit|flying to|travel to)\s+(.+)$/i,
  );
  if (listMatch?.[1] && listMatch.index !== undefined) {
    const base = listMatch.index + listMatch[0].length - listMatch[1].length;
    let cursor = 0;
    for (const part of listMatch[1].split(/\s+(?:and|then|,)\s+|\s*,\s*|\s+/)) {
      const at = listMatch[1].indexOf(part, cursor);
      if (
        /^(?:from|to|then|and|the|a|my|first|destination|origin|keep|dates|with)$/i.test(
          part,
        )
      ) {
        cursor = at >= 0 ? at + part.length : cursor;
        continue;
      }
      push(part, base + Math.max(0, at));
      cursor = at >= 0 ? at + part.length : cursor;
    }
  }

  const fromTo = message.match(
    /\bfrom\s+([\p{L}][\p{L}\-']{1,40})\s+to\s+([\p{L}][\p{L}\-']{1,40})(?:\s+then\s+([\p{L}][\p{L}\-']{1,40}))?(?:\s*,?\s*returning\s+from\s+([\p{L}][\p{L}\-']{1,40}))?/iu,
  );
  if (fromTo && fromTo.index !== undefined) {
    for (let i = 1; i <= 4; i += 1) {
      const group = fromTo[i];
      if (!group) continue;
      const rel = fromTo[0].indexOf(group);
      push(group, fromTo.index + Math.max(0, rel));
    }
  }

  const instead = folded.match(
    /\b(?:instead of|rather than)\s+([a-z][\p{L}\-']{2,40})(?:\s*[.!?]|$)/iu,
  );
  if (instead?.[1] && instead.index !== undefined) {
    push(
      instead[1],
      instead.index + instead[0].indexOf(instead[1]),
    );
  }

  const changeTo = folded.match(
    /\b(?:change|switch|replace)\s+([a-z][\p{L}\-']{2,40})\s+to\s+([a-z][\p{L}\-']{2,40})(?:\s*[.!?]|$)/iu,
  );
  if (changeTo && changeTo.index !== undefined) {
    push(changeTo[1], changeTo.index + changeTo[0].indexOf(changeTo[1]!));
    push(changeTo[2], changeTo.index + changeTo[0].indexOf(changeTo[2]!));
  } else {
    const changeDest = folded.match(
      /\bchange\s+(?:the\s+)?destination\s+to\s+([a-z][\p{L}\-']{2,40})(?:\s*[.!?]|$)/iu,
    );
    if (changeDest?.[1] && changeDest.index !== undefined) {
      push(
        changeDest[1],
        changeDest.index + changeDest[0].indexOf(changeDest[1]),
      );
    }
  }

  const remove = folded.match(
    /\b(?:remove|drop|forget)\s+(?:the\s+)?([a-z][\p{L}\-']{2,40})(?:\s*[.!?]|$)/iu,
  );
  if (remove?.[1] && remove.index !== undefined) {
    push(remove[1], remove.index + remove[0].indexOf(remove[1]));
  }

  const add = folded.match(
    /\badd\s+([a-z][\p{L}\-']{2,40})(?:\s+(?:after|before|on the way))?(?:\s*[.!?]|$)/iu,
  );
  if (add?.[1] && add.index !== undefined) {
    push(add[1], add.index + add[0].indexOf(add[1]));
  }

  const leaving = folded.match(
    /\b(?:leaving|departing|starting)\s+from\s+([a-z][\p{L}\-']{2,40})(?:\s*[.!?]|$)/iu,
  );
  if (leaving?.[1] && leaving.index !== undefined) {
    push(leaving[1], leaving.index + leaving[0].indexOf(leaving[1]));
  }

  return hits;
}

function mergePlaceHits(hits: PlaceHit[]): string[] {
  hits.sort((a, b) => a.index - b.index || b.length - a.length);
  const unique: string[] = [];
  for (const hit of hits) {
    if (!unique.some((u) => asciiFold(u) === asciiFold(hit.name))) {
      unique.push(hit.name);
    }
  }
  return unique;
}

/**
 * Shared semantic interpretation for the governed conversation engine.
 * Temporal meaning uses shared calendar + contextual temporal capabilities.
 */
export function interpretSemanticMeaning(input: {
  message: string;
  currentState: ConversationCoreState;
  now?: Date;
}): SemanticInterpretation {
  const message = input.message.trim();
  const folded = asciiFold(message);
  const state = input.currentState;
  const now = input.now ?? new Date();
  const places = mergePlaceHits([
    ...findKnownPlaceHits(message, state),
    ...captureFramePlaceHits(message, state),
  ]);
  const deltas: SemanticDelta[] = [];
  let intent: SemanticInterpretation['intent'] = 'unknown';
  let conversationalControl: SemanticInterpretation['conversationalControl'] =
    'none';
  let clarificationStance: SemanticInterpretation['clarificationStance'] =
    'none';
  let confidence = 0.5;
  const ambiguityNotes: string[] = [];

  if (
    /\b(?:start\s+again|forget\s+everything|reset\s+(?:the\s+)?trip)\b/.test(
      folded,
    )
  ) {
    intent = 'reset';
    conversationalControl = 'reset';
    deltas.push({
      kind: 'control_reset',
      entities: [],
      value: null,
      evidence: message,
    });
    confidence = 0.95;
  } else if (/\b(?:restart|new\s+conversation)\b/.test(folded)) {
    intent = 'restart';
    conversationalControl = 'restart';
    deltas.push({
      kind: 'control_restart',
      entities: [],
      value: null,
      evidence: message,
    });
    confidence = 0.95;
  } else if (/^\s*undo(?:\s+that)?\s*[.!?]?\s*$/.test(folded)) {
    intent = 'undo';
    conversationalControl = 'undo';
    deltas.push({
      kind: 'control_undo',
      entities: [],
      value: null,
      evidence: message,
    });
    confidence = 0.9;
  }

  // Conversational-control family (may combine with other facts later).
  const controlMeaning = resolveConversationalControlSemantics({
    message,
    folded,
  });
  if (controlMeaning !== null && conversationalControl === 'none') {
    conversationalControl = controlMeaning.conversationalControl;
    intent = controlMeaning.intent;
    confidence = Math.max(confidence, controlMeaning.confidence);
    deltas.push(...controlMeaning.deltas);
  } else if (controlMeaning !== null) {
    // Preserve stronger reset/restart/undo; still attach non-conflicting control deltas.
    for (const delta of controlMeaning.deltas) {
      if (
        delta.kind === 'control_information_complete' ||
        delta.kind === 'control_request_summary' ||
        delta.kind === 'control_ready_to_proceed' ||
        delta.kind === 'control_decline_further' ||
        delta.kind === 'control_confirm_plan' ||
        delta.kind === 'control_reject_plan'
      ) {
        deltas.push(delta);
      }
    }
    confidence = Math.max(confidence, controlMeaning.confidence);
  }

  if (
    /\b(?:keep\s+the\s+dates|leave\s+everything\s+else|keep\s+everything\s+else|same\s+travellers)\b/.test(
      folded,
    )
  ) {
    conversationalControl =
      conversationalControl === 'none' ? 'preserve_rest' : conversationalControl;
    if (/\bkeep\s+the\s+dates\b/.test(folded)) {
      deltas.push({
        kind: 'preserve_facet',
        entities: [],
        value: 'dates',
        evidence: 'keep the dates',
      });
    }
    if (/\bleave\s+everything\s+else|keep\s+everything\s+else\b/.test(folded)) {
      deltas.push({
        kind: 'control_keep_rest',
        entities: [],
        value: null,
        evidence: message,
      });
      conversationalControl = 'preserve_rest';
    }
  }

  if (
    /\bkeep\s+the\s+dates\b/.test(folded) &&
    /\bchange\s+(?:the\s+)?destination\b/.test(folded)
  ) {
    conversationalControl = 'change_only';
    intent = 'correct';
  }

  const secondStop = /\b(?:the\s+)?second\s+stop\b/.test(folded);
  if (/\b(?:remove|forget|drop)\b/.test(folded) || secondStop) {
    intent = 'remove';
    confidence = Math.max(confidence, 0.88);
    if (secondStop) {
      deltas.push({
        kind: 'remove_place',
        entities: [
          emptyReferencedEntity({
            surface: 'the second stop',
            resolvedHint: null,
            entityKindHint: 'stop_index',
            indexHint: 1,
          }),
        ],
        value: null,
        evidence: message,
      });
    } else if (places[0]) {
      deltas.push({
        kind: 'remove_place',
        entities: [placeEntity(places[0])],
        value: null,
        evidence: message,
      });
    }
  }

  if (/\badd\b/.test(folded) && places[0]) {
    intent = 'add';
    confidence = Math.max(confidence, 0.87);
    deltas.push({
      kind: 'add_place',
      entities: [placeEntity(places[0])],
      value: places[0],
      evidence: message,
    });
  }

  const beforeMatch = folded.match(
    /\b(?:put|place)\s+([a-z][\p{L}\s\-']+?)\s+before\s+([a-z][\p{L}\s\-']+?)(?:\s*[.!?]|$)/iu,
  );
  if (beforeMatch) {
    intent = 'reorder';
    confidence = Math.max(confidence, 0.9);
    const ordered =
      places.length >= 2
        ? places.slice(0, 2)
        : [
            titleCaseWords(beforeMatch[1]!.trim()),
            titleCaseWords(beforeMatch[2]!.trim()),
          ];
    deltas.push({
      kind: 'reorder_places',
      entities: ordered.map((p) => placeEntity(p)),
      value: ordered,
      evidence: message,
    });
  }

  const keepButChange = folded.match(
    /\bkeep\s+([a-z][\p{L}\-']{2,40})\s+but\s+change\s+([a-z][\p{L}\-']{2,40})\s+to\s+([a-z][\p{L}\-']{2,40})/iu,
  );
  const insteadOf = folded.match(
    /\b(.+?)\s+instead of\s+([a-z][\p{L}\-']{2,40})(?:\s*[.!?]|$)/iu,
  );
  const keepButChangePlaces =
    keepButChange &&
    (() => {
      const keep = titleCaseWords(keepButChange[1]!.trim());
      const from = titleCaseWords(keepButChange[2]!.trim());
      const to = titleCaseWords(keepButChange[3]!.trim());
      const known = new Set(
        [
          ...places,
          state.origin,
          state.destination,
          ...(state.destinationStops ?? []),
        ]
          .filter((p): p is string => typeof p === 'string')
          .map((p) => asciiFold(p)),
      );
      const keepKnown = known.has(asciiFold(keep));
      const fromKnown = known.has(asciiFold(from));
      // Ignore facet phrasing like "keep the dates but change the destination".
      if (!keepKnown || !fromKnown) return null;
      return { keep, from, to };
    })();

  if (keepButChangePlaces) {
    intent = 'correct';
    confidence = Math.max(confidence, 0.9);
    deltas.push({
      kind: 'preserve_facet',
      entities: [placeEntity(keepButChangePlaces.keep)],
      value: 'places',
      evidence: `keep ${keepButChangePlaces.keep}`,
    });
    deltas.push({
      kind: 'replace_place',
      entities: [placeEntity(keepButChangePlaces.from)],
      value: keepButChangePlaces.to,
      evidence: message,
    });
  } else if (
    /\b(?:leaving|departing|starting)\s+from\b/.test(folded) &&
    places.length >= 1
  ) {
    const leavingCapture = folded.match(
      /\b(?:leaving|departing|starting)\s+from\s+([a-z][\p{L}\-']{2,40})/iu,
    );
    const captured = leavingCapture?.[1]
      ? titleCaseWords(leavingCapture[1].trim())
      : null;
    const newOrigin =
      (captured &&
        places.find((p) => asciiFold(p) === asciiFold(captured))) ||
      captured ||
      places.find(
        (p) => !state.origin || asciiFold(p) !== asciiFold(state.origin),
      ) ||
      places[0]!;
    const answeringOpenSubject =
      state.openClarification?.blocking === true &&
      asciiFold(newOrigin) === asciiFold(state.openClarification.subject) &&
      !/\binstead of\b/.test(folded) &&
      !/\brather than\b/.test(folded);
    if (!answeringOpenSubject) {
      intent = 'correct';
      confidence = Math.max(confidence, 0.9);
      const oldOrigin =
        places.find(
          (p) =>
            asciiFold(p) !== asciiFold(newOrigin) &&
            state.origin &&
            asciiFold(p) === asciiFold(state.origin),
        ) ??
        state.origin ??
        (state.openClarification ? state.openClarification.subject : null);
      deltas.push({
        kind: 'replace_place',
        entities: oldOrigin
          ? [placeEntity(oldOrigin)]
          : [placeEntity(newOrigin)],
        value: newOrigin,
        evidence: message,
      });
      if (state.openClarification?.blocking) {
        clarificationStance = 'corrects_premise';
      }
    }
    // else: open clarification answer handled below as confirm_option origin
  } else if (insteadOf && places.length >= 1) {
    intent = 'correct';
    confidence = Math.max(confidence, 0.88);
    const fromRaw = titleCaseWords((insteadOf[2] ?? '').trim());
    const from =
      places.find((p) => asciiFold(p) === asciiFold(fromRaw)) ?? fromRaw;
    const to =
      places.find((p) => asciiFold(p) !== asciiFold(from)) ?? places[0]!;
    deltas.push({
      kind: 'replace_place',
      entities: [placeEntity(from)],
      value: to,
      evidence: message,
    });
  } else if (
    /\bchange\s+([a-z][\p{L}\-']{2,40})\s+to\s+([a-z][\p{L}\-']{2,40})\b/iu.test(
      folded,
    ) ||
    /\bchange\s+(?:the\s+)?destination\s+to\b/i.test(folded)
  ) {
    intent = 'correct';
    confidence = Math.max(confidence, 0.85);
    const pair = folded.match(
      /\bchange\s+([a-z][\p{L}\-']{2,40})\s+to\s+([a-z][\p{L}\-']{2,40})\b/iu,
    );
    const destOnly = folded.match(
      /\bchange\s+(?:the\s+)?destination\s+to\s+([a-z][\p{L}\-']{2,40})\b/iu,
    );
    const from = pair
      ? places.find((p) => asciiFold(p) === asciiFold(pair[1]!)) ??
        titleCaseWords(pair[1]!.trim())
      : state.destinationStops?.[0] ?? state.destination;
    const to = pair
      ? places.find((p) => asciiFold(p) === asciiFold(pair[2]!)) ??
        titleCaseWords(pair[2]!.trim())
      : places.find(
          (p) => !from || asciiFold(p) === asciiFold(destOnly?.[1] ?? ''),
        ) ??
        (destOnly?.[1] ? titleCaseWords(destOnly[1].trim()) : places[places.length - 1]!);
    deltas.push({
      kind: 'replace_place',
      entities: from ? [placeEntity(from)] : [],
      value: to,
      evidence: message,
    });
  }

  const routeMatch = message.match(
    /\bfrom\s+([\p{L}][\p{L}\-']{1,40})\s+to\s+([\p{L}][\p{L}\-']{1,40})(?:\s+then\s+([\p{L}][\p{L}\-']{1,40}))?(?:\s*,?\s*returning\s+from\s+([\p{L}][\p{L}\-']{1,40}))?/iu,
  );
  const isFullRoute =
    Boolean(routeMatch) ||
    (places.length >= 3 && /\bthen\b/.test(folded) && /\bfrom\b/.test(folded));
  if (isFullRoute) {
    intent = 'replace_route';
    clarificationStance = state.openClarification?.blocking
      ? 'supplies_new_route'
      : clarificationStance;
    confidence = Math.max(confidence, 0.92);
    const origin =
      (routeMatch?.[1]
        ? resolveCanonicalPlaceName(routeMatch[1], state)
        : null) ??
      places[0] ??
      '';
    const returnPoint = routeMatch?.[4]
      ? resolveCanonicalPlaceName(routeMatch[4], state)
      : places.length >= 4
        ? places[places.length - 1]!
        : null;
    const dests = (
      routeMatch
        ? [routeMatch[2], routeMatch[3]]
            .filter((p): p is string => typeof p === 'string' && p.length > 0)
            .map((p) => resolveCanonicalPlaceName(p, state))
        : places.slice(1)
    ).filter((p) => !returnPoint || asciiFold(p) !== asciiFold(returnPoint));
    deltas.push({
      kind: 'mention_place',
      entities: [origin, ...dests, ...(returnPoint ? [returnPoint] : [])]
        .filter(Boolean)
        .map((p) => placeEntity(p)),
      value: {
        origin,
        returnPoint,
        destinations: dests,
      },
      evidence: message,
    });
  }

  if (/\b(?:flights?|hotels?|car\s+hire|cars?)\b/.test(folded)) {
    if (intent === 'unknown') intent = 'inform';
    deltas.push({
      kind: 'set_service',
      entities: [],
      value: {
        flightsRequested: /\bflights?\b/.test(folded) ? true : undefined,
        accommodationRequested: /\bhotels?\b/.test(folded) ? true : undefined,
        carHireRequested: /\bcar\b/.test(folded) ? true : undefined,
      },
      evidence: message,
    });
    confidence = Math.max(confidence, 0.7);
    if (state.openClarification?.blocking) {
      clarificationStance = 'unrelated';
    }
  }

  // Clarification answers — skip when the utterance already supplies a full route
  // or an unrelated/correcting stance that supersedes the open question.
  if (
    state.openClarification?.blocking &&
    !isFullRoute &&
    clarificationStance !== 'corrects_premise' &&
    clarificationStance !== 'unrelated' &&
    clarificationStance !== 'supplies_new_route'
  ) {
    const open = state.openClarification;
    const subjectKey = asciiFold(open.subject);
    const trimmed = folded.replace(/[.!?]+$/g, '').trim();

    if (
      /\b(?:neither|none\s+of\s+(?:those|them)|not\s+sure)\b/.test(trimmed)
    ) {
      intent = 'reject';
      clarificationStance = 'rejects_choices';
      confidence = 0.8;
      deltas.push({
        kind: 'reject_framing',
        entities: [],
        value: null,
        evidence: message,
      });
    } else if (
      /\b(?:first\s+(?:destination|stop)|destination|first)\b/.test(trimmed) ||
      new RegExp(`\\b${subjectKey}\\s+is\\s+first\\b`).test(trimmed)
    ) {
      intent = 'clarify_answer';
      clarificationStance = 'answers';
      confidence = 0.9;
      deltas.push({
        kind: 'confirm_option',
        entities: [],
        value: 'first_destination',
        evidence: message,
      });
    } else if (
      /\b(?:origin|start(?:ing)?(?:\s+from)?|leaving\s+from|depart(?:ing)?)\b/.test(
        trimmed,
      ) &&
      !/\bfirst\b/.test(trimmed) &&
      !/\bto\b/.test(trimmed)
    ) {
      intent = 'clarify_answer';
      clarificationStance = 'answers';
      confidence = 0.9;
      deltas.push({
        kind: 'confirm_option',
        entities: [],
        value: 'origin',
        evidence: message,
      });
    } else if (
      clarificationStance === 'none' &&
      places.length === 1 &&
      asciiFold(places[0]!) === subjectKey &&
      trimmed === subjectKey
    ) {
      // Bare subject echo — genuinely ambiguous; do not force origin.
      intent = 'clarify_answer';
      clarificationStance = 'ambiguous';
      confidence = 0.45;
      ambiguityNotes.push('Bare clarification subject without role cue');
      deltas.push({
        kind: 'mention_place',
        entities: [placeEntity(places[0]!)],
        value: null,
        evidence: message,
      });
    }
  }

  // Travel-relationship / strategy family (before bare place mentions).
  const relationMeaning = resolveTravelRelationSemantics({
    message,
    folded,
    places,
    placeEntity,
  });
  const relationClaimed = new Set(
    (relationMeaning?.claimedPlaces ?? []).map((p) => asciiFold(p)),
  );
  if (relationMeaning !== null) {
    intent = intent === 'unknown' || intent === 'conversational_control'
      ? 'inform'
      : intent;
    confidence = Math.max(confidence, relationMeaning.confidence);
    ambiguityNotes.push(...relationMeaning.ambiguityNotes);
    deltas.push(...relationMeaning.deltas);
  }

  const hasPlaceRoleDelta = deltas.some(
    (d) =>
      d.kind === 'mention_place' ||
      d.kind === 'add_place' ||
      d.kind === 'replace_place' ||
      d.kind === 'remove_place' ||
      d.kind === 'reorder_places' ||
      d.kind.startsWith('relation_'),
  );

  // Multi-place travel seed without explicit origin role.
  if (
    !hasPlaceRoleDelta &&
    places.length >= 2 &&
    !state.origin &&
    (state.destinationStops?.length ?? 0) === 0 &&
    /\b(?:want to go|like to go|go to|visit|travel)\b/.test(folded) &&
    !/\bfrom\b/.test(folded)
  ) {
    intent = 'inform';
    confidence = Math.max(confidence, 0.8);
    ambiguityNotes.push('Multi-place travel seed without origin role');
    deltas.push({
      kind: 'mention_place',
      entities: places.map((p) => placeEntity(p)),
      value: { places, roleAmbiguous: true },
      evidence: message,
    });
  }

  // Single-place travel frames → explicit roleHint (not vacancy guessing).
  // Planner may only assign roles from roleHint or Dialogue-bound obligations.
  // Skip when a travel-relation or other place-role delta already owns meaning.
  if (!hasPlaceRoleDelta && places.length === 1) {
    const place = places[0]!;
    const originFrame =
      /\b(?:from|leaving from|departing from|travelling from|traveling from|flying from)\b/.test(
        folded,
      ) && !/\b(?:go(?:ing)?\s+to|to\s+)/.test(folded);
    const destinationFrame =
      /\b(?:want to go|like to go|go to|going to|visit(?:ing)?|travel(?:l?ing)?\s+to|fly(?:ing)?\s+to|head(?:ing)?\s+to)\b/.test(
        folded,
      ) || /\bto\s+[a-z]/.test(folded);

    intent = intent === 'unknown' ? 'inform' : intent;
    confidence = Math.max(confidence, 0.75);
    if (originFrame) {
      deltas.push({
        kind: 'mention_place',
        entities: [placeEntity(place)],
        value: { roleHint: 'origin' },
        evidence: message,
      });
    } else if (destinationFrame) {
      deltas.push({
        kind: 'mention_place',
        entities: [placeEntity(place)],
        value: { roleHint: 'destination' },
        evidence: message,
      });
    } else if (!relationClaimed.has(asciiFold(place))) {
      // Untyped place mention — no role ownership here.
      deltas.push({
        kind: 'mention_place',
        entities: [placeEntity(place)],
        value: null,
        evidence: message,
      });
    }
  }

  if (
    /\b(?:not|no)\b/.test(folded) &&
    /\b(?:yes|both|also)\b/.test(folded) &&
    places.length >= 1
  ) {
    confidence = Math.min(confidence, 0.35);
    ambiguityNotes.push('Contradictory polarity cues');
  }

  if (/\b(maybe|perhaps|somehow|not sure|i guess|possibly)\b/.test(folded)) {
    confidence = Math.min(confidence, 0.4);
    ambiguityNotes.push('Hedging language lowers confidence');
  }

  const hasPlaceRoleDeltaAfter = deltas.some(
    (d) =>
      d.kind === 'mention_place' ||
      d.kind === 'add_place' ||
      d.kind === 'replace_place' ||
      d.kind === 'remove_place' ||
      d.kind === 'reorder_places' ||
      d.kind.startsWith('relation_'),
  );
  if (!hasPlaceRoleDeltaAfter && places.length > 0) {
    intent = intent === 'unknown' ? 'inform' : intent;
    confidence = Math.max(confidence, 0.7);
    for (const place of places) {
      if (relationClaimed.has(asciiFold(place))) continue;
      deltas.push({
        kind: 'mention_place',
        entities: [placeEntity(place)],
        value: null,
        evidence: message,
      });
    }
  }

  // Shared temporal meaning (calendar + contextual relative) → set_date deltas.
  // Role/target binding is Dialogue + Travel Planner responsibility.
  const emittedIso = new Set<string>();
  const calendarIso = resolveCalendarDateIso(message, now);
  if (calendarIso !== null) {
    deltas.push({
      kind: 'set_date',
      entities: [],
      value: calendarIso,
      evidence: message,
    });
    emittedIso.add(calendarIso);
    intent = intent === 'unknown' ? 'inform' : intent;
    confidence = Math.max(confidence, 0.75);
  }

  const activeRequirement = deriveActiveTravelRequirement(state);
  const interpretationContext = buildInterpretationContext({
    message,
    currentState: state,
    activeRequirement,
    recentHistory: state.transcript,
    now,
  });
  const contextualTemporal = resolveContextualTemporalSemantics(
    interpretationContext,
  );
  if (contextualTemporal !== null) {
    if (
      typeof contextualTemporal.departureDate === 'string' &&
      !emittedIso.has(contextualTemporal.departureDate)
    ) {
      deltas.push({
        kind: 'set_date',
        entities: [],
        value: contextualTemporal.departureDate,
        evidence: message,
      });
      emittedIso.add(contextualTemporal.departureDate);
    }
    if (
      typeof contextualTemporal.returnDate === 'string' &&
      !emittedIso.has(contextualTemporal.returnDate)
    ) {
      deltas.push({
        kind: 'set_date',
        entities: [],
        value: contextualTemporal.returnDate,
        evidence: message,
      });
      emittedIso.add(contextualTemporal.returnDate);
    }
    if (emittedIso.size > 0 || contextualTemporal.nightCount !== null) {
      intent = intent === 'unknown' ? 'inform' : intent;
      confidence = Math.max(
        confidence,
        contextualTemporal.confidence > 0
          ? contextualTemporal.confidence
          : 0.75,
      );
    }
  }

  if (deltas.length === 0 && intent === 'unknown') {
    return emptySemanticInterpretationResult({
      intent: 'unknown',
      confidence: 0.2,
      evidenceSummary: [message],
      ambiguityNotes: ['No semantic deltas extracted'],
    });
  }

  return emptySemanticInterpretationResult({
    intent,
    deltas,
    conversationalControl,
    clarificationStance,
    confidence,
    evidenceSummary: [message],
    ambiguityNotes,
  });
}
