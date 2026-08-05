/**
 * Dialogue Reasoner — domain-agnostic contract tests.
 * No travel field names, cities, or transcript-specific phrases.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildTurnContributions,
  createInitialDialogueState,
  reasonDialogue,
  updateDialogueStateAfterAct,
} from '../dialogue';
import { emptySemanticInterpretationResult } from '../semanticInterpretation';

const FORBIDDEN_TRAVEL_TOKENS = [
  'origin',
  'destination',
  'departureDate',
  'returnDate',
  'adultCount',
  'multi_city',
  'flightsRequested',
  'accommodationRequested',
  'carHireRequested',
] as const;

describe('Dialogue Reasoner — domain boundary', () => {
  it('source must not contain travel field tokens', () => {
    const src = readFileSync(
      resolve(
        process.cwd(),
        'src/features/conversation-architecture/dialogue/dialogueReasoner.ts',
      ),
      'utf8',
    );
    for (const token of FORBIDDEN_TRAVEL_TOKENS) {
      expect(src.includes(token), `forbidden token ${token}`).toBe(false);
    }
  });
});

describe('Dialogue Reasoner — conversational events', () => {
  it('classifies no_prior_move for cold start contributions', () => {
    const semantic = emptySemanticInterpretationResult({
      intent: 'inform',
      confidence: 0.8,
      deltas: [
        {
          kind: 'mention_place',
          entities: [],
          value: null,
          evidence: 'place',
        },
      ],
    });
    const contributions = buildTurnContributions(semantic);
    const decision = reasonDialogue({
      dialogueState: createInitialDialogueState(),
      contributions,
      semantic,
      hasBlockingClarification: false,
    });
    expect(decision.event).toBe('no_prior_move');
    expect(decision.planningMode).toBe('apply_contributions_only');
  });

  it('classifies answered_previous_move when contribution matches expect class', () => {
    const prior = createInitialDialogueState({
      lastMove: {
        moveId: 'move:1:ask',
        kind: 'ask',
        expectValueClasses: ['PlaceLike'],
        obligationId: 'obl:move:1:ask',
        promptFingerprint: 'ask',
        issuedAtTurn: 1,
      },
      obligations: [
        {
          id: 'obl:move:1:ask',
          sourceMoveId: 'move:1:ask',
          expectValueClasses: ['PlaceLike'],
          status: 'awaiting',
          domainSealed: { domainTarget: 'origin' },
        },
      ],
      openThread: { threadId: 't', kind: 'capture', status: 'active' },
    });
    const semantic = emptySemanticInterpretationResult({
      intent: 'inform',
      confidence: 0.85,
      deltas: [
        {
          kind: 'mention_place',
          entities: [],
          value: null,
          evidence: 'answer',
        },
      ],
    });
    const decision = reasonDialogue({
      dialogueState: prior,
      contributions: buildTurnContributions(semantic),
      semantic,
      hasBlockingClarification: false,
    });
    expect(decision.event).toBe('answered_previous_move');
    expect(decision.satisfiedObligationIds).toEqual(['obl:move:1:ask']);
    expect(decision.planningMode).toBe('apply_bound_contributions');
  });

  it('classifies ignored_move_with_contribution when classes do not match', () => {
    const prior = createInitialDialogueState({
      lastMove: {
        moveId: 'move:1:ask',
        kind: 'ask',
        expectValueClasses: ['TemporalLike'],
        obligationId: 'obl:move:1:ask',
        promptFingerprint: 'ask',
        issuedAtTurn: 1,
      },
      obligations: [
        {
          id: 'obl:move:1:ask',
          sourceMoveId: 'move:1:ask',
          expectValueClasses: ['TemporalLike'],
          status: 'awaiting',
          domainSealed: { domainTarget: 'departureDate' },
        },
      ],
      openThread: { threadId: 't', kind: 'capture', status: 'active' },
    });
    const semantic = emptySemanticInterpretationResult({
      intent: 'inform',
      confidence: 0.8,
      deltas: [
        {
          kind: 'mention_place',
          entities: [],
          value: null,
          evidence: 'place-not-date',
        },
      ],
    });
    const decision = reasonDialogue({
      dialogueState: prior,
      contributions: buildTurnContributions(semantic),
      semantic,
      hasBlockingClarification: false,
    });
    expect(decision.event).toBe('ignored_move_with_contribution');
    expect(decision.deferredObligationIds).toEqual(['obl:move:1:ask']);
    expect(decision.planningMode).toBe('apply_contributions_only');
  });

  it('classifies restarted and supersedes awaiting obligations', () => {
    const prior = createInitialDialogueState({
      lastMove: {
        moveId: 'move:1:ask',
        kind: 'ask',
        expectValueClasses: ['PlaceLike'],
        obligationId: 'obl:1',
        promptFingerprint: 'ask',
        issuedAtTurn: 1,
      },
      obligations: [
        {
          id: 'obl:1',
          sourceMoveId: 'move:1:ask',
          expectValueClasses: ['PlaceLike'],
          status: 'awaiting',
          domainSealed: {},
        },
      ],
      openThread: { threadId: 't', kind: 'capture', status: 'active' },
    });
    const semantic = emptySemanticInterpretationResult({
      intent: 'restart',
      conversationalControl: 'restart',
      confidence: 0.9,
      deltas: [],
    });
    const decision = reasonDialogue({
      dialogueState: prior,
      contributions: [],
      semantic,
      hasBlockingClarification: false,
    });
    expect(decision.event).toBe('restarted');
    expect(decision.supersededObligationIds).toEqual(['obl:1']);
    expect(decision.planningMode).toBe('apply_restart');
  });

  it('governor update records lastMove and sealed obligation without ladder queue', () => {
    const prior = createInitialDialogueState();
    const decision = reasonDialogue({
      dialogueState: prior,
      contributions: [],
      semantic: emptySemanticInterpretationResult({
        intent: 'inform',
        confidence: 0.7,
        deltas: [],
      }),
      hasBlockingClarification: false,
    });
    const next = updateDialogueStateAfterAct({
      prior,
      decision,
      act: {
        kind: 'ask',
        reply: 'generic ask',
        askTopic: 'origin',
        confidence: 0.8,
      },
      turnCount: 1,
    });
    expect(next.lastMove?.kind).toBe('ask');
    expect(next.obligations).toHaveLength(1);
    expect(next.obligations[0]?.domainSealed.domainTarget).toBe('origin');
    expect(next.obligations[0]?.expectValueClasses).toEqual(['PlaceLike']);
    // Set, not a multi-slot progression queue from missing fields.
    expect(next.obligations.filter((o) => o.status === 'awaiting')).toHaveLength(
      1,
    );
  });
});
