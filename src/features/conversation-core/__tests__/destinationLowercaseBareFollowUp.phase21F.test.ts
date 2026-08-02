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
 * Phase 21F — lowercase bare destination follow-up fix (production path).
 *
 * Proves casing-insensitive bare places when destination is null, with
 * Title-Case storage, while missing-"to" cues and deny-list guards stay put.
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
      conversationId: 'conversation-21f-lowercase-bare',
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
    userEntryId: `user-21f-${index}`,
    assistantEntryId: `assistant-21f-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 2, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 2, 0, 0, index * 2 + 1)),
  });
}

describe('Phase 21F — lowercase bare destination follow-up', () => {
  it('locks casing-insensitive bare path + Title-Case emit in destination extractor', () => {
    const source = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/DestinationConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(source).toMatch(/Phase 21F/);
    expect(source).toMatch(/toTitleCasePlace/);
    expect(source).toMatch(/\^\[A-Za-z\]\+/);
    expect(source).toMatch(/isDestinationFollowUpActive/);
    expect(source).toMatch(/extractExplicitDestination\(input\.message\)/);
    // Missing-"to" remains out of scope — no go/<place> cue without "to".
    expect(source).toMatch(/\\s\+to\\s\+\(\.\+\)\$\/i/);
  });

  it('primary: Hi Aleya. → lebanon sets Lebanon and advances to origin', () => {
    let s = createState();
    let result = turn('Hi Aleya.', s, 0);
    expect(result.state.destination).toBeNull();
    expect(result.reply).toContain(DESTINATION_Q);

    s = result.state;
    result = turn('lebanon', s, 1);
    expect(result.state.destination).toBe('Lebanon');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
    expect(result.reply).not.toContain(DESTINATION_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });

  it.each([
    { message: 'lebanon', stored: 'Lebanon' },
    { message: 'melbourne', stored: 'Melbourne' },
    { message: 'sydney', stored: 'Sydney' },
    { message: 'brisbane', stored: 'Brisbane' },
    { message: 'perth', stored: 'Perth' },
    { message: 'paris', stored: 'Paris' },
    { message: 'gold coast', stored: 'Gold Coast' },
    { message: 'new york', stored: 'New York' },
    { message: 'united arab emirates', stored: 'United Arab Emirates' },
    { message: 'Lebanon', stored: 'Lebanon' },
    { message: 'Melbourne', stored: 'Melbourne' },
    { message: 'Gold Coast', stored: 'Gold Coast' },
    { message: 'New York', stored: 'New York' },
    { message: 'United Arab Emirates', stored: 'United Arab Emirates' },
    { message: 'lebanon.', stored: 'Lebanon' },
    { message: 'GOLD COAST', stored: 'Gold Coast' },
  ])(
    'bare $message → destination=$stored and origin follow-up',
    ({ message, stored }) => {
      let s = createState();
      s = turn('Hi Aleya.', s, 0).state;
      const result = turn(message, s, 1);
      expect(result.state.destination).toBe(stored);
      expect(result.trace.messageInterpreted).toBe(true);
      expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
    },
  );

  it('explicit cues unchanged (including lowercase captured values)', () => {
    const extractor = new DestinationConversationStateExtractor();
    const active = createState({ destination: null });
    expect(
      extractor.extract({
        message: 'I want to travel to Lebanon',
        currentState: active,
      }),
    ).toEqual({ stateUpdate: { destination: 'Lebanon' } });
    expect(
      extractor.extract({
        message: 'I want to travel to lebanon',
        currentState: active,
      }),
    ).toEqual({ stateUpdate: { destination: 'lebanon' } });
    expect(
      extractor.extract({
        message: 'I want to go to Lebanon',
        currentState: active,
      }),
    ).toEqual({ stateUpdate: { destination: 'Lebanon' } });
    expect(
      extractor.extract({
        message: 'I want to go to lebanon',
        currentState: active,
      }),
    ).toEqual({ stateUpdate: { destination: 'lebanon' } });
  });

  it('missing-"to" wording remains unsupported', () => {
    for (const message of [
      'i want to go lebanon',
      'I want to go Lebanon',
      'go Melbourne',
    ]) {
      const result = turn(message, createState(), 0);
      expect(result.state.destination, message).toBeNull();
      expect(result.trace.messageInterpreted, message).toBe(false);
    }
  });

  it('guard phrases never become destination', () => {
    const guards = [
      'hello',
      'hi',
      'yes',
      'no',
      'maybe',
      'not sure',
      'surprise me',
      'somewhere warm',
      'help',
      'what can you do',
      'beach',
      'Beach',
      'flights',
      'Flights',
      'accommodation',
      'Accommodation',
      'activities',
      'Activities',
      'restaurants',
      'Restaurants',
      'car hire',
      'Car Hire',
    ];
    const extractor = new DestinationConversationStateExtractor();
    const active = createState({ destination: null });
    for (const message of guards) {
      expect(
        extractor.extract({ message, currentState: active }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('bare destination inactive once destination is set; origin may claim place', () => {
    const result = turn(
      'Sydney',
      createState({ destination: 'Melbourne', origin: null }),
      0,
    );
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.origin).toBe('Sydney');
    expect(result.trace.messageInterpreted).toBe(true);
  });

  it('composite merges Title-Case bare destination when active', () => {
    expect(
      extractConversationState({
        message: 'lebanon',
        currentState: createState({ destination: null }),
      }).stateUpdate.destination,
    ).toBe('Lebanon');
    expect(
      extractConversationState({
        message: 'lebanon',
        currentState: createState({ destination: 'Perth' }),
      }).stateUpdate.destination,
    ).toBeUndefined();
  });
});
