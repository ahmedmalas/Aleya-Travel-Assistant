import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type OpenClarification,
} from '../../conversation-core';
import { runConsultantTurn } from '../../conversation-consultant/runConsultantTurn';
import type { ConsultantAct } from '../../conversation-consultant/types';
import {
  ACTIVATION_GATE_IDS,
  assertDivergenceReadiness,
  buildGovernorBootDiagnostics,
  buildGovernorTurnDiagnostics,
  evaluateActivationGates,
  isArchitectureBehaviourSwitchActive,
  isVercelPreviewBuild,
  PHASE5_DIVERGENCE_READINESS,
  runDualPathComparisonBundle,
} from '../index';

function state(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'phase5-promotion',
      now: new Date('2026-08-04T00:00:00.000Z'),
    }),
    status: 'active',
    ...overrides,
  };
}

const clarBangkok: OpenClarification = {
  id: 'place-role:Bangkok',
  type: 'place_role',
  subject: 'Bangkok',
  prompt:
    'Are you starting from Bangkok, or is Bangkok your first destination?',
  options: ['origin', 'first_destination'],
  blocking: true,
  placesInOrder: ['Bangkok', 'Beirut'],
  attemptCount: 1,
};

const clarOsaka: OpenClarification = {
  id: 'place-role:Osaka',
  type: 'place_role',
  subject: 'Osaka',
  prompt: 'Are you starting from Osaka, or is Osaka your first destination?',
  options: ['origin', 'first_destination'],
  blocking: true,
  placesInOrder: ['Osaka', 'Nairobi'],
  attemptCount: 1,
};

function clarifyAct(clar: OpenClarification): ConsultantAct {
  return {
    kind: 'clarify',
    reply: clar.prompt,
    clarification: clar,
    confidence: 0.9,
  };
}

async function turn(
  message: string,
  prior: ConversationCoreState,
  index: number,
  behaviourSwitchRequested?: boolean,
) {
  return runConsultantTurn({
    message,
    state: prior,
    userEntryId: `u-${index}`,
    assistantEntryId: `a-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2 + 1)),
    interpretationMode: 'offline-semantic',
    now: new Date('2026-08-04T00:00:00.000Z'),
    behaviourSwitchRequested,
  });
}

describe('Phase 5 — divergence readiness proofs', () => {
  it('proves each non-aligning corpus divergence is safer and more human', () => {
    const readiness = assertDivergenceReadiness();
    expect(readiness.verdicts).toHaveLength(4);
    expect(readiness.allSafer).toBe(true);
    expect(readiness.allMoreHuman).toBe(true);
    expect(
      PHASE5_DIVERGENCE_READINESS.filter((v) => v.category === 'legacy_loop_risk'),
    ).toHaveLength(2);
    expect(
      PHASE5_DIVERGENCE_READINESS.filter(
        (v) => v.category === 'different_state_same_act',
      ),
    ).toHaveLength(1);
    expect(
      PHASE5_DIVERGENCE_READINESS.filter(
        (v) => v.category === 'unsafe_new_path_blocked',
      ),
    ).toHaveLength(1);
  });

  it('legacy_loop_risk: bare bangkok narrows instead of looping', () => {
    const prior = state({ openClarification: clarBangkok });
    const { comparison, gates } = runDualPathComparisonBundle({
      message: 'bangkok',
      priorState: prior,
      legacyState: prior,
      legacyReply: clarBangkok.prompt,
      legacyAct: clarifyAct(clarBangkok),
    });
    expect(comparison.divergence).toBe('legacy_loop_risk');
    expect(comparison.previewAct.reply.length).toBeLessThan(
      clarBangkok.prompt.length,
    );
    expect(comparison.previewAct.clarificationId).not.toBe(clarBangkok.id);
    expect(comparison.previewState.origin).toBeNull();
    expect(gates.allPassed).toBe(true);
    expect(
      gates.results.find((r) => r.id === 'no_repeated_question_loops')?.passed,
    ).toBe(true);
    expect(
      gates.results.find(
        (r) => r.id === 'clarification_before_ambiguous_commits',
      )?.passed,
    ).toBe(true);
  });

  it('different_state_same_act: remove Osaka clears invalid multi_city', () => {
    const prior = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
      departureDate: '2026-09-01',
      returnDate: '2026-09-20',
    });
    const { comparison, gates } = runDualPathComparisonBundle({
      message: 'Remove Osaka',
      priorState: prior,
      legacyState: {
        ...prior,
        destination: 'Bogotá',
        destinationStops: ['Bogotá'],
        // Legacy incoherence: multi_city with one stop.
        tripStructure: 'multi_city',
      },
      legacyReply: 'Removed.',
      legacyAct: { kind: 'amend', reply: 'Removed.', confidence: 0.8 },
    });
    expect(comparison.divergence).toBe('different_state_same_act');
    expect(comparison.previewState.destinationStops).toEqual(['Bogotá']);
    expect(comparison.previewState.tripStructure).toBeNull();
    expect(comparison.previewState.departureDate).toBe('2026-09-01');
    expect(gates.allPassed).toBe(true);
  });

  it('unsafe_new_path_blocked: hedged replace does not mutate', () => {
    const prior = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka'],
    });
    const { comparison, gates } = runDualPathComparisonBundle({
      message: 'Maybe change Osaka to Muscat somehow',
      priorState: prior,
      legacyState: prior,
      legacyReply: 'Could you clarify?',
      legacyAct: {
        kind: 'ask',
        reply: 'Could you clarify?',
        askTopic: 'destination',
        confidence: 0.5,
      },
    });
    expect(comparison.divergence).toMatch(
      /unsafe_new_path_blocked|same_state_same_act|new_path_abstained/,
    );
    expect(comparison.previewState.destinationStops).toEqual(['Osaka']);
    expect(gates.allPassed).toBe(true);
    expect(
      gates.results.find((r) => r.id === 'no_unsafe_canonical_writes')?.passed,
    ).toBe(true);
  });
});

describe('Phase 5 — activation gates', () => {
  it('defines all six required gates', () => {
    expect(ACTIVATION_GATE_IDS).toEqual([
      'no_unsafe_canonical_writes',
      'no_loss_of_valid_trip_details',
      'clarification_before_ambiguous_commits',
      'no_repeated_question_loops',
      'amendments_preserve_unaffected_state',
      'deterministic_validation_authoritative',
    ]);
  });

  it('corpus critical paths all pass gates', () => {
    const cases: Array<{
      message: string;
      priorState: ConversationCoreState;
      legacyState: ConversationCoreState;
      legacyReply: string;
      legacyAct: ConsultantAct;
    }> = [
      {
        message: 'bangkok',
        priorState: state({ openClarification: clarBangkok }),
        legacyState: state({ openClarification: clarBangkok }),
        legacyReply: clarBangkok.prompt,
        legacyAct: clarifyAct(clarBangkok),
      },
      {
        message: 'Osaka',
        priorState: state({ openClarification: clarOsaka }),
        legacyState: state({ openClarification: clarOsaka }),
        legacyReply: clarOsaka.prompt,
        legacyAct: clarifyAct(clarOsaka),
      },
      {
        message: 'Remove Osaka',
        priorState: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka', 'Bogotá'],
          tripStructure: 'multi_city',
          departureDate: '2026-09-01',
          returnDate: '2026-09-20',
        }),
        legacyState: state({
          origin: 'Lisbon',
          destination: 'Bogotá',
          destinationStops: ['Bogotá'],
          tripStructure: 'multi_city',
          departureDate: '2026-09-01',
          returnDate: '2026-09-20',
        }),
        legacyReply: 'Removed.',
        legacyAct: { kind: 'amend', reply: 'Removed.', confidence: 0.8 },
      },
      {
        message: 'Maybe change Osaka to Muscat somehow',
        priorState: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyState: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyReply: '?',
        legacyAct: {
          kind: 'ask',
          reply: '?',
          askTopic: 'destination',
          confidence: 0.5,
        },
      },
      {
        message: 'Keep the dates but change the destination to Nairobi',
        priorState: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
          departureDate: '2026-10-01',
          returnDate: '2026-10-15',
        }),
        legacyState: state({
          origin: 'Lisbon',
          destination: 'Nairobi',
          destinationStops: ['Nairobi'],
          departureDate: '2026-10-01',
          returnDate: '2026-10-15',
        }),
        legacyReply: 'Updated.',
        legacyAct: { kind: 'amend', reply: 'Updated.', confidence: 0.8 },
      },
    ];

    for (const c of cases) {
      const { comparison, gates } = runDualPathComparisonBundle(c);
      expect(gates.allPassed, `${c.message} → ${JSON.stringify(gates.results)}`).toBe(
        true,
      );
      expect(
        evaluateActivationGates({
          comparison,
          priorState: c.priorState,
        }).allPassed,
      ).toBe(true);
    }
  });
});

describe('Phase 5 — reversible behaviour switch', () => {
  it('resolves explicit flag, preview default, and production off', () => {
    expect(isArchitectureBehaviourSwitchActive({})).toBe(false);
    expect(
      isArchitectureBehaviourSwitchActive({
        VITE_ARCHITECTURE_GOVERNOR_SWITCH: 'false',
      }),
    ).toBe(false);
    expect(
      isArchitectureBehaviourSwitchActive({
        VITE_ARCHITECTURE_GOVERNOR_SWITCH: 'true',
      }),
    ).toBe(true);
    expect(
      isArchitectureBehaviourSwitchActive({
        VITE_VERCEL_ENV: 'preview',
      }),
    ).toBe(true);
    expect(
      isArchitectureBehaviourSwitchActive({
        VITE_VERCEL_TARGET_ENV: 'preview',
      }),
    ).toBe(true);
    expect(isVercelPreviewBuild({ VITE_VERCEL_TARGET_ENV: 'preview' })).toBe(
      true,
    );
    expect(
      isArchitectureBehaviourSwitchActive({
        VITE_VERCEL_ENV: 'production',
      }),
    ).toBe(false);
    expect(
      isArchitectureBehaviourSwitchActive({
        VITE_VERCEL_TARGET_ENV: 'production',
      }),
    ).toBe(false);
    // Explicit false kills switch even on preview (reversible).
    expect(
      isArchitectureBehaviourSwitchActive({
        VITE_VERCEL_ENV: 'preview',
        VITE_ARCHITECTURE_GOVERNOR_SWITCH: 'false',
      }),
    ).toBe(false);
  });

  it('when switch off, legacy still owns Bangkok loop result', async () => {
    let s = state();
    const first = await turn('I want to go Bangkok and Beirut', s, 0, false);
    s = first.state;
    const second = await turn('bangkok', s, 1, false);
    expect(second.behaviourSwitchActive).toBe(false);
    expect(second.behaviourSwitchRequested).toBe(false);
    expect(second.governorDiagnostics.statusLabel).toBe(
      'Governor: legacy fallback',
    );
    expect(second.governorDiagnostics.fallbackReason).toMatch(/switch off/i);
    expect(second.reply).toBe(
      'Are you starting from Bangkok, or is Bangkok your first destination?',
    );
    expect(second.state.openClarification?.id).toBe('place-role:Bangkok');
    expect(second.dualRunComparison.divergence).toBe('legacy_loop_risk');
  });

  it('when switch on and gates pass, architecture owns bare bangkok turn', async () => {
    let s = state();
    const first = await turn('I want to go Bangkok and Beirut', s, 0, true);
    expect(first.state.openClarification?.subject).toBe('Bangkok');
    expect(first.governorDiagnostics.statusLabel).toBe('Governor: active');
    s = first.state;
    const second = await turn('bangkok', s, 1, true);
    expect(second.behaviourSwitchActive).toBe(true);
    expect(second.behaviourSwitchRequested).toBe(true);
    expect(second.dualRunComparison.gatesPassed).toBe(true);
    expect(second.dualRunComparison.behaviourSwitchActive).toBe(true);
    expect(second.governorDiagnostics.statusLabel).toBe('Governor: active');
    expect(second.governorDiagnostics.fallbackReason).toBeNull();
    expect(second.governorDiagnostics.failedGates).toEqual([]);
    expect(second.reply.length).toBeLessThan(
      'Are you starting from Bangkok, or is Bangkok your first destination?'
        .length,
    );
    expect(second.state.openClarification?.id).not.toBe('place-role:Bangkok');
    expect(second.state.openClarification?.parentClarificationId).toBe(
      'place-role:Bangkok',
    );
    expect(second.state.origin).toBeNull();
    expect(second.architectureTrace.committer.active).toBe(true);
    expect(second.architectureTrace.governor.active).toBe(true);
  });

  it('when switch on, low-confidence hedge does not mutate committed stops', async () => {
    const s = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka'],
    });
    const r = await turn(
      'Maybe change Osaka to Muscat somehow',
      s,
      0,
      true,
    );
    expect(r.behaviourSwitchActive).toBe(true);
    expect(r.state.destinationStops).toEqual(['Osaka']);
    expect(r.dualRunComparison.divergence).toMatch(
      /unsafe_new_path_blocked|same_state_same_act|new_path_abstained/,
    );
  });
});

describe('Phase 5 — visible governor diagnostics (never silent)', () => {
  it('boot diagnostics reflect preview ON vs production OFF', () => {
    const preview = buildGovernorBootDiagnostics({
      VITE_VERCEL_ENV: 'preview',
    });
    expect(preview.statusLabel).toBe('Governor: active');
    expect(preview.switchRequested).toBe(true);

    const production = buildGovernorBootDiagnostics({
      VITE_VERCEL_ENV: 'production',
    });
    expect(production.statusLabel).toBe('Governor: legacy fallback');
    expect(production.switchRequested).toBe(false);
    expect(production.fallbackReason).toMatch(/production/i);
  });

  it('surfaces failed gate ids when switch requested but gates block', () => {
    const prior = state({ openClarification: clarBangkok });
    const { comparison } = runDualPathComparisonBundle({
      message: 'bangkok',
      priorState: prior,
      legacyState: prior,
      legacyReply: clarBangkok.prompt,
      legacyAct: clarifyAct(clarBangkok),
      behaviourSwitchRequested: true,
    });
    // Force a blocked diagnostic by synthesizing a failed gate report.
    const blocked = {
      ...comparison,
      gatesPassed: false,
      gateResults: [
        {
          id: 'no_repeated_question_loops' as const,
          passed: false,
          detail: 'same clarification id retained',
        },
        ...comparison.gateResults.filter(
          (g) => g.id !== 'no_repeated_question_loops',
        ),
      ],
      behaviourSwitchActive: false,
    };
    const diagnostics = buildGovernorTurnDiagnostics({
      behaviourSwitchActive: false,
      dualRunComparison: blocked,
      switchRequested: true,
    });
    expect(diagnostics.statusLabel).toBe('Governor: legacy fallback');
    expect(diagnostics.failedGates.map((g) => g.id)).toContain(
      'no_repeated_question_loops',
    );
    expect(diagnostics.fallbackReason).toMatch(
      /Activation gate\(s\) blocked/,
    );
    expect(diagnostics.fallbackReason).toMatch(/no_repeated_question_loops/);
  });
});
