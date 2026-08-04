import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { extractConversationState } from '../extractConversationState';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 21D — bare destination follow-up extraction (production path + extractor).
 *
 * Proves destination-null active context accepts bare place answers through
 * processConversationTurn, and that guards refuse bare places when destination
 * does not own the follow-up. Missing-"to" travel cues are owned by Phase 21I.
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
      conversationId: 'conversation-21d-destination-bare',
      now: new Date('2026-08-01T00:00:00.000Z'),
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
    userEntryId: `user-21d-${index}`,
    assistantEntryId: `assistant-21d-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index * 2 + 1)),
  });
}

describe('Phase 21D — bare destination follow-up extraction', () => {
  it('locks active-destination gate ownership inside DestinationConversationStateExtractor', () => {
    const source = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/DestinationConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(source).toMatch(/Phase 21D/);
    expect(source).toMatch(/isDestinationFollowUpActive/);
    expect(source).toMatch(/extractBareDestinationPlace/);
    expect(source).toMatch(/extractExplicitDestination\(input\.message\)/);
    expect(source).not.toMatch(
      /import \{[^}]*selectConversationFollowUpQuestion/,
    );
    // Phase 21D did not add missing-"to"; Phase 21I owns that cue family.
    expect(source).toMatch(/Phase 21I/);
    expect(source).toMatch(/MISSING_TO_DESTINATION_CUES/);
  });

  it('primary reproduction: Hi Aleya. → Melbourne sets destination and advances to origin', () => {
    let s = createState();
    let result = turn('Hi Aleya.', s, 0);
    expect(result.state.destination).toBeNull();
    expect(result.trace.messageInterpreted).toBe(false);
    expect(result.reply).toContain(DESTINATION_Q);

    s = result.state;
    result = turn('Melbourne', s, 1);
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.origin).toBeNull();
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
    expect(result.reply).not.toContain(DESTINATION_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });

  it.each([
    { name: 'Melbourne', message: 'Melbourne', destination: 'Melbourne' },
    { name: 'Melbourne.', message: 'Melbourne.', destination: 'Melbourne' },
    { name: 'Gold Coast', message: 'Gold Coast', destination: 'Gold Coast' },
    { name: 'Sydney', message: 'Sydney', destination: 'Sydney' },
    { name: 'Brisbane', message: 'Brisbane', destination: 'Brisbane' },
    { name: 'Perth', message: 'Perth', destination: 'Perth' },
  ])(
    'production path bare follow-up $name sets destination and advances to origin',
    ({ message, destination }) => {
      let s = createState();
      let result = turn('Hi Aleya.', s, 0);
      expect(selectConversationFollowUpQuestion(result.state)).toBe(DESTINATION_Q);

      s = result.state;
      result = turn(message, s, 1);
      expect(result.state.destination).toBe(destination);
      expect(result.trace.messageInterpreted).toBe(true);
      expect(result.reply).toContain(ORIGIN_Q);
      expect(result.reply).not.toContain(DESTINATION_Q);
      expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
    },
  );

  it('physical sequence: missing-to go-Melbourne sets destination (Phase 21I)', () => {
    let s = createState();
    let result = turn('Hi Aleya I want to go Melbourne', s, 0);
    expect(result.state.destination).toBe('Melbourne');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });

  it('extractor: bare place emits destination only when destination follow-up is active', () => {
    const extractor = new DestinationConversationStateExtractor();
    const active = createState({ destination: null });
    expect(
      extractor.extract({ message: 'Melbourne', currentState: active }),
    ).toEqual({ stateUpdate: { destination: 'Melbourne' } });
    expect(
      extractor.extract({ message: 'Melbourne.', currentState: active }),
    ).toEqual({ stateUpdate: { destination: 'Melbourne' } });
    expect(
      extractor.extract({ message: 'Gold Coast', currentState: active }),
    ).toEqual({ stateUpdate: { destination: 'Gold Coast' } });

    // destination already populated — bare path inactive
    expect(
      extractor.extract({
        message: 'Sydney',
        currentState: createState({ destination: 'Melbourne' }),
      }),
    ).toEqual({ stateUpdate: {} });

    // origin owns follow-up (destination complete)
    expect(
      extractor.extract({
        message: 'Sydney',
        currentState: createState({
          destination: 'Melbourne',
          origin: null,
        }),
      }),
    ).toEqual({ stateUpdate: {} });

    // explicit cues still work when destination already set
    expect(
      extractor.extract({
        message: 'go to Cairns',
        currentState: createState({ destination: 'Melbourne' }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
  });

  it('production path guards: bare fillers stay uninterpreted', () => {
    const fillers = [
      'hello',
      'hi',
      'yes',
      'no',
      'maybe',
      'not sure',
      'surprise me',
      'somewhere warm',
      'what can you do',
      'help me',
    ];

    for (const [index, message] of fillers.entries()) {
      const result = turn(message, createState(), index);
      expect(result.state.destination, message).toBeNull();
      expect(result.trace.messageInterpreted, message).toBe(false);
      expect(selectConversationFollowUpQuestion(result.state), message).toBe(
        DESTINATION_Q,
      );
    }
  });

  it('production path guard: bare place does not overwrite existing destination', () => {
    const result = turn(
      'Sydney',
      createState({ destination: 'Melbourne', origin: null }),
      0,
    );
    // Origin 21B may claim bare Sydney when destination is complete.
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.origin).toBe('Sydney');
  });

  it('composite path merges bare destination when active', () => {
    expect(
      extractConversationState({
        message: 'Melbourne.',
        currentState: createState({ destination: null }),
      }).stateUpdate.destination,
    ).toBe('Melbourne');
    expect(
      extractConversationState({
        message: 'Melbourne',
        currentState: createState({ destination: 'Perth' }),
      }).stateUpdate.destination,
    ).toBeUndefined();
  });

  it('missing-"to" travel phrasing is owned by Phase 21I (sets destination)', () => {
    const result = turn('Hi Aleya I want to go Melbourne', createState(), 0);
    expect(result.state.destination).toBe('Melbourne');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });
});
