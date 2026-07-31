import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { renderBaselineConversationalReplyPlan } from '../renderBaselineConversationalReplyPlan';
import { selectConversationalObjective } from '../selectConversationalObjective';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 13P — baseline conversational reply generator characterisation.
 *
 * Proves ConversationReplyPlan → renderBaselineConversationalReplyPlan →
 * wording-string return without runtime wiring or wording mutation beyond the
 * acknowledgement-only transform.
 */

const ROOT = process.cwd();
const GENERATOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateBaselineConversationalReply.ts',
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
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

function expectedBaselineWording(replyPlan: ConversationReplyPlan): string {
  if (
    replyPlan.acknowledgements.length === 1 &&
    replyPlan.followUpQuestion === null
  ) {
    return transformBaselineAcknowledgement(replyPlan.acknowledgements[0]!);
  }
  return renderConversationReplyPlan(replyPlan);
}

function expectWording(
  replyPlan: ConversationReplyPlan,
  style?: Parameters<typeof generateBaselineConversationalReply>[1],
) {
  const wording = generateBaselineConversationalReply(replyPlan, style);
  const viaAdapter = renderBaselineConversationalReplyPlan(replyPlan, style);
  const expected = expectedBaselineWording(replyPlan);

  expect(typeof wording).toBe('string');
  expect(wording).toBe(viaAdapter.wording);
  expect(wording).toBe(expected);
  expect(wording).toBe(viaAdapter.wording);
  return { wording, expected };
}

describe('phase 13P — generateBaselineConversationalReply', () => {
  it('returns wording only through the reply-plan adapter without duplicate boundaries', () => {
    const source = readFileSync(GENERATOR_SOURCE, 'utf8');

    expect(source.includes('renderBaselineConversationalReplyPlan')).toBe(true);
    expect(source.includes('.wording')).toBe(true);
    expect(source.includes('buildConversationalLayerInput')).toBe(false);
    expect(source.includes('executeBaselineConversationalRenderer')).toBe(false);
    expect(source.includes('executeConversationalLayerRenderer')).toBe(false);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(source.includes('renderConversationReplyPlan')).toBe(false);
    expect(source.includes('createBaselineConversationalRendererRegistry')).toBe(
      false,
    );
    expect(source.includes('selectConversationalObjective')).toBe(false);
    expect(source.includes('followUpQuestion')).toBe(false);
    expect(source.includes('acknowledgements')).toBe(false);
    expect(source.includes('trim(')).toBe(false);
    expect(source.includes('fallback')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('OpenAI')).toBe(false);
    expect(source.includes('LLM')).toBe(false);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'generateBaselineConversationalReply',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'generateBaselineConversationalReply',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'generateBaselineConversationalReply',
      ),
    ).toBe(false);
  });

  it('returns exact wording for acknowledgement + follow-up without trimming or punctuation changes', () => {
    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const { wording, expected } = expectWording(replyPlan);
    expect(wording).toBe(`Great — Brisbane.\n${FOLLOW_UPS.origin}`);
    expect(wording).toBe(expected);
    expect(wording.startsWith(' ')).toBe(false);
    expect(wording.endsWith(' ')).toBe(false);
    expect(wording.includes('Great — Brisbane.')).toBe(true);
    expect(wording.includes(FOLLOW_UPS.origin)).toBe(true);
  });

  it('covers specific follow-up, neutral continuation, acknowledgement-only, and empty plans', () => {
    expect(
      expectWording(
        plan({
          followUpQuestion: FOLLOW_UPS.activities,
          messageInterpreted: true,
        }),
      ).wording,
    ).toBe(FOLLOW_UPS.activities);

    expect(
      expectWording(
        plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      ).wording,
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      expectWording(
        plan({
          acknowledgements: ['Perfect.'],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      ).wording,
    ).toBe('Perfect, got it.');

    expect(expectWording(plan()).wording).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
  });

  it('supports null derived objective and style profiles without behavioural effect', () => {
    const emptyObjectivePlan = plan({
      acknowledgements: ['Perfect.'],
      followUpQuestion: null,
      messageInterpreted: true,
    });
    expect(selectConversationalObjective(emptyObjectivePlan)).toBeNull();
    expect(buildConversationalLayerInput(emptyObjectivePlan).objective).toBeNull();
    expect(generateBaselineConversationalReply(emptyObjectivePlan)).toBe(
      'Perfect, got it.',
    );

    const replyPlan = plan({
      acknowledgements: ['Great — Brisbane.'],
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    });
    expect(generateBaselineConversationalReply(replyPlan)).toBe(
      renderConversationReplyPlan(replyPlan),
    );

    for (const style of [
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
      REFERENCE_CONVERSATIONAL_STYLE_WARM,
      REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
    ]) {
      expectWording(replyPlan, style);
    }
  });

  it('leaves frozen plan and style unchanged and repeats equivalent wording', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const style = REFERENCE_CONVERSATIONAL_STYLE_LUXURY;
    const planBefore = structuredClone(replyPlan);
    const styleBefore = structuredClone(style);
    const expected = renderConversationReplyPlan(replyPlan);

    const first = generateBaselineConversationalReply(replyPlan, style);
    const second = generateBaselineConversationalReply(replyPlan, style);
    const third = generateBaselineConversationalReply(
      structuredClone(replyPlan),
      style,
    );

    expect(first).toBe(expected);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(replyPlan).toEqual(planBefore);
    expect(style).toEqual(styleBefore);
    expect(Object.isFrozen(replyPlan)).toBe(true);
    expect(Object.isFrozen(style)).toBe(true);
  });
});
