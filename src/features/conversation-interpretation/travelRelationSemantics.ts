/**
 * Travel-relationship semantic capability family.
 *
 * Expresses routing / transit / stopover / hub preference / avoidance /
 * comparison intent as typed deltas. Meaning only — no canonical writes.
 *
 * Uses structural cue families (preposition + place, transit lexicon,
 * stay-duration mid-route, avoidance polarity). Not a city or transcript lock.
 */

import type { ReferencedEntity } from '../conversation-architecture/clarification';
import type {
  SemanticDelta,
  TravelRelationValue,
} from '../conversation-architecture/semanticInterpretation';

export type TravelRelationMeaning = {
  deltas: SemanticDelta[];
  ambiguityNotes: string[];
  confidence: number;
  /** Place surfaces already claimed by a relation delta (suppress bare mention). */
  claimedPlaces: string[];
};

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

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Prefer a known place in the post-cue window; otherwise capture a place-shaped
 * token (letters / hyphen / apostrophe). No closed city list.
 */
function placeNearCue(
  folded: string,
  cueIndex: number,
  places: string[],
): string | null {
  if (cueIndex < 0) return null;
  const window = folded.slice(cueIndex, cueIndex + 80);
  let best: { place: string; index: number } | null = null;
  for (const place of places) {
    const needle = asciiFold(place);
    const at = window.indexOf(needle);
    if (at === -1) continue;
    if (best === null || at < best.index) {
      best = { place, index: at };
    }
  }
  if (best) return best.place;

  // Strip relation-lexicon tokens, then take the next place-shaped span.
  // Structural fillers (stay/transit/layover…) are not place names.
  let afterCue = window.trim();
  const filler =
    /^(?:via|through|rout(?:e|ed|ing)\s+through|fly(?:ing)?\s+(?:via|through)|connect(?:ing)?\s+(?:via|through|at)|avoid(?:ing)?|prefer(?:ring)?|rather|also\s+visit|add\s+(?:a\s+)?stop(?:\s+in)?|include\s+(?:a\s+)?stop(?:\s+in)?|stop\s+in|then\s+(?:go\s+to|visit)|stopover|stop\s*over|transit(?:ing)?|connection|connecting|layover|stay(?:ing)?|spend|night|nights|days?|hours?|just|only|a|an|the|in|at|for|on|with)\s+/i;
  for (let i = 0; i < 8 && filler.test(afterCue); i += 1) {
    afterCue = afterCue.replace(filler, '').trim();
  }
  const match = afterCue.match(
    /^([a-z][a-z'-]{1,40}(?:\s+[a-z][a-z'-]{1,40}){0,2})\b/,
  );
  if (!match?.[1]) return null;
  const raw = match[1].replace(/\s+(?:for|on|with|and|to)\b.*$/, '').trim();
  if (raw.length < 3) return null;
  if (
    /^(?:the|a|an|my|our|just|only|two|few|some|nights?|days?|hours?|stay|transit|layover|stopover|connection)$/.test(
      raw,
    )
  ) {
    return null;
  }
  return titleCaseWords(raw);
}

function entityFor(
  place: string,
  placeEntity: (name: string) => ReferencedEntity,
): ReferencedEntity {
  return placeEntity(place);
}

/**
 * Resolve travel-relation meaning from folded message + known places in order.
 */
export function resolveTravelRelationSemantics(input: {
  message: string;
  folded: string;
  places: string[];
  placeEntity: (name: string) => ReferencedEntity;
}): TravelRelationMeaning | null {
  const { message, folded, places, placeEntity } = input;
  // Places may be unresolved against the curated set — relation cues can still
  // capture place-shaped tokens. Compare/optimise may have no place at all.
  const mayHaveRelation =
    places.length > 0 ||
    /\b(?:via|through|rout(?:e|ed|ing)\s+through|transit|stopover|stop\s*over|avoid|prefer|also\s+visit|add\s+(?:a\s+)?stop|cheapest|fastest|compare|optimis|optimiz)\b/.test(
      folded,
    );
  if (!mayHaveRelation) return null;

  const deltas: SemanticDelta[] = [];
  const ambiguityNotes: string[] = [];
  const claimed = new Set<string>();
  let confidence = 0;

  const hasStayDuration =
    /\b(?:stop\s*over|stopover|stay(?:ing)?|spend|night|nights|days?)\b/.test(
      folded,
    );
  const hasTransitLexicon =
    /\b(?:transit(?:ing)?|connection|connecting|change\s+(?:planes?|flights?)|layover)\b/.test(
      folded,
    );
  const hasThroughFrame =
    /\b(?:via|through|rout(?:e|ed|ing)\s+through|fly(?:ing)?\s+(?:via|through)|connect(?:ing)?\s+(?:via|through|at))\b/.test(
      folded,
    );
  const hasAvoid =
    /\b(?:avoid|avoiding|do\s+not\s+(?:want\s+to\s+)?(?:go|fly|travel)\s+via|don'?t\s+(?:want\s+to\s+)?(?:go|fly|travel)\s+(?:via|through)|not\s+via|skip)\b/.test(
      folded,
    );
  const hasPreferHub =
    /\b(?:prefer(?:ring)?|rather)\b/.test(folded) &&
    /\b(?:via|through|hub|connect(?:ing)?)\b/.test(folded);
  const hasItineraryStop =
    /\b(?:also\s+visit|add\s+(?:a\s+)?stop|include\s+(?:a\s+)?stop|stop\s+in|then\s+(?:go\s+to|visit))\b/.test(
      folded,
    );
  const hasCompareOptimise =
    /\b(?:cheapest|fastest|best\s+(?:option|route|fare)|compare|comparison|optimis(?:e|ation)|optimiz(?:e|ation)|fare\s+optim)\b/.test(
      folded,
    );

  const throughCue = folded.search(
    /\b(?:via|through|rout(?:e|ed|ing)\s+through|fly(?:ing)?\s+(?:via|through)|connect(?:ing)?\s+(?:via|through|at))\b/,
  );
  const avoidCue = folded.search(
    /\b(?:avoid|avoiding|not\s+via|skip|do\s+not\s+(?:want\s+to\s+)?(?:go|fly|travel)\s+(?:via|through)|don'?t\s+(?:want\s+to\s+)?(?:go|fly|travel)\s+(?:via|through))\b/,
  );
  const stopCue = folded.search(
    /\b(?:also\s+visit|add\s+(?:a\s+)?stop|include\s+(?:a\s+)?stop|stop\s+in|then\s+(?:go\s+to|visit)|stopover|stop\s*over)\b/,
  );
  const preferCue = folded.search(/\b(?:prefer(?:ring)?|rather)\b/);

  if (hasAvoid) {
    const place =
      placeNearCue(folded, avoidCue, places) ?? places[places.length - 1] ?? null;
    if (place) {
      claimed.add(asciiFold(place));
      const value: TravelRelationValue = {
        relationFamily: 'avoid',
      };
      deltas.push({
        kind: 'relation_avoid_place',
        entities: [entityFor(place, placeEntity)],
        value,
        evidence: message,
      });
      confidence = Math.max(confidence, 0.82);
    }
  }

  if (hasPreferHub && !hasAvoid) {
    const place =
      placeNearCue(folded, preferCue >= 0 ? preferCue : throughCue, places) ??
      places[places.length - 1] ??
      null;
    if (place) {
      claimed.add(asciiFold(place));
      deltas.push({
        kind: 'relation_prefer_hub',
        entities: [entityFor(place, placeEntity)],
        value: { relationFamily: 'prefer_hub' } satisfies TravelRelationValue,
        evidence: message,
      });
      confidence = Math.max(confidence, 0.8);
    }
  }

  if (hasItineraryStop && !hasAvoid) {
    const place =
      placeNearCue(folded, stopCue, places) ?? places[places.length - 1] ?? null;
    if (place && !claimed.has(asciiFold(place))) {
      claimed.add(asciiFold(place));
      deltas.push({
        kind: 'relation_itinerary_stop',
        entities: [entityFor(place, placeEntity)],
        value: {
          relationFamily: 'itinerary_stop',
        } satisfies TravelRelationValue,
        evidence: message,
      });
      confidence = Math.max(confidence, 0.8);
    }
  }

  const transitCue = folded.search(
    /\b(?:transit(?:ing)?|connection|connecting|change\s+(?:planes?|flights?)|layover)\b/,
  );
  const relationPlaceCue = Math.max(
    throughCue,
    stopCue,
    transitCue,
    preferCue,
  );

  // Through / via frames: distinguish transit, stopover, or unresolved.
  if (hasThroughFrame && !hasAvoid && !hasPreferHub) {
    const place =
      placeNearCue(folded, throughCue, places) ??
      places[places.length - 1] ??
      null;
    if (place && !claimed.has(asciiFold(place))) {
      claimed.add(asciiFold(place));
      if (hasTransitLexicon && !hasStayDuration) {
        deltas.push({
          kind: 'relation_transit',
          entities: [entityFor(place, placeEntity)],
          value: { relationFamily: 'transit' } satisfies TravelRelationValue,
          evidence: message,
        });
        confidence = Math.max(confidence, 0.84);
      } else if (hasStayDuration && !hasTransitLexicon) {
        deltas.push({
          kind: 'relation_stopover',
          entities: [entityFor(place, placeEntity)],
          value: { relationFamily: 'stopover' } satisfies TravelRelationValue,
          evidence: message,
        });
        confidence = Math.max(confidence, 0.84);
      } else if (hasTransitLexicon && hasStayDuration) {
        ambiguityNotes.push(
          'Transit lexicon and stay-duration cues coexist — routing role unresolved',
        );
        deltas.push({
          kind: 'relation_routing_ambiguous',
          entities: [entityFor(place, placeEntity)],
          value: {
            relationFamily: 'routing_or_stopover_unresolved',
            unresolvedBetween: ['transit', 'stopover'],
          } satisfies TravelRelationValue,
          evidence: message,
        });
        confidence = Math.max(confidence, 0.7);
      } else {
        // Bare through/via without stay or transit lexicon — unresolved.
        ambiguityNotes.push(
          'Through-route cue without transit or stopover markers — unresolved',
        );
        deltas.push({
          kind: 'relation_routing_ambiguous',
          entities: [entityFor(place, placeEntity)],
          value: {
            relationFamily: 'routing_or_stopover_unresolved',
            unresolvedBetween: ['transit', 'stopover', 'route_via'],
          } satisfies TravelRelationValue,
          evidence: message,
        });
        confidence = Math.max(confidence, 0.78);
      }
    }
  } else if (
    hasTransitLexicon &&
    hasStayDuration &&
    !hasThroughFrame &&
    !hasAvoid
  ) {
    const place =
      placeNearCue(folded, relationPlaceCue, places) ??
      places[places.length - 1] ??
      null;
    if (place && !claimed.has(asciiFold(place))) {
      claimed.add(asciiFold(place));
      ambiguityNotes.push(
        'Transit lexicon and stay-duration cues coexist — routing role unresolved',
      );
      deltas.push({
        kind: 'relation_routing_ambiguous',
        entities: [entityFor(place, placeEntity)],
        value: {
          relationFamily: 'routing_or_stopover_unresolved',
          unresolvedBetween: ['transit', 'stopover'],
        } satisfies TravelRelationValue,
        evidence: message,
      });
      confidence = Math.max(confidence, 0.7);
    }
  } else if (hasTransitLexicon && !hasThroughFrame && !hasAvoid) {
    const place =
      placeNearCue(folded, Math.max(transitCue, relationPlaceCue), places) ??
      places[places.length - 1] ??
      null;
    if (place && !claimed.has(asciiFold(place))) {
      claimed.add(asciiFold(place));
      deltas.push({
        kind: 'relation_transit',
        entities: [entityFor(place, placeEntity)],
        value: { relationFamily: 'transit' } satisfies TravelRelationValue,
        evidence: message,
      });
      confidence = Math.max(confidence, 0.8);
    }
  } else if (hasStayDuration && /\bstopover|stop\s*over\b/.test(folded) && !hasAvoid) {
    const place =
      placeNearCue(folded, Math.max(stopCue, 0), places) ??
      places[places.length - 1] ??
      null;
    if (place && !claimed.has(asciiFold(place))) {
      claimed.add(asciiFold(place));
      deltas.push({
        kind: 'relation_stopover',
        entities: [entityFor(place, placeEntity)],
        value: { relationFamily: 'stopover' } satisfies TravelRelationValue,
        evidence: message,
      });
      confidence = Math.max(confidence, 0.8);
    }
  }

  if (hasCompareOptimise) {
    let axis: TravelRelationValue['optimisationAxis'] = 'unspecified';
    if (/\bcheapest|fare\b/.test(folded)) axis = 'cheapest';
    else if (/\bfastest\b/.test(folded)) axis = 'fastest';
    else if (/\bconvenient|best\b/.test(folded)) axis = 'convenient';
    deltas.push({
      kind: 'relation_compare_optimise',
      entities: [],
      value: {
        relationFamily: 'compare_optimise',
        optimisationAxis: axis,
      } satisfies TravelRelationValue,
      evidence: message,
    });
    confidence = Math.max(confidence, 0.75);
  }

  // Explicit route_via when speaker marks preferred routing without ambiguity markers.
  if (
    deltas.some((d) => d.kind === 'relation_routing_ambiguous') === false &&
    hasThroughFrame &&
    /\b(?:need|must|should|prefer)\b/.test(folded) &&
    !hasStayDuration &&
    !hasTransitLexicon &&
    !hasAvoid
  ) {
    // Keep unresolved reading — preferred routing still ambiguous transit vs stopover.
    // Already emitted relation_routing_ambiguous above when hasThroughFrame.
  }

  if (deltas.length === 0) return null;

  return {
    deltas,
    ambiguityNotes,
    confidence,
    claimedPlaces: [...claimed],
  };
}
