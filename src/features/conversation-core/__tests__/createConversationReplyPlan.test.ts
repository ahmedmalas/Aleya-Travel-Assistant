import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  createConversationReplyPlan,
} from '../createConversationReplyPlan';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';

const ROOT = process.cwd();
const PLAN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationReplyPlan.ts',
);
const REPLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-10g',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
    ...overrides,
  });
}

function planFor(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  return createConversationReplyPlan({
    state,
    classification: classifyConversationStateChange(previousState, state),
  });
}

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-10g',
    assistantEntryId: 'assistant-10g',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10G — deterministic reply planning boundary', () => {
  it('keeps the reply planner internal between classification and rendering', () => {
    const planSource = readFileSync(PLAN_SOURCE, 'utf8');
    const replySource = readFileSync(REPLY_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(planSource).toContain('Phase 10G');
    expect(planSource).toContain('Phase 10H');
    expect(planSource).toContain('Phase 10I');
    expect(planSource).toContain('Phase 10J');
    expect(planSource).toContain('Phase 10K');
    expect(planSource).toContain('Phase 10L');
    expect(planSource).toContain('Phase 10M');
    expect(planSource).toContain('Phase 10N');
    expect(planSource).toMatch(/export function createConversationReplyPlan/);
    expect(planSource).toMatch(/selectConversationReplyComponents\(/);
    expect(planSource).toMatch(/assembleConversationReplyPlan\(/);
    expect(planSource).not.toMatch(/selectConversationFollowUpQuestion\(/);
    expect(planSource).not.toMatch(/selectConversationAcknowledgement\(/);
    expect(planSource).not.toMatch(/selectConversationMessageInterpreted\(/);
    expect(planSource).not.toMatch(/selectConversationContinuationPrompt\(/);
    expect(replySource).toContain('Phase 10G');
    expect(replySource).toContain('Phase 10K');
    expect(replySource).toContain('Phase 10L');
    expect(replySource).toContain('Phase 10M');
    expect(replySource).toContain('Phase 10N');
    expect(replySource).toMatch(/createConversationReplyPlan\(/);
    expect(replySource).toMatch(/renderConversationReplyPlan\(/);
    expect(index).not.toMatch(/createConversationReplyPlan/);
    expect(index).not.toMatch(/renderConversationReplyPlan/);
    expect(index).not.toMatch(/selectConversationFollowUpQuestion/);
    expect(index).not.toMatch(/selectConversationAcknowledgement/);
    expect(index).not.toMatch(/selectConversationMessageInterpreted/);
    expect(index).not.toMatch(/selectConversationContinuationPrompt/);
    expect(index).not.toMatch(/selectConversationReplyComponents/);
    expect(index).not.toMatch(/assembleConversationReplyPlan/);
    expect(index).not.toMatch(/CONVERSATION_REPLY_CATALOGUE/);
    expect(processTurn).not.toMatch(/createConversationReplyPlan/);
  });

  it('plans a destination acknowledgement with origin follow-up', () => {
    const previous = createState();
    const state = createState({ destination: 'Brisbane' });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual(['Great — Brisbane.']);
    expect(plan.followUpQuestion).toBe('Where will you be travelling from?');
    expect(plan.messageInterpreted).toBe(true);
    expect(renderConversationReplyPlan(plan)).toBe(
      'Great — Brisbane.\nWhere will you be travelling from?',
    );
  });

  it('plans an origin acknowledgement with departure follow-up', () => {
    const previous = createState({ destination: 'Brisbane' });
    const state = createState({ destination: 'Brisbane', origin: 'Sydney' });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      'Perfect — departing from Sydney.',
    ]);
    expect(plan.followUpQuestion).toBe('When would you like to depart?');
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans a new-capability acknowledgement', () => {
    const previous = completeCore();
    const state = completeCore({ flightsRequested: true });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      "I've added flights to your trip requirements.",
    ]);
    expect(plan.followUpQuestion).toBe(
      'How many adults will be travelling?',
    );
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans a departure-date acknowledgement with return follow-up', () => {
    const previous = createState({
      destination: 'Cairns',
      origin: 'Sydney',
    });
    const state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      'Perfect — departing on 2026-08-28.',
    ]);
    expect(plan.followUpQuestion).toBe('When would you like to return?');
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans a return-date acknowledgement with neutral follow-up', () => {
    const previous = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    const state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      'Perfect — returning on 2026-09-05.',
    ]);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans an adult-count acknowledgement with neutral follow-up', () => {
    const previous = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });
    const state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual(['Perfect — 2 adults travelling.']);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans a child-count acknowledgement with neutral follow-up', () => {
    const previous = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
    });
    const state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
      childCount: 1,
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      'Perfect — 1 child travelling.',
    ]);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans an infant-count acknowledgement with neutral follow-up', () => {
    const previous = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
      childCount: 1,
    });
    const state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      'Perfect — 1 infant travelling.',
    ]);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans Perfect for other changed travel fields', () => {
    const previous = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
    });
    const state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      toursRequested: true,
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual(['Perfect.']);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans missing core-field progression ahead of contextual questions', () => {
    const previous = createState();
    const state = createState({ flightsRequested: true });
    const plan = planFor(previous, state);
    expect(plan.followUpQuestion).toBe('Where would you like to travel?');
    expect(plan.followUpQuestion).not.toMatch(/adults will be travelling/i);
  });

  it('plans a contextual service question when core fields are complete', () => {
    const previous = completeCore({ adultCount: 2 });
    const state = completeCore({
      adultCount: 2,
      activitiesRequested: true,
    });
    const plan = planFor(previous, state);
    expect(plan.followUpQuestion).toBe(
      'What kinds of activities are you interested in?',
    );
  });

  it('plans suppression of traveller questions when adultCount is known', () => {
    const previous = completeCore({ adultCount: 2 });
    const state = completeCore({
      adultCount: 2,
      flightsRequested: true,
      accommodationRequested: true,
      restaurantsRequested: true,
    });
    const plan = planFor(previous, state);
    expect(plan.followUpQuestion).toBe(
      'What type of dining are you looking for?',
    );
    expect(plan.followUpQuestion).not.toMatch(/adults will be travelling/i);
    expect(plan.followUpQuestion).not.toMatch(/guests will be staying/i);
  });

  it('plans the neutral continuation for a fully satisfied state', () => {
    const previous = completeCore({ adultCount: 2 });
    const state = completeCore({
      adultCount: 2,
      beachesRequested: true,
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      "I've added beaches to your trip requirements.",
    ]);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(plan.messageInterpreted).toBe(true);
  });

  it('plans an unchanged turn as neutral with messageInterpreted false', () => {
    const previous = createState({ destination: 'Cairns' });
    const state = createState({ destination: 'Cairns' });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([]);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(plan.messageInterpreted).toBe(false);
    expect(renderConversationReplyPlan(plan)).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('plans one acknowledgement for multiple current-turn changes with capability precedence', () => {
    const previous = createState();
    const state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      flightsRequested: true,
      accommodationRequested: true,
    });
    const plan = planFor(previous, state);
    expect(plan.acknowledgements).toEqual([
      "I've added flights and accommodation to your trip requirements.",
    ]);
    expect(plan.followUpQuestion).toBe('When would you like to depart?');
    expect(plan.acknowledgements).toHaveLength(1);
  });

  it('never plans more than one follow-up question', () => {
    const plans = [
      planFor(createState(), createState({ destination: 'Brisbane' })),
      planFor(
        createState({ destination: 'Brisbane' }),
        createState({ destination: 'Brisbane', origin: 'Sydney' }),
      ),
      planFor(completeCore(), completeCore({ flightsRequested: true })),
      planFor(
        completeCore({ adultCount: 2 }),
        completeCore({
          adultCount: 2,
          flightsRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
      planFor(
        createState({ destination: 'Cairns' }),
        createState({ destination: 'Cairns' }),
      ),
    ];
    for (const plan of plans) {
      expect(plan.acknowledgements.length).toBeLessThanOrEqual(1);
      expect(
        plan.followUpQuestion === null ? 0 : 1,
        JSON.stringify(plan),
      ).toBeLessThanOrEqual(1);
      if (plan.followUpQuestion !== null) {
        expect((plan.followUpQuestion.match(/\?/g) ?? []).length).toBe(1);
      }
    }
  });

  it('keeps rendered replies and messageInterpreted identical to the live processor', () => {
    const cases: Array<{
      message: string;
      state: ConversationCoreState;
      stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'];
    }> = [
      { message: 'go to Brisbane', state: createState() },
      {
        message: 'from Sydney',
        state: createState({ destination: 'Brisbane' }),
      },
      { message: 'book flights', state: completeCore() },
      {
        message: 'book flights',
        state: completeCore({ adultCount: 2 }),
      },
      {
        message: 'book flights. book a hotel. book activities',
        state: completeCore({ adultCount: 2 }),
      },
      {
        message: 'Hello there',
        state: createState({ destination: 'Cairns' }),
      },
      {
        message: 'book flights. Fly from Sydney to Cairns',
        state: createState(),
      },
      {
        message: 'Hello',
        state: completeCore(),
        stateUpdate: { adultCount: 3, flightsRequested: true },
      },
    ];

    for (const entry of cases) {
      const result = turn(entry.message, entry.state, entry.stateUpdate);
      const plan = createConversationReplyPlan({
        state: result.state,
        classification: classifyConversationStateChange(
          entry.state,
          result.state,
        ),
      });
      expect(renderConversationReplyPlan(plan), entry.message).toBe(
        result.reply,
      );
      expect(plan.messageInterpreted, entry.message).toBe(
        result.trace.messageInterpreted,
      );
      expect(
        generateConversationReply({
          message: entry.message,
          previousState: entry.state,
          state: result.state,
        }),
        entry.message,
      ).toBe(result.reply);
    }
  });
});
