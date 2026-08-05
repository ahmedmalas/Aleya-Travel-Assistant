/**
 * Semantic engine capability tests (Engine Consolidation Phase 6).
 * Transcript cue locks (Thinking X / sounds good / missing-to vacancy) retired.
 */

import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { runArchitecturePipeline } from '../../conversation-architecture/runArchitecturePipeline';
import { createInitialDialogueState } from '../../conversation-architecture/dialogue/dialogueState';
import { updateDialogueStateAfterAct } from '../../conversation-architecture/dialogue/updateDialogueStateAfterAct';
import { interpretTravelUtterance } from '../interpretTravelUtterance';

const NOW = new Date('2026-08-04T00:00:00.000Z');

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'semantic-engine',
      now: NOW,
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

describe('Semantic conversation engine — capability regressions', () => {
  it('framed destination then Dialogue-bound origin', () => {
    const first = runArchitecturePipeline({
      message: 'I want to go to Melbourne',
      currentState: createState(),
      now: NOW,
    });
    expect(first.committed.state.destination).toBe('Melbourne');

    const dialogue = updateDialogueStateAfterAct({
      prior: createInitialDialogueState(),
      decision: first.dialogueDecision,
      act: first.previewAct,
      turnCount: 1,
    });
    const second = runArchitecturePipeline({
      message: 'Sydney',
      currentState: {
        ...first.committed.state,
        dialogueState: dialogue,
        turnCount: 1,
      },
      now: NOW,
    });
    expect(second.committed.state.origin).toBe('Sydney');
    expect(second.committed.state.destination).toBe('Melbourne');
  });

  it('explicit from-origin cue via offline compatibility path', async () => {
    const interpretation = await interpretTravelUtterance({
      message: 'I am travelling from Sydney',
      currentState: createState(),
      mode: 'offline-semantic',
    });
    expect(interpretation.stateUpdate.origin).toBe('Sydney');
  });

  it('calendar date via offline compatibility path', async () => {
    const s = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
    });
    const interpretation = await interpretTravelUtterance({
      message: '28th of August',
      currentState: s,
      mode: 'offline-semantic',
    });
    expect(interpretation.stateUpdate.departureDate).toMatch(/^\d{4}-08-28$/);
  });

  it('regex fallback remains available as explicit mode only', async () => {
    const interpretation = await interpretTravelUtterance({
      message: 'I want to go to Melbourne',
      currentState: createState(),
      mode: 'regex-fallback',
    });
    expect(interpretation.source).toBe('regex-fallback');
    expect(interpretation.stateUpdate.destination).toBe('Melbourne');
  });

  it('empty travel frame does not fabricate destination on governed path', () => {
    const pipe = runArchitecturePipeline({
      message: 'I want to go',
      currentState: createState(),
      now: NOW,
    });
    expect(pipe.committed.state.destination).toBeNull();
  });

  it('service add via offline compatibility path', async () => {
    const s = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
    });
    const r = await interpretTravelUtterance({
      message: 'add a hotel too',
      currentState: s,
      mode: 'offline-semantic',
    });
    const applied = processConversationTurn({
      message: 'add a hotel too',
      state: s,
      userEntryId: 'u',
      assistantEntryId: 'a',
      userMessageAt: NOW,
      assistantMessageAt: NOW,
      stateUpdate: r.stateUpdate,
      skipExtraction: true,
      replyOverride: 'ok',
    });
    expect(applied.state.accommodationRequested).toBe(true);
  });
});
