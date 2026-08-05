/**
 * Phase 21D bare-destination patch — RETIRED (Engine Consolidation Phase 5/6).
 * Replacement: SI roleHint=destination for travel frames; Dialogue binds bare
 * PlaceLike when destination obligation awaits.
 */

import { describe, expect, it } from 'vitest';
import { createInitialConversationCoreState } from '../types';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { runArchitecturePipeline } from '../../conversation-architecture/runArchitecturePipeline';

const NOW = new Date('2026-08-05T00:00:00.000Z');

describe('Phase 21D bare-destination patch retired', () => {
  it('extractor no longer emits destination from bare place follow-up', () => {
    const extractor = new DestinationConversationStateExtractor();
    const idle = createInitialConversationCoreState({
      conversationId: '21d-retire',
      now: NOW,
    });
    expect(
      extractor.extract({ message: 'Melbourne', currentState: idle }),
    ).toEqual({ stateUpdate: {} });
  });

  it('governed path sets destination from travel-frame roleHint', () => {
    const pipe = runArchitecturePipeline({
      message: 'I want to go Melbourne',
      currentState: createInitialConversationCoreState({
        conversationId: '21d-cap',
        now: NOW,
      }),
      now: NOW,
    });
    expect(pipe.committed.state.destination).toBe('Melbourne');
    expect(pipe.previewAct.askTopic).toBe('origin');
  });
});
