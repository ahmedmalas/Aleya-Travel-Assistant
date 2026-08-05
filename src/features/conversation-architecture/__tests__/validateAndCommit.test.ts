import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type OpenClarification,
} from '../../conversation-core';
import {
  buildArchitectureTurnTrace,
  commitCanonicalOperations,
  emptySemanticInterpretationResult,
  planCanonicalOperations,
  validateCanonicalOperations,
  type ProposedOperation,
  type SemanticInterpretation,
} from '../index';

function state(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'phase3-validate-commit',
      now: new Date('2026-08-04T00:00:00.000Z'),
    }),
    status: 'active',
    ...overrides,
  };
}

function placeEntity(name: string) {
  return {
    surface: name,
    resolvedHint: name,
    entityKindHint: 'place' as const,
    indexHint: null,
    deixis: null,
  };
}

function freezeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function plan(
  semantic: SemanticInterpretation,
  current: ConversationCoreState,
) {
  return planCanonicalOperations({ semantic, currentState: current });
}

const clarOsaka: OpenClarification = {
  id: 'place-role:Osaka',
  type: 'place_role',
  subject: 'Osaka',
  prompt: 'Are you starting from Osaka, or is Osaka your first destination?',
  options: ['origin', 'first_destination'],
  blocking: true,
  placesInOrder: ['Osaka', 'Nairobi'],
};

describe('Phase 3 — Canonical Validator', () => {
  it('accepts remove_destination for Osaka and rejects invalid stop index', () => {
    const current = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
    });
    const before = freezeClone(current);
    const proposed = plan(
      emptySemanticInterpretationResult({
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
      current,
    );
    const validation = validateCanonicalOperations({
      operations: proposed.operations,
      currentState: current,
    });
    expect(validation.accepted.map((o) => o.op)).toContain('remove_destination');
    expect(current).toEqual(before);

    const badIndex: ProposedOperation = {
      op: 'remove_destination',
      target: 'destinationStops',
      value: 'Ghost',
      resolvedEntity: { role: 'stop', id: 9 },
      dependsOnClarification: false,
      confidence: 0.9,
      reasoningTrace: ['bad index'],
    };
    const rejected = validateCanonicalOperations({
      operations: [badIndex],
      currentState: current,
    });
    expect(rejected.accepted).toEqual([]);
    expect(rejected.rejected[0]?.reason).toMatch(/out of range/i);
  });

  it('preserve_places blocks removal of Vancouver', () => {
    const current = state({
      origin: 'Lisbon',
      destination: 'Vancouver',
      destinationStops: ['Vancouver', 'Muscat'],
      tripStructure: 'multi_city',
    });
    const validation = validateCanonicalOperations({
      operations: [
        {
          op: 'preserve_places',
          target: 'places',
          value: ['Vancouver'],
          resolvedEntity: { role: 'unknown', id: null },
          dependsOnClarification: false,
          confidence: 1,
          reasoningTrace: ['preserve Vancouver'],
        },
        {
          op: 'remove_destination',
          target: 'destinationStops',
          value: 'Vancouver',
          resolvedEntity: { role: 'stop', id: 0 },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: ['remove Vancouver'],
        },
      ],
      currentState: current,
    });
    expect(validation.accepted.map((o) => o.op)).toContain('preserve_places');
    expect(
      validation.rejected.some((r) => r.op.op === 'remove_destination'),
    ).toBe(true);
  });

  it('ambiguous place-role answer → no place commit + narrow action', () => {
    const current = state({ openClarification: clarOsaka });
    const proposed = plan(
      emptySemanticInterpretationResult({
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
      current,
    );
    const validation = validateCanonicalOperations({
      operations: proposed.operations,
      currentState: current,
    });
    expect(validation.clarificationAction).toBe('narrow');
    expect(validation.narrowedClarification?.parentClarificationId).toBe(
      'place-role:Osaka',
    );
    expect(validation.narrowedClarification?.id).not.toBe('place-role:Osaka');
    expect(
      validation.accepted.some((o) => PLACE_MUTATION(o.op)),
    ).toBe(false);
  });

  it('explicit clarification answer accepts confirm + origin ops and clears', () => {
    const current = state({ openClarification: clarOsaka });
    const proposed = plan(
      emptySemanticInterpretationResult({
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
      current,
    );
    const validation = validateCanonicalOperations({
      operations: proposed.operations,
      currentState: current,
    });
    expect(validation.clarificationAction).toBe('clear');
    expect(validation.accepted.map((o) => o.op)).toEqual(
      expect.arrayContaining(['confirm_clarification', 'set_origin']),
    );
  });

  it('correction supersedes clarification', () => {
    const current = state({ openClarification: clarOsaka });
    const proposed = plan(
      emptySemanticInterpretationResult({
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
      current,
    );
    const validation = validateCanonicalOperations({
      operations: proposed.operations,
      currentState: current,
    });
    expect(validation.clarificationAction).toBe('supersede');
    expect(validation.accepted.map((o) => o.op)).toContain(
      'supersede_clarification',
    );
  });

  it('rejects undo when no history exists', () => {
    const validation = validateCanonicalOperations({
      operations: [
        {
          op: 'undo_last_commit',
          target: 'history',
          value: true,
          resolvedEntity: { role: 'unknown', id: null },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: ['undo'],
        },
      ],
      currentState: state({ origin: 'Lisbon' }),
    });
    expect(validation.rejected[0]?.reason).toMatch(/history/i);
  });
});

function PLACE_MUTATION(op: string): boolean {
  return [
    'set_origin',
    'replace_origin',
    'set_destinations',
    'replace_destination',
    'add_destination',
    'remove_destination',
    'reorder_destinations',
  ].includes(op);
}

describe('Phase 3 — State Committer', () => {
  it('does not mutate input state', () => {
    const current = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
    });
    const before = freezeClone(current);
    const proposed = plan(
      emptySemanticInterpretationResult({
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
      current,
    );
    const validation = validateCanonicalOperations({
      operations: proposed.operations,
      currentState: current,
    });
    commitCanonicalOperations({
      currentState: current,
      accepted: validation.accepted,
      clarificationAction: validation.clarificationAction,
    });
    expect(current).toEqual(before);
  });

  it('applies remove/replace/reorder/add and rebuilds legs', () => {
    const current = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
      departureDate: '2026-11-01',
    });

    const removed = commitCanonicalOperations({
      currentState: current,
      accepted: [
        {
          op: 'remove_destination',
          target: 'destinationStops',
          value: 'Osaka',
          resolvedEntity: { role: 'stop', id: 0 },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
      ],
      clarificationAction: 'none',
    });
    expect(removed.state.destinationStops).toEqual(['Bogotá']);
    expect(removed.state.tripLegs?.[0]).toMatchObject({
      origin: 'Lisbon',
      destination: 'Bogotá',
    });

    const reordered = commitCanonicalOperations({
      currentState: current,
      accepted: [
        {
          op: 'reorder_destinations',
          target: 'destinationStops',
          value: ['Bogotá', 'Osaka'],
          resolvedEntity: { role: 'stop', id: 'Bogotá' },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
      ],
      clarificationAction: 'none',
    });
    expect(reordered.state.destinationStops).toEqual(['Bogotá', 'Osaka']);
    expect(reordered.state.destination).toBe('Bogotá');

    const replaced = commitCanonicalOperations({
      currentState: current,
      accepted: [
        {
          op: 'replace_destination',
          target: 'destinationStops',
          value: { from: 'Bogotá', to: 'Muscat' },
          resolvedEntity: { role: 'stop', id: 1 },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
      ],
      clarificationAction: 'none',
    });
    expect(replaced.state.destinationStops).toEqual(['Osaka', 'Muscat']);

    const added = commitCanonicalOperations({
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka'],
      }),
      accepted: [
        {
          op: 'add_destination',
          target: 'destinationStops',
          value: 'Nairobi',
          resolvedEntity: { role: 'stop', id: 'Nairobi' },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
      ],
      clarificationAction: 'none',
    });
    expect(added.state.destinationStops).toEqual(['Osaka', 'Nairobi']);
    expect(added.state.tripStructure).toBe('multi_city');
  });

  it('applies origin replacement and full-route replacement', () => {
    const originSwap = commitCanonicalOperations({
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka'],
      }),
      accepted: [
        {
          op: 'replace_origin',
          target: 'origin',
          value: 'Vancouver',
          resolvedEntity: { role: 'origin', id: 'Vancouver' },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
      ],
      clarificationAction: 'none',
    });
    expect(originSwap.state.origin).toBe('Vancouver');
    expect(originSwap.state.tripLegs?.[0]?.origin).toBe('Vancouver');

    const route = commitCanonicalOperations({
      currentState: state(),
      accepted: [
        {
          op: 'set_origin',
          target: 'origin',
          value: 'Lisbon',
          resolvedEntity: { role: 'origin', id: 'Lisbon' },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
        {
          op: 'set_destinations',
          target: 'destinationStops',
          value: ['Osaka', 'Nairobi'],
          resolvedEntity: { role: 'destination', id: 'Osaka' },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
        {
          op: 'set_trip_structure',
          target: 'tripStructure',
          value: 'multi_city',
          resolvedEntity: { role: 'unknown', id: null },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
        {
          op: 'set_return_point',
          target: 'returnPoint',
          value: 'Muscat',
          resolvedEntity: { role: 'return_point', id: 'Muscat' },
          dependsOnClarification: false,
          confidence: 0.9,
          reasoningTrace: [],
        },
      ],
      clarificationAction: 'none',
    });
    expect(route.state.origin).toBe('Lisbon');
    expect(route.state.destinationStops).toEqual(['Osaka', 'Nairobi']);
    expect(route.state.tripLegs).toHaveLength(2);
    expect(route.returnPoint).toBe('Muscat');
  });

  it('clears clarification on explicit answer and does not reuse cleared id', () => {
    const current = state({ openClarification: clarOsaka });
    const proposed = plan(
      emptySemanticInterpretationResult({
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
      current,
    );
    const validation = validateCanonicalOperations({
      operations: proposed.operations,
      currentState: current,
    });
    const committed = commitCanonicalOperations({
      currentState: current,
      accepted: validation.accepted,
      clarificationAction: validation.clarificationAction,
      narrowedClarification: validation.narrowedClarification,
    });
    expect(committed.state.origin).toBe('Osaka');
    expect(committed.state.destinationStops).toEqual(['Nairobi']);
    expect(committed.state.openClarification).toBeNull();
    expect(committed.clearedClarificationIds).toContain('place-role:Osaka');
  });

  it('narrowing creates a new clarification id with parent set', () => {
    const current = state({ openClarification: clarOsaka });
    const proposed = plan(
      emptySemanticInterpretationResult({
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
      current,
    );
    const validation = validateCanonicalOperations({
      operations: proposed.operations,
      currentState: current,
    });
    const committed = commitCanonicalOperations({
      currentState: current,
      accepted: validation.accepted,
      clarificationAction: validation.clarificationAction,
      narrowedClarification: validation.narrowedClarification,
    });
    expect(committed.state.origin).toBeNull();
    expect(committed.state.openClarification?.id).not.toBe('place-role:Osaka');
    expect(committed.state.openClarification?.parentClarificationId).toBe(
      'place-role:Osaka',
    );
    expect(committed.clearedClarificationIds).toContain('place-role:Osaka');
    expect(committed.clearedClarificationIds).not.toContain(
      committed.state.openClarification?.id,
    );
  });

  it('reset clears travel fields safely', () => {
    const committed = commitCanonicalOperations({
      currentState: state({
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka', 'Nairobi'],
        departureDate: '2026-12-01',
        openClarification: clarOsaka,
      }),
      accepted: [
        {
          op: 'reset_trip',
          target: 'trip',
          value: true,
          resolvedEntity: { role: 'unknown', id: null },
          dependsOnClarification: false,
          confidence: 1,
          reasoningTrace: [],
        },
      ],
      clarificationAction: 'clear',
    });
    expect(committed.state.origin).toBeNull();
    expect(committed.state.destinationStops).toBeNull();
    expect(committed.state.departureDate).toBeNull();
    expect(committed.state.openClarification).toBeNull();
  });
});

describe('Phase 3 — diagnostic architecture trace', () => {
  it('populates validator results and committer preview without activating behaviour', () => {
    const current = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
    });
    const before = freezeClone(current);
    const trace = buildArchitectureTurnTrace({
      message: 'Remove Osaka',
      currentState: current,
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
    });
    expect(trace.phase).toBe(5);
    expect(trace.behaviourSwitchActive).toBe(false);
    expect(trace.committer.active).toBe(false);
    expect(trace.governor.active).toBe(false);
    expect(trace.validation.accepted.map((o) => o.op)).toContain(
      'remove_destination',
    );
    expect(trace.committer.preview.destinationStops).toEqual(['Bogotá']);
    expect(current).toEqual(before);
  });
});
