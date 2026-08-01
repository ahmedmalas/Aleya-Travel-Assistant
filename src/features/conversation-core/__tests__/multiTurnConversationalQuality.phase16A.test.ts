import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
} from '../renderBaselineNeutralContinuation';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 16A — multi-turn conversational quality gap audit.
 *
 * Investigation-only baseline for Phase 16. Where Phase 16B intentionally
 * supersedes acknowledgement-plus-neutral wording, expectations are marked
 * as superseded and lock the Phase 16B bridge expression.
 */

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

type Owner = '15B' | '15C' | '15J' | '15F' | '15E' | '16B' | 'deterministic';

type TurnStep = {
  message: string;
  stateUpdate?: ConversationStateUpdate;
};

type CapturedTurn = {
  turn: number;
  message: string;
  previous: TravelSnapshot;
  final: TravelSnapshot;
  classification: {
    hasInterpretedChange: boolean;
    hasAcknowledgementEligibleChange: boolean;
  };
  acknowledgement: string | null;
  followUp: string | null;
  continuation: string | null;
  plan: {
    acknowledgements: readonly string[];
    acknowledgementEvent: import('../conversationAcknowledgementEvent').ConversationAcknowledgementEvent;
    followUpQuestion: string | null;
    messageInterpreted: boolean;
  };
  owner: Owner;
  reply: string;
};

type TravelSnapshot = {
  destination: string | null;
  origin: string | null;
  departureDate: string | null;
  returnDate: string | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
  flightsRequested: boolean | null;
  activitiesRequested: boolean | null;
  restaurantsRequested: boolean | null;
  restaurantPreference: string | null;
  beachesRequested: boolean | null;
};

const BRIDGE_FIELD_SET =
  "Is there anything else you'd like me to consider?";
const BRIDGE_FIELD_REMOVED = 'We can update the rest as we go.';
const BRIDGE_CAPABILITY_ENABLED =
  'Tell me anything else that matters for this trip.';
const BRIDGE_CAPABILITY_DISABLED = 'We can keep refining the plan.';

/** Phase 16B superseded expression for field set/change + canonical neutral. */
function fieldSetNeutral(transformedAck: string): string {
  return `${transformedAck} ${BRIDGE_FIELD_SET} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
}

/** Phase 16B superseded expression for capability enabled + canonical neutral. */
function capabilityEnabledNeutral(transformedAck: string): string {
  return `${transformedAck} ${BRIDGE_CAPABILITY_ENABLED} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
}

/** Phase 16B superseded expression for capability disabled + canonical neutral. */
function capabilityDisabledNeutral(transformedAck: string): string {
  return `${transformedAck} ${BRIDGE_CAPABILITY_DISABLED} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
}

/** Phase 16B superseded expression for field removed + canonical neutral. */
function fieldRemovedNeutral(transformedAck: string): string {
  return `${transformedAck} ${BRIDGE_FIELD_REMOVED} ${CANONICAL_NEUTRAL_CONTINUATION_PROMPT}`;
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16a',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function travelSnapshot(state: ConversationCoreState): TravelSnapshot {
  return {
    destination: state.destination,
    origin: state.origin,
    departureDate: state.departureDate,
    returnDate: state.returnDate,
    adultCount: state.adultCount,
    childCount: state.childCount,
    infantCount: state.infantCount,
    flightsRequested: state.flightsRequested,
    activitiesRequested: state.activitiesRequested,
    restaurantsRequested: state.restaurantsRequested,
    restaurantPreference: state.restaurantPreference,
    beachesRequested: state.beachesRequested,
  };
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
    return '15E';
  }
  return 'deterministic';
}

function runJourney(steps: TurnStep[]): CapturedTurn[] {
  let state = createState();
  const captured: CapturedTurn[] = [];

  for (const [index, step] of steps.entries()) {
    const previous = structuredClone(state);
    const result = processConversationTurn({
      message: step.message,
      state,
      userEntryId: `user-16a-${index}`,
      assistantEntryId: `assistant-16a-${index}`,
      userMessageAt: new Date(
        `2026-07-29T00:${String(index).padStart(2, '0')}:00.000Z`,
      ),
      assistantMessageAt: new Date(
        `2026-07-29T00:${String(index).padStart(2, '0')}:01.000Z`,
      ),
      ...(step.stateUpdate !== undefined ? { stateUpdate: step.stateUpdate } : {}),
    });
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

    captured.push({
      turn: index + 1,
      message: step.message,
      previous: travelSnapshot(previous),
      final: travelSnapshot(result.state),
      classification: {
        hasInterpretedChange: classification.hasInterpretedChange,
        hasAcknowledgementEligibleChange:
          classification.hasAcknowledgementEligibleChange,
      },
      acknowledgement: components.acknowledgement,
      followUp: components.followUpQuestion,
      continuation: components.continuationPrompt,
      plan: {
        acknowledgements: plan.acknowledgements,
        acknowledgementEvent: plan.acknowledgementEvent,
        followUpQuestion: plan.followUpQuestion,
        messageInterpreted: plan.messageInterpreted,
      },
      owner: classifyOwner(plan),
      reply: result.reply,
    });
    state = result.state;
  }

  return captured;
}

function expectReplies(turns: CapturedTurn[], expected: string[]) {
  expect(turns.map((turn) => turn.reply)).toEqual(expected);
}

describe('phase 16A — multi-turn conversational quality audit', () => {
  it('characterises complete trip supplied one field at a time', () => {
    const turns = runJourney([
      { message: 'I want to go to Cairns' },
      { message: 'flying from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
    ]);

    // Phase 16B supersedes prior direct ack+neutral joins on turns 4–5.
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      fieldSetNeutral('Return is set for 2026-09-05.'),
      fieldSetNeutral('Travelling with 2 adults.'),
    ]);
    expect(turns.map((turn) => turn.owner)).toEqual([
      '15C',
      '15C',
      '15C',
      '16B',
      '16B',
    ]);
    expect(turns[4]!.final).toMatchObject({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
    });
  });

  it('characterises destination change after initially being set', () => {
    const successful = runJourney([
      { message: 'go to Brisbane' },
      { message: 'go to Cairns' },
    ]);
    expectReplies(successful, [
      'Great, Brisbane it is. Where will you be travelling from?',
      'Updated — Cairns it is. Where will you be travelling from?',
    ]);
    expect(successful[1]!.final.destination).toBe('Cairns');
    expect(successful[1]!.owner).toBe('15C');

    // Phase 17B: natural destination repair phrasing is extracted.
    const repaired = runJourney([
      { message: 'go to Brisbane' },
      { message: 'sorry I meant Cairns' },
    ]);
    expectReplies(repaired, [
      'Great, Brisbane it is. Where will you be travelling from?',
      'Updated — Cairns it is. Where will you be travelling from?',
    ]);
    expect(repaired[1]!.final.destination).toBe('Cairns');
    expect(repaired[1]!.owner).toBe('15C');
  });

  it('characterises origin change after initially being set', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Brisbane' },
      { message: 'actually from Sydney' },
    ]);
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Brisbane. When would you like to depart?",
      "We'll depart from Sydney instead. When would you like to depart?",
    ]);
    expect(turns[2]!.final.origin).toBe('Sydney');
    expect(turns.map((turn) => turn.owner)).toEqual(['15C', '15C', '15C']);
  });

  it('characterises departure and return date changes', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'Depart on 1 September 2026' },
      { message: 'Return on 10 September 2026' },
    ]);
    // Phase 16B supersedes prior direct ack+neutral joins on post-core date edits.
    // Phase 16J uses event-aware changed wording on later date edits.
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      fieldSetNeutral('Return is set for 2026-09-05.'),
      fieldSetNeutral('Departure is now set for 2026-09-01.'),
      fieldSetNeutral('Return is now set for 2026-09-10.'),
    ]);
    expect(turns[5]!.final).toMatchObject({
      departureDate: '2026-09-01',
      returnDate: '2026-09-10',
    });
    expect(turns[4]!.owner).toBe('16B');
    expect(turns[5]!.owner).toBe('16B');
  });

  it('characterises adult / child / infant count changes', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'I need flights' },
      { message: '2 adults' },
      { message: '1 child' },
      { message: '1 infant' },
      { message: '3 adults' },
    ]);
    // Phase 16B supersedes prior direct ack+neutral joins on passenger turns.
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      fieldSetNeutral('Return is set for 2026-09-05.'),
      "Great, I've added flights to your trip. How many adults will be travelling?",
      fieldSetNeutral('Travelling with 2 adults.'),
      fieldSetNeutral("I've noted 1 child."),
      fieldSetNeutral('That includes 1 infant.'),
      fieldSetNeutral('Updated to 3 adults.'),
    ]);
    expect(turns[8]!.final).toMatchObject({
      adultCount: 3,
      childCount: 1,
      infantCount: 1,
      flightsRequested: true,
    });
  });

  it('characterises field removal followed by replacement', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'clear destination', stateUpdate: { destination: null } },
      { message: 'go to Hobart' },
    ]);
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      "No problem, I've removed the destination. Where would you like to travel?",
      'Great, Hobart it is. When would you like to depart?',
    ]);
    expect(turns[2]!.final.destination).toBeNull();
    expect(turns[3]!.final).toMatchObject({
      destination: 'Hobart',
      origin: 'Sydney',
    });
  });

  it('characterises capability enabled then disabled', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'I need flights' },
      { message: '2 adults' },
      { message: 'remove flights', stateUpdate: { flightsRequested: false } },
    ]);
    // Phase 16B supersedes prior direct ack+neutral joins.
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      fieldSetNeutral('Return is set for 2026-09-05.'),
      "Great, I've added flights to your trip. How many adults will be travelling?",
      fieldSetNeutral('Travelling with 2 adults.'),
      capabilityDisabledNeutral(
        "No problem, I've removed flights from your trip.",
      ),
    ]);
    expect(turns[6]!.final.flightsRequested).toBe(false);
    expect(turns[6]!.owner).toBe('16B');
  });

  it('characterises activities enabled and clarified', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'book activities' },
      { message: 'we like hiking' },
    ]);
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      fieldSetNeutral('Return is set for 2026-09-05.'),
      "Great, I've added activities to your trip. What kinds of activities are you interested in?",
      // Phase 18D: specific activity interest completes the activities follow-up.
      "Great, I've added hiking and walking to your trip. Tell me anything else that matters for this trip. What else should I know about your trip?",
    ]);
    expect(turns[5]!.followUp).toBe(FOLLOW_UPS.neutralContinuation);
    expect(turns[5]!.owner).toBe('16B');
  });

  it('characterises restaurants enabled and clarified', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'find restaurants' },
      { message: 'looking for seafood' },
    ]);
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      fieldSetNeutral('Return is set for 2026-09-05.'),
      "Great, I've added restaurants to your trip. What type of dining are you looking for?",
      // Phase 18F + 19E: seafood preference persisted with dedicated acknowledgement;
      // dining follow-up suppressed.
      'Great — seafood. What else should I know about your trip?',
    ]);
    expect(turns[5]!.final.restaurantsRequested).toBe(true);
    expect(turns[5]!.final.restaurantPreference).toBe('seafood');
    expect(turns[5]!.followUp).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('characterises unsupported message mid-journey', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'what is the weather like' },
      { message: 'from Sydney' },
    ]);
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      // Phase 18B: incomplete trip keeps the origin follow-up.
      `Let's begin with where you're travelling from. ${FOLLOW_UPS.origin}`,
      "We'll start from Sydney. When would you like to depart?",
    ]);
    expect(turns[1]!.final.destination).toBe('Cairns');
    expect(turns[1]!.final.origin).toBeNull();
    expect(turns[1]!.owner).toBe('15F');
  });

  it('characterises correction of a previous statement', () => {
    // Phase 17B: "sorry I meant Cairns" updates destination.
    const turns = runJourney([
      { message: 'go to Brisbane' },
      { message: 'sorry I meant Cairns' },
    ]);
    expectReplies(turns, [
      'Great, Brisbane it is. Where will you be travelling from?',
      'Updated — Cairns it is. Where will you be travelling from?',
    ]);
    expect(turns[1]!.final.destination).toBe('Cairns');
    expect(turns[1]!.classification.hasInterpretedChange).toBe(true);
    expect(turns[1]!.owner).toBe('15C');
  });

  it('characterises multiple facts supplied in one message', () => {
    const turns = runJourney([
      {
        message:
          'go to Cairns from Sydney on 28 August 2026 returning 5 September 2026',
      },
    ]);
    expectReplies(turns, [
      'Great, Cairns it is. When would you like to depart?',
    ]);
    // Phase 17I: origin clause boundary cleans place capture; departureDate
    // is still missed on this non-repair multi-fact shape.
    expect(turns[0]!.final.destination).toBe('Cairns');
    expect(turns[0]!.final.origin).toBe('Sydney');
    expect(turns[0]!.final.departureDate).toBeNull();
    expect(turns[0]!.final.returnDate).toBe('2026-09-05');
    expect(turns[0]!.owner).toBe('15C');
  });

  it('characterises fully satisfied trip followed by an additional preference', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
      { message: 'I like beaches' },
    ]);
    // Phase 16B supersedes prior direct ack+neutral joins.
    expectReplies(turns, [
      'Great, Cairns it is. Where will you be travelling from?',
      "We'll start from Sydney. When would you like to depart?",
      'Departure is set for 2026-08-28. When would you like to return?',
      fieldSetNeutral('Return is set for 2026-09-05.'),
      fieldSetNeutral('Travelling with 2 adults.'),
      capabilityEnabledNeutral("Great, I've added beaches to your trip."),
    ]);
    expect(turns[5]!.final.beachesRequested).toBe(true);
    expect(turns[5]!.owner).toBe('16B');
  });

  it('proves Phase 16B multi-turn production improvements over repetitive ack+neutral joins', () => {
    // core field changed after trip completion
    const dateChange = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'Depart on 1 September 2026' },
    ]);
    expect(dateChange[4]!.owner).toBe('16B');
    expect(dateChange[4]!.reply).toBe(
      fieldSetNeutral('Departure is now set for 2026-09-01.'),
    );
    expect(dateChange[4]!.reply).not.toBe(
      'Departure is now set for 2026-09-01. What else should I know about your trip?',
    );

    // field removed after trip completion
    const fieldRemoved = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
      { message: '1 child' },
      {
        message: 'clear child count',
        stateUpdate: { childCount: null },
      },
    ]);
    expect(fieldRemoved[6]!.owner).toBe('16B');
    expect(fieldRemoved[6]!.reply).toBe(
      fieldRemovedNeutral("No problem, I've removed the child count."),
    );
    expect(fieldRemoved[6]!.reply).not.toBe(
      "No problem, I've removed the child count. What else should I know about your trip?",
    );

    // capability enabled after core completion
    const capabilityEnabled = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'I like beaches' },
    ]);
    expect(capabilityEnabled[4]!.owner).toBe('16B');
    expect(capabilityEnabled[4]!.reply).toBe(
      capabilityEnabledNeutral("Great, I've added beaches to your trip."),
    );
    expect(capabilityEnabled[4]!.reply).not.toBe(
      "Great, I've added beaches to your trip. What else should I know about your trip?",
    );

    // capability disabled after core completion
    const capabilityDisabled = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'I need flights' },
      { message: '2 adults' },
      { message: 'remove flights', stateUpdate: { flightsRequested: false } },
    ]);
    expect(capabilityDisabled[6]!.owner).toBe('16B');
    expect(capabilityDisabled[6]!.reply).toBe(
      capabilityDisabledNeutral(
        "No problem, I've removed flights from your trip.",
      ),
    );
    expect(capabilityDisabled[6]!.reply).not.toBe(
      "No problem, I've removed flights from your trip. What else should I know about your trip?",
    );
  });

  it('locks recurring quality patterns observed across journeys', () => {
    const complete = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
      { message: '1 child' },
    ]);

    const neutralTrailing = complete.filter((turn) =>
      turn.reply.endsWith(CANONICAL_NEUTRAL_CONTINUATION_PROMPT),
    );
    expect(neutralTrailing.length).toBeGreaterThanOrEqual(3);
    // Phase 16B supersedes prior 15C ownership for ack+neutral trailing replies.
    expect(
      neutralTrailing.every((turn) => turn.owner === '16B'),
    ).toBe(true);
    expect(
      neutralTrailing.every((turn) => turn.reply.includes(BRIDGE_FIELD_SET)),
    ).toBe(true);
    // Prior Phase 16A repetitive direct join is no longer produced.
    expect(
      neutralTrailing.some((turn) =>
        /^(Perfect,[^.]*\.|Great,[^.]*\.) What else should I know about your trip\?$/.test(
          turn.reply,
        ),
      ),
    ).toBe(false);

    // Historical Phase 16A/16C: ≥3 Perfect, openers. Phase 16D diversifies them.
    const perfectOpeners = complete.filter((turn) =>
      turn.reply.startsWith('Perfect,'),
    );
    expect(perfectOpeners.length).toBe(0);
    expect(complete.map((turn) => turn.reply.split(/[.!?]/)[0])).toEqual([
      'Great, Cairns it is',
      "We'll start from Sydney",
      'Departure is set for 2026-08-28',
      'Return is set for 2026-09-05',
      'Travelling with 2 adults',
      "I've noted 1 child",
    ]);

    const unsupported = runJourney([
      { message: 'go to Cairns' },
      { message: 'what is the weather like' },
    ]);
    // Phase 18B: incomplete trip keeps the origin follow-up on unsupported input.
    expect(unsupported[1]!.reply).toBe(
      `Let's begin with where you're travelling from. ${FOLLOW_UPS.origin}`,
    );
    expect(unsupported[1]!.final.origin).toBeNull();
  });
});
