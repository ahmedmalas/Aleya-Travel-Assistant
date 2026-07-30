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
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

const ROOT = process.cwd();
const SELECTOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationContinuationPrompt.ts',
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
      conversationId: 'conversation-10l',
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
    userEntryId: 'user-10l',
    assistantEntryId: 'assistant-10l',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10L — deterministic continuation prompt boundary', () => {
  it('keeps the continuation selector internal and consumed by the reply plan', () => {
    const selectorSource = readFileSync(SELECTOR_SOURCE, 'utf8');
    const planSource = readFileSync(PLAN_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(selectorSource).toContain('Phase 10L');
    expect(selectorSource).toMatch(
      /export function selectConversationContinuationPrompt/,
    );
    const componentsSource = readFileSync(COMPONENTS_SOURCE, 'utf8');
    expect(planSource).toContain('Phase 10L');
    expect(planSource).toMatch(/selectConversationReplyComponents\(/);
    expect(componentsSource).toMatch(/selectConversationContinuationPrompt\(/);
    expect(planSource).not.toMatch(
      /followUpQuestion: NEUTRAL_TRIP_FALLBACK_REPLY/,
    );
    expect(index).not.toMatch(/selectConversationContinuationPrompt/);
    expect(processTurn).not.toMatch(/selectConversationContinuationPrompt/);
  });

  it('returns null when a follow-up question is already present', () => {
    expect(
      selectConversationContinuationPrompt({
        followUpQuestion: 'Where would you like to travel?',
      }),
    ).toBeNull();
    expect(
      selectConversationContinuationPrompt({
        followUpQuestion: NEUTRAL_TRIP_FALLBACK_REPLY,
      }),
    ).toBeNull();
  });

  it('returns the existing continuation prompt when no follow-up exists', () => {
    expect(
      selectConversationContinuationPrompt({
        followUpQuestion: null,
      }),
    ).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(
      selectConversationContinuationPrompt({
        followUpQuestion: null,
      }),
    ).toBe('What else should I know about your trip?');
  });

  it('delegates unchanged-turn continuation through the selector', () => {
    const previous = createState({ destination: 'Cairns' });
    const state = createState({ destination: 'Cairns' });
    const plan = planFor(previous, state);
    const continuation = selectConversationContinuationPrompt({
      followUpQuestion: null,
    });

    expect(plan.acknowledgements).toEqual([]);
    expect(plan.messageInterpreted).toBe(false);
    expect(plan.followUpQuestion).toBe(continuation);
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(renderConversationReplyPlan(plan)).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
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
        message: 'Hello there',
        state: createState({ destination: 'Cairns' }),
      },
      {
        message: 'book flights. Fly from Sydney to Cairns',
        state: createState(),
      },
      {
        message: 'Hello',
        state: completeCore({ adultCount: 2 }),
        stateUpdate: { beachesRequested: true },
      },
    ];

    for (const entry of cases) {
      const result = turn(entry.message, entry.state, entry.stateUpdate);
      const classification = classifyConversationStateChange(
        entry.state,
        result.state,
      );
      const followUpQuestion = classification.hasInterpretedChange
        ? selectConversationFollowUpQuestion(result.state)
        : null;
      const continuationPrompt = selectConversationContinuationPrompt({
        followUpQuestion,
      });
      const plan = planFor(entry.state, result.state);

      expect(plan.followUpQuestion, entry.message).toBe(
        followUpQuestion ?? continuationPrompt,
      );
      expect(renderConversationReplyPlan(plan), entry.message).toBe(
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
