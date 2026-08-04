import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type OpenClarification,
} from '../../conversation-core';
import {
  architectureTurnTraceSchema,
  buildArchitectureTurnTrace,
  clarificationFromOpenClarification,
  clarificationSchema,
  emptyPlannerResult,
  emptySemanticInterpretationResult,
  emptyValidationResult,
  plannerResultSchema,
  proposedOperationSchema,
  semanticInterpretationSchema,
  validationResultSchema,
} from '../index';

function state(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'phase1-arch',
      now: new Date('2026-08-04T00:00:00.000Z'),
    }),
    status: 'active',
    ...overrides,
  };
}

describe('Phase 1 — architecture schemas', () => {
  it('accepts a meaning-only semantic interpretation (remove_place, no mutation op)', () => {
    const semantic = emptySemanticInterpretationResult({
      intent: 'remove',
      confidence: 0.9,
      evidenceSummary: ['Remove Bangkok'],
      deltas: [
        {
          kind: 'remove_place',
          entities: [
            {
              surface: 'Bangkok',
              resolvedHint: 'Bangkok',
              entityKindHint: 'place',
              indexHint: null,
              deixis: null,
            },
          ],
          value: null,
          evidence: 'Remove Bangkok',
        },
      ],
    });

    expect(semanticInterpretationSchema.parse(semantic)).toEqual(semantic);
    expect(semantic.deltas[0]?.kind).toBe('remove_place');
    // Must not look like a canonical mutation op.
    expect(JSON.stringify(semantic)).not.toMatch(/remove_destination/);
  });

  it('accepts proposed operations and empty planner/validator factories', () => {
    const op = proposedOperationSchema.parse({
      op: 'remove_destination',
      target: 'destinationStops',
      value: 'Bangkok',
      resolvedEntity: { role: 'stop', id: 'Bangkok' },
      dependsOnClarification: false,
      confidence: 0.8,
      reasoningTrace: ['Bangkok matched a destination stop'],
    });
    expect(op.op).toBe('remove_destination');

    const planner = emptyPlannerResult();
    expect(plannerResultSchema.parse(planner).operations).toEqual([]);

    const validation = emptyValidationResult();
    expect(validationResultSchema.parse(validation).accepted).toEqual([]);
    expect(validation.clarificationAction).toBe('none');
  });

  it('projects OpenClarification into generic Clarification without mutating state', () => {
    const open: OpenClarification = {
      id: 'place-role:Bangkok',
      type: 'place_role',
      subject: 'Bangkok',
      prompt:
        'Are you starting from Bangkok, or is Bangkok your first destination?',
      options: ['origin', 'first_destination'],
      blocking: true,
      placesInOrder: ['Bangkok', 'Beirut'],
    };
    const projected = clarificationFromOpenClarification(open);
    expect(projected).not.toBeNull();
    expect(clarificationSchema.parse(projected)).toMatchObject({
      id: 'place-role:Bangkok',
      domain: 'location',
      issueType: 'role_ambiguity',
      status: 'open',
      blocking: true,
      parentClarificationId: null,
      attemptCount: 1,
      placesInOrder: ['Bangkok', 'Beirut'],
    });
    expect(clarificationFromOpenClarification(null)).toBeNull();
  });
});

describe('Phase 1 — diagnostic architecture traces', () => {
  it('emits a diagnostic-only trace with behaviour switch off', () => {
    const open: OpenClarification = {
      id: 'place-role:Osaka',
      type: 'place_role',
      subject: 'Osaka',
      prompt: 'Are you starting from Osaka, or is Osaka your first destination?',
      options: ['origin', 'first_destination'],
      blocking: true,
      placesInOrder: ['Osaka', 'Nairobi'],
    };
    const current = state({ openClarification: open });
    const trace = buildArchitectureTurnTrace({
      message: 'Remove Osaka.',
      currentState: current,
      semantic: emptySemanticInterpretationResult({
        intent: 'remove',
        confidence: 0.91,
        evidenceSummary: ['Remove Osaka.'],
        deltas: [
          {
            kind: 'remove_place',
            entities: [
              {
                surface: 'Osaka',
                resolvedHint: 'Osaka',
                entityKindHint: 'place',
                indexHint: null,
                deixis: null,
              },
            ],
            value: null,
            evidence: 'Remove Osaka.',
          },
        ],
      }),
    });

    expect(architectureTurnTraceSchema.parse(trace)).toMatchObject({
      phase: 4,
      diagnosticOnly: true,
      behaviourSwitchActive: false,
      message: 'Remove Osaka.',
      committer: { active: false },
      governor: { active: false },
    });
    expect(trace.governor.previewAct.kind).toBeTruthy();
    expect(trace.activeClarification?.id).toBe('place-role:Osaka');
    expect(trace.semantic.deltas[0]?.kind).toBe('remove_place');
    expect(trace.planner.operations.length).toBeGreaterThan(0);
    expect(trace.planner.reasoningTrace[0]).toMatch(/Phase 2 pure Intent Planner/);
    expect(trace.validation.reasons[0]).toMatch(/Phase 3 Canonical Validator/);
    // Canonical state object identity/fields unchanged by trace build.
    expect(current.openClarification).toEqual(open);
    expect(current.origin).toBeNull();
    expect(current.destinationStops).toBeNull();
  });

  it('runs diagnostic interpreter when semantic is not supplied', () => {
    const trace = buildArchitectureTurnTrace({
      message: 'hello',
      currentState: state(),
    });
    expect(trace.semantic.intent).toBe('unknown');
    expect(trace.behaviourSwitchActive).toBe(false);
    expect(trace.committer.active).toBe(false);
    expect(trace.governor.active).toBe(false);
    expect(trace.phase).toBe(4);
    expect(trace.stagesPresent).toEqual([
      'semantic_interpreter',
      'intent_planner',
      'canonical_validator',
      'state_committer',
      'consultant_governor',
    ]);
    expect(trace.notes.some((n) => n.includes('No behaviour switch'))).toBe(
      true,
    );
  });
});
