import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import * as baselineModule from '../generateBaselineConversationalReply';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  renderBaselineNeutralContinuation,
} from '../renderBaselineNeutralContinuation';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 15L — end-to-end production-path characterisation of Phase 15 output.
 *
 * Drives realistic turns through processConversationTurn (sole public entry).
 * Does not construct reply plans for primary reply expectations; plans are
 * inspected only as secondary state→plan proofs after the turn completes.
 */

const ROOT = process.cwd();
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

type Owner =
  | '15B'
  | '15C'
  | '15J'
  | '15F'
  | '15E-pass-through'
  | '16B'
  | 'deterministic';

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-15l',
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
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
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
    userEntryId: 'user-15l',
    assistantEntryId: 'assistant-15l',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
}

function classifyOwner(plan: {
  acknowledgements: readonly string[];
  followUpQuestion: string | null;
}): Owner {
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return '16B';
  }
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === null
  ) {
    return '15B';
  }
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion !== null
  ) {
    return '15C';
  }
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return '15J';
  }
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion !== null
  ) {
    const followUp = plan.followUpQuestion;
    if (
      followUp === FOLLOW_UPS.destination ||
      followUp === FOLLOW_UPS.origin ||
      followUp === FOLLOW_UPS.departureDate ||
      followUp === FOLLOW_UPS.returnDate ||
      followUp === FOLLOW_UPS.flightsAdultCount ||
      followUp === FOLLOW_UPS.accommodationGuestCount ||
      followUp === FOLLOW_UPS.activities ||
      followUp === FOLLOW_UPS.restaurants
    ) {
      return '15F';
    }
    return '15E-pass-through';
  }
  return 'deterministic';
}

function inspectTurn(
  previous: ConversationCoreState,
  result: ReturnType<typeof turn>,
) {
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const components = selectConversationReplyComponents({
    state: result.state,
    classification,
  });
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return { classification, components, plan };
}

function assertCleanActivatedReply(
  reply: string,
  options: { allowNewline?: boolean } = {},
) {
  if (!options.allowNewline) {
    expect(reply.includes('\n')).toBe(false);
  }
  expect(reply.includes(', Where')).toBe(false);
  expect(reply.includes('And When')).toBe(false);
  expect(reply.includes(', How')).toBe(false);
  expect(reply.includes(', What')).toBe(false);
  expect(
    reply.includes(
      "There's just one more thing I'd like to know. There's just one more thing",
    ),
  ).toBe(false);
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  return haystack.split(needle).length - 1;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('phase 15L — production runtime conversational output', () => {
  it('uses processConversationTurn as the sole production entry point', () => {
    const source = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    expect(source).toMatch(/generateIntegratedConversationReply\(\{/);
    expect(source).toMatch(/export function processConversationTurn/);
  });

  it('covers reachable Phase 15C acknowledgement-plus-follow-up journeys', () => {
    const journeys: Array<{
      label: string;
      message: string;
      previous: ConversationCoreState;
      stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'];
      assertState: (state: ConversationCoreState) => void;
      deterministicAck: string;
      followUp: string;
    }> = [
      {
        label: 'destination supplied',
        message: 'go to Cairns',
        previous: createState(),
        assertState: (state) => {
          expect(state.destination).toBe('Cairns');
          expect(state.origin).toBeNull();
        },
        deterministicAck: ACKS.destination('Cairns'),
        followUp: FOLLOW_UPS.origin,
      },
      {
        label: 'origin supplied',
        message: 'from Sydney',
        previous: createState({ destination: 'Cairns' }),
        assertState: (state) => {
          expect(state.destination).toBe('Cairns');
          expect(state.origin).toBe('Sydney');
        },
        deterministicAck: ACKS.origin('Sydney'),
        followUp: FOLLOW_UPS.departureDate,
      },
      {
        label: 'departure date supplied',
        message: 'Depart on 28 August 2026',
        previous: createState({ destination: 'Cairns', origin: 'Sydney' }),
        assertState: (state) => {
          expect(state.departureDate).toBe('2026-08-28');
        },
        deterministicAck: ACKS.departureDate('2026-08-28'),
        followUp: FOLLOW_UPS.returnDate,
      },
      {
        label: 'field removed',
        message: 'clear destination',
        previous: completeCore(),
        stateUpdate: { destination: null },
        assertState: (state) => {
          expect(state.destination).toBeNull();
          expect(state.origin).toBe('Sydney');
        },
        deterministicAck: ACKS.destinationRemoved,
        followUp: FOLLOW_UPS.destination,
      },
      {
        label: 'capability enabled',
        message: 'I need flights',
        previous: completeCore(),
        assertState: (state) => {
          expect(state.flightsRequested).toBe(true);
          expect(state.adultCount).toBeNull();
        },
        deterministicAck: ACKS.addedCapabilities('flights'),
        followUp: FOLLOW_UPS.flightsAdultCount,
      },
      {
        label: 'capability disabled',
        message: 'update requirements',
        previous: completeCore({ flightsRequested: true, adultCount: 2 }),
        stateUpdate: { flightsRequested: false },
        assertState: (state) => {
          expect(state.flightsRequested).toBe(false);
        },
        deterministicAck: ACKS.removedCapabilities('flights'),
        followUp: FOLLOW_UPS.neutralContinuation,
      },
      {
        label: 'activities follow-up (with acknowledgement)',
        message: 'book activities',
        previous: completeCore({ adultCount: 2 }),
        assertState: (state) => {
          expect(state.activitiesRequested).toBe(true);
        },
        deterministicAck: ACKS.addedCapabilities('activities'),
        followUp: FOLLOW_UPS.activities,
      },
      {
        label: 'restaurants follow-up (with acknowledgement)',
        message: 'find restaurants',
        previous: completeCore({ adultCount: 2 }),
        assertState: (state) => {
          expect(state.restaurantsRequested).toBe(true);
        },
        deterministicAck: ACKS.addedCapabilities('restaurants'),
        followUp: FOLLOW_UPS.restaurants,
      },
      {
        label: 'return date reaches ack + neutral',
        message: 'Return on 5 September 2026',
        previous: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
        assertState: (state) => {
          expect(state.returnDate).toBe('2026-09-05');
        },
        deterministicAck: ACKS.returnDate('2026-09-05'),
        followUp: FOLLOW_UPS.neutralContinuation,
      },
    ];

    for (const journey of journeys) {
      const previous = structuredClone(journey.previous);
      const result = turn(
        journey.message,
        journey.previous,
        journey.stateUpdate,
      );
      const { classification, components, plan } = inspectTurn(
        previous,
        result,
      );
      const expectedOwner =
        journey.followUp === FOLLOW_UPS.neutralContinuation ? '16B' : '15C';
      const expected = expectedActivatedBaselineReply(plan);

      journey.assertState(result.state);
      expect(classification.hasInterpretedChange, journey.label).toBe(true);
      expect(
        classification.hasAcknowledgementEligibleChange,
        journey.label,
      ).toBe(true);
      expect(components.acknowledgement, journey.label).toBe(
        journey.deterministicAck,
      );
      expect(components.followUpQuestion, journey.label).toBe(journey.followUp);
      expect(plan.acknowledgements, journey.label).toEqual([
        journey.deterministicAck,
      ]);
      expect(plan.followUpQuestion, journey.label).toBe(journey.followUp);
      expect(classifyOwner(plan), journey.label).toBe(expectedOwner);
      expect(result.reply, journey.label).toBe(expected);
      expect(result.reply, journey.label).toBe(
        expectedActivatedBaselineReply(plan),
      );
      expect(result.reply.endsWith(journey.followUp), journey.label).toBe(true);
      expect(
        countOccurrences(result.reply, journey.followUp),
        journey.label,
      ).toBe(1);
      expect(
        countOccurrences(
          result.reply,
          transformBaselineAcknowledgement(journey.deterministicAck),
        ),
        journey.label,
      ).toBe(1);
      assertCleanActivatedReply(result.reply);
    }
  });

  it('covers reachable Phase 15F follow-up-only journeys via inert request-flag clears', () => {
    const journeys: Array<{
      label: string;
      previous: ConversationCoreState;
      followUp: string;
      assertState: (state: ConversationCoreState) => void;
    }> = [
      {
        label: 'missing destination',
        previous: createState({ flightsRequested: true }),
        followUp: FOLLOW_UPS.destination,
        assertState: (state) => {
          expect(state.destination).toBeNull();
          expect(state.flightsRequested).toBeNull();
        },
      },
      {
        label: 'missing origin',
        previous: createState({
          destination: 'Cairns',
          flightsRequested: true,
        }),
        followUp: FOLLOW_UPS.origin,
        assertState: (state) => {
          expect(state.destination).toBe('Cairns');
          expect(state.origin).toBeNull();
        },
      },
      {
        label: 'missing departure date',
        previous: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
        }),
        followUp: FOLLOW_UPS.departureDate,
        assertState: (state) => {
          expect(state.departureDate).toBeNull();
        },
      },
      {
        label: 'activities follow-up only',
        previous: completeCore({
          adultCount: 2,
          activitiesRequested: true,
          flightsRequested: true,
        }),
        followUp: FOLLOW_UPS.activities,
        assertState: (state) => {
          expect(state.activitiesRequested).toBe(true);
          expect(state.flightsRequested).toBeNull();
        },
      },
      {
        label: 'restaurants follow-up only',
        previous: completeCore({
          adultCount: 2,
          restaurantsRequested: true,
          flightsRequested: true,
        }),
        followUp: FOLLOW_UPS.restaurants,
        assertState: (state) => {
          expect(state.restaurantsRequested).toBe(true);
          expect(state.flightsRequested).toBeNull();
        },
      },
    ];

    for (const journey of journeys) {
      const previous = structuredClone(journey.previous);
      const result = turn('clear flights request flag', journey.previous, {
        flightsRequested: null,
      });
      const { classification, components, plan } = inspectTurn(
        previous,
        result,
      );
      const expected = renderBaselineFollowUpOnly({
        followUpQuestion: journey.followUp,
      });

      journey.assertState(result.state);
      expect(classification.hasInterpretedChange, journey.label).toBe(true);
      expect(
        classification.hasAcknowledgementEligibleChange,
        journey.label,
      ).toBe(false);
      expect(components.acknowledgement, journey.label).toBeNull();
      expect(components.followUpQuestion, journey.label).toBe(journey.followUp);
      expect(plan.acknowledgements, journey.label).toEqual([]);
      expect(plan.followUpQuestion, journey.label).toBe(journey.followUp);
      expect(classifyOwner(plan), journey.label).toBe('15F');
      expect(result.reply, journey.label).toBe(expected);
      expect(result.reply.endsWith(journey.followUp), journey.label).toBe(true);
      expect(
        countOccurrences(result.reply, journey.followUp),
        journey.label,
      ).toBe(1);
      assertCleanActivatedReply(result.reply);
    }
  });

  it('covers Phase 15J neutral continuation on fully satisfied / uninterpreted turns', () => {
    const journeys: Array<{
      label: string;
      message: string;
      previous: ConversationCoreState;
      interpreted: boolean;
      followUp: string;
      expectedReply: string;
    }> = [
      {
        label: 'fully satisfied uninterpreted',
        message: 'thanks',
        previous: completeCore({ flightsRequested: true, adultCount: 2 }),
        interpreted: false,
        followUp: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
        expectedReply: ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
      },
      {
        label: 'unsupported input on empty state',
        message: 'hello there',
        previous: createState(),
        interpreted: false,
        followUp: FOLLOW_UPS.destination,
        expectedReply: renderBaselineFollowUpOnly({
          followUpQuestion: FOLLOW_UPS.destination,
        }),
      },
    ];

    for (const journey of journeys) {
      const previous = structuredClone(journey.previous);
      const result = turn(journey.message, journey.previous);
      const { classification, components, plan } = inspectTurn(
        previous,
        result,
      );

      expect(result.trace.messageInterpreted, journey.label).toBe(
        journey.interpreted,
      );
      expect(classification.hasInterpretedChange, journey.label).toBe(
        journey.interpreted,
      );
      expect(components.acknowledgement, journey.label).toBeNull();
      // Phase 18B: follow-up always selected; continuation null when follow-up exists.
      expect(components.followUpQuestion, journey.label).toBe(journey.followUp);
      expect(components.continuationPrompt, journey.label).toBeNull();
      expect(plan.acknowledgements, journey.label).toEqual([]);
      expect(plan.followUpQuestion, journey.label).toBe(journey.followUp);
      expect(classifyOwner(plan), journey.label).toBe(
        journey.followUp === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
          ? '15J'
          : '15F',
      );
      expect(result.reply, journey.label).toBe(journey.expectedReply);
      expect(result.reply.endsWith(journey.followUp), journey.label).toBe(true);
      expect(
        countOccurrences(result.reply, journey.followUp),
        journey.label,
      ).toBe(1);
      assertCleanActivatedReply(result.reply);
    }
  });

  it('documents production-unreachable Phase 15B and multi-ack / empty-null shapes', () => {
    // Assembly always coalesces followUp ?? continuation, so followUpQuestion
    // on a production plan is never null. Acknowledgement selection emits at
    // most one acknowledgement string. Therefore:
    // - Phase 15B (one ack, followUp null) is unreachable
    // - multi-ack arrays (length >= 2) are unreachable
    // - empty plans with followUp null are unreachable (continuation fills)
    const previous = completeCore({ adultCount: 2 });
    const result = turn('I like beaches', previous);
    const { components, plan } = inspectTurn(previous, result);

    expect(components.acknowledgement).toBe(
      ACKS.addedCapabilities('beaches'),
    );
    expect(plan.acknowledgements).toHaveLength(1);
    expect(plan.followUpQuestion).not.toBeNull();
    // Phase 16B owns production ack + canonical neutral (previously 15C).
    expect(classifyOwner(plan)).toBe('16B');
    expect(classifyOwner(plan)).not.toBe('15B');
    expect(classifyOwner(plan)).not.toBe('deterministic');

    // Uninterpreted turns store neutral via continuation — not empty-null plans.
    const uninterpretedPrevious = completeCore({
      flightsRequested: true,
      adultCount: 2,
    });
    const uninterpreted = turn('noise', uninterpretedPrevious);
    const inspected = inspectTurn(uninterpretedPrevious, uninterpreted);
    expect(inspected.plan.followUpQuestion).toBe(
      CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    );
    expect(inspected.plan.followUpQuestion).not.toBeNull();
    expect(classifyOwner(inspected.plan)).toBe('15J');
  });

  it('keeps Phase 14I deterministic fallback available on the production turn path', () => {
    const previous = createState();
    let capturedPlan: ReturnType<typeof createConversationReplyPlan> | null =
      null;

    const baselineSpy = vi
      .spyOn(baselineModule, 'generateBaselineConversationalReply')
      .mockImplementation((receivedPlan) => {
        capturedPlan = {
          acknowledgements: [...receivedPlan.acknowledgements],
          acknowledgementEvent: receivedPlan.acknowledgementEvent,
          followUpQuestion: receivedPlan.followUpQuestion,
          messageInterpreted: receivedPlan.messageInterpreted,
        };
        throw new Error('forced-baseline-failure:phase15L');
      });

    const result = turn('go to Cairns', previous);
    const { plan } = inspectTurn(previous, result);
    const expectedDeterministic = renderConversationReplyPlan(plan);

    expect(baselineSpy).toHaveBeenCalledTimes(1);
    expect(capturedPlan).toEqual(plan);
    expect(result.reply).toBe(expectedDeterministic);
    expect(result.reply).toBe(
      `${ACKS.destination('Cairns')}\n${FOLLOW_UPS.origin}`,
    );
    expect(result.reply).not.toBe(
      renderBaselineAcknowledgementFollowUp({
        acknowledgement: ACKS.destination('Cairns'),
        followUpQuestion: FOLLOW_UPS.origin,
      }),
    );
    expect(result.state.destination).toBe('Cairns');
  });

  it('agrees with generateConversationReply for the same previous/final travel states', () => {
    const previous = createState({ destination: 'Cairns' });
    const result = turn('from Melbourne', previous);
    const { plan } = inspectTurn(previous, result);
    const viaGenerator = generateConversationReply({
      message: 'from Melbourne',
      previousState: previous,
      state: result.state,
    });

    expect(result.reply).toBe(viaGenerator);
    expect(result.reply).toBe(expectedActivatedBaselineReply(plan));
    expect(result.reply).toBe(
      renderBaselineAcknowledgementFollowUp({
        acknowledgement: ACKS.origin('Melbourne'),
        followUpQuestion: FOLLOW_UPS.departureDate,
      }),
    );
  });
});
