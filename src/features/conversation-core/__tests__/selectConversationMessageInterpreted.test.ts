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
import { selectConversationMessageInterpreted } from '../selectConversationMessageInterpreted';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

const ROOT = process.cwd();
const SELECTOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationMessageInterpreted.ts',
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
      conversationId: 'conversation-10j',
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

function interpretedFor(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  return selectConversationMessageInterpreted(
    classifyConversationStateChange(previousState, state),
  );
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
    userEntryId: 'user-10j',
    assistantEntryId: 'assistant-10j',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10J — deterministic interpretation selection boundary', () => {
  it('keeps the interpretation selector internal and consumed by the reply plan', () => {
    const selectorSource = readFileSync(SELECTOR_SOURCE, 'utf8');
    const planSource = readFileSync(PLAN_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(selectorSource).toContain('Phase 10J');
    expect(selectorSource).toContain('Phase 11G');
    expect(selectorSource).toMatch(
      /export function selectConversationMessageInterpreted/,
    );
    const componentsSource = readFileSync(COMPONENTS_SOURCE, 'utf8');
    expect(planSource).toContain('Phase 10J');
    expect(planSource).toMatch(/selectConversationReplyComponents\(/);
    expect(componentsSource).toMatch(/selectConversationMessageInterpreted\(/);
    expect(planSource).not.toMatch(
      /const messageInterpreted = classification\.hasAnyChange/,
    );
    expect(planSource).not.toMatch(
      /const messageInterpreted = classification\.hasAcknowledgementEligibleChange/,
    );
    expect(selectorSource).toMatch(
      /return classification\.hasInterpretedChange/,
    );
    expect(selectorSource).not.toMatch(
      /return classification\.hasAnyChange/,
    );
    expect(selectorSource).not.toMatch(
      /return classification\.hasAcknowledgementEligibleChange/,
    );
    expect(index).not.toMatch(/selectConversationMessageInterpreted/);
    expect(processTurn).not.toMatch(/selectConversationMessageInterpreted/);
  });

  it('returns true for a newly populated travel field', () => {
    expect(
      interpretedFor(createState(), createState({ destination: 'Brisbane' })),
    ).toBe(true);
  });

  it('returns true for an updated travel field', () => {
    expect(
      interpretedFor(
        createState({ destination: 'Brisbane' }),
        createState({ destination: 'Hobart' }),
      ),
    ).toBe(true);
  });

  it('returns true for a newly enabled request flag', () => {
    expect(
      interpretedFor(completeCore(), completeCore({ flightsRequested: true })),
    ).toBe(true);
  });

  it('returns true for multiple travel-field changes', () => {
    expect(
      interpretedFor(
        createState(),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
          adultCount: 2,
        }),
      ),
    ).toBe(true);
  });

  it('returns false for an unchanged state', () => {
    expect(
      interpretedFor(
        createState({ destination: 'Cairns' }),
        createState({ destination: 'Cairns' }),
      ),
    ).toBe(false);
  });

  it('returns true for acknowledgement-inert request-flag clears to null', () => {
    expect(
      interpretedFor(
        completeCore({ flightsRequested: true }),
        completeCore({ flightsRequested: null }),
      ),
    ).toBe(true);
    expect(
      interpretedFor(
        completeCore({ flightsRequested: false }),
        completeCore({ flightsRequested: null }),
      ),
    ).toBe(true);

    const classification = classifyConversationStateChange(
      completeCore({ flightsRequested: true }),
      completeCore({ flightsRequested: null }),
    );
    expect(classification.hasInterpretedChange).toBe(true);
    expect(classification.hasAcknowledgementEligibleChange).toBe(false);
  });

  it('keeps reply-plan output, rendered replies, and messageInterpreted identical', () => {
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
      {
        message: 'change destination to Hobart',
        state: createState({ destination: 'Brisbane', origin: 'Sydney' }),
        stateUpdate: { destination: 'Hobart' },
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
      const plan = planFor(entry.state, result.state);

      expect(plan.messageInterpreted).toBe(messageInterpreted);
      expect(plan.messageInterpreted).toBe(
        classification.hasInterpretedChange,
      );
      expect(plan.messageInterpreted, entry.message).toBe(
        result.trace.messageInterpreted,
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

      if (!messageInterpreted) {
        expect(plan.acknowledgements).toEqual([]);
        expect(plan.followUpQuestion).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
      }
    }
  });
});
