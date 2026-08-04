import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type OpenClarification,
} from '../../conversation-core';
import {
  buildArchitectureTurnTrace,
  emptySemanticInterpretationResult,
  planCanonicalOperations,
  type SemanticInterpretation,
} from '../index';

function state(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'phase2-planner',
      now: new Date('2026-08-04T00:00:00.000Z'),
    }),
    status: 'active',
    ...overrides,
  };
}

function placeEntity(
  name: string,
  extras: Partial<SemanticInterpretation['deltas'][0]['entities'][0]> = {},
) {
  return {
    surface: name,
    resolvedHint: name,
    entityKindHint: 'place' as const,
    indexHint: null,
    deixis: null,
    ...extras,
  };
}

function freezeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('Phase 2 — pure Intent Planner', () => {
  it('does not mutate canonical state', () => {
    const current = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
    });
    const before = freezeClone(current);
    planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'remove',
        confidence: 0.9,
        deltas: [
          {
            kind: 'remove_place',
            entities: [placeEntity('Osaka')],
            value: null,
            evidence: 'Remove Osaka',
          },
        ],
      }),
      currentState: current,
    });
    expect(current).toEqual(before);
  });

  it('remove_place resolves a stop in Lisbon→Osaka→Bogotá', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'remove',
        confidence: 0.92,
        deltas: [
          {
            kind: 'remove_place',
            entities: [placeEntity('Osaka')],
            value: null,
            evidence: 'Remove Osaka',
          },
        ],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka', 'Bogotá'],
        tripStructure: 'multi_city',
      }),
    });
    expect(result.operations.map((o) => o.op)).toContain('remove_destination');
    expect(
      result.operations.find((o) => o.op === 'remove_destination'),
    ).toMatchObject({
      value: 'Osaka',
      resolvedEntity: { role: 'stop' },
    });
    expect(result.reasoningTrace.some((line) => line.includes('remove_destination'))).toBe(
      true,
    );
  });

  it('remove_place by stop index removes the second stop', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'remove',
        confidence: 0.88,
        deltas: [
          {
            kind: 'remove_place',
            entities: [
              {
                surface: 'the second stop',
                resolvedHint: null,
                entityKindHint: 'stop_index',
                indexHint: 1,
                deixis: null,
              },
            ],
            value: null,
            evidence: 'Remove the second stop',
          },
        ],
      }),
      currentState: state({
        origin: 'Vancouver',
        destination: 'Nairobi',
        destinationStops: ['Nairobi', 'Muscat'],
        tripStructure: 'multi_city',
      }),
    });
    const remove = result.operations.find((o) => o.op === 'remove_destination');
    expect(remove).toMatchObject({
      value: 'Muscat',
      resolvedEntity: { role: 'stop', id: 1 },
    });
  });

  it('reorder_places proposes reorder_destinations for Nairobi/Muscat', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'reorder',
        confidence: 0.9,
        deltas: [
          {
            kind: 'reorder_places',
            entities: [placeEntity('Muscat'), placeEntity('Nairobi')],
            value: ['Muscat', 'Nairobi'],
            evidence: 'Put Muscat before Nairobi',
          },
        ],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Nairobi',
        destinationStops: ['Nairobi', 'Muscat'],
        tripStructure: 'multi_city',
      }),
    });
    expect(result.operations.map((o) => o.op)).toEqual(
      expect.arrayContaining(['reorder_destinations', 'set_trip_structure']),
    );
    expect(
      result.operations.find((o) => o.op === 'reorder_destinations')?.value,
    ).toEqual(['Muscat', 'Nairobi']);
  });

  it('replace_place swaps Bogotá for Vancouver on a stop', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'correct',
        confidence: 0.91,
        deltas: [
          {
            kind: 'replace_place',
            entities: [placeEntity('Bogotá')],
            value: 'Vancouver',
            evidence: 'Change Bogotá to Vancouver',
          },
        ],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka', 'Bogotá'],
        tripStructure: 'multi_city',
      }),
    });
    expect(
      result.operations.find((o) => o.op === 'replace_destination'),
    ).toMatchObject({
      value: { from: 'Bogotá', to: 'Vancouver' },
    });
  });

  it('add_place proposes add_destination for Muscat', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'add',
        confidence: 0.87,
        deltas: [
          {
            kind: 'add_place',
            entities: [placeEntity('Muscat')],
            value: 'Muscat',
            evidence: 'Add Muscat on the way',
          },
        ],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka'],
      }),
    });
    expect(result.operations.map((o) => o.op)).toContain('add_destination');
  });

  it('replace_origin when leaving from Vancouver instead', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'correct',
        confidence: 0.9,
        deltas: [
          {
            kind: 'replace_place',
            entities: [placeEntity('Lisbon')],
            value: 'Vancouver',
            evidence: 'Leaving from Vancouver instead of Lisbon',
          },
        ],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka'],
      }),
    });
    expect(result.operations.map((o) => o.op)).toContain('replace_origin');
    expect(
      result.operations.find((o) => o.op === 'replace_origin')?.value,
    ).toBe('Vancouver');
  });

  it('unresolved deixis does not invent a place operation', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'correct',
        confidence: 0.4,
        ambiguityNotes: ['deixis unresolved'],
        deltas: [
          {
            kind: 'replace_place',
            entities: [
              {
                surface: 'there',
                resolvedHint: null,
                entityKindHint: 'place',
                indexHint: null,
                deixis: 'there',
              },
            ],
            value: 'Nairobi',
            evidence: 'Go there instead — Nairobi',
          },
        ],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka'],
      }),
    });
    expect(result.operations.every((o) => o.op === 'no_state_change')).toBe(
      true,
    );
  });

  it('preserve_rest and change_only emit preserve operations', () => {
    const preserve = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'conversational_control',
        conversationalControl: 'preserve_rest',
        confidence: 0.85,
        deltas: [{ kind: 'control_keep_rest', entities: [], value: null, evidence: 'Leave everything else the same' }],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        departureDate: '2026-10-01',
      }),
    });
    expect(preserve.operations.map((o) => o.op)).toEqual(
      expect.arrayContaining([
        'preserve_dates',
        'preserve_travellers',
        'preserve_preferences',
      ]),
    );

    const changeOnly = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'correct',
        conversationalControl: 'change_only',
        confidence: 0.86,
        deltas: [
          {
            kind: 'replace_place',
            entities: [placeEntity('Osaka')],
            value: 'Nairobi',
            evidence: 'Keep the dates but change the destination to Nairobi',
          },
          {
            kind: 'preserve_facet',
            entities: [],
            value: 'dates',
            evidence: 'Keep the dates',
          },
        ],
      }),
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka'],
        departureDate: '2026-10-01',
      }),
    });
    expect(changeOnly.operations.map((o) => o.op)).toEqual(
      expect.arrayContaining([
        'preserve_dates',
        'preserve_travellers',
        'replace_destination',
      ]),
    );
  });

  it('reset / restart / undo propose control operations', () => {
    const current = state({ origin: 'Lisbon', destination: 'Osaka' });
    expect(
      planCanonicalOperations({
        semantic: emptySemanticInterpretationResult({
          intent: 'reset',
          conversationalControl: 'reset',
          confidence: 0.95,
          deltas: [
            {
              kind: 'control_reset',
              entities: [],
              value: null,
              evidence: 'Start again',
            },
          ],
        }),
        currentState: current,
      }).operations.map((o) => o.op),
    ).toContain('reset_trip');

    expect(
      planCanonicalOperations({
        semantic: emptySemanticInterpretationResult({
          intent: 'restart',
          conversationalControl: 'restart',
          confidence: 0.95,
          deltas: [
            {
              kind: 'control_restart',
              entities: [],
              value: null,
              evidence: 'Forget everything',
            },
          ],
        }),
        currentState: current,
      }).operations.map((o) => o.op),
    ).toContain('restart_conversation');

    expect(
      planCanonicalOperations({
        semantic: emptySemanticInterpretationResult({
          intent: 'undo',
          conversationalControl: 'undo',
          confidence: 0.9,
          deltas: [
            {
              kind: 'control_undo',
              entities: [],
              value: null,
              evidence: 'Undo that',
            },
          ],
        }),
        currentState: current,
      }).operations.map((o) => o.op),
    ).toContain('undo_last_commit');
  });

  it('replace_route proposes origin, destinations, structure, return point', () => {
    const result = planCanonicalOperations({
      semantic: emptySemanticInterpretationResult({
        intent: 'replace_route',
        clarificationStance: 'supplies_new_route',
        confidence: 0.93,
        deltas: [
          {
            kind: 'mention_place',
            entities: [
              placeEntity('Lisbon'),
              placeEntity('Osaka'),
              placeEntity('Bogotá'),
            ],
            value: { origin: 'Lisbon', returnPoint: 'Muscat' },
            evidence:
              'Lisbon to Osaka then Bogotá returning from Muscat',
          },
        ],
      }),
      currentState: state(),
    });
    const ops = result.operations.map((o) => o.op);
    expect(ops).toEqual(
      expect.arrayContaining([
        'set_origin',
        'set_destinations',
        'set_trip_structure',
        'set_return_point',
      ]),
    );
  });

  describe('active clarification', () => {
    const clar: OpenClarification = {
      id: 'place-role:Osaka',
      type: 'place_role',
      subject: 'Osaka',
      prompt:
        'Are you starting from Osaka, or is Osaka your first destination?',
      options: ['origin', 'first_destination'],
      blocking: true,
      placesInOrder: ['Osaka', 'Nairobi'],
    };

    it('answers with confirm_option origin proposes confirm + set_origin', () => {
      const result = planCanonicalOperations({
        semantic: emptySemanticInterpretationResult({
          intent: 'clarify_answer',
          clarificationStance: 'answers',
          confidence: 0.9,
          deltas: [
            {
              kind: 'confirm_option',
              entities: [],
              value: 'origin',
              evidence: 'starting from Osaka',
            },
          ],
        }),
        currentState: state({ openClarification: clar }),
      });
      expect(result.operations.map((o) => o.op)).toEqual(
        expect.arrayContaining([
          'confirm_clarification',
          'set_origin',
          'set_destinations',
        ]),
      );
      expect(
        result.operations.find((o) => o.op === 'set_origin')?.value,
      ).toBe('Osaka');
    });

    it('rejects_choices proposes reject_clarification', () => {
      const result = planCanonicalOperations({
        semantic: emptySemanticInterpretationResult({
          intent: 'reject',
          clarificationStance: 'rejects_choices',
          confidence: 0.8,
          deltas: [
            {
              kind: 'reject_framing',
              entities: [],
              value: null,
              evidence: 'Neither',
            },
          ],
        }),
        currentState: state({ openClarification: clar }),
      });
      expect(result.operations.map((o) => o.op)).toContain(
        'reject_clarification',
      );
    });

    it('corrects_premise proposes supersede_clarification', () => {
      const result = planCanonicalOperations({
        semantic: emptySemanticInterpretationResult({
          intent: 'correct',
          clarificationStance: 'corrects_premise',
          confidence: 0.9,
          deltas: [
            {
              kind: 'replace_place',
              entities: [placeEntity('Osaka')],
              value: 'Vancouver',
              evidence: 'No, leaving from Vancouver',
            },
          ],
        }),
        currentState: state({ openClarification: clar }),
      });
      expect(result.operations.map((o) => o.op)).toContain(
        'supersede_clarification',
      );
    });

    it('bare Osaka under ambiguous stance does NOT force origin', () => {
      const result = planCanonicalOperations({
        semantic: emptySemanticInterpretationResult({
          intent: 'clarify_answer',
          clarificationStance: 'ambiguous',
          confidence: 0.45,
          deltas: [
            {
              kind: 'mention_place',
              entities: [placeEntity('Osaka')],
              value: null,
              evidence: 'Osaka',
            },
          ],
        }),
        currentState: state({ openClarification: clar }),
      });
      const ops = result.operations.map((o) => o.op);
      expect(ops).toContain('narrow_clarification');
      expect(ops).not.toContain('set_origin');
      expect(ops).not.toContain('confirm_clarification');
      expect(
        result.reasoningTrace.some((line) =>
          line.toLowerCase().includes('not forcing origin'),
        ) ||
          result.operations.some((o) =>
            o.reasoningTrace.some((line) =>
              line.toLowerCase().includes('not forcing origin'),
            ),
          ),
      ).toBe(true);
    });
  });

  it('architecture trace includes planner proposals with behaviour switch off', () => {
    const current = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
    });
    const before = freezeClone(current);
    const semantic = emptySemanticInterpretationResult({
      intent: 'remove',
      confidence: 0.9,
      deltas: [
        {
          kind: 'remove_place',
          entities: [placeEntity('Bogotá')],
          value: null,
          evidence: 'Remove Bogotá',
        },
      ],
    });
    const trace = buildArchitectureTurnTrace({
      message: 'Remove Bogotá',
      currentState: current,
      semantic,
    });
    expect(trace.phase).toBe(3);
    expect(trace.behaviourSwitchActive).toBe(false);
    expect(trace.committer.active).toBe(false);
    expect(trace.validation.accepted.map((o) => o.op)).toContain(
      'remove_destination',
    );
    expect(trace.committer.preview.destinationStops).toEqual(['Osaka']);
    // Preview removed Bogotá; input unchanged.
    expect(trace.planner.operations.map((o) => o.op)).toContain(
      'remove_destination',
    );
    expect(current).toEqual(before);
  });
});
