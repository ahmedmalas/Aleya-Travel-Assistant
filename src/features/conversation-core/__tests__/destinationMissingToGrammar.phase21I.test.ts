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
 * Phase 21I — missing-"to" destination travel grammar (production path).
 *
 * Proves go/travel/fly/head + place without "to" sets destination through
 * processConversationTurn, preserves origin, rejects fabricated places, and
 * leaves with-"to" cues + bare-answer ownership intact.
 */

const ROOT = process.cwd();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const DESTINATION_Q = FOLLOW_UPS.destination;
const ORIGIN_Q = FOLLOW_UPS.origin;
const DEPARTURE_Q = FOLLOW_UPS.departureDate;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-21i-missing-to',
      now: new Date('2026-08-04T00:00:00.000Z'),
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
    userEntryId: `user-21i-${index}`,
    assistantEntryId: `assistant-21i-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2 + 1)),
  });
}

describe('Phase 21I — missing-"to" destination grammar', () => {
  it('locks missing-to cue ownership inside DestinationConversationStateExtractor', () => {
    const source = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/DestinationConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(source).toMatch(/Phase 21I/);
    expect(source).toMatch(/MISSING_TO_DESTINATION_CUES/);
    expect(source).toMatch(/asValidatedTitleCasePlace/);
    expect(source).toMatch(/\(\?!to\\b\)/);
    // With-"to" family retained.
    expect(source).toMatch(/\\s\+to\\s\+\(\.\+\)\$\/i/);
    expect(source).not.toMatch(/import \{[^}]*selectConversationFollowUpQuestion/);
  });

  it('Flow A: I want to go Melbourne → Sydney', () => {
    let s = createState();
    let result = turn('I want to go Melbourne', s, 0);
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.origin).toBeNull();
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);

    s = result.state;
    result = turn('Sydney', s, 1);
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.origin).toBe('Sydney');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(DEPARTURE_Q);
    expect(result.reply).not.toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DEPARTURE_Q);
  });

  it('Flow B: travelling from Sydney → I want to go Lebanon', () => {
    let s = createState();
    let result = turn('I am travelling from Sydney', s, 0);
    expect(result.state.origin).toBe('Sydney');
    expect(result.state.destination).toBeNull();
    expect(result.reply).toContain(DESTINATION_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DESTINATION_Q);

    s = result.state;
    result = turn('I want to go Lebanon', s, 1);
    expect(result.state.origin).toBe('Sydney');
    expect(result.state.destination).toBe('Lebanon');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(DEPARTURE_Q);
    expect(result.reply).not.toContain(DESTINATION_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DEPARTURE_Q);
  });

  it('Flow C: go Gold Coast', () => {
    const result = turn('go Gold Coast', createState(), 0);
    expect(result.state.destination).toBe('Gold Coast');
    expect(result.state.origin).toBeNull();
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });

  it('Flow D: I want to go fabricates nothing', () => {
    const result = turn('I want to go', createState(), 0);
    expect(result.state.destination).toBeNull();
    expect(result.state.origin).toBeNull();
    expect(result.trace.messageInterpreted).toBe(false);
    expect(result.reply).toContain(DESTINATION_Q);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DESTINATION_Q);
  });

  it('Flow E: I want to go Melbourne from Sydney — no reversal', () => {
    const result = turn('I want to go Melbourne from Sydney', createState(), 0);
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.origin).toBe('Sydney');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DEPARTURE_Q);
    expect(result.reply).not.toContain(DESTINATION_Q);
    expect(result.reply).not.toContain(ORIGIN_Q);
  });

  it.each([
    { message: 'I want to go Melbourne', destination: 'Melbourne' },
    { message: 'I want to go Lebanon', destination: 'Lebanon' },
    { message: 'I want to travel Gold Coast', destination: 'Gold Coast' },
    { message: 'I want to fly Sydney', destination: 'Sydney' },
    { message: 'go Melbourne', destination: 'Melbourne' },
    { message: 'i want to go lebanon', destination: 'Lebanon' },
    { message: 'I WANT TO GO MELBOURNE', destination: 'Melbourne' },
    { message: 'I want to go Melbourne.', destination: 'Melbourne' },
  ])('missing-to $message → destination=$destination', ({ message, destination }) => {
    const result = turn(message, createState(), 0);
    expect(result.state.destination).toBe(destination);
    expect(result.trace.messageInterpreted).toBe(true);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });

  it.each([
    'I want to go to Melbourne',
    'I want to travel to Lebanon',
    'fly to Sydney',
    'go to Melbourne',
  ])('with-"to" cue preserved: %s', (message) => {
    const extractor = new DestinationConversationStateExtractor();
    const result = extractor.extract({
      message,
      currentState: createState(),
    });
    expect(result.stateUpdate.destination).toBeTruthy();
    // With-"to" path preserves captured casing (not Title-Case rewrite).
    expect(typeof result.stateUpdate.destination).toBe('string');
  });

  it('with-"to" lowercase value casing still preserved', () => {
    const extractor = new DestinationConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'I want to go to lebanon',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { destination: 'lebanon' } });
  });

  it.each([
    'I want to go',
    "let's go",
    'go ahead',
    'I want to travel',
  ])('false positive rejected: %s', (message) => {
    const result = turn(message, createState(), 0);
    expect(result.state.destination, message).toBeNull();
    expect(result.trace.messageInterpreted, message).toBe(false);
    expect(result.reply, message).toContain(DESTINATION_Q);
  });

  it('bare destination ownership preserved when destination is requested', () => {
    let s = createState();
    s = turn('Hi Aleya.', s, 0).state;
    expect(selectConversationFollowUpQuestion(s)).toBe(DESTINATION_Q);
    const result = turn('Sydney', s, 1);
    expect(result.state.destination).toBe('Sydney');
    expect(result.state.origin).toBeNull();
    expect(selectConversationFollowUpQuestion(result.state)).toBe(ORIGIN_Q);
  });

  it('bare origin ownership preserved when origin is requested', () => {
    const result = turn(
      'Sydney',
      createState({ destination: 'Melbourne', origin: null }),
      0,
    );
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.origin).toBe('Sydney');
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DEPARTURE_Q);
  });

  it('origin cues travelling/flying from preserved', () => {
    expect(turn('I am travelling from Sydney', createState(), 0).state).toMatchObject({
      origin: 'Sydney',
      destination: null,
    });
    expect(turn('I am flying from Melbourne', createState(), 0).state).toMatchObject({
      origin: 'Melbourne',
      destination: null,
    });
  });
});
