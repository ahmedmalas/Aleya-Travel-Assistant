import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { NEUTRAL_TRIP_FALLBACK_REPLY } from '../generateConversationReply';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 14B — route production through the integration seam.
 *
 * Proves processConversationTurn reaches generateIntegratedConversationReply
 * while preserving exact deterministic reply behaviour and without invoking
 * the experimental conversational layer.
 */

const ROOT = process.cwd();
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INTEGRATED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateIntegratedConversationReply.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-14b',
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
    userEntryId: 'user-14b',
    assistantEntryId: 'assistant-14b',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 14B — integrated conversation reply runtime', () => {
  it('routes processTurn through the integration seam without conversational-layer wiring', () => {
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const integrated = readFileSync(INTEGRATED_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');

    expect(processTurn).toMatch(
      /from '\.\/generateIntegratedConversationReply'/,
    );
    expect(processTurn).toMatch(/generateIntegratedConversationReply\(\{/);
    expect(processTurn).not.toMatch(/generateConversationReply\(/);
    expect(processTurn).toMatch(/hasSupportedTravelFieldChange\(/);

    expect(integrated).toMatch(/return generateConversationReply\(input\)/);
    expect(integrated.includes('generateBaselineConversationalReply')).toBe(
      false,
    );
    expect(integrated.includes('buildConversationalLayerInput')).toBe(false);
    expect(integrated.includes('renderBaselineConversationalLayer')).toBe(
      false,
    );
    expect(integrated.includes('executeConversationalLayerRenderer')).toBe(
      false,
    );
    expect(integrated.includes('createBaselineConversationalRendererRegistry')).toBe(
      false,
    );

    expect(processTurn.includes('generateBaselineConversationalReply')).toBe(
      false,
    );
    expect(processTurn.includes('buildConversationalLayerInput')).toBe(false);
    expect(processTurn.includes('renderBaselineConversationalLayer')).toBe(
      false,
    );
    expect(processTurn.includes('ConversationalLayerRenderer')).toBe(false);
    expect(index.includes('generateIntegratedConversationReply')).toBe(false);
  });

  it('preserves acknowledgement + follow-up wording through the seam', () => {
    const destination = turn('go to Brisbane', createState());
    expect(destination.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`,
    );

    const origin = turn(
      'from Sydney',
      createState({ destination: 'Brisbane' }),
    );
    expect(origin.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.origin('Sydney'))} ${FOLLOW_UPS.departureDate}`,
    );

    const departure = turn(
      'Depart on 28 August 2026',
      createState({
        destination: 'Brisbane',
        origin: 'Sydney',
      }),
    );
    expect(departure.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.departureDate('2026-08-28'))} ${FOLLOW_UPS.returnDate}`,
    );
  });

  it('preserves capability enable/disable and neutral continuation wording', () => {
    const core = createState({
      destination: 'Brisbane',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });

    const enableFlights = turn('I need flights', core);
    expect(enableFlights.state.flightsRequested).toBe(true);
    expect(enableFlights.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.addedCapabilities('flights'))} ${FOLLOW_UPS.flightsAdultCount}`,
    );

    const disableFlights = turn(
      'update requirements',
      {
        ...core,
        flightsRequested: true,
        adultCount: 2,
        childCount: 2,
      },
      { flightsRequested: false },
    );
    expect(disableFlights.state.flightsRequested).toBe(false);
    expect(disableFlights.reply).toBe(
      expectedActivatedBaselineReply({
        acknowledgements: [ACKS.removedCapabilities('flights')],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );

    const continuation = turn('thanks', {
      ...core,
      flightsRequested: true,
      adultCount: 2,
      childCount: 2,
    });
    expect(continuation.reply).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(continuation.reply.endsWith(FOLLOW_UPS.neutralContinuation)).toBe(
      true,
    );
  });

  it('does not mutate turn state inputs and repeats equivalent replies', () => {
    const previous = createState({ destination: 'Cairns' });
    const previousBefore = structuredClone(previous);

    const first = turn('from Melbourne', previous);
    const second = turn('from Melbourne', structuredClone(previousBefore));

    expect(previous).toEqual(previousBefore);
    expect(first.reply).toBe(second.reply);
    expect(first.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.origin('Melbourne'))} ${FOLLOW_UPS.departureDate}`,
    );
    expect(first.state.origin).toBe('Melbourne');
    expect(second.state.origin).toBe('Melbourne');
  });
});
