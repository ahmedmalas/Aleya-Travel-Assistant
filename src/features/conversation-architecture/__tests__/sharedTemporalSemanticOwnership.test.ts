/**
 * Shared temporal meaning for governed Semantic Interpretation.
 * Proves calendar + contextual temporal reuse — not transcript patches.
 */

import { describe, expect, it } from 'vitest';
import { createInitialConversationCoreState } from '../../conversation-core';
import { resolveCalendarDateIso } from '../../conversation-interpretation/calendarDateSemantics';
import { interpretOfflineSemantic } from '../../conversation-interpretation/offlineSemanticInterpreter';
import { buildTurnContributions } from '../dialogue/turnContributions';
import { interpretDiagnosticSemantic } from '../interpretDiagnosticSemantic';
import { runArchitecturePipeline } from '../runArchitecturePipeline';
import { createInitialDialogueState } from '../dialogue/dialogueState';
import { updateDialogueStateAfterAct } from '../dialogue/updateDialogueStateAfterAct';

const NOW = new Date('2026-08-05T00:00:00.000Z');

function withDialogueAwaitingDeparture() {
  const base = createInitialConversationCoreState({
    conversationId: 'temporal-sem',
    now: NOW,
  });
  const dialogue = updateDialogueStateAfterAct({
    prior: createInitialDialogueState(),
    decision: {
      event: 'no_prior_move',
      confidence: 1,
      satisfiedObligationIds: [],
      deferredObligationIds: [],
      supersededObligationIds: [],
      planningMode: 'apply_contributions_only',
      contributionPolicy: 'allow_additional_clear_facts',
      ambiguity: 'none',
      boundContributionRefs: [],
      notes: [],
    },
    act: {
      kind: 'ask',
      reply: 'When would you like to depart?',
      askTopic: 'departureDate',
      confidence: 0.8,
    },
    turnCount: 2,
  });
  return {
    ...base,
    origin: 'Sydney',
    destination: 'Beirut',
    destinationStops: ['Beirut'],
    destinationResolutionStatus: 'resolved' as const,
    originResolutionStatus: 'resolved' as const,
    turnCount: 2,
    dialogueState: dialogue,
  };
}

describe('Shared temporal semantic ownership', () => {
  it('production offline and diagnostic architecture agree on calendar ISO', () => {
    const message = '28th of August';
    const diagnostic = interpretDiagnosticSemantic({
      message,
      currentState: createInitialConversationCoreState({
        conversationId: 'agree',
        now: NOW,
      }),
      now: NOW,
    });
    const offline = interpretOfflineSemantic({
      message,
      currentState: createInitialConversationCoreState({
        conversationId: 'agree',
        now: NOW,
      }),
      activeRequirement: 'departureDate',
      now: NOW,
    });
    const iso = resolveCalendarDateIso(message, NOW);
    expect(iso).toBe('2026-08-28');
    expect(offline.departureDate).toBe(iso);
    expect(
      diagnostic.deltas.some(
        (d) => d.kind === 'set_date' && d.value === iso,
      ),
    ).toBe(true);
    expect(
      buildTurnContributions(diagnostic).some((c) =>
        c.valueClasses.includes('TemporalLike'),
      ),
    ).toBe(true);
  });

  it('does not hard-code a single calendar phrase — month/day forms share resolveCalendarDateIso', () => {
    const forms = [
      '3rd of March',
      'March 3',
      '3 March',
      '12th of January',
      'January 12th',
    ];
    for (const message of forms) {
      const iso = resolveCalendarDateIso(message, NOW);
      expect(iso, message).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const diagnostic = interpretDiagnosticSemantic({
        message,
        currentState: createInitialConversationCoreState({
          conversationId: 'forms',
          now: NOW,
        }),
        now: NOW,
      });
      expect(
        diagnostic.deltas.some(
          (d) => d.kind === 'set_date' && d.value === iso,
        ),
        message,
      ).toBe(true);
    }
  });

  it('awaiting departure obligation + calendar date → bound set_departure_date', () => {
    const state = withDialogueAwaitingDeparture();
    const pipe = runArchitecturePipeline({
      message: '18th of December',
      currentState: state,
      now: NOW,
    });
    expect(
      pipe.contributions.some((c) => c.valueClasses.includes('TemporalLike')),
    ).toBe(true);
    expect(pipe.dialogueDecision.event).toBe('answered_previous_move');
    expect(
      pipe.planner.operations.some(
        (o) =>
          o.op === 'set_departure_date' &&
          (o.value === '2026-12-18' ||
            (typeof o.value === 'object' &&
              o.value !== null &&
              JSON.stringify(o.value).includes('2026-12-18'))),
      ),
    ).toBe(true);
    expect(pipe.committed.state.departureDate).toBe('2026-12-18');
    expect(pipe.previewAct.askTopic).not.toBe('departureDate');
  });

  it('awaiting return obligation binds calendar date to return', () => {
    const base = withDialogueAwaitingDeparture();
    const dialogue = updateDialogueStateAfterAct({
      prior: createInitialDialogueState(),
      decision: {
        event: 'no_prior_move',
        confidence: 1,
        satisfiedObligationIds: [],
        deferredObligationIds: [],
        supersededObligationIds: [],
        planningMode: 'apply_contributions_only',
        contributionPolicy: 'allow_additional_clear_facts',
        ambiguity: 'none',
        boundContributionRefs: [],
        notes: [],
      },
      act: {
        kind: 'ask',
        reply: 'When will you return?',
        askTopic: 'returnDate',
        confidence: 0.8,
      },
      turnCount: 3,
    });
    const state = {
      ...base,
      departureDate: '2026-12-01',
      dialogueState: dialogue,
      turnCount: 3,
    };
    const pipe = runArchitecturePipeline({
      message: '20 January',
      currentState: state,
      now: NOW,
    });
    expect(pipe.dialogueDecision.event).toBe('answered_previous_move');
    expect(
      pipe.planner.operations.some((o) => o.op === 'set_return_date'),
    ).toBe(true);
    expect(pipe.committed.state.returnDate).toBe('2027-01-20');
  });
});
