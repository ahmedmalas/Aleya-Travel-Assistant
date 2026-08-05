/**
 * Phase 21B bare-origin patch — RETIRED (Engine Consolidation Phase 5/6).
 *
 * Authoritative replacement: Dialogue-bound PlaceLike under origin obligation
 * + Travel Domain Planner sealed domainTarget (see dialogueLayer /
 * engineConsolidationOwnership tests).
 */

import { describe, expect, it } from 'vitest';
import { createInitialConversationCoreState } from '../types';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { runArchitecturePipeline } from '../../conversation-architecture/runArchitecturePipeline';
import { createInitialDialogueState } from '../../conversation-architecture/dialogue/dialogueState';
import { updateDialogueStateAfterAct } from '../../conversation-architecture/dialogue/updateDialogueStateAfterAct';

const NOW = new Date('2026-08-05T00:00:00.000Z');

describe('Phase 21B bare-origin patch retired', () => {
  it('extractor no longer emits origin from bare place follow-up', () => {
    const extractor = new OriginConversationStateExtractor();
    const active = {
      ...createInitialConversationCoreState({
        conversationId: '21b-retire',
        now: NOW,
      }),
      destination: 'Melbourne',
    };
    expect(
      extractor.extract({ message: 'Sydney', currentState: active }),
    ).toEqual({ stateUpdate: {} });
  });

  it('governed path binds bare place to origin via Dialogue obligation', () => {
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
        reply: 'Where will you be travelling from?',
        askTopic: 'origin',
        confidence: 0.8,
      },
      turnCount: 1,
    });
    const state = {
      ...createInitialConversationCoreState({
        conversationId: '21b-cap',
        now: NOW,
      }),
      destination: 'Melbourne',
      destinationStops: ['Melbourne'],
      dialogueState: dialogue,
      turnCount: 1,
    };
    const pipe = runArchitecturePipeline({
      message: 'Sydney',
      currentState: state,
      now: NOW,
    });
    expect(pipe.dialogueDecision.event).toBe('answered_previous_move');
    expect(
      pipe.planner.operations.some((o) => o.op === 'set_origin'),
    ).toBe(true);
    expect(pipe.committed.state.origin).toBe('Sydney');
  });
});
