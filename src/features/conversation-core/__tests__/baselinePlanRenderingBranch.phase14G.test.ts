import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  generateConversationReply,
  renderConversationReplyPlan,
  type GenerateConversationReplyInput,
} from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';

/**
 * Phase 14G — unselected baseline plan-rendering branch characterisation.
 *
 * Proves the mode contract includes both modes, production selection remains
 * statically deterministic, and the unreachable baseline branch delegates to
 * generateBaselineConversationalReply(plan) without rebuilding the plan.
 */

const ROOT = process.cwd();
const MODE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
);
const SEAM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const BASELINE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateBaselineConversationalReply.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function plan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: [],
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-14g',
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
  message = 'phase-14g',
): GenerateConversationReplyInput {
  return { message, previousState, state };
}

function turn(message: string, state: ConversationCoreState) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-14g',
    assistantEntryId: 'assistant-14g',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
  });
}

describe('phase 14G — baseline plan rendering branch', () => {
  it('declares both modes, keeps production selection deterministic, and wires the unselected branch', () => {
    const source = readFileSync(SEAM_SOURCE, 'utf8');
    const modeSource = readFileSync(MODE_SOURCE, 'utf8');
    const baseline = readFileSync(BASELINE_SOURCE, 'utf8');

    expect(modeSource).toMatch(
      /export type ConversationReplyPlanIntegrationMode =\s*\|\s*'deterministic'\s*\|\s*'baseline-conversational'/,
    );
    expect(source).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/,
    );
    expect(source).not.toMatch(
      /const mode: ConversationReplyPlanIntegrationMode = 'baseline-conversational'/,
    );
    expect(source).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );
    expect(modeSource).toMatch(/switch \(input\.mode\)/);
    expect(modeSource).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );
    expect(modeSource).toMatch(
      /case 'baseline-conversational':\s*return generateBaselineConversationalReply\(input\.plan\)/,
    );
    expect(modeSource).toMatch(
      /from '\.\/generateBaselineConversationalReply'/,
    );
    expect(source.includes('generateBaselineConversationalReply')).toBe(false);

    // Baseline entry consumes the plan directly — no duplicate assembly/input construction.
    expect(baseline).toMatch(
      /export function generateBaselineConversationalReply\(\s*plan: Readonly<ConversationReplyPlan>/,
    );
    expect(modeSource.includes('buildConversationalLayerInput')).toBe(false);
    expect(modeSource.includes('createConversationReplyPlan')).toBe(false);
    expect(modeSource.includes('assembleConversationReplyPlan(')).toBe(false);
    expect(modeSource.includes('selectConversationalObjective')).toBe(false);
    expect(modeSource.includes('renderBaselineConversationalReplyPlan')).toBe(
      false,
    );
    expect(modeSource.includes('executeBaselineConversationalRenderer')).toBe(
      false,
    );

    // Mode cannot be supplied through the production wrapper or environment.
    expect(source.includes('mode?:')).toBe(false);
    expect(source.includes('input.mode')).toBe(false);
    expect(source.includes('integrationMode')).toBe(false);
    expect(source.includes('process.env')).toBe(false);
    expect(source.includes('import.meta.env')).toBe(false);
    expect(source.includes('featureFlag')).toBe(false);
    expect(source.includes('Math.random')).toBe(false);
    expect(source.includes('percentage')).toBe(false);
    expect(source.includes('request')).toBe(false);
    expect(source.includes('session')).toBe(false);
    expect(source.includes('userId')).toBe(false);
    expect(source.includes('window.')).toBe(false);
    expect(source.includes('URLSearchParams')).toBe(false);
    expect(source.includes('if (')).toBe(false);

    // Exhaustive switch: exactly two case arms on the extracted module.
    expect(modeSource.match(/case '/g)?.length).toBe(2);
    expect(modeSource.match(/case 'deterministic'/g)?.length).toBe(1);
    expect(modeSource.match(/case 'baseline-conversational'/g)?.length).toBe(1);

    // Public production contract unchanged; mode not exported from barrel.
    expect(source).toMatch(
      /export type RenderIntegratedConversationReplyPlanInput = Readonly<\{\s*plan: Readonly<ConversationReplyPlan>;\s*\}>/,
    );
    expect(source.includes('export type ConversationReplyPlanIntegrationMode')).toBe(
      false,
    );
    expect(source.includes('export const mode')).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'ConversationReplyPlanIntegrationMode',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'generateBaselineConversationalReply',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderConversationReplyPlanByIntegrationMode',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'generateBaselineConversationalReply',
      ),
    ).toBe(false);
    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'generateBaselineConversationalReply',
      ),
    ).toBe(false);
  });

  it('keeps production output unchanged and baseline parity intact', () => {
    const cases: Array<{ label: string; replyPlan: ConversationReplyPlan }> = [
      {
        label: 'acknowledgement + follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      },
      {
        label: 'neutral continuation',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      },
      {
        label: 'capability enable',
        replyPlan: plan({
          acknowledgements: [ACKS.addedCapabilities('flights')],
          followUpQuestion: FOLLOW_UPS.flightsAdultCount,
          messageInterpreted: true,
        }),
      },
      {
        label: 'capability disable',
        replyPlan: plan({
          acknowledgements: [ACKS.removedCapabilities('flights')],
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      },
      {
        label: 'empty plan',
        replyPlan: plan(),
      },
    ];

    for (const entry of cases) {
      const before = structuredClone(entry.replyPlan);
      const deterministic = renderConversationReplyPlan(entry.replyPlan);
      const baseline = generateBaselineConversationalReply(entry.replyPlan);
      const integrated = renderIntegratedConversationReplyPlan({
        plan: entry.replyPlan,
      });

      // Production seam still selects deterministic path.
      expect(integrated, entry.label).toBe(deterministic);
      // Baseline entry retains parity with deterministic wording.
      expect(baseline, `${entry.label} / baseline parity`).toBe(deterministic);
      expect(entry.replyPlan, `${entry.label} / unchanged`).toEqual(before);
    }

    expect(
      renderIntegratedConversationReplyPlan({
        plan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      }),
    ).toBe(`${ACKS.destination('Brisbane')}\n${FOLLOW_UPS.origin}`);

    expect(
      renderIntegratedConversationReplyPlan({
        plan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      }),
    ).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);

    const viaProcessTurn = turn('go to Brisbane', createState());
    expect(viaProcessTurn.reply).toBe(
      `${ACKS.destination('Brisbane')}\n${FOLLOW_UPS.origin}`,
    );

    const previous = createState();
    const state = createState({ destination: 'Cairns' });
    const input = replyInput(previous, state, 'go to Cairns');
    const previousBefore = structuredClone(previous);
    const stateBefore = structuredClone(state);
    expect(generateConversationReply(input)).toBe(
      `${ACKS.destination('Cairns')}\n${FOLLOW_UPS.origin}`,
    );
    expect(previous).toEqual(previousBefore);
    expect(state).toEqual(stateBefore);
  });

  it('does not mutate a frozen plan through either branch entry point', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.origin('Sydney')]),
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);
    const expected = renderConversationReplyPlan(replyPlan);

    expect(renderIntegratedConversationReplyPlan({ plan: replyPlan })).toBe(
      expected,
    );
    expect(generateBaselineConversationalReply(replyPlan)).toBe(expected);
    expect(replyPlan).toEqual(before);
    expect(Object.isFrozen(replyPlan)).toBe(true);
  });
});
