/**
 * Phase 2 — pure Intent Planner.
 *
 * SemanticInterpretation + canonical state snapshot → PlannerResult.
 * Does not mutate state, choose acts, or activate in production.
 */

import type { ConversationCoreState, OpenClarification } from '../conversation-core';
import type {
  CanonicalOperationKind,
  PlannerResult,
  ProposedOperation,
  ResolvedEntityRole,
} from './canonicalOperations';
import { plannerResultSchema } from './canonicalOperations';
import type { ReferencedEntity } from './clarification';
import { clarificationFromOpenClarification } from './clarification';
import type {
  ClarificationStance,
  SemanticDelta,
  SemanticInterpretation,
} from './semanticInterpretation';

export type PlanCanonicalOperationsInput = {
  semantic: SemanticInterpretation;
  currentState: ConversationCoreState;
};

type PlaceMatch = {
  role: ResolvedEntityRole;
  id: string | number;
  source: string;
};

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

function placeKey(value: string): string {
  return asciiFold(value).trim();
}

function asPlaceString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPlaceList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const places = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return places.length > 0 ? places : null;
}

function op(
  kind: CanonicalOperationKind,
  input: {
    target: string;
    value: unknown;
    role: ResolvedEntityRole;
    id: string | number | null;
    dependsOnClarification: boolean;
    confidence: number;
    reasoningTrace: string[];
  },
): ProposedOperation {
  return {
    op: kind,
    target: input.target,
    value: input.value,
    resolvedEntity: { role: input.role, id: input.id },
    dependsOnClarification: input.dependsOnClarification,
    confidence: input.confidence,
    reasoningTrace: input.reasoningTrace,
  };
}

function noStateChange(
  reason: string,
  confidence: number,
  dependsOnClarification = false,
): ProposedOperation {
  return op('no_state_change', {
    target: 'none',
    value: null,
    role: 'unknown',
    id: null,
    dependsOnClarification,
    confidence,
    reasoningTrace: [reason],
  });
}

/**
 * Resolve a place reference against canonical state and active clarification.
 * Returns all matches — caller decides uniqueness. No city-name catalogue.
 */
export function resolvePlaceReferences(
  entity: ReferencedEntity,
  state: ConversationCoreState,
  clarification: OpenClarification | null,
): PlaceMatch[] {
  const matches: PlaceMatch[] = [];
  const stops = state.destinationStops ?? [];

  if (entity.indexHint !== null && entity.indexHint !== undefined) {
    const index = entity.indexHint;
    if (index >= 0 && index < stops.length) {
      matches.push({
        role: 'stop',
        id: index,
        source: `stop_index:${index}=${stops[index]}`,
      });
    }
    return matches;
  }

  const needle =
    entity.resolvedHint && entity.resolvedHint.trim().length > 0
      ? placeKey(entity.resolvedHint)
      : entity.surface
        ? placeKey(entity.surface)
        : '';

  if (needle.length === 0 && entity.deixis) {
    // Deixis without a resolved hint cannot be bound by the planner alone.
    return matches;
  }

  if (needle.length === 0) return matches;

  if (state.origin && placeKey(state.origin) === needle) {
    matches.push({
      role: 'origin',
      id: state.origin,
      source: 'canonical.origin',
    });
  }

  if (state.destination && placeKey(state.destination) === needle) {
    matches.push({
      role: 'destination',
      id: state.destination,
      source: 'canonical.destination',
    });
  }

  for (let i = 0; i < stops.length; i += 1) {
    const stop = stops[i];
    if (stop && placeKey(stop) === needle) {
      matches.push({
        role: 'stop',
        id: i,
        source: `canonical.destinationStops[${i}]`,
      });
    }
  }

  if (clarification) {
    if (placeKey(clarification.subject) === needle) {
      matches.push({
        role: 'clarification_subject',
        id: clarification.subject,
        source: 'openClarification.subject',
      });
    }
    for (const option of clarification.options) {
      if (placeKey(option) === needle) {
        matches.push({
          role: 'clarification_option',
          id: option,
          source: 'openClarification.options',
        });
      }
    }
    for (const place of clarification.placesInOrder ?? []) {
      if (placeKey(place) === needle) {
        // Candidate journey place — not yet a committed role.
        if (
          !matches.some(
            (m) =>
              m.role === 'clarification_subject' &&
              placeKey(String(m.id)) === needle,
          )
        ) {
          matches.push({
            role: 'clarification_subject',
            id: place,
            source: 'openClarification.placesInOrder',
          });
        }
      }
    }
  }

  return matches;
}

function uniqueCommittedPlaceMatch(
  matches: PlaceMatch[],
): PlaceMatch | 'ambiguous' | null {
  const committed = matches.filter(
    (m) =>
      m.role === 'origin' ||
      m.role === 'destination' ||
      m.role === 'stop' ||
      m.role === 'return_point',
  );
  if (committed.length === 0) return null;
  if (committed.length > 1) {
    // destination often mirrors stops[0] — treat as one logical target.
    const stopAndDest =
      committed.length === 2 &&
      committed.some((m) => m.role === 'destination') &&
      committed.some((m) => m.role === 'stop' && m.id === 0);
    if (stopAndDest) {
      return committed.find((m) => m.role === 'stop') ?? committed[0]!;
    }
    return 'ambiguous';
  }
  return committed[0] ?? null;
}

function planPreserveFacet(
  delta: SemanticDelta,
  confidence: number,
): ProposedOperation {
  const facet =
    typeof delta.value === 'string' ? asciiFold(delta.value) : 'places';
  if (facet.includes('date')) {
    return op('preserve_dates', {
      target: 'dates',
      value: true,
      role: 'unknown',
      id: null,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [`preserve_facet dates from evidence: ${delta.evidence}`],
    });
  }
  if (facet.includes('travell') || facet.includes('passenger')) {
    return op('preserve_travellers', {
      target: 'travellers',
      value: true,
      role: 'unknown',
      id: null,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [
        `preserve_facet travellers from evidence: ${delta.evidence}`,
      ],
    });
  }
  if (facet.includes('prefer')) {
    return op('preserve_preferences', {
      target: 'preferences',
      value: true,
      role: 'unknown',
      id: null,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [
        `preserve_facet preferences from evidence: ${delta.evidence}`,
      ],
    });
  }
  return op('preserve_places', {
    target: 'places',
    value: delta.entities.map((e) => e.resolvedHint ?? e.surface),
    role: 'unknown',
    id: null,
    dependsOnClarification: false,
    confidence,
    reasoningTrace: [`preserve_facet places from evidence: ${delta.evidence}`],
  });
}

function planClarificationStance(
  stance: ClarificationStance,
  semantic: SemanticInterpretation,
  clarification: OpenClarification | null,
  confidence: number,
): ProposedOperation[] {
  if (!clarification || !clarification.blocking) {
    if (
      stance !== 'none' &&
      stance !== 'unrelated' &&
      stance !== 'ambiguous'
    ) {
      return [
        noStateChange(
          `Clarification stance ${stance} but no blocking clarification on state`,
          confidence,
        ),
      ];
    }
    return [];
  }

  const depends = true;
  const clarId = clarification.id;

  switch (stance) {
    case 'answers': {
      const confirm = semantic.deltas.find((d) => d.kind === 'confirm_option');
      const option =
        asPlaceString(confirm?.value) ??
        (typeof confirm?.entities[0]?.resolvedHint === 'string'
          ? confirm.entities[0]?.resolvedHint
          : null) ??
        (clarification.options.length === 1 ? clarification.options[0]! : null);

      if (!option || !clarification.options.includes(option)) {
        return [
          op('narrow_clarification', {
            target: 'openClarification',
            value: {
              parentClarificationId: clarId,
              reason: 'answer without unambiguous option',
            },
            role: 'clarification_subject',
            id: clarification.subject,
            dependsOnClarification: depends,
            confidence,
            reasoningTrace: [
              'Stance answers but selected option not resolved — propose narrow, not silent role commit',
            ],
          }),
        ];
      }

      const ops: ProposedOperation[] = [
        op('confirm_clarification', {
          target: 'openClarification',
          value: option,
          role: 'clarification_option',
          id: option,
          dependsOnClarification: depends,
          confidence,
          reasoningTrace: [
            `Confirm clarification ${clarId} option=${option}`,
          ],
        }),
      ];

      if (option === 'origin') {
        const rest = (clarification.placesInOrder ?? []).filter(
          (p) => placeKey(p) !== placeKey(clarification.subject),
        );
        ops.push(
          op(clarification.subject ? 'set_origin' : 'no_state_change', {
            target: 'origin',
            value: clarification.subject,
            role: 'origin',
            id: clarification.subject,
            dependsOnClarification: depends,
            confidence,
            reasoningTrace: [
              'Option origin → propose set_origin from clarification subject',
            ],
          }),
        );
        if (rest.length > 0) {
          ops.push(
            op('set_destinations', {
              target: 'destinationStops',
              value: rest,
              role: 'destination',
              id: rest[0] ?? null,
              dependsOnClarification: depends,
              confidence,
              reasoningTrace: [
                'Remaining clarification places become destination stops',
              ],
            }),
          );
          if (rest.length >= 2) {
            ops.push(
              op('set_trip_structure', {
                target: 'tripStructure',
                value: 'multi_city',
                role: 'unknown',
                id: null,
                dependsOnClarification: depends,
                confidence,
                reasoningTrace: ['≥2 remaining stops → multi_city'],
              }),
            );
          }
        }
      } else if (option === 'first_destination') {
        const stops =
          clarification.placesInOrder && clarification.placesInOrder.length > 0
            ? clarification.placesInOrder
            : [clarification.subject];
        ops.push(
          op('set_destinations', {
            target: 'destinationStops',
            value: stops,
            role: 'destination',
            id: stops[0] ?? null,
            dependsOnClarification: depends,
            confidence,
            reasoningTrace: [
              'Option first_destination → propose set_destinations from placesInOrder',
            ],
          }),
        );
        if (stops.length >= 2) {
          ops.push(
            op('set_trip_structure', {
              target: 'tripStructure',
              value: 'multi_city',
              role: 'unknown',
              id: null,
              dependsOnClarification: depends,
              confidence,
              reasoningTrace: ['≥2 stops → multi_city'],
            }),
          );
        }
      }
      return ops;
    }
    case 'corrects_premise':
    case 'replaces_facts':
    case 'supplies_new_route':
      return [
        op('supersede_clarification', {
          target: 'openClarification',
          value: { id: clarId, stance },
          role: 'clarification_subject',
          id: clarification.subject,
          dependsOnClarification: depends,
          confidence,
          reasoningTrace: [
            `Stance ${stance} supersedes clarification ${clarId}; place ops follow from deltas`,
          ],
        }),
      ];
    case 'rejects_choices':
      return [
        op('reject_clarification', {
          target: 'openClarification',
          value: { id: clarId },
          role: 'clarification_subject',
          id: clarification.subject,
          dependsOnClarification: depends,
          confidence,
          reasoningTrace: [`Reject clarification ${clarId} without replacement`],
        }),
      ];
    case 'narrows':
    case 'ambiguous':
      return [
        op('narrow_clarification', {
          target: 'openClarification',
          value: {
            parentClarificationId: clarId,
            subject: clarification.subject,
          },
          role: 'clarification_subject',
          id: clarification.subject,
          dependsOnClarification: depends,
          confidence,
          reasoningTrace: [
            `Stance ${stance}: do not commit role; propose narrower clarification`,
          ],
        }),
      ];
    case 'unrelated':
      return [
        noStateChange(
          `Unrelated to clarification ${clarId} — keep clarification; no place commit from stance`,
          confidence,
          true,
        ),
      ];
    default:
      return [];
  }
}

function planMentionPlace(
  delta: SemanticDelta,
  state: ConversationCoreState,
  clarification: OpenClarification | null,
  stance: ClarificationStance,
  confidence: number,
): ProposedOperation[] {
  const entity = delta.entities[0];
  const place =
    (entity ? entity.resolvedHint ?? entity.surface : null) ||
    asPlaceString(delta.value);

  // Blocking place-role clarification: bare place echo must not force origin.
  if (
    clarification?.blocking &&
    clarification.type === 'place_role' &&
    (stance === 'ambiguous' ||
      stance === 'none' ||
      stance === 'narrows' ||
      stance === 'unrelated')
  ) {
    const matches = entity
      ? resolvePlaceReferences(entity, state, clarification)
      : [];
    const isSubjectEcho =
      place !== null &&
      placeKey(place) === placeKey(clarification.subject);

    if (isSubjectEcho || matches.some((m) => m.role === 'clarification_subject')) {
      return [
        op('narrow_clarification', {
          target: 'openClarification',
          value: {
            parentClarificationId: clarification.id,
            subject: clarification.subject,
            reason: 'bare_or_ambiguous_subject_mention',
          },
          role: 'clarification_subject',
          id: clarification.subject,
          dependsOnClarification: true,
          confidence,
          reasoningTrace: [
            'Bare/ambiguous mention of clarification subject — not forcing origin',
            `evidence: ${delta.evidence}`,
          ],
        }),
      ];
    }
  }

  if (stance === 'answers') {
    // Handled by clarification stance planner when confirm_option present.
    return [
      noStateChange(
        'mention_place under answers without confirm_option — no silent role commit',
        confidence,
        true,
      ),
    ];
  }

  if (!place) {
    return [
      noStateChange(
        'mention_place with unresolved entity — no operation',
        confidence,
      ),
    ];
  }

  // No blocking clarification: propose set based on empty slots (goal fill, not ladder).
  if (state.destination === null && (state.destinationStops?.length ?? 0) === 0) {
    return [
      op('set_destinations', {
        target: 'destinationStops',
        value: [place],
        role: 'destination',
        id: place,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: [
          'No destination on state — propose set_destinations with mentioned place',
        ],
      }),
    ];
  }

  if (state.origin === null) {
    return [
      op('set_origin', {
        target: 'origin',
        value: place,
        role: 'origin',
        id: place,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: [
          'Destination present, origin missing — propose set_origin',
        ],
      }),
    ];
  }

  return [
    op('add_destination', {
      target: 'destinationStops',
      value: place,
      role: 'stop',
      id: place,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [
        'Origin and destination present — propose add_destination',
      ],
    }),
  ];
}

function planRemovePlace(
  delta: SemanticDelta,
  state: ConversationCoreState,
  clarification: OpenClarification | null,
  confidence: number,
): ProposedOperation[] {
  const entity = delta.entities[0];
  if (!entity) {
    return [noStateChange('remove_place missing entity', confidence)];
  }

  if (entity.deixis && !entity.resolvedHint && !entity.surface) {
    return [
      noStateChange(
        `remove_place deixis ${entity.deixis} unresolved — not guessing`,
        confidence,
      ),
    ];
  }

  const matches = resolvePlaceReferences(entity, state, clarification);
  const committed = uniqueCommittedPlaceMatch(matches);

  if (committed === 'ambiguous') {
    return [
      noStateChange(
        `remove_place reference ambiguous across roles: ${matches.map((m) => m.source).join(', ')}`,
        confidence,
      ),
    ];
  }

  if (committed === null) {
    return [
      noStateChange(
        `remove_place reference unresolved against canonical state (surface=${entity.surface})`,
        confidence,
      ),
    ];
  }

  if (committed.role === 'origin') {
    return [
      op('clear_origin', {
        target: 'origin',
        value: null,
        role: 'origin',
        id: committed.id,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: [
          `Resolved remove_place to origin via ${committed.source}`,
        ],
      }),
    ];
  }

  if (committed.role === 'return_point') {
    return [
      op('clear_return_point', {
        target: 'returnPoint',
        value: null,
        role: 'return_point',
        id: committed.id,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: [
          `Resolved remove_place to return_point via ${committed.source}`,
        ],
      }),
    ];
  }

  // destination or stop
  const stopName =
    committed.role === 'stop' && typeof committed.id === 'number'
      ? state.destinationStops?.[committed.id] ?? String(committed.id)
      : String(committed.id);

  return [
    op('remove_destination', {
      target: 'destinationStops',
      value: stopName,
      role: committed.role === 'stop' ? 'stop' : 'destination',
      id: committed.id,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [
        `Resolved remove_place to ${committed.role} via ${committed.source}`,
      ],
    }),
  ];
}

function planReplacePlace(
  delta: SemanticDelta,
  state: ConversationCoreState,
  clarification: OpenClarification | null,
  confidence: number,
  stance: ClarificationStance,
): ProposedOperation[] {
  const entity = delta.entities[0];
  const replacement =
    asPlaceString(delta.value) ??
    (delta.entities[1]
      ? delta.entities[1].resolvedHint ?? delta.entities[1].surface
      : null);

  if (!replacement) {
    return [noStateChange('replace_place missing replacement value', confidence)];
  }

  const ops: ProposedOperation[] = [];
  if (
    clarification?.blocking &&
    (stance === 'corrects_premise' ||
      stance === 'replaces_facts' ||
      stance === 'supplies_new_route')
  ) {
    // supersede emitted by stance handler
  }

  if (!entity) {
    // Replace primary destination when no explicit old entity.
    if (state.destination || (state.destinationStops?.length ?? 0) > 0) {
      return [
        op('replace_destination', {
          target: 'destinationStops',
          value: { from: state.destinationStops?.[0] ?? state.destination, to: replacement },
          role: 'destination',
          id: replacement,
          dependsOnClarification: false,
          confidence,
          reasoningTrace: [
            'replace_place without old entity — propose replace primary destination',
          ],
        }),
      ];
    }
    return [
      op('set_destinations', {
        target: 'destinationStops',
        value: [replacement],
        role: 'destination',
        id: replacement,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['No destination on state — propose set_destinations'],
      }),
    ];
  }

  if (entity.deixis && !entity.resolvedHint && entity.surface === '') {
    return [
      noStateChange(
        `replace_place deixis ${entity.deixis} unresolved — not guessing`,
        confidence,
      ),
    ];
  }

  const matches = resolvePlaceReferences(entity, state, clarification);
  const committed = uniqueCommittedPlaceMatch(matches);

  if (committed === 'ambiguous') {
    return [
      noStateChange(
        `replace_place reference ambiguous: ${matches.map((m) => m.source).join(', ')}`,
        confidence,
      ),
    ];
  }

  if (committed === null) {
    // Deictic / “it” with no bind → ambiguous
    if (entity.deixis) {
      return [
        noStateChange(
          `replace_place deixis unresolved (deixis=${entity.deixis})`,
          confidence,
        ),
      ];
    }
    return [
      noStateChange(
        `replace_place old place unresolved (surface=${entity.surface})`,
        confidence,
      ),
    ];
  }

  if (committed.role === 'origin') {
    ops.push(
      op('replace_origin', {
        target: 'origin',
        value: replacement,
        role: 'origin',
        id: replacement,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: [
          `Resolved replace target to origin via ${committed.source}`,
        ],
      }),
    );
    return ops;
  }

  const fromName =
    committed.role === 'stop' && typeof committed.id === 'number'
      ? state.destinationStops?.[committed.id] ?? String(committed.id)
      : String(committed.id);

  ops.push(
    op('replace_destination', {
      target: 'destinationStops',
      value: { from: fromName, to: replacement },
      role: 'stop',
      id: committed.id,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [
        `Resolved replace target to ${committed.role} via ${committed.source}`,
      ],
    }),
  );
  return ops;
}

function planAddPlace(
  delta: SemanticDelta,
  confidence: number,
): ProposedOperation[] {
  const place =
    asPlaceString(delta.value) ??
    (delta.entities[0]
      ? delta.entities[0].resolvedHint ?? delta.entities[0].surface
      : null);
  if (!place) {
    return [noStateChange('add_place missing place', confidence)];
  }
  return [
    op('add_destination', {
      target: 'destinationStops',
      value: place,
      role: 'stop',
      id: place,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [`add_place → add_destination ${place}`],
    }),
  ];
}

function planReorderPlaces(
  delta: SemanticDelta,
  state: ConversationCoreState,
  confidence: number,
): ProposedOperation[] {
  const ordered =
    asPlaceList(delta.value) ??
    delta.entities.map((e) => e.resolvedHint ?? e.surface).filter(Boolean);

  if (ordered.length < 2) {
    return [
      noStateChange(
        'reorder_places requires ≥2 ordered places in value/entities',
        confidence,
      ),
    ];
  }

  const current = state.destinationStops ?? [];
  if (current.length >= 2) {
    const currentKeys = new Set(current.map(placeKey));
    const allKnown = ordered.every((p) => currentKeys.has(placeKey(p)));
    if (!allKnown) {
      return [
        noStateChange(
          'reorder_places references a place not in current destinationStops — unresolved',
          confidence,
        ),
      ];
    }
  }

  const ops: ProposedOperation[] = [
    op('reorder_destinations', {
      target: 'destinationStops',
      value: ordered,
      role: 'stop',
      id: ordered[0] ?? null,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [
        `reorder_destinations → [${ordered.join(', ')}]`,
      ],
    }),
  ];
  if (ordered.length >= 2) {
    ops.push(
      op('set_trip_structure', {
        target: 'tripStructure',
        value: 'multi_city',
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['Reorder of ≥2 stops implies multi_city'],
      }),
    );
  }
  return ops;
}

function planRouteReplacement(
  semantic: SemanticInterpretation,
  confidence: number,
): ProposedOperation[] {
  const places: string[] = [];
  for (const delta of semantic.deltas) {
    if (
      delta.kind === 'mention_place' ||
      delta.kind === 'add_place' ||
      delta.kind === 'replace_place'
    ) {
      for (const entity of delta.entities) {
        const name = entity.resolvedHint ?? entity.surface;
        if (name && !places.some((p) => placeKey(p) === placeKey(name))) {
          places.push(name);
        }
      }
      const valuePlace = asPlaceString(delta.value);
      if (valuePlace && !places.some((p) => placeKey(p) === placeKey(valuePlace))) {
        places.push(valuePlace);
      }
    }
    if (delta.kind === 'reorder_places') {
      const list = asPlaceList(delta.value);
      if (list) {
        for (const name of list) {
          if (!places.some((p) => placeKey(p) === placeKey(name))) {
            places.push(name);
          }
        }
      }
    }
  }

  // Convention in fixtures: first entity with entityKindHint place under replace_route
  // may mark return via value { returnPoint: X } on a delta.
  let returnPoint: string | null = null;
  let origin: string | null = null;
  for (const delta of semantic.deltas) {
    if (
      delta.value &&
      typeof delta.value === 'object' &&
      delta.value !== null &&
      'returnPoint' in delta.value
    ) {
      returnPoint = asPlaceString(
        (delta.value as { returnPoint: unknown }).returnPoint,
      );
    }
    if (
      delta.value &&
      typeof delta.value === 'object' &&
      delta.value !== null &&
      'origin' in delta.value
    ) {
      origin = asPlaceString((delta.value as { origin: unknown }).origin);
    }
  }

  if (places.length === 0 && !origin) {
    return [
      noStateChange('replace_route without resolvable places', confidence),
    ];
  }

  const ops: ProposedOperation[] = [];
  const routeOrigin = origin ?? places[0] ?? null;
  const destinations =
    origin !== null ? places : places.length > 1 ? places.slice(1) : places;

  if (routeOrigin) {
    ops.push(
      op('set_origin', {
        target: 'origin',
        value: routeOrigin,
        role: 'origin',
        id: routeOrigin,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['replace_route → set_origin'],
      }),
    );
  }
  if (destinations.length > 0) {
    ops.push(
      op('set_destinations', {
        target: 'destinationStops',
        value: destinations,
        role: 'destination',
        id: destinations[0] ?? null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['replace_route → set_destinations'],
      }),
    );
  }
  if (destinations.length >= 2) {
    ops.push(
      op('set_trip_structure', {
        target: 'tripStructure',
        value: 'multi_city',
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['replace_route multi-stop → multi_city'],
      }),
    );
  }
  if (returnPoint) {
    ops.push(
      op('set_return_point', {
        target: 'returnPoint',
        value: returnPoint,
        role: 'return_point',
        id: returnPoint,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['replace_route → set_return_point'],
      }),
    );
  }
  return ops;
}

function planDuration(
  delta: SemanticDelta,
  state: ConversationCoreState,
  clarification: OpenClarification | null,
  confidence: number,
): ProposedOperation[] {
  const entity = delta.entities[0];
  const nights =
    typeof delta.value === 'number'
      ? delta.value
      : typeof delta.value === 'object' &&
          delta.value !== null &&
          'nights' in delta.value
        ? Number((delta.value as { nights: unknown }).nights)
        : null;

  if (nights === null || Number.isNaN(nights)) {
    return [noStateChange('set_duration_on_place missing nights value', confidence)];
  }

  if (!entity) {
    return [
      noStateChange('set_duration_on_place missing place entity', confidence),
    ];
  }

  const matches = resolvePlaceReferences(entity, state, clarification);
  const committed = uniqueCommittedPlaceMatch(matches);
  if (committed === 'ambiguous') {
    return [
      noStateChange(
        'set_duration_on_place place reference ambiguous',
        confidence,
      ),
    ];
  }
  if (committed === null) {
    return [
      noStateChange(
        'set_duration_on_place place unresolved against state',
        confidence,
      ),
    ];
  }

  return [
    op('set_leg_duration', {
      target: 'tripLegs',
      value: { placeId: committed.id, nights },
      role: committed.role,
      id: committed.id,
      dependsOnClarification: false,
      confidence,
      reasoningTrace: [
        `set_leg_duration nights=${nights} on ${committed.source}`,
      ],
    }),
  ];
}

/**
 * Pure Intent Planner — proposes canonical operations; never writes state.
 */
export function planCanonicalOperations(
  input: PlanCanonicalOperationsInput,
): PlannerResult {
  const { semantic, currentState } = input;
  const clarification = currentState.openClarification;
  const confidence = semantic.confidence;
  const reasoningTrace: string[] = [
    'Phase 2 pure Intent Planner',
    `intent=${semantic.intent}`,
    `clarificationStance=${semantic.clarificationStance}`,
    `conversationalControl=${semantic.conversationalControl}`,
    clarification
      ? `blockingClarification=${clarification.id}`
      : 'blockingClarification=none',
  ];

  // Project clarification for diagnostic parity (no mutation).
  void clarificationFromOpenClarification(clarification);

  const operations: ProposedOperation[] = [];

  // Conversational controls first.
  if (
    semantic.conversationalControl === 'reset' ||
    semantic.intent === 'reset' ||
    semantic.deltas.some((d) => d.kind === 'control_reset')
  ) {
    operations.push(
      op('reset_trip', {
        target: 'trip',
        value: true,
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['control reset → reset_trip'],
      }),
    );
  }

  if (
    semantic.conversationalControl === 'restart' ||
    semantic.intent === 'restart' ||
    semantic.deltas.some((d) => d.kind === 'control_restart')
  ) {
    operations.push(
      op('restart_conversation', {
        target: 'conversation',
        value: true,
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['control restart → restart_conversation'],
      }),
    );
  }

  if (
    semantic.conversationalControl === 'undo' ||
    semantic.intent === 'undo' ||
    semantic.deltas.some((d) => d.kind === 'control_undo')
  ) {
    operations.push(
      op('undo_last_commit', {
        target: 'history',
        value: true,
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['control undo → undo_last_commit proposal'],
      }),
    );
  }

  if (
    semantic.conversationalControl === 'preserve_rest' ||
    semantic.deltas.some((d) => d.kind === 'control_keep_rest')
  ) {
    operations.push(
      op('preserve_dates', {
        target: 'dates',
        value: true,
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['preserve_rest → preserve_dates'],
      }),
      op('preserve_travellers', {
        target: 'travellers',
        value: true,
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['preserve_rest → preserve_travellers'],
      }),
      op('preserve_preferences', {
        target: 'preferences',
        value: true,
        role: 'unknown',
        id: null,
        dependsOnClarification: false,
        confidence,
        reasoningTrace: ['preserve_rest → preserve_preferences'],
      }),
    );
  }

  // Clarification stance ops (before place deltas that may supersede).
  const stanceOps = planClarificationStance(
    semantic.clarificationStance,
    semantic,
    clarification,
    confidence,
  );
  operations.push(...stanceOps);

  if (semantic.intent === 'replace_route') {
    operations.push(...planRouteReplacement(semantic, confidence));
  }

  for (const delta of semantic.deltas) {
    switch (delta.kind) {
      case 'preserve_facet':
        operations.push(planPreserveFacet(delta, confidence));
        break;
      case 'mention_place':
        if (semantic.intent !== 'replace_route') {
          operations.push(
            ...planMentionPlace(
              delta,
              currentState,
              clarification,
              semantic.clarificationStance,
              confidence,
            ),
          );
        }
        break;
      case 'remove_place':
        operations.push(
          ...planRemovePlace(delta, currentState, clarification, confidence),
        );
        break;
      case 'replace_place':
        operations.push(
          ...planReplacePlace(
            delta,
            currentState,
            clarification,
            confidence,
            semantic.clarificationStance,
          ),
        );
        break;
      case 'add_place':
        operations.push(...planAddPlace(delta, confidence));
        break;
      case 'reorder_places':
        operations.push(
          ...planReorderPlaces(delta, currentState, confidence),
        );
        break;
      case 'set_duration_on_place':
        operations.push(
          ...planDuration(delta, currentState, clarification, confidence),
        );
        break;
      case 'confirm_option':
      case 'reject_option':
      case 'reject_framing':
      case 'control_reset':
      case 'control_restart':
      case 'control_undo':
      case 'control_keep_rest':
        // Handled via stance / control blocks.
        break;
      case 'set_date':
        operations.push(
          op(
            asciiFold(String(delta.value ?? '')).includes('return')
              ? 'set_return_date'
              : 'set_departure_date',
            {
              target: 'dates',
              value: delta.value,
              role: 'unknown',
              id: null,
              dependsOnClarification: false,
              confidence,
              reasoningTrace: [`set_date from evidence: ${delta.evidence}`],
            },
          ),
        );
        break;
      case 'set_travellers':
        operations.push(
          op('set_traveller_count', {
            target: 'travellers',
            value: delta.value,
            role: 'unknown',
            id: null,
            dependsOnClarification: false,
            confidence,
            reasoningTrace: [`set_travellers from evidence: ${delta.evidence}`],
          }),
        );
        break;
      case 'set_service':
        operations.push(
          op('set_service', {
            target: 'services',
            value: delta.value,
            role: 'unknown',
            id: null,
            dependsOnClarification: false,
            confidence,
            reasoningTrace: [`set_service from evidence: ${delta.evidence}`],
          }),
        );
        break;
      default:
        break;
    }
  }

  // change_only: ensure preserve markers for untouched facets.
  if (semantic.conversationalControl === 'change_only') {
    if (!operations.some((o) => o.op === 'preserve_dates')) {
      operations.unshift(
        op('preserve_dates', {
          target: 'dates',
          value: true,
          role: 'unknown',
          id: null,
          dependsOnClarification: false,
          confidence,
          reasoningTrace: ['change_only → preserve_dates'],
        }),
      );
    }
    if (!operations.some((o) => o.op === 'preserve_travellers')) {
      operations.unshift(
        op('preserve_travellers', {
          target: 'travellers',
          value: true,
          role: 'unknown',
          id: null,
          dependsOnClarification: false,
          confidence,
          reasoningTrace: ['change_only → preserve_travellers'],
        }),
      );
    }
  }

  if (operations.length === 0) {
    operations.push(
      noStateChange(
        'No plannable deltas/controls produced an operation',
        confidence,
      ),
    );
  }

  // Collapse duplicate clarification lifecycle ops (stance + delta overlap).
  const deduped: ProposedOperation[] = [];
  for (const item of operations) {
    const duplicateClarOp =
      (item.op === 'narrow_clarification' ||
        item.op === 'reject_clarification' ||
        item.op === 'supersede_clarification' ||
        item.op === 'confirm_clarification') &&
      deduped.some((existing) => existing.op === item.op);
    if (duplicateClarOp) {
      const prior = deduped.find((existing) => existing.op === item.op)!;
      prior.reasoningTrace = [
        ...prior.reasoningTrace,
        ...item.reasoningTrace,
      ];
      continue;
    }
    deduped.push(item);
  }

  for (const item of deduped) {
    reasoningTrace.push(
      `op:${item.op} target=${item.target} role=${item.resolvedEntity.role} id=${String(item.resolvedEntity.id)}`,
    );
  }

  return plannerResultSchema.parse({
    operations: deduped,
    clarificationStance: semantic.clarificationStance,
    reasoningTrace,
  });
}
