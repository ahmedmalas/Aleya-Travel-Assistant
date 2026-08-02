import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { extractConversationState } from '../extractConversationState';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 21B — bare origin follow-up extraction (production path + extractor).
 *
 * Proves destination-complete + origin-null active context accepts bare place
 * answers through processConversationTurn, and that guards refuse bare places
 * when origin does not own the follow-up.
 */

const ROOT = process.cwd();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ORIGIN_Q = FOLLOW_UPS.origin;
const DEPARTURE_Q = FOLLOW_UPS.departureDate;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-21b-origin-bare',
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
    userEntryId: `user-21b-${index}`,
    assistantEntryId: `assistant-21b-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index * 2 + 1)),
  });
}

describe('Phase 21B — bare origin follow-up extraction', () => {
  it('locks active-origin gate ownership inside OriginConversationStateExtractor', () => {
    const source = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/OriginConversationStateExtractor.ts'),
      'utf8',
    );
    expect(source).toMatch(/Phase 21B/);
    expect(source).toMatch(/isOriginFollowUpActive/);
    expect(source).toMatch(/extractBareOriginPlace/);
    expect(source).toMatch(/extractExplicitOrigin\(input\.message\)/);
    expect(source).not.toMatch(/import \{[^}]*selectConversationFollowUpQuestion/);
  });

  it.each([
    { name: 'bare place', message: 'Sydney' },
    { name: 'bare place with period', message: 'Sydney.' },
    { name: 'from cue', message: 'from Sydney' },
    { name: 'travelling-from cue', message: 'I am travelling from Sydney' },
    { name: 'will-be-travelling-from cue', message: 'I will be travelling from Sydney' },
  ])(
    'production path Melbourne → $name sets origin and advances to departure',
    ({ message }) => {
      let s = createState();
      let result = turn('I want to go to Melbourne.', s, 0);
      expect(result.state.destination).toBe('Melbourne');
      expect(result.state.origin).toBeNull();
      expect(result.reply).toContain(ORIGIN_Q);

      s = result.state;
      result = turn(message, s, 1);
      expect(result.state.origin).toBe('Sydney');
      expect(result.state.destination).toBe('Melbourne');
      expect(result.trace.messageInterpreted).toBe(true);
      expect(result.reply).toContain(DEPARTURE_Q);
      expect(result.reply).not.toContain(ORIGIN_Q);
      expect(selectConversationFollowUpQuestion(result.state)).toBe(DEPARTURE_Q);
    },
  );

  it('multi-turn Melbourne → Sydney. does not re-ask origin', () => {
    let s = createState();
    let result = turn('I want to go to Melbourne.', s, 0);
    s = result.state;
    result = turn('Sydney.', s, 1);
    expect(result.state.origin).toBe('Sydney');
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.reply).toContain(DEPARTURE_Q);
    expect(result.reply).not.toMatch(/travelling from\?/i);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DEPARTURE_Q);
  });

  it('extractor: bare place emits origin only when origin follow-up is active', () => {
    const extractor = new OriginConversationStateExtractor();
    const active = createState({ destination: 'Melbourne', origin: null });
    expect(
      extractor.extract({ message: 'Sydney', currentState: active }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      extractor.extract({ message: 'Sydney.', currentState: active }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });

    // destination still required
    expect(
      extractor.extract({
        message: 'Sydney',
        currentState: createState({ destination: null, origin: null }),
      }),
    ).toEqual({ stateUpdate: {} });

    // origin already populated
    expect(
      extractor.extract({
        message: 'Sydney',
        currentState: createState({
          destination: 'Melbourne',
          origin: 'Hobart',
        }),
      }),
    ).toEqual({ stateUpdate: {} });

    // departure is active (origin complete)
    expect(
      extractor.extract({
        message: 'Sydney',
        currentState: createState({
          destination: 'Melbourne',
          origin: 'Hobart',
          departureDate: null,
        }),
      }),
    ).toEqual({ stateUpdate: {} });

    // bare repeat of completed destination is not origin
    expect(
      extractor.extract({
        message: 'Melbourne',
        currentState: active,
      }),
    ).toEqual({ stateUpdate: {} });

    // multi-word chatter is not bare origin (use from-cues for multi-word places)
    expect(
      extractor.extract({
        message: 'Gold Coast',
        currentState: active,
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('production path guards: bare place does not set origin incorrectly', () => {
    // destination still required — Phase 21D may set destination; origin stays null
    let result = turn('Sydney', createState(), 0);
    expect(result.state.origin).toBeNull();
    expect(result.state.destination).toBe('Sydney');
    expect(result.trace.messageInterpreted).toBe(true);

    // origin already set; departure active
    result = turn(
      'Sydney',
      createState({
        destination: 'Melbourne',
        origin: 'Hobart',
        departureDate: null,
      }),
      1,
    );
    expect(result.state.origin).toBe('Hobart');
    expect(result.trace.messageInterpreted).toBe(false);
    expect(selectConversationFollowUpQuestion(result.state)).toBe(DEPARTURE_Q);

    // origin already set; bare place must not overwrite
    result = turn(
      'Sydney.',
      createState({ destination: 'Melbourne', origin: 'Hobart' }),
      2,
    );
    expect(result.state.origin).toBe('Hobart');
  });

  it('composite path merges bare origin when active', () => {
    const active = createState({ destination: 'Melbourne', origin: null });
    expect(
      extractConversationState({
        message: 'Sydney.',
        currentState: active,
      }).stateUpdate.origin,
    ).toBe('Sydney');
    expect(
      extractConversationState({
        message: 'Sydney',
        currentState: createState({ destination: null, origin: null }),
      }).stateUpdate.origin,
    ).toBeUndefined();
  });

  it('hedged or questioned bare wording stays uninterpreted when origin is active', () => {
    const s = createState({ destination: 'Melbourne', origin: null });
    const hedged = turn('maybe Brisbane', s, 0);
    expect(hedged.state.origin).toBeNull();
    expect(hedged.trace.messageInterpreted).toBe(false);

    const questioned = turn('Sydney?', s, 1);
    expect(questioned.state.origin).toBeNull();
    expect(questioned.trace.messageInterpreted).toBe(false);

    const please = turn('Brisbane please', s, 2);
    expect(please.state.origin).toBeNull();
    expect(please.trace.messageInterpreted).toBe(false);
  });
});
