import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import type { ConversationAcknowledgementEvent } from '../conversationAcknowledgementEvent';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { renderConversationReplyPlan } from '../generateConversationReply';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
} from '../renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16K — production-path closure audit for Phase 16 acknowledgement
 * expression. Characterization only. Production wording is unchanged.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const BRIDGE_FIELD =
  "Is there anything else you'd like me to consider?";
const BRIDGE_REMOVED = 'We can update the rest as we go.';
const BRIDGE_CAP_ENABLED =
  'Tell me anything else that matters for this trip.';
const BRIDGE_CAP_DISABLED = 'We can keep refining the plan.';
const NEUTRAL = CANONICAL_NEUTRAL_CONTINUATION_PROMPT;

type Owner = '15B' | '15C' | '15J' | '15F' | '15E' | '16B' | 'deterministic';

type CapturedTurn = {
  turn: number;
  message: string;
  deterministicAcknowledgement: string | null;
  acknowledgementEvent: ConversationAcknowledgementEvent;
  renderedAcknowledgement: string | null;
  renderedOpener: string;
  followUpOrContinuation: string | null;
  owner: Owner;
  fallbackUsed: boolean;
  reply: string;
  destination: string | null;
  origin: string | null;
  departureDate: string | null;
  returnDate: string | null;
  restaurantsRequested: boolean | null;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16k',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function classifyOwner(plan: ConversationReplyPlan): Owner {
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === NEUTRAL
  ) {
    return '16B';
  }
  if (plan.acknowledgements.length === 1 && plan.followUpQuestion === null) {
    return '15B';
  }
  if (plan.acknowledgements.length === 1 && plan.followUpQuestion !== null) {
    return '15C';
  }
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion === NEUTRAL
  ) {
    return '15J';
  }
  if (plan.acknowledgements.length === 0 && plan.followUpQuestion !== null) {
    if (
      plan.followUpQuestion === FOLLOW_UPS.activities ||
      plan.followUpQuestion === FOLLOW_UPS.restaurants ||
      plan.followUpQuestion === FOLLOW_UPS.flightsAdultCount ||
      plan.followUpQuestion === FOLLOW_UPS.accommodationGuestCount
    ) {
      return '15F';
    }
    return '15E';
  }
  return 'deterministic';
}

function opener(rendered: string | null): string {
  if (rendered === null) return '(none)';
  if (rendered.startsWith("Great, I've added")) return "Great, I've added";
  if (rendered.startsWith('Updated —')) return 'Updated —';
  if (rendered.startsWith('Great,')) return 'Great,';
  if (rendered.startsWith('No problem,')) return 'No problem,';
  if (rendered.startsWith("We'll start")) return "We'll start";
  if (rendered.startsWith("We'll depart")) return "We'll depart";
  if (rendered.startsWith('Departure is now set')) return 'Departure is now set';
  if (rendered.startsWith('Departure is set')) return 'Departure is set';
  if (rendered.startsWith('Return is now set')) return 'Return is now set';
  if (rendered.startsWith('Return is set')) return 'Return is set';
  if (rendered.startsWith('Travelling with')) return 'Travelling with';
  if (rendered.startsWith('Updated to')) return 'Updated to';
  if (rendered.startsWith("I've noted")) return "I've noted";
  if (rendered.startsWith('That includes')) return 'That includes';
  if (rendered.startsWith('Perfect,')) return 'Perfect,';
  if (rendered.startsWith("There's just one more thing")) {
    return "There's just one more thing";
  }
  return rendered.split(/[\s.]/)[0] ?? rendered;
}

function ackOnly(reply: string, acknowledgement: string | null): string | null {
  if (acknowledgement === null) return null;
  const transformed = transformBaselineAcknowledgement;
  // Prefer stripping known suffixes after the transformed ack.
  for (const marker of [
    ` ${BRIDGE_FIELD} `,
    ` ${BRIDGE_REMOVED} `,
    ` ${BRIDGE_CAP_ENABLED} `,
    ` ${BRIDGE_CAP_DISABLED} `,
    ` ${NEUTRAL}`,
    `\n${NEUTRAL}`,
    ' Where ',
    ' When ',
    ' How ',
    ' What ',
  ]) {
    const idx = reply.indexOf(marker);
    if (idx >= 0) return reply.slice(0, idx);
  }
  void transformed;
  return reply;
}

function runJourney(
  steps: Array<{ message: string; stateUpdate?: ConversationStateUpdate }>,
  initial: Partial<ConversationCoreState> = {},
): CapturedTurn[] {
  let state = createState(initial);
  const captured: CapturedTurn[] = [];

  for (const [index, step] of steps.entries()) {
    const previous = structuredClone(state);
    const result = processConversationTurn({
      message: step.message,
      state,
      userEntryId: `user-16k-${index}`,
      assistantEntryId: `assistant-16k-${index}`,
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
    const plan = createConversationReplyPlan({
      state: result.state,
      classification,
    });
    const owner = classifyOwner(plan);
    const deterministicAcknowledgement =
      plan.acknowledgements.length === 1 ? plan.acknowledgements[0]! : null;
    const renderedAcknowledgement =
      deterministicAcknowledgement === null
        ? null
        : transformBaselineAcknowledgement(
            deterministicAcknowledgement,
            plan.acknowledgementEvent,
          );
    const fallbackUsed =
      owner === 'deterministic' ||
      (plan.acknowledgements.length !== 1 &&
        plan.acknowledgements.length !== 0);

    captured.push({
      turn: index + 1,
      message: step.message,
      deterministicAcknowledgement,
      acknowledgementEvent: plan.acknowledgementEvent,
      renderedAcknowledgement:
        renderedAcknowledgement ??
        ackOnly(result.reply, deterministicAcknowledgement),
      renderedOpener: opener(
        renderedAcknowledgement ??
          (deterministicAcknowledgement === null ? null : result.reply),
      ),
      followUpOrContinuation: plan.followUpQuestion,
      owner,
      fallbackUsed,
      reply: result.reply,
      destination: result.state.destination,
      origin: result.state.origin,
      departureDate: result.state.departureDate,
      returnDate: result.state.returnDate,
      restaurantsRequested: result.state.restaurantsRequested,
    });
    state = result.state;
  }

  return captured;
}

function maxConsecutive(values: readonly string[]): number {
  if (values.length === 0) return 0;
  let max = 1;
  let run = 1;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] === values[i - 1]) {
      run += 1;
      max = Math.max(max, run);
    } else {
      run = 1;
    }
  }
  return max;
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

const COMPLETE_CORE: Partial<ConversationCoreState> = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-05',
  adultCount: 2,
  childCount: 1,
  infantCount: 1,
};

describe('Phase 16K — conversational quality closure audit', () => {
  it('Journey A — initial trip capture openers', () => {
    const turns = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
      { message: '1 child' },
      { message: '1 infant' },
    ]);

    expect(turns.map((turn) => turn.renderedOpener)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Travelling with',
      "I've noted",
      'That includes',
    ]);
    expect(turns.map((turn) => turn.acknowledgementEvent?.kind)).toEqual([
      'field-set',
      'field-set',
      'field-set',
      'field-set',
      'field-set',
      'field-set',
      'field-set',
    ]);
    expect(maxConsecutive(turns.map((turn) => turn.renderedOpener))).toBe(1);
  });

  it('Journey B — complete trip revision openers', () => {
    const turns = runJourney(
      [
        { message: 'go to Hobart' },
        { message: 'from Brisbane instead' },
        { message: 'Depart on 30 August 2026' },
        { message: 'Return on 8 September 2026' },
        { message: '3 adults' },
        { message: '2 children' },
        { message: '2 infants' },
      ],
      COMPLETE_CORE,
    );

    expect(turns.map((turn) => turn.renderedOpener)).toEqual([
      'Updated —',
      "We'll depart",
      'Departure is now set',
      'Return is now set',
      'Updated to',
      'Updated to',
      'Updated to',
    ]);
    expect(turns.map((turn) => turn.acknowledgementEvent?.kind)).toEqual([
      'field-changed',
      'field-changed',
      'field-changed',
      'field-changed',
      'field-changed',
      'field-changed',
      'field-changed',
    ]);
    // Shared "Updated to" across passenger families is consecutive here.
    expect(maxConsecutive(turns.map((turn) => turn.renderedOpener))).toBe(3);
    expect(
      turns.slice(4).every((turn) => turn.renderedOpener === 'Updated to'),
    ).toBe(true);
    expect(
      new Set(turns.slice(4).map((turn) => turn.renderedAcknowledgement)).size,
    ).toBe(3);
  });

  it('Journey C — all seven set-versus-changed distinctions', () => {
    const pairs: Array<{
      field: string;
      setMessage: string;
      changeMessage: string;
      setOpener: string;
      changeOpener: string;
      seed: Partial<ConversationCoreState>;
    }> = [
      {
        field: 'destination',
        setMessage: 'go to Cairns',
        changeMessage: 'go to Hobart',
        setOpener: 'Great,',
        changeOpener: 'Updated —',
        seed: {},
      },
      {
        field: 'origin',
        setMessage: 'from Sydney',
        changeMessage: 'from Brisbane instead',
        setOpener: "We'll start",
        changeOpener: "We'll depart",
        seed: { destination: 'Cairns' },
      },
      {
        field: 'departureDate',
        setMessage: 'Depart on 28 August 2026',
        changeMessage: 'Depart on 30 August 2026',
        setOpener: 'Departure is set',
        changeOpener: 'Departure is now set',
        seed: { destination: 'Cairns', origin: 'Sydney' },
      },
      {
        field: 'returnDate',
        setMessage: 'Return on 5 September 2026',
        changeMessage: 'Return on 8 September 2026',
        setOpener: 'Return is set',
        changeOpener: 'Return is now set',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        },
      },
      {
        field: 'adultCount',
        setMessage: '1 adult',
        changeMessage: '3 adults',
        setOpener: 'Travelling with',
        changeOpener: 'Updated to',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        },
      },
      {
        field: 'childCount',
        setMessage: '1 child',
        changeMessage: '2 children',
        setOpener: "I've noted",
        changeOpener: 'Updated to',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
        },
      },
      {
        field: 'infantCount',
        setMessage: '1 infant',
        changeMessage: '2 infants',
        setOpener: 'That includes',
        changeOpener: 'Updated to',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          adultCount: 2,
          childCount: 1,
        },
      },
    ];

    let distinctPairs = 0;
    for (const pair of pairs) {
      const turns = runJourney(
        [{ message: pair.setMessage }, { message: pair.changeMessage }],
        pair.seed,
      );
      expect(turns[0]!.acknowledgementEvent, pair.field).toEqual({
        kind: 'field-set',
        field: pair.field,
      });
      expect(turns[1]!.acknowledgementEvent, pair.field).toEqual({
        kind: 'field-changed',
        field: pair.field,
      });
      expect(turns[0]!.renderedOpener, pair.field).toBe(pair.setOpener);
      expect(turns[1]!.renderedOpener, pair.field).toBe(pair.changeOpener);
      expect(turns[0]!.renderedOpener, pair.field).not.toBe(
        turns[1]!.renderedOpener,
      );
      distinctPairs += 1;
    }
    expect(distinctPairs).toBe(7);
  });

  it('preserves adult → child → infant set sequence as distinct openers', () => {
    const turns = runJourney(
      [
        { message: '2 adults' },
        { message: '1 child' },
        { message: '1 infant' },
      ],
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
      },
    );
    expect(turns.map((turn) => turn.renderedOpener)).toEqual([
      'Travelling with',
      "I've noted",
      'That includes',
    ]);
  });

  it('Journey D — removal wording remains deterministic and unchanged', () => {
    const removals: Array<{
      field: string;
      stateUpdate: ConversationStateUpdate;
      expectedAck: string;
      expectedRendered: string;
    }> = [
      {
        field: 'destination',
        stateUpdate: { destination: null },
        expectedAck: ACKS.destinationRemoved,
        expectedRendered: "No problem, I've removed the destination.",
      },
      {
        field: 'origin',
        stateUpdate: { origin: null },
        expectedAck: ACKS.originRemoved,
        expectedRendered: "No problem, I've removed the departure location.",
      },
      {
        field: 'departureDate',
        stateUpdate: { departureDate: null },
        expectedAck: ACKS.departureDateRemoved,
        expectedRendered: "No problem, I've removed the departure date.",
      },
      {
        field: 'returnDate',
        stateUpdate: { returnDate: null },
        expectedAck: ACKS.returnDateRemoved,
        expectedRendered: "No problem, I've removed the return date.",
      },
      {
        field: 'adultCount',
        stateUpdate: { adultCount: null },
        expectedAck: ACKS.adultCountRemoved,
        expectedRendered: "No problem, I've removed the adult count.",
      },
      {
        field: 'childCount',
        stateUpdate: { childCount: null },
        expectedAck: ACKS.childCountRemoved,
        expectedRendered: "No problem, I've removed the child count.",
      },
      {
        field: 'infantCount',
        stateUpdate: { infantCount: null },
        expectedAck: ACKS.infantCountRemoved,
        expectedRendered: "No problem, I've removed the infant count.",
      },
    ];

    for (const removal of removals) {
      const turns = runJourney(
        [{ message: 'clear field', stateUpdate: removal.stateUpdate }],
        COMPLETE_CORE,
      );
      expect(turns[0]!.deterministicAcknowledgement, removal.field).toBe(
        removal.expectedAck,
      );
      expect(turns[0]!.acknowledgementEvent, removal.field).toEqual({
        kind: 'field-removed',
        field: removal.field,
      });
      expect(turns[0]!.renderedAcknowledgement, removal.field).toBe(
        removal.expectedRendered,
      );
      expect(turns[0]!.renderedOpener, removal.field).toBe('No problem,');
    }
  });

  it('Journey E — capability enable/disable wording and priority unchanged', () => {
    const turns = runJourney(
      [
        { message: 'I need flights' },
        { message: 'I like beaches' },
        {
          message: 'remove flights',
          stateUpdate: { flightsRequested: false },
        },
        {
          message: 'remove beaches',
          stateUpdate: { beachesRequested: false },
        },
      ],
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
      },
    );

    expect(turns[0]!.acknowledgementEvent).toEqual({
      kind: 'capability-enabled',
      capabilities: ['flights'],
    });
    expect(turns[0]!.renderedAcknowledgement).toBe(
      "Great, I've added flights to your trip.",
    );
    expect(turns[1]!.acknowledgementEvent).toEqual({
      kind: 'capability-enabled',
      capabilities: ['beaches'],
    });
    expect(turns[2]!.acknowledgementEvent).toEqual({
      kind: 'capability-disabled',
      capabilities: ['flights'],
    });
    expect(turns[2]!.renderedAcknowledgement).toBe(
      "No problem, I've removed flights from your trip.",
    );
    expect(turns[3]!.acknowledgementEvent).toEqual({
      kind: 'capability-disabled',
      capabilities: ['beaches'],
    });
  });

  it('Journey F — generic, follow-up-only, neutral-only, and fallback paths unchanged', () => {
    // Follow-up only / neutral only: unsupported after destination set.
    const unsupported = runJourney([
      { message: 'go to Cairns' },
      { message: 'asdfgh nonsense' },
    ]);
    expect(unsupported[1]!.deterministicAcknowledgement).toBeNull();
    expect(unsupported[1]!.acknowledgementEvent).toBeNull();
    expect(unsupported[1]!.owner).toBe('15J');
    expect(unsupported[1]!.reply).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);

    // Generic catalogue transform still maps Perfect. → Perfect, got it.
    expect(
      transformBaselineAcknowledgement(ACKS.genericTravelFieldChange, {
        kind: 'generic',
      }),
    ).toBe('Perfect, got it.');

    // Deterministic fallback for multi-ack / empty-null shapes.
    const multi = renderConversationReplyPlan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    });
    expect(multi).toBe(
      `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`,
    );
    const empty = renderConversationReplyPlan({
      acknowledgements: [],
      acknowledgementEvent: null,
      followUpQuestion: null,
      messageInterpreted: false,
    });
    expect(empty).toBe(NEUTRAL);
  });

  it('Journey G — acknowledgement + non-neutral follow-up preserves follow-up text', () => {
    const set = runJourney([{ message: 'go to Cairns' }]);
    expect(set[0]!.owner).toBe('15C');
    expect(set[0]!.followUpOrContinuation).toBe(FOLLOW_UPS.origin);
    expect(set[0]!.reply).toBe(
      `Great, Cairns it is. ${FOLLOW_UPS.origin}`,
    );

    const change = runJourney(
      [{ message: 'go to Hobart' }],
      { destination: 'Cairns' },
    );
    expect(change[0]!.owner).toBe('15C');
    expect(change[0]!.followUpOrContinuation).toBe(FOLLOW_UPS.origin);
    expect(change[0]!.reply).toBe(
      `Updated — Hobart it is. ${FOLLOW_UPS.origin}`,
    );
    // Only acknowledgement expression differs; follow-up identical.
    expect(set[0]!.followUpOrContinuation).toBe(
      change[0]!.followUpOrContinuation,
    );
  });

  it('Journey H — acknowledgement + canonical neutral preserves 16B bridge', () => {
    const set = runJourney(
      [{ message: '2 adults' }],
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
      },
    );
    expect(set[0]!.owner).toBe('16B');
    expect(set[0]!.reply).toBe(
      `Travelling with 2 adults. ${BRIDGE_FIELD} ${NEUTRAL}`,
    );

    const change = runJourney(
      [{ message: 'go to Hobart' }],
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
      },
    );
    expect(change[0]!.owner).toBe('16B');
    expect(change[0]!.reply).toBe(
      `Updated — Hobart it is. ${BRIDGE_FIELD} ${NEUTRAL}`,
    );
    expect(change[0]!.reply).toContain(BRIDGE_FIELD);
    expect(change[0]!.reply.endsWith(NEUTRAL)).toBe(true);
  });

  it('records Phase 16 closure measurements across capture and revision journeys', () => {
    const capture = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
      { message: '1 child' },
      { message: '1 infant' },
    ]);
    const revision = runJourney(
      [
        { message: 'go to Hobart' },
        { message: 'from Brisbane instead' },
        { message: 'Depart on 30 August 2026' },
        { message: 'Return on 8 September 2026' },
        { message: '3 adults' },
        { message: '2 children' },
        { message: '2 infants' },
      ],
      COMPLETE_CORE,
    );
    const all = [...capture, ...revision];
    const openers = all.map((turn) => turn.renderedOpener);
    const completeAcks = all.map(
      (turn) => turn.renderedAcknowledgement ?? '',
    );
    const openerCounts = countBy(openers);
    const mostFrequent = Object.entries(openerCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]!;

    expect(mostFrequent[0]).toBe('Updated to');
    expect(mostFrequent[1]).toBe(3);
    expect(maxConsecutive(openers)).toBe(3);
    expect(maxConsecutive(completeAcks)).toBe(1);

    // Seven set/change pairs with distinct wording (measured in Journey C).
    // Families still sharing an opener intentionally: passenger field-changed
    // uses "Updated to" for adult/child/infant.
    const sharedChangedPassengerOpener = revision
      .slice(4)
      .map((turn) => turn.renderedOpener);
    expect(sharedChangedPassengerOpener).toEqual([
      'Updated to',
      'Updated to',
      'Updated to',
    ]);
  });

  it('reconfirms known non-acknowledgement defects are unchanged', () => {
    // Failed repair: natural correction phrasing is not extracted; destination stays.
    const failedRepair = runJourney([
      { message: 'go to Brisbane' },
      { message: 'sorry I meant Cairns' },
    ]);
    expect(failedRepair[0]!.destination).toBe('Brisbane');
    expect(failedRepair[1]!.destination).toBe('Brisbane');
    expect(failedRepair[1]!.deterministicAcknowledgement).toBeNull();
    expect(failedRepair[1]!.acknowledgementEvent).toBeNull();
    expect(failedRepair[1]!.owner).toBe('15J');
    expect(failedRepair[1]!.reply).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);

    // Activities re-asked after hiking interest clarification.
    const hiking = runJourney(
      [
        { message: 'book activities' },
        { message: 'we like hiking' },
      ],
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
      },
    );
    expect(hiking[1]!.reply).toContain(
      "Great, I've added hiking and walking to your trip.",
    );
    expect(hiking[1]!.followUpOrContinuation).toBe(FOLLOW_UPS.activities);

    // Seafood preference ignored — no seafood wording; restaurants flag remains.
    const seafood = runJourney(
      [{ message: 'looking for seafood' }],
      {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-05',
        adultCount: 2,
        restaurantsRequested: true,
      },
    );
    expect(seafood[0]!.reply).not.toMatch(/seafood/i);
    expect(seafood[0]!.restaurantsRequested).toBe(true);
    expect(seafood[0]!.owner).toBe('15J');

    // Multi-fact extraction pollutes origin and misses departureDate.
    const multiFact = runJourney([
      {
        message:
          'go to Cairns from Sydney on 28 August 2026 returning 5 September 2026',
      },
    ]);
    expect(multiFact[0]!.destination).toBe('Cairns');
    expect(multiFact[0]!.origin).toBe(
      'Sydney on 28 August 2026 returning 5 September 2026',
    );
    expect(multiFact[0]!.departureDate).toBeNull();
    expect(multiFact[0]!.returnDate).toBe('2026-09-05');
    expect(multiFact[0]!.followUpOrContinuation).toBe(FOLLOW_UPS.departureDate);
  });

  it('documents Phase 16K is audit-only and production modules are untouched', () => {
    const audit = readFileSync(
      resolve(
        ROOT,
        'docs/conversation-engine/phase16-conversational-quality-closure-audit.md',
      ),
      'utf8',
    );
    expect(audit).toMatch(/Phase 16 acknowledgement-expression work is complete/);
    expect(audit).toMatch(/Updated to/);
    expect(audit).toMatch(/semantically intentional/);

    // Transform/selection/assembly signatures from 16J remain event-aware.
    const transform = readFileSync(
      resolve(CORE_SRC, 'transformBaselineAcknowledgement.ts'),
      'utf8',
    );
    expect(transform).toMatch(/Phase 16J/);
    expect(transform).toMatch(/acknowledgementEvent/);
  });
});
