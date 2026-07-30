import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  generateConversationReply,
} from '../generateConversationReply';

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-10c',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-10c',
    assistantEntryId: 'assistant-10c',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

function questionCount(reply: string): number {
  return (reply.match(/\?/g) ?? []).length;
}

describe('phase 10C — deterministic conversation progression', () => {
  it('follows destination acknowledgement with the origin question', () => {
    const result = turn('go to Brisbane', createState());
    expect(result.state.destination).toBe('Brisbane');
    expect(result.reply).toBe(
      'Great — Brisbane.\nWhere will you be travelling from?',
    );
    expect(questionCount(result.reply)).toBe(1);
  });

  it('follows origin acknowledgement with the departure-date question', () => {
    const result = turn(
      'from Sydney',
      createState({ destination: 'Brisbane' }),
    );
    expect(result.state.origin).toBe('Sydney');
    expect(result.reply).toBe(
      'Perfect — departing from Sydney.\nWhen would you like to depart?',
    );
    expect(questionCount(result.reply)).toBe(1);
  });

  it('follows departure-date acknowledgement with the return-date question', () => {
    const result = turn(
      'Depart on 28 August 2026',
      createState({
        destination: 'Brisbane',
        origin: 'Sydney',
      }),
    );
    expect(result.state.departureDate).toBe('2026-08-28');
    expect(result.reply).toBe(
      'Perfect — departing on 2026-08-28.\nWhen would you like to return?',
    );
    expect(questionCount(result.reply)).toBe(1);
  });

  it('follows service acknowledgement with the first missing required field', () => {
    const missingDestination = turn(
      'book flights. book a hotel',
      createState(),
    );
    expect(missingDestination.reply).toBe(
      "I've added flights and accommodation to your trip requirements.\nWhere would you like to travel?",
    );

    const missingOrigin = turn(
      'add accommodation',
      createState({
        destination: 'Cairns',
        flightsRequested: true,
      }),
    );
    expect(missingOrigin.reply).toBe(
      "I've added accommodation to your trip requirements.\nWhere will you be travelling from?",
    );
  });

  it('never requests a field that already exists in the final state', () => {
    const result = turn(
      'book flights',
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-09-01',
      }),
    );
    expect(result.reply).toBe(
      "I've added flights to your trip requirements.\nWhen would you like to return?",
    );
    expect(result.reply).not.toMatch(/Where would you like to travel/i);
    expect(result.reply).not.toMatch(/travelling from/i);
    expect(result.reply).not.toMatch(/depart\?/i);
  });

  it('lets explicit stateUpdate affect progression through final canonical state', () => {
    const forcedDestination = turn('Hello', createState(), {
      destination: 'Hobart',
    });
    expect(forcedDestination.state.destination).toBe('Hobart');
    expect(forcedDestination.reply).toBe(
      'Great — Hobart.\nWhere will you be travelling from?',
    );

    const completeViaExplicit = turn(
      'add wildlife',
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-09-01',
      }),
      {
        returnDate: '2026-09-08',
      },
    );
    expect(completeViaExplicit.state.returnDate).toBe('2026-09-08');
    expect(completeViaExplicit.reply).toBe(
      `I've added wildlife to your trip requirements.\n${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );
  });

  it('produces only one follow-up question', () => {
    const replies = [
      turn('go to Cairns', createState()).reply,
      turn('from Sydney', createState({ destination: 'Cairns' })).reply,
      turn(
        'book flights. book a hotel',
        createState({ destination: 'Cairns' }),
      ).reply,
      turn(
        'Depart on 28 August 2026',
        createState({ destination: 'Cairns', origin: 'Sydney' }),
      ).reply,
    ];
    for (const reply of replies) {
      expect(questionCount(reply), reply).toBe(1);
      expect(reply.split('\n')).toHaveLength(2);
    }
  });

  it('returns the neutral continuation when all required fields are complete', () => {
    const complete = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
    });
    const result = turn('add beaches', complete);
    expect(result.reply).toBe(
      `I've added beaches to your trip requirements.\n${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );
    expect(questionCount(result.reply)).toBe(1);

    expect(
      generateConversationReply({
        message: 'ignored',
        previousState: complete,
        state: {
          ...complete,
          beachesRequested: true,
        },
      }),
    ).toBe(
      `I've added beaches to your trip requirements.\n${NEUTRAL_TRIP_FALLBACK_REPLY}`,
    );
  });
});
