import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type OpenClarification,
} from '../../conversation-core';
import { runConsultantTurn } from '../../conversation-consultant/runConsultantTurn';
import type { ConsultantAct } from '../../conversation-consultant/types';
import {
  classifyDivergence,
  interpretDiagnosticSemantic,
  runDualPathComparison,
  type DivergenceCategory,
} from '../index';
import { choosePreviewConsultantAct } from '../choosePreviewConsultantAct';
import { commitCanonicalOperations } from '../commitCanonicalOperations';
import { planCanonicalOperations } from '../planCanonicalOperations';
import { validateCanonicalOperations } from '../validateCanonicalOperations';

function state(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'phase4-dual-run',
      now: new Date('2026-08-04T00:00:00.000Z'),
    }),
    status: 'active',
    ...overrides,
  };
}

function freezeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

const multiCityLisbon: Partial<ConversationCoreState> = {
  origin: 'Lisbon',
  destination: 'Osaka',
  destinationStops: ['Osaka', 'Bogotá'],
  tripStructure: 'multi_city',
  departureDate: '2026-09-01',
  returnDate: '2026-09-20',
};

function clarifyAct(clar: OpenClarification): ConsultantAct {
  return {
    kind: 'clarify',
    reply: clar.prompt,
    clarification: clar,
    confidence: 0.9,
  };
}

function askAct(reply: string): ConsultantAct {
  return {
    kind: 'ask',
    reply,
    askTopic: 'departureDate',
    confidence: 0.8,
  };
}

function amendAct(reply = 'Updated.'): ConsultantAct {
  return {
    kind: 'amend',
    reply,
    confidence: 0.8,
  };
}

async function liveTurn(
  message: string,
  prior: ConversationCoreState,
  index: number,
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
  });
}

describe('Phase 4 — dual-run orchestration', () => {
  it('keeps behaviourSwitchActive false and never mutates prior state', () => {
    const prior = state({ openClarification: clarBangkok });
    const before = freezeClone(prior);
    const comparison = runDualPathComparison({
      message: 'bangkok',
      priorState: prior,
      legacyState: prior,
      legacyReply: clarBangkok.prompt,
      legacyAct: clarifyAct(clarBangkok),
    });
    expect(comparison.behaviourSwitchActive).toBe(false);
    expect(comparison.diagnosticOnly).toBe(true);
    expect(comparison.phase).toBe(5);
    expect(prior).toEqual(before);
  });

  it('Bangkok/Beirut clarification loop → legacy_loop_risk + shorter narrowed preview', () => {
    const prior = state({ openClarification: clarBangkok });
    const comparison = runDualPathComparison({
      message: 'bangkok',
      priorState: prior,
      legacyState: { ...prior, openClarification: clarBangkok },
      legacyReply: clarBangkok.prompt,
      legacyAct: clarifyAct(clarBangkok),
    });

    expect(comparison.divergence).toBe('legacy_loop_risk');
    expect(comparison.semantic.clarificationStance).toBe('ambiguous');
    expect(comparison.planner.operations.map((o) => o.op)).toContain(
      'narrow_clarification',
    );
    expect(comparison.planner.operations.map((o) => o.op)).not.toContain(
      'set_origin',
    );
    expect(comparison.validation.clarificationAction).toBe('narrow');
    expect(comparison.previewAct.kind).toBe('clarify');
    expect(comparison.previewAct.reply.length).toBeLessThan(
      clarBangkok.prompt.length,
    );
    expect(comparison.clearedClarificationIds).toContain('place-role:Bangkok');
    expect(comparison.previewAct.clarificationId).not.toBe(
      'place-role:Bangkok',
    );
    expect(comparison.clearedClarificationIds).not.toContain(
      comparison.previewAct.clarificationId,
    );
  });

  it('explicit clarification answer commits origin in preview', () => {
    const prior = state({ openClarification: clarOsaka });
    const comparison = runDualPathComparison({
      message: 'starting from Osaka',
      priorState: prior,
      legacyState: {
        ...prior,
        origin: 'Osaka',
        destination: 'Nairobi',
        destinationStops: ['Nairobi'],
        openClarification: null,
      },
      legacyReply: 'When would you like to depart?',
      legacyAct: askAct('When would you like to depart?'),
    });

    expect(comparison.previewState.origin).toBe('Osaka');
    expect(comparison.previewState.destinationStops).toEqual(['Nairobi']);
    expect(comparison.previewState.openClarificationId).toBeNull();
    expect(comparison.clearedClarificationIds).toContain('place-role:Osaka');
    expect(comparison.previewAct.clarificationId).not.toBe(
      'place-role:Osaka',
    );
  });

  it('ambiguous bare place under Osaka clar narrows without origin commit', () => {
    const prior = state({ openClarification: clarOsaka });
    const comparison = runDualPathComparison({
      message: 'Osaka',
      priorState: prior,
      legacyState: prior,
      legacyReply: clarOsaka.prompt,
      legacyAct: clarifyAct(clarOsaka),
    });
    expect(comparison.divergence).toBe('legacy_loop_risk');
    expect(comparison.previewState.origin).toBeNull();
    expect(comparison.previewAct.reply).toMatch(/Osaka as your starting point/);
  });

  it('origin correction Vancouver instead of Lisbon', () => {
    const prior = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka'],
    });
    const before = freezeClone(prior);
    const comparison = runDualPathComparison({
      message: 'Leaving from Vancouver instead of Lisbon',
      priorState: prior,
      legacyState: {
        ...prior,
        origin: 'Vancouver',
      },
      legacyReply: 'Got it — leaving from Vancouver.',
      legacyAct: amendAct('Got it — leaving from Vancouver.'),
    });
    expect(prior).toEqual(before);
    expect(comparison.previewState.origin).toBe('Vancouver');
    expect(comparison.semantic.intent).toBe('correct');
  });

  it('destination replacement Osaka → Muscat', () => {
    const prior = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka', 'Bogotá'],
      tripStructure: 'multi_city',
    });
    const comparison = runDualPathComparison({
      message: 'Change Osaka to Muscat',
      priorState: prior,
      legacyState: {
        ...prior,
        destination: 'Muscat',
        destinationStops: ['Muscat', 'Bogotá'],
      },
      legacyReply: 'Updated destination to Muscat.',
      legacyAct: amendAct('Updated destination to Muscat.'),
    });
    expect(comparison.previewState.destinationStops).toContain('Muscat');
    expect(comparison.previewState.destinationStops).not.toContain('Osaka');
  });

  it('add / remove / reorder stops for Lisbon→Osaka→Bogotá', () => {
    const prior = state({ ...multiCityLisbon });

    const removed = runDualPathComparison({
      message: 'Remove Osaka',
      priorState: prior,
      legacyState: {
        ...prior,
        destination: 'Bogotá',
        destinationStops: ['Bogotá'],
      },
      legacyReply: 'Removed Osaka.',
      legacyAct: amendAct('Removed Osaka.'),
    });
    expect(removed.previewState.destinationStops).toEqual(['Bogotá']);

    const added = runDualPathComparison({
      message: 'Add Vancouver',
      priorState: prior,
      legacyState: {
        ...prior,
        destinationStops: ['Osaka', 'Bogotá', 'Vancouver'],
      },
      legacyReply: 'Added Vancouver.',
      legacyAct: amendAct('Added Vancouver.'),
    });
    expect(added.previewState.destinationStops).toContain('Vancouver');

    const reordered = runDualPathComparison({
      message: 'Put Bogotá before Osaka',
      priorState: prior,
      legacyState: {
        ...prior,
        destination: 'Bogotá',
        destinationStops: ['Bogotá', 'Osaka'],
      },
      legacyReply: 'Reordered stops.',
      legacyAct: amendAct('Reordered stops.'),
    });
    expect(reordered.previewState.destinationStops).toEqual([
      'Bogotá',
      'Osaka',
    ]);
  });

  it('full-route replacement Lisbon→Osaka→Bogotá returning Muscat', () => {
    const prior = state({ openClarification: clarOsaka });
    const comparison = runDualPathComparison({
      message:
        'Actually from Lisbon to Osaka then Bogotá, returning from Muscat',
      priorState: prior,
      legacyState: {
        ...prior,
        origin: 'Lisbon',
        destination: 'Osaka',
        destinationStops: ['Osaka', 'Bogotá'],
        tripStructure: 'multi_city',
        openClarification: null,
      },
      legacyReply: 'Route updated.',
      legacyAct: { kind: 'amend', reply: 'Route updated.', confidence: 0.85 },
    });
    expect(comparison.semantic.intent).toBe('replace_route');
    expect(comparison.previewState.origin).toBe('Lisbon');
    expect(comparison.previewState.destinationStops).toEqual(
      expect.arrayContaining(['Osaka', 'Bogotá']),
    );
    expect(comparison.clearedClarificationIds).toContain('place-role:Osaka');
  });

  it('preserve dates while changing destination to Nairobi', () => {
    const prior = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka'],
      departureDate: '2026-10-01',
      returnDate: '2026-10-15',
    });
    const comparison = runDualPathComparison({
      message: 'Keep the dates but change the destination to Nairobi',
      priorState: prior,
      legacyState: {
        ...prior,
        destination: 'Nairobi',
        destinationStops: ['Nairobi'],
      },
      legacyReply: 'Destination updated; dates kept.',
      legacyAct: {
        kind: 'amend',
        reply: 'Destination updated; dates kept.',
        confidence: 0.85,
      },
    });
    expect(comparison.previewState.departureDate).toBe('2026-10-01');
    expect(comparison.previewState.returnDate).toBe('2026-10-15');
    expect(comparison.previewState.destinationStops).toContain('Nairobi');
    expect(
      comparison.planner.operations.some((o) => o.op === 'preserve_dates'),
    ).toBe(true);
  });

  it('unrelated hotel request while clarification remains open → keep clar', () => {
    const prior = state({ openClarification: clarBangkok });
    const comparison = runDualPathComparison({
      message: 'What about hotels?',
      priorState: prior,
      legacyState: prior,
      legacyReply: clarBangkok.prompt,
      legacyAct: clarifyAct(clarBangkok),
    });
    expect(comparison.semantic.clarificationStance).toBe('unrelated');
    expect(comparison.previewState.openClarificationId).toBe(
      'place-role:Bangkok',
    );
    expect(comparison.validation.clarificationAction).toBe('keep');
  });

  it('reset / restart clears preview travel state', () => {
    const prior = state({ ...multiCityLisbon });
    const reset = runDualPathComparison({
      message: 'Forget everything and start again',
      priorState: prior,
      legacyState: state(),
      legacyReply: 'Where would you like to go?',
      legacyAct: askAct('Where would you like to go?'),
    });
    expect(reset.previewState.origin).toBeNull();
    expect(reset.previewState.destinationStops).toBeNull();

    const restart = runDualPathComparison({
      message: 'Restart',
      priorState: prior,
      legacyState: state(),
      legacyReply: 'Where would you like to go?',
      legacyAct: askAct('Where would you like to go?'),
    });
    expect(restart.previewState.origin).toBeNull();
  });

  it('invalid reference (second stop with one stop) does not mutate', () => {
    const prior = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka'],
    });
    const before = freezeClone(prior);
    const comparison = runDualPathComparison({
      message: 'Remove the second stop',
      priorState: prior,
      legacyState: prior,
      legacyReply: 'I am not sure which stop you mean.',
      legacyAct: {
        kind: 'ask',
        reply: 'I am not sure which stop you mean.',
        askTopic: 'destination',
        confidence: 0.5,
      },
    });
    expect(prior).toEqual(before);
    expect(comparison.previewState.destinationStops).toEqual(['Osaka']);
    expect(
      comparison.planner.operations.every(
        (o) => o.op === 'no_state_change' || o.op.startsWith('preserve_'),
      ),
    ).toBe(true);
  });

  it('low-confidence contradiction blocks unsafe mutation', () => {
    const prior = state({
      origin: 'Lisbon',
      destination: 'Osaka',
      destinationStops: ['Osaka'],
    });
    const comparison = runDualPathComparison({
      message: 'Maybe change Osaka to Muscat somehow',
      priorState: prior,
      legacyState: prior,
      legacyReply: 'Could you clarify the destination?',
      legacyAct: {
        kind: 'ask',
        reply: 'Could you clarify the destination?',
        askTopic: 'destination',
        confidence: 0.5,
      },
    });
    expect(comparison.semantic.confidence).toBeLessThan(0.55);
    expect(
      comparison.validation.rejected.some((r) =>
        /Low confidence/i.test(r.reason),
      ),
    ).toBe(true);
    expect(comparison.previewState.destinationStops).toEqual(['Osaka']);
    expect(comparison.divergence).toBe('unsafe_new_path_blocked');
  });

  it('preview act is deterministic across repeated dual-runs', () => {
    const prior = state({ openClarification: clarBangkok });
    const a = runDualPathComparison({
      message: 'bangkok',
      priorState: prior,
      legacyState: prior,
      legacyReply: clarBangkok.prompt,
      legacyAct: clarifyAct(clarBangkok),
    });
    const b = runDualPathComparison({
      message: 'bangkok',
      priorState: prior,
      legacyState: prior,
      legacyReply: clarBangkok.prompt,
      legacyAct: clarifyAct(clarBangkok),
    });
    expect(a).toEqual(b);
  });

  it('classifyDivergence covers same/different state×act categories', () => {
    const prior = state({ origin: 'Lisbon', destination: 'Osaka' });
    const previewAct = choosePreviewConsultantAct({
      previewState: prior,
      validation: validateCanonicalOperations({
        operations: planCanonicalOperations({
          semantic: interpretDiagnosticSemantic({
            message: 'hello',
            currentState: prior,
          }),
          currentState: prior,
        }).operations,
        currentState: prior,
      }),
      semantic: interpretDiagnosticSemantic({
        message: 'hello',
        currentState: prior,
      }),
      clearedClarificationIds: [],
      priorClarificationId: null,
    });

    expect(
      classifyDivergence({
        priorState: prior,
        legacyState: prior,
        legacyAct: {
          kind: 'ask',
          reply: 'When would you like to depart?',
          askTopic: 'departureDate',
          confidence: 0.8,
        },
        previewState: prior,
        previewAct: { ...previewAct, kind: 'ask' },
        validationRejectedPlace: false,
        newPathOnlyNoOpOrNarrow: false,
        message: 'hello',
      }).divergence,
    ).toBe('same_state_same_act');

    expect(
      classifyDivergence({
        priorState: prior,
        legacyState: prior,
        legacyAct: {
          kind: 'summarise',
          reply: 'Here is your trip.',
          confidence: 0.8,
        },
        previewState: prior,
        previewAct: { ...previewAct, kind: 'ask' },
        validationRejectedPlace: false,
        newPathOnlyNoOpOrNarrow: false,
        message: 'hello',
      }).divergence,
    ).toBe('same_state_different_act');

    expect(
      classifyDivergence({
        priorState: prior,
        legacyState: prior,
        legacyAct: {
          kind: 'ask',
          reply: 'When would you like to depart?',
          askTopic: 'departureDate',
          confidence: 0.8,
        },
        previewState: { ...prior, origin: 'Vancouver' },
        previewAct: { ...previewAct, kind: 'ask' },
        validationRejectedPlace: false,
        newPathOnlyNoOpOrNarrow: false,
        message: 'hello',
      }).divergence,
    ).toBe('different_state_same_act');

    expect(
      classifyDivergence({
        priorState: prior,
        legacyState: prior,
        legacyAct: {
          kind: 'summarise',
          reply: 'Here is your trip.',
          confidence: 0.8,
        },
        previewState: { ...prior, origin: 'Vancouver' },
        previewAct: { ...previewAct, kind: 'ask' },
        validationRejectedPlace: false,
        newPathOnlyNoOpOrNarrow: false,
        message: 'hello',
      }).divergence,
    ).toBe('different_state_different_act');
  });

  it('new_path_abstained when preview only narrows under open clar', () => {
    const prior = state({ openClarification: clarOsaka });
    const semantic = interpretDiagnosticSemantic({
      message: 'Osaka',
      currentState: prior,
    });
    const planner = planCanonicalOperations({ semantic, currentState: prior });
    const validation = validateCanonicalOperations({
      operations: planner.operations,
      currentState: prior,
    });
    const committed = commitCanonicalOperations({
      currentState: prior,
      accepted: validation.accepted,
      clarificationAction: validation.clarificationAction,
      narrowedClarification: validation.narrowedClarification,
    });
    const previewAct = choosePreviewConsultantAct({
      previewState: committed.state,
      validation,
      semantic,
      clearedClarificationIds: committed.clearedClarificationIds,
      priorClarificationId: clarOsaka.id,
    });

    // Force non-loop legacy act kind so abstain path is reachable.
    const classified = classifyDivergence({
      priorState: prior,
      legacyState: { ...prior, openClarification: clarOsaka },
      legacyAct: {
        kind: 'ask',
        reply: 'Where from?',
        askTopic: 'origin',
        confidence: 0.5,
      },
      previewState: committed.state,
      previewAct,
      validationRejectedPlace: false,
      newPathOnlyNoOpOrNarrow: true,
      message: 'not-the-subject',
    });
    expect(classified.divergence).toBe('new_path_abstained');
  });
});

describe('Phase 4 — live dual-run corpus (legacy owns result)', () => {
  it('legacy result.state/reply unchanged vs dual-run legacy snapshot', async () => {
    let s = state();
    const first = await liveTurn('I want to go Bangkok and Beirut', s, 0);
    expect(first.dualRunComparison.behaviourSwitchActive).toBe(false);
    expect(first.dualRunComparison.legacy.reply).toBe(first.reply);
    expect(first.dualRunComparison.legacy.state.openClarificationId).toBe(
      first.state.openClarification?.id ?? null,
    );
    // Diagnostic must not override production behaviour.
    expect(first.state.openClarification?.subject).toBe('Bangkok');
    expect(first.reply).toBe(
      'Are you starting from Bangkok, or is Bangkok your first destination?',
    );

    s = first.state;
    const second = await liveTurn('bangkok', s, 1);
    // Current production still loops — telemetry records it.
    expect(second.reply).toBe(first.reply);
    expect(second.dualRunComparison.divergence).toBe('legacy_loop_risk');
    expect(second.dualRunComparison.previewAct.reply.length).toBeLessThan(
      second.reply.length,
    );
    expect(second.dualRunComparison.previewState.origin).toBeNull();
    expect(second.state.openClarification?.id).toBe(
      second.dualRunComparison.legacy.state.openClarificationId,
    );
    // result.state remains legacy — not preview narrowed state.
    expect(second.state.openClarification?.id).toBe('place-role:Bangkok');
    expect(second.dualRunComparison.previewAct.clarificationId).not.toBe(
      'place-role:Bangkok',
    );
  });

  it('corpus divergence counts across required scenarios', () => {
    const counts: Record<DivergenceCategory, number> = {
      same_state_same_act: 0,
      same_state_different_act: 0,
      different_state_same_act: 0,
      different_state_different_act: 0,
      new_path_abstained: 0,
      legacy_loop_risk: 0,
      unsafe_new_path_blocked: 0,
    };

    const cases: Array<{
      name: string;
      message: string;
      prior: ConversationCoreState;
      legacyState: ConversationCoreState;
      legacyReply: string;
      legacyAct: ConsultantAct;
    }> = [
      {
        name: 'loop',
        message: 'bangkok',
        prior: state({ openClarification: clarBangkok }),
        legacyState: state({ openClarification: clarBangkok }),
        legacyReply: clarBangkok.prompt,
        legacyAct: clarifyAct(clarBangkok),
      },
      {
        name: 'explicit',
        message: 'starting from Osaka',
        prior: state({ openClarification: clarOsaka }),
        legacyState: state({
          origin: 'Osaka',
          destination: 'Nairobi',
          destinationStops: ['Nairobi'],
        }),
        legacyReply: 'When would you like to depart?',
        legacyAct: askAct('When would you like to depart?'),
      },
      {
        name: 'bare-osaka',
        message: 'Osaka',
        prior: state({ openClarification: clarOsaka }),
        legacyState: state({ openClarification: clarOsaka }),
        legacyReply: clarOsaka.prompt,
        legacyAct: clarifyAct(clarOsaka),
      },
      {
        name: 'origin-correction',
        message: 'Leaving from Vancouver instead of Lisbon',
        prior: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyState: state({
          origin: 'Vancouver',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyReply: 'Updated origin.',
        legacyAct: amendAct('Updated origin.'),
      },
      {
        name: 'dest-replace',
        message: 'Change Osaka to Muscat',
        prior: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka', 'Bogotá'],
          tripStructure: 'multi_city',
        }),
        legacyState: state({
          origin: 'Lisbon',
          destination: 'Muscat',
          destinationStops: ['Muscat', 'Bogotá'],
          tripStructure: 'multi_city',
        }),
        legacyReply: 'Updated.',
        legacyAct: amendAct(),
      },
      {
        name: 'remove',
        message: 'Remove Osaka',
        prior: state({ ...multiCityLisbon }),
        legacyState: state({
          ...multiCityLisbon,
          destination: 'Bogotá',
          destinationStops: ['Bogotá'],
        }),
        legacyReply: 'Removed.',
        legacyAct: amendAct('Removed.'),
      },
      {
        name: 'add',
        message: 'Add Vancouver',
        prior: state({ ...multiCityLisbon }),
        legacyState: state({
          ...multiCityLisbon,
          destinationStops: ['Osaka', 'Bogotá', 'Vancouver'],
        }),
        legacyReply: 'Added.',
        legacyAct: amendAct('Added.'),
      },
      {
        name: 'reorder',
        message: 'Put Bogotá before Osaka',
        prior: state({ ...multiCityLisbon }),
        legacyState: state({
          ...multiCityLisbon,
          destination: 'Bogotá',
          destinationStops: ['Bogotá', 'Osaka'],
        }),
        legacyReply: 'Reordered.',
        legacyAct: amendAct('Reordered.'),
      },
      {
        name: 'full-route',
        message: 'From Lisbon to Osaka then Bogotá returning from Muscat',
        prior: state({ openClarification: clarOsaka }),
        legacyState: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka', 'Bogotá'],
          tripStructure: 'multi_city',
        }),
        legacyReply: 'Route set.',
        legacyAct: { kind: 'amend', reply: 'Route set.', confidence: 0.85 },
      },
      {
        name: 'preserve-dates',
        message: 'Keep the dates but change the destination to Nairobi',
        prior: state({
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
        legacyAct: amendAct(),
      },
      {
        name: 'unrelated-service',
        message: 'What about hotels?',
        prior: state({ openClarification: clarBangkok }),
        legacyState: state({ openClarification: clarBangkok }),
        legacyReply: clarBangkok.prompt,
        legacyAct: clarifyAct(clarBangkok),
      },
      {
        name: 'reset',
        message: 'Forget everything and start again',
        prior: state({ ...multiCityLisbon }),
        legacyState: state(),
        legacyReply: 'Where would you like to go?',
        legacyAct: askAct('Where would you like to go?'),
      },
      {
        name: 'invalid-ref',
        message: 'Remove the second stop',
        prior: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyState: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyReply: 'Not sure.',
        legacyAct: {
          kind: 'ask',
          reply: 'Not sure.',
          askTopic: 'destination',
          confidence: 0.5,
        },
      },
      {
        name: 'low-confidence',
        message: 'Maybe change Osaka to Muscat somehow',
        prior: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyState: state({
          origin: 'Lisbon',
          destination: 'Osaka',
          destinationStops: ['Osaka'],
        }),
        legacyReply: 'Could you clarify?',
        legacyAct: {
          kind: 'ask',
          reply: 'Could you clarify?',
          askTopic: 'destination',
          confidence: 0.5,
        },
      },
    ];

    const traces: Array<{ name: string; divergence: DivergenceCategory }> = [];
    for (const c of cases) {
      const comparison = runDualPathComparison({
        message: c.message,
        priorState: c.prior,
        legacyState: c.legacyState,
        legacyReply: c.legacyReply,
        legacyAct: c.legacyAct,
      });
      expect(comparison.behaviourSwitchActive).toBe(false);
      counts[comparison.divergence] += 1;
      traces.push({ name: c.name, divergence: comparison.divergence });
    }

    // Required categories must appear in the corpus.
    expect(counts.legacy_loop_risk).toBeGreaterThanOrEqual(1);
    expect(counts.unsafe_new_path_blocked).toBeGreaterThanOrEqual(1);

    // Surfaced for the Phase 4 report (assert structure stays stable).
    expect(traces.length).toBe(cases.length);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(cases.length);

    // Attach counts on expect message for CI logs.
    expect({
      divergenceCounts: counts,
      traces,
    }).toMatchObject({
      divergenceCounts: expect.any(Object),
      traces: expect.any(Array),
    });
  });
});
