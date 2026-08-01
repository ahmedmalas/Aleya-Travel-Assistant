import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createConversationalLayerInput,
  type ConversationalObjective,
} from '../conversationalLayerContracts';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 13H — deterministic conversational-layer baseline characterisation.
 *
 * Proves baseline wording matches the deterministic renderer for non-eligible
 * plans, applies acknowledgement-only transform when eligible, and that style /
 * objective metadata cannot alter rendered output.
 */

const ROOT = process.cwd();
const RENDERER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function plan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: [],
    acknowledgementEvent: null,
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

function expectWordingMatchesBaseline(
  replyPlan: ConversationReplyPlan,
  style?: Parameters<typeof buildConversationalLayerInput>[1],
): string {
  const input = buildConversationalLayerInput(replyPlan, style);
  const output = renderBaselineConversationalLayer(input);
  const expected = expectedActivatedBaselineReply(replyPlan);
  expect(output).toEqual({ wording: expected });
  expect(Object.keys(output)).toEqual(['wording']);
  return output.wording;
}

describe('phase 13H — renderBaselineConversationalLayer', () => {
  it('stays free of state, message, ordering recalculation, and runtime integration', () => {
    const source = readFileSync(RENDERER_SOURCE, 'utf8');

    expect(source.includes('ConversationCoreState')).toBe(false);
    expect(source.includes('stateUpdate')).toBe(false);
    expect(source.includes('input.message')).toBe(false);
    expect(source.includes('user message')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('selectConversationFollowUpQuestion')).toBe(false);
    expect(source.includes('renderConversationReplyPlan')).toBe(true);
    expect(source.includes("from './generateConversationReply'")).toBe(true);
    expect(source.includes('transformBaselineAcknowledgement')).toBe(true);
    expect(source.includes("from './transformBaselineAcknowledgement'")).toBe(
      true,
    );
    expect(source.includes('renderBaselineFollowUpOnly')).toBe(true);
    expect(source.includes("from './renderBaselineFollowUpOnly'")).toBe(true);
    expect(source.includes('generateConversationReply(')).toBe(false);
    expect(source.includes('processConversationTurn')).toBe(false);
    expect(source.includes('styleProfile')).toBe(true);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'renderBaselineConversationalLayer',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'renderBaselineConversationalLayer',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'renderBaselineConversationalLayer',
      ),
    ).toBe(false);
  });

  it('renders acknowledgement + destination follow-up like the deterministic renderer', () => {
    const wording = expectWordingMatchesBaseline(
      plan({
        acknowledgements: ['Great — Brisbane.'],
        followUpQuestion: FOLLOW_UPS.destination,
        messageInterpreted: true,
      }),
    );
    expect(wording).toBe(`Great, Brisbane it is. ${FOLLOW_UPS.destination}`);
  });

  it('renders acknowledgement + origin follow-up like the deterministic renderer', () => {
    const wording = expectWordingMatchesBaseline(
      plan({
        acknowledgements: ['Perfect — departing from Sydney.'],
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    expect(wording).toBe(
      `We'll start from Sydney. ${FOLLOW_UPS.origin}`,
    );
  });

  it('renders a specific follow-up only with the approved conversational lead-in', () => {
    const wording = expectWordingMatchesBaseline(
      plan({
        followUpQuestion: FOLLOW_UPS.activities,
        messageInterpreted: true,
      }),
    );
    expect(wording).toBe(`Let's look at activities. ${FOLLOW_UPS.activities}`);
    expect(wording).not.toBe(FOLLOW_UPS.activities);
    expect(wording.endsWith(FOLLOW_UPS.activities)).toBe(true);
  });

  it('renders neutral continuation via Phase 15J activated expression', () => {
    const wording = expectWordingMatchesBaseline(
      plan({
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: true,
      }),
    );
    expect(wording).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(wording.endsWith(FOLLOW_UPS.neutralContinuation)).toBe(true);
  });

  it('renders uninterpreted continuation via Phase 15J activated expression', () => {
    const wording = expectWordingMatchesBaseline(
      plan({
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
        messageInterpreted: false,
      }),
    );
    expect(wording).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(wording.endsWith(FOLLOW_UPS.neutralContinuation)).toBe(true);
  });

  it('renders acknowledgement only with the approved conversational transform', () => {
    const wording = expectWordingMatchesBaseline(
      plan({
        acknowledgements: ['Perfect.'],
      acknowledgementEvent: null,
        followUpQuestion: null,
        messageInterpreted: true,
      }),
    );
    expect(wording).toBe('Perfect, got it.');
  });

  it('renders an empty plan like the deterministic renderer', () => {
    const wording = expectWordingMatchesBaseline(plan());
    expect(wording).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('allows a null objective and still renders from the plan', () => {
    const replyPlan = plan({
      acknowledgements: ['Perfect.'],
      acknowledgementEvent: null,
      followUpQuestion: null,
      messageInterpreted: true,
    });
    const input = createConversationalLayerInput(replyPlan, null);
    expect(input.objective).toBeNull();

    const output = renderBaselineConversationalLayer(input);
    expect(output).toEqual({
      wording: transformBaselineAcknowledgement('Perfect.'),
    });
    expect(output.wording).toBe('Perfect, got it.');
  });

  it('ignores professional, warm, and luxury style profiles', () => {
    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const baseline = expectedActivatedBaselineReply(replyPlan);

    for (const style of [
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
      REFERENCE_CONVERSATIONAL_STYLE_WARM,
      REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
    ]) {
      const output = renderBaselineConversationalLayer(
        buildConversationalLayerInput(replyPlan, style),
      );
      expect(output.wording).toBe(baseline);
      expect(output).toEqual({ wording: baseline });
    }
  });

  it('never lets objective metadata override the plan, including malformed metadata', () => {
    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    });
    const expected = expectedActivatedBaselineReply(replyPlan);

    const mismatched: ConversationalObjective = {
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    };
    const inventingNone: ConversationalObjective = {
      id: 'none',
      catalogueWording: null,
    };
    const inventingNeutral: ConversationalObjective = {
      id: 'neutralContinuation',
      catalogueWording: FOLLOW_UPS.neutralContinuation,
    };

    for (const objective of [mismatched, inventingNone, inventingNeutral, null]) {
      const output = renderBaselineConversationalLayer(
        createConversationalLayerInput(replyPlan, objective),
      );
      expect(output.wording).toBe(expected);
      expect(output.wording.includes(FOLLOW_UPS.origin)).toBe(false);
      expect(output.wording).toBe(
        `Great, Brisbane it is. ${FOLLOW_UPS.destination}`,
      );
    }
  });

  it('renders identical frozen input identically and does not mutate it', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const input = Object.freeze(
      buildConversationalLayerInput(
        replyPlan,
        REFERENCE_CONVERSATIONAL_STYLE_WARM,
      ),
    );
    const before = structuredClone(input);

    const first = renderBaselineConversationalLayer(input);
    const second = renderBaselineConversationalLayer(input);
    const third = renderBaselineConversationalLayer(structuredClone(input));

    expect(first).toEqual({
      wording: expectedActivatedBaselineReply(replyPlan),
    });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(input).toEqual(before);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.plan)).toBe(true);
    expect(Object.isFrozen(REFERENCE_CONVERSATIONAL_STYLE_WARM)).toBe(true);
  });
});
