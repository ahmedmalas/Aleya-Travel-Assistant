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
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

const ROOT = process.cwd();
const SELECTOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
);
const PLAN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationReplyPlan.ts',
);
const COMPONENTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationReplyComponents.ts',
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
      conversationId: 'conversation-10h',
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
    userEntryId: 'user-10h',
    assistantEntryId: 'assistant-10h',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10H — deterministic follow-up selection boundary', () => {
  it('keeps the follow-up selector internal and consumed by the reply plan', () => {
    const selectorSource = readFileSync(SELECTOR_SOURCE, 'utf8');
    const planSource = readFileSync(PLAN_SOURCE, 'utf8');
    const componentsSource = readFileSync(COMPONENTS_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(selectorSource).toContain('Phase 10H');
    expect(selectorSource).toContain('Phase 10K');
    expect(selectorSource).toMatch(
      /export function selectConversationFollowUpQuestion/,
    );
    expect(selectorSource).toMatch(/CONVERSATION_REPLY_CATALOGUE/);
    expect(selectorSource).not.toMatch(
      /Where would you like to travel\?/,
    );
    expect(planSource).toContain('Phase 10H');
    expect(planSource).toMatch(/selectConversationReplyComponents\(/);
    expect(componentsSource).toMatch(/selectConversationFollowUpQuestion\(/);
    expect(planSource).not.toMatch(/PROGRESSION_QUESTIONS|CONTEXTUAL_QUESTIONS/);
    expect(index).not.toMatch(/selectConversationFollowUpQuestion/);
    expect(processTurn).not.toMatch(/selectConversationFollowUpQuestion/);
  });

  it('selects the destination question when destination is missing', () => {
    expect(selectConversationFollowUpQuestion(createState())).toBe(
      'Where would you like to travel?',
    );
  });

  it('selects the origin question when origin is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: 'Brisbane' }),
      ),
    ).toBe('Where will you be travelling from?');
  });

  it('selects the departure-date question when departureDate is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: 'Brisbane', origin: 'Sydney' }),
      ),
    ).toBe('When would you like to depart?');
  });

  it('selects the return-date question when returnDate is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
    ).toBe('When would you like to return?');
  });

  it('selects the flights adult-count question when adultCount is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({ flightsRequested: true }),
      ),
    ).toBe('How many adults will be travelling?');
  });

  it('selects the accommodation guest-count question when adultCount is missing', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({ accommodationRequested: true }),
      ),
    ).toBe('How many guests will be staying?');
  });

  it('selects the activities question when activities are requested', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({ adultCount: 2, activitiesRequested: true }),
      ),
    ).toBe('What kinds of activities are you interested in?');
  });

  it('selects the restaurants question when restaurants are requested', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({ adultCount: 2, restaurantsRequested: true }),
      ),
    ).toBe('What type of dining are you looking for?');
  });

  it('suppresses count questions when adultCount is known', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          flightsRequested: true,
          accommodationRequested: true,
        }),
      ),
    ).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          flightsRequested: true,
          accommodationRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe('What type of dining are you looking for?');
  });

  it('selects the neutral continuation for a fully satisfied state', () => {
    expect(
      selectConversationFollowUpQuestion(
        completeCore({ adultCount: 2, beachesRequested: true }),
      ),
    ).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('applies deterministic priority when multiple questions are eligible', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe('Where would you like to travel?');

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          accommodationRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe('How many adults will be travelling?');

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
    ).toBe('What kinds of activities are you interested in?');
  });

  it('returns only one question string', () => {
    const selections = [
      selectConversationFollowUpQuestion(createState()),
      selectConversationFollowUpQuestion(
        createState({ destination: 'Cairns' }),
      ),
      selectConversationFollowUpQuestion(completeCore({ flightsRequested: true })),
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          flightsRequested: true,
          activitiesRequested: true,
          restaurantsRequested: true,
        }),
      ),
      selectConversationFollowUpQuestion(completeCore({ adultCount: 2 })),
    ];
    for (const selected of selections) {
      expect(typeof selected).toBe('string');
      expect(selected).not.toBeNull();
      expect((selected!.match(/\?/g) ?? []).length).toBe(1);
      expect(selected!.includes('\n')).toBe(false);
    }
  });

  it('keeps reply-plan output and rendered replies identical', () => {
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
    ];

    for (const entry of cases) {
      const result = turn(entry.message, entry.state, entry.stateUpdate);
      const plan = planFor(entry.state, result.state);
      expect(plan.followUpQuestion, entry.message).toBe(
        plan.acknowledgements.length === 0
          ? NEUTRAL_TRIP_FALLBACK_REPLY
          : selectConversationFollowUpQuestion(result.state),
      );
      expect(expectedActivatedBaselineReply(plan), entry.message).toBe(
        result.reply,
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
