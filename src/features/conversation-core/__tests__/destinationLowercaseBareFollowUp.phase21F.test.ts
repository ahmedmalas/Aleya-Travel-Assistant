/**
 * Phase 21E/F lowercase bare-destination patches — RETIRED.
 * Place casing normalize belongs to shared place resolve (TLI / SI), not
 * follow-up extractor Title-Case patches.
 */

import { describe, expect, it } from 'vitest';
import { createInitialConversationCoreState } from '../types';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { runArchitecturePipeline } from '../../conversation-architecture/runArchitecturePipeline';
import { interpretSemanticMeaning } from '../../conversation-interpretation/interpretSemanticMeaning';

const NOW = new Date('2026-08-05T00:00:00.000Z');

describe('Phase 21E/F lowercase destination patches retired', () => {
  it('extractor bare lowercase path is inert', () => {
    const extractor = new DestinationConversationStateExtractor();
    const idle = createInitialConversationCoreState({
      conversationId: '21f-retire',
      now: NOW,
    });
    expect(
      extractor.extract({ message: 'lebanon', currentState: idle }),
    ).toEqual({ stateUpdate: {} });
  });

  it('shared SI resolves curated lowercase place via travel frame', () => {
    const state = createInitialConversationCoreState({
      conversationId: '21f-cap',
      now: NOW,
    });
    const semantic = interpretSemanticMeaning({
      message: 'I want to go lebanon',
      currentState: state,
      now: NOW,
    });
    expect(
      semantic.deltas.some(
        (d) =>
          d.kind === 'mention_place' &&
          d.entities.some((e) => e.resolvedHint === 'Lebanon'),
      ),
    ).toBe(true);
    const pipe = runArchitecturePipeline({
      message: 'I want to go lebanon',
      currentState: state,
      now: NOW,
    });
    expect(pipe.committed.state.destination).toBe('Lebanon');
  });
});
