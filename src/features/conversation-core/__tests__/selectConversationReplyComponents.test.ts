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
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

const ROOT = process.cwd();
const COMPONENTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationReplyComponents.ts',
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
      conversationId: 'conversation-10n',
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

function componentsFor(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  return selectConversationReplyComponents({
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
    userEntryId: 'user-10n',
    assistantEntryId: 'assistant-10n',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10N — deterministic reply-component selection boundary', () => {
  it('keeps the component selector internal and consumed by the reply planner', () => {
    const componentsSource = readFileSync(COMPONENTS_SOURCE, 'utf8');
    const planSource = readFileSync(PLAN_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(componentsSource).toContain('Phase 10N');
    expect(componentsSource).toMatch(
      /export function selectConversationReplyComponents/,
    );
    expect(componentsSource).toMatch(/selectConversationAcknowledgement\(/);
    expect(componentsSource).toMatch(/selectConversationFollowUpQuestion\(/);
    expect(componentsSource).toMatch(/selectConversationContinuationPrompt\(/);
    expect(componentsSource).toMatch(/selectConversationMessageInterpreted\(/);
    expect(componentsSource).not.toMatch(
      /assembleConversationReplyPlan\(|renderConversationReplyPlan\(/,
    );
    expect(planSource).toContain('Phase 10N');
    expect(planSource).toMatch(/selectConversationReplyComponents\(/);
    expect(planSource).toMatch(/assembleConversationReplyPlan\(/);
    expect(planSource).not.toMatch(/selectConversationAcknowledgement\(/);
    expect(planSource).not.toMatch(/selectConversationFollowUpQuestion\(/);
    expect(index).not.toMatch(/selectConversationReplyComponents/);
    expect(processTurn).not.toMatch(/selectConversationReplyComponents/);
  });

  it('returns the selected acknowledgement, follow-up, continuation, and interpretation', () => {
    const previous = createState();
    const state = createState({ destination: 'Brisbane' });
    const classification = classifyConversationStateChange(previous, state);
    const components = componentsFor(previous, state);

    expect(components.acknowledgement).toBe(
      selectConversationAcknowledgement(state, classification),
    );
    expect(components.acknowledgement).toBe('Great — Brisbane.');
    expect(components.followUpQuestion).toBe(
      selectConversationFollowUpQuestion(state),
    );
    expect(components.followUpQuestion).toBe(
      'Where will you be travelling from?',
    );
    expect(components.continuationPrompt).toBe(
      selectConversationContinuationPrompt({
        followUpQuestion: components.followUpQuestion,
      }),
    );
    expect(components.continuationPrompt).toBeNull();
    expect(components.messageInterpreted).toBe(
      selectConversationMessageInterpreted(classification),
    );
    expect(components.messageInterpreted).toBe(true);
  });

  it('passes the selected follow-up into continuation selection', () => {
    const interpreted = componentsFor(
      createState(),
      createState({ destination: 'Brisbane' }),
    );
    expect(interpreted.followUpQuestion).not.toBeNull();
    expect(interpreted.continuationPrompt).toBe(
      selectConversationContinuationPrompt({
        followUpQuestion: interpreted.followUpQuestion,
      }),
    );
    expect(interpreted.continuationPrompt).toBeNull();

    const unchanged = componentsFor(
      createState({ destination: 'Cairns' }),
      createState({ destination: 'Cairns' }),
    );
    expect(unchanged.followUpQuestion).toBeNull();
    expect(unchanged.continuationPrompt).toBe(
      selectConversationContinuationPrompt({
        followUpQuestion: unchanged.followUpQuestion,
      }),
    );
    expect(unchanged.continuationPrompt).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(unchanged.messageInterpreted).toBe(false);
    expect(unchanged.acknowledgement).toBeNull();
  });

  it('preserves existing follow-up priority and adultCount suppression', () => {
    const priority = componentsFor(
      createState(),
      createState({
        flightsRequested: true,
        accommodationRequested: true,
        activitiesRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(priority.followUpQuestion).toBe('Where would you like to travel?');
    expect(priority.acknowledgement).toBe(
      "I've added flights, accommodation, activities and restaurants to your trip requirements.",
    );

    const suppressed = componentsFor(
      completeCore({ adultCount: 2 }),
      completeCore({
        adultCount: 2,
        flightsRequested: true,
        accommodationRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(suppressed.followUpQuestion).toBe(
      'What type of dining are you looking for?',
    );
    expect(suppressed.followUpQuestion).not.toMatch(/adults will be travelling/i);
    expect(suppressed.followUpQuestion).not.toMatch(/guests will be staying/i);
  });

  it('keeps planner output and rendered replies identical via component selection', () => {
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
      const components = selectConversationReplyComponents({
        state: result.state,
        classification,
      });
      const assembled = assembleConversationReplyPlan(components);
      const planned = createConversationReplyPlan({
        state: result.state,
        classification,
      });

      expect(planned).toEqual(assembled);
      expect(renderConversationReplyPlan(planned), entry.message).toBe(
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
