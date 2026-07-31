import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  generateConversationReply,
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
  type GenerateConversationReplyInput,
} from '../generateConversationReply';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 14E — route deterministic rendering through the plan-level seam.
 *
 * Proves generateConversationReply reaches renderIntegratedConversationReplyPlan
 * for final production rendering, preserves exact deterministic wording, and
 * does not activate the conversational layer.
 */

const ROOT = process.cwd();
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INTEGRATED_REPLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateIntegratedConversationReply.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const CREATE_PLAN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationReplyPlan.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const CONVERSATIONAL_MARKERS = [
  'generateBaselineConversationalReply',
  'renderBaselineConversationalReplyPlan',
  'renderBaselineConversationalLayer',
  'buildConversationalLayerInput',
  'executeBaselineConversationalRenderer',
  'executeConversationalLayerRenderer',
  'createBaselineConversationalRendererRegistry',
  'ConversationalLayerRenderer',
  'ConversationalLayerInput',
  'conversationalLayerContracts',
] as const;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-14e',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function replyInput(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
  message = 'phase-14e',
): GenerateConversationReplyInput {
  return { message, previousState, state };
}

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-14e',
    assistantEntryId: 'assistant-14e',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 14E — integrated reply plan runtime', () => {
  it('routes the authoritative production path through the plan-level seam', () => {
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const integrated = readFileSync(INTEGRATED_REPLY_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const createPlan = readFileSync(CREATE_PLAN_SOURCE, 'utf8');

    expect(generate).toMatch(
      /from '\.\/renderIntegratedConversationReplyPlan'/,
    );
    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(generate).not.toMatch(/return renderConversationReplyPlan\(plan\)/);
    expect(generate).toMatch(/export function renderConversationReplyPlan/);
    expect(generate.match(/createConversationReplyPlan\(/g)?.length).toBe(1);

    expect(seam).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(seam).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );
    expect(seam.includes('generateBaselineConversationalReply')).toBe(false);
    expect(seam.includes('switch (')).toBe(false);

    // Final production rendering is owned by the plan seam, not processTurn
    // or the state-level integration entry.
    expect(processTurn.includes('renderIntegratedConversationReplyPlan')).toBe(
      false,
    );
    expect(processTurn.includes('renderConversationReplyPlan')).toBe(false);
    expect(integrated.includes('renderIntegratedConversationReplyPlan')).toBe(
      false,
    );
    expect(integrated.includes('renderConversationReplyPlan')).toBe(false);
    expect(createPlan.includes('renderIntegratedConversationReplyPlan')).toBe(
      false,
    );
    expect(createPlan.includes('renderConversationReplyPlan')).toBe(false);

    expect(index.includes('renderIntegratedConversationReplyPlan')).toBe(false);
    expect(index.includes('renderConversationReplyPlan')).toBe(false);

    for (const marker of CONVERSATIONAL_MARKERS) {
      expect(generate.includes(marker), `generate must not reference ${marker}`).toBe(
        false,
      );
      expect(seam.includes(marker), `seam must not reference ${marker}`).toBe(
        false,
      );
    }

    expect(generate.includes('featureFlag')).toBe(false);
    expect(generate.includes('process.env')).toBe(false);
    expect(seam.includes('featureFlag')).toBe(false);
    expect(seam.includes('process.env')).toBe(false);
    expect(seam.includes('if (')).toBe(false);
    expect(seam.includes('switch (')).toBe(false);
  });

  it('preserves acknowledgement, follow-up, continuation, and capability output exactly', () => {
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

    const core = createState({
      destination: 'Brisbane',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });

    const enableFlights = turn('I need flights', core);
    expect(enableFlights.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.addedCapabilities('flights'))} ${FOLLOW_UPS.flightsAdultCount}`,
    );

    const disableFlights = turn(
      'update requirements',
      {
        ...core,
        flightsRequested: true,
        adultCount: 2,
      },
      { flightsRequested: false },
    );
    expect(disableFlights.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.removedCapabilities('flights'))} ${FOLLOW_UPS.neutralContinuation}`,
    );

    const continuation = turn('thanks', {
      ...core,
      flightsRequested: true,
      adultCount: 2,
    });
    expect(continuation.reply).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(continuation.reply.endsWith(FOLLOW_UPS.neutralContinuation)).toBe(
      true,
    );
  });

  it('keeps generateConversationReply output identical to direct deterministic rendering', () => {
    const cases: Array<{
      label: string;
      previousState: ConversationCoreState;
      state: ConversationCoreState;
    }> = [
      {
        label: 'acknowledgement + follow-up',
        previousState: createState(),
        state: createState({ destination: 'Brisbane' }),
      },
      {
        label: 'capability enable',
        previousState: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
        }),
        state: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          flightsRequested: true,
        }),
      },
      {
        label: 'capability disable',
        previousState: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          flightsRequested: true,
          adultCount: 2,
        }),
        state: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          flightsRequested: false,
          adultCount: 2,
        }),
      },
      {
        label: 'neutral continuation',
        previousState: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          flightsRequested: true,
          adultCount: 2,
        }),
        state: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-05',
          flightsRequested: true,
          adultCount: 2,
        }),
      },
    ];

    for (const entry of cases) {
      const previousBefore = structuredClone(entry.previousState);
      const stateBefore = structuredClone(entry.state);
      const classification = classifyConversationStateChange(
        entry.previousState,
        entry.state,
      );
      const plan = createConversationReplyPlan({
        state: entry.state,
        classification,
      });
      const planBefore = structuredClone(plan);

      const viaGenerator = generateConversationReply(
        replyInput(entry.previousState, entry.state),
      );
      const viaSeam = renderIntegratedConversationReplyPlan({ plan });
      const viaDirect = renderConversationReplyPlan(plan);
      const expected = expectedActivatedBaselineReply(plan);

      expect(viaGenerator, entry.label).toBe(expected);
      expect(viaSeam, `${entry.label} / seam`).toBe(expected);
      if (expected === viaDirect) {
        expect(expected, `${entry.label} / parity`).toBe(viaDirect);
      } else {
        expect(expected, `${entry.label} / diverges`).not.toBe(viaDirect);
      }
      expect(entry.previousState, `${entry.label} / previous`).toEqual(
        previousBefore,
      );
      expect(entry.state, `${entry.label} / state`).toEqual(stateBefore);
      expect(plan, `${entry.label} / plan`).toEqual(planBefore);
    }
  });

  it('does not mutate frozen inputs when rendering through the production path', () => {
    const previousState = Object.freeze(createState());
    const state = Object.freeze(createState({ destination: 'Cairns' }));
    const previousBefore = structuredClone(previousState);
    const stateBefore = structuredClone(state);

    const first = generateConversationReply(
      replyInput(previousState, state, 'go to Cairns'),
    );
    const second = generateConversationReply(
      replyInput(previousState, state, 'go to Cairns'),
    );

    expect(first).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Cairns'))} ${FOLLOW_UPS.origin}`,
    );
    expect(second).toBe(first);
    expect(previousState).toEqual(previousBefore);
    expect(state).toEqual(stateBefore);
    expect(Object.isFrozen(previousState)).toBe(true);
    expect(Object.isFrozen(state)).toBe(true);
  });
});
