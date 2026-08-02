import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 21E — lowercase destination runtime failure audit (characterization).
 *
 * History: at Phase 21D tip, bare lowercase places failed Title-Case shape.
 * Phase 21F repairs bare lowercase; this suite retains audit history and
 * asserts the corrected bare path while keeping missing-"to" unsupported.
 */

const ROOT = process.cwd();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const DESTINATION_Q = FOLLOW_UPS.destination;
const ORIGIN_Q = FOLLOW_UPS.origin;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'c2a62457-4cfe-4bec-afd6-d0561a73ecf3',
      now: new Date('2026-08-02T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(message: string, state: ConversationCoreState, index: number) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-21e-${index}`,
    assistantEntryId: `assistant-21e-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 2, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 2, 0, 0, index * 2 + 1)),
  });
}

describe('Phase 21E — lowercase destination runtime failure audit', () => {
  it('locks Phase 21F casing-insensitive bare path superseding 21D Title-Case-only', () => {
    const source = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/DestinationConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(source).toMatch(/Phase 21D/);
    expect(source).toMatch(/Phase 21F/);
    expect(source).toMatch(/toTitleCasePlace/);
    expect(source).toMatch(/\^\[A-Za-z\]\+/);
    // Explicit go/travel cues still require "to".
    expect(source).toMatch(/\\s\+to\\s\+\(\.\+\)\$\/i/);
  });

  it('physical transcript turn 1 still fails; turn 2 lebanon repaired by 21F', () => {
    let s = createState();
    let result = turn('i want to go lebanon', s, 0);
    expect(result.state.destination).toBeNull();
    expect(result.trace.messageInterpreted).toBe(false);
    expect(result.reply).toContain(DESTINATION_Q);

    // Phase 21E failure: bare lowercase rejected. Phase 21F: accepted.
    s = result.state;
    result = turn('lebanon', s, 1);
    expect(result.state.destination).toBe('Lebanon');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });

  it('control: Title-Case bare Lebanon succeeds after greeting', () => {
    let s = createState();
    s = turn('Hi Aleya.', s, 0).state;
    const result = turn('Lebanon', s, 1);
    expect(result.state.destination).toBe('Lebanon');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
  });

  it('control: lowercase bare lebanon succeeds after greeting (Phase 21F)', () => {
    let s = createState();
    s = turn('Hi Aleya.', s, 0).state;
    const result = turn('lebanon', s, 1);
    expect(result.state.destination).toBe('Lebanon');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
  });

  it.each([
    {
      name: 'missing-to Title-Case',
      message: 'I want to go Lebanon',
      destination: null as string | null,
      interpreted: false,
    },
    {
      name: 'missing-to lowercase',
      message: 'I want to go lebanon',
      destination: null as string | null,
      interpreted: false,
    },
    {
      name: 'cued travel-to Title-Case',
      message: 'I want to travel to Lebanon',
      destination: 'Lebanon',
      interpreted: true,
    },
    {
      name: 'cued travel-to lowercase (cue /i; value casing preserved)',
      message: 'I want to travel to lebanon',
      destination: 'lebanon',
      interpreted: true,
    },
    {
      name: 'cued go-to lowercase',
      message: 'i want to go to lebanon',
      destination: 'lebanon',
      interpreted: true,
    },
  ])(
    'after Hi Aleya: $name → destination=$destination',
    ({ message, destination, interpreted }) => {
      let s = createState();
      s = turn('Hi Aleya.', s, 0).state;
      const result = turn(message, s, 1);
      expect(result.state.destination).toBe(destination);
      expect(result.trace.messageInterpreted).toBe(interpreted);
    },
  );

  it('extractor: bare lowercase and Title-Case accepted when active (21F)', () => {
    const extractor = new DestinationConversationStateExtractor();
    const active = createState({ destination: null });
    expect(
      extractor.extract({ message: 'lebanon', currentState: active }),
    ).toEqual({ stateUpdate: { destination: 'Lebanon' } });
    expect(
      extractor.extract({ message: 'Lebanon', currentState: active }),
    ).toEqual({ stateUpdate: { destination: 'Lebanon' } });
    expect(
      extractor.extract({ message: 'gold coast', currentState: active }),
    ).toEqual({ stateUpdate: { destination: 'Gold Coast' } });
    expect(
      extractor.extract({ message: 'Gold Coast', currentState: active }),
    ).toEqual({ stateUpdate: { destination: 'Gold Coast' } });
  });

  it('casing matrix: lowercase and Title-Case bare places succeed with Title-Case store', () => {
    const cases: Array<{ message: string; stored: string }> = [
      { message: 'melbourne', stored: 'Melbourne' },
      { message: 'Melbourne', stored: 'Melbourne' },
      { message: 'sydney', stored: 'Sydney' },
      { message: 'Sydney', stored: 'Sydney' },
      { message: 'paris', stored: 'Paris' },
      { message: 'Paris', stored: 'Paris' },
      { message: 'new york', stored: 'New York' },
      { message: 'New York', stored: 'New York' },
      { message: 'united arab emirates', stored: 'United Arab Emirates' },
      { message: 'United Arab Emirates', stored: 'United Arab Emirates' },
    ];
    for (const { message, stored } of cases) {
      const result = turn(message, createState(), 0);
      expect(result.state.destination, message).toBe(stored);
      expect(result.trace.messageInterpreted, message).toBe(true);
    }
  });
});
