import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  createConversationReplyPlan,
} from '../createConversationReplyPlan';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationMessageInterpreted } from '../selectConversationMessageInterpreted';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

const ROOT = process.cwd();
const ASSEMBLER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/assembleConversationReplyPlan.ts',
);
const PLAN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationReplyPlan.ts',
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
      conversationId: 'conversation-10m',
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

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-10m',
    assistantEntryId: 'assistant-10m',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10M — deterministic reply-plan assembly boundary', () => {
  it('keeps the assembler internal and consumed by the reply planner', () => {
    const assemblerSource = readFileSync(ASSEMBLER_SOURCE, 'utf8');
    const planSource = readFileSync(PLAN_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(assemblerSource).toContain('Phase 10M');
    expect(assemblerSource).toMatch(
      /export function assembleConversationReplyPlan/,
    );
    expect(assemblerSource).not.toMatch(/selectConversation/);
    expect(assemblerSource).not.toMatch(/ConversationCoreState/);
    expect(planSource).toContain('Phase 10M');
    expect(planSource).toMatch(/assembleConversationReplyPlan\(/);
    expect(index).not.toMatch(/assembleConversationReplyPlan/);
    expect(processTurn).not.toMatch(/assembleConversationReplyPlan/);
  });

  it('puts a present acknowledgement into a one-item array', () => {
    const plan = assembleConversationReplyPlan({
      acknowledgement: 'Great — Brisbane.',
      acknowledgementEvent: null,
      followUpQuestion: 'Where will you be travelling from?',
      continuationPrompt: null,
      messageInterpreted: true,
    });
    expect(plan.acknowledgements).toEqual(['Great — Brisbane.']);
    expect(plan.acknowledgements).toHaveLength(1);
  });

  it('uses an empty acknowledgements array when acknowledgement is absent', () => {
    const plan = assembleConversationReplyPlan({
      acknowledgement: null,
      acknowledgementEvent: null,
      followUpQuestion: null,
      continuationPrompt: NEUTRAL_TRIP_FALLBACK_REPLY,
      messageInterpreted: false,
    });
    expect(plan.acknowledgements).toEqual([]);
  });

  it('prefers follow-up over continuation prompt', () => {
    const plan = assembleConversationReplyPlan({
      acknowledgement: 'Perfect.',
      acknowledgementEvent: null,
      followUpQuestion: 'When would you like to depart?',
      continuationPrompt: NEUTRAL_TRIP_FALLBACK_REPLY,
      messageInterpreted: true,
    });
    expect(plan.followUpQuestion).toBe('When would you like to depart?');
    expect(plan.followUpQuestion).not.toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('uses continuation prompt when follow-up is null', () => {
    const plan = assembleConversationReplyPlan({
      acknowledgement: null,
      acknowledgementEvent: null,
      followUpQuestion: null,
      continuationPrompt: NEUTRAL_TRIP_FALLBACK_REPLY,
      messageInterpreted: false,
    });
    expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('preserves messageInterpreted true unchanged', () => {
    const plan = assembleConversationReplyPlan({
      acknowledgement: "I've added flights to your trip requirements.",
      acknowledgementEvent: null,
      followUpQuestion: 'How many adults will be travelling?',
      continuationPrompt: null,
      messageInterpreted: true,
    });
    expect(plan.messageInterpreted).toBe(true);
  });

  it('preserves messageInterpreted false unchanged', () => {
    const plan = assembleConversationReplyPlan({
      acknowledgement: null,
      acknowledgementEvent: null,
      followUpQuestion: null,
      continuationPrompt: NEUTRAL_TRIP_FALLBACK_REPLY,
      messageInterpreted: false,
    });
    expect(plan.messageInterpreted).toBe(false);
  });

  it('keeps planner output and rendered replies identical via assembly', () => {
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
      const messageInterpreted =
        selectConversationMessageInterpreted(classification);
      const selected = selectConversationAcknowledgement(
        result.state,
        classification,
      );
      const acknowledgement = selected?.text ?? null;
      const acknowledgementEvent = selected?.event ?? null;
      const followUpQuestion = messageInterpreted
        ? selectConversationFollowUpQuestion(result.state)
        : null;
      const continuationPrompt = selectConversationContinuationPrompt({
        followUpQuestion,
      });
      const assembled = assembleConversationReplyPlan({
        acknowledgement,
        acknowledgementEvent,
        followUpQuestion,
        continuationPrompt,
        messageInterpreted,
      });
      const planned = createConversationReplyPlan({
        state: result.state,
        classification,
      });

      expect(planned).toEqual(assembled);
      expect(expectedActivatedBaselineReply(planned), entry.message).toBe(
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
