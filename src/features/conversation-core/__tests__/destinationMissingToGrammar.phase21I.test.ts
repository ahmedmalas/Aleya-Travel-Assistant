/**
 * Phase 21I missing-"to" grammar patch — RETIRED.
 * Replacement: shared SI destination travel frames (want to go / go to / visit).
 */

import { describe, expect, it } from 'vitest';
import { createInitialConversationCoreState } from '../types';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { runArchitecturePipeline } from '../../conversation-architecture/runArchitecturePipeline';

const NOW = new Date('2026-08-05T00:00:00.000Z');

describe('Phase 21I missing-to grammar patch retired', () => {
  it('extractor missing-to cues are inert', () => {
    const extractor = new DestinationConversationStateExtractor();
    const idle = createInitialConversationCoreState({
      conversationId: '21i-retire',
      now: NOW,
    });
    expect(
      extractor.extract({
        message: 'I want to go Melbourne',
        currentState: idle,
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('governed SI+Planner handles framed go-without-to via roleHint', () => {
    const pipe = runArchitecturePipeline({
      message: 'I want to go Melbourne',
      currentState: createInitialConversationCoreState({
        conversationId: '21i-cap',
        now: NOW,
      }),
      now: NOW,
    });
    expect(pipe.committed.state.destination).toBe('Melbourne');
  });
});
