import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationalLayerInput } from '../conversationalLayerContracts';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { selectConversationalObjective } from '../selectConversationalObjective';

/**
 * Phase 13G — conversational layer input adapter characterisation.
 *
 * Proves buildConversationalLayerInput packages the structured plan with an
 * objective derived solely via selectConversationalObjective, optionally
 * attaching a style profile, without runtime integration.
 */

const ROOT = process.cwd();
const ADAPTER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/buildConversationalLayerInput.ts',
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

describe('phase 13G — buildConversationalLayerInput', () => {
  it('stays free of state, message, priority, wording, and runtime integration', () => {
    const source = readFileSync(ADAPTER_SOURCE, 'utf8');

    expect(source.includes('ConversationCoreState')).toBe(false);
    expect(source.includes('stateUpdate')).toBe(false);
    expect(source.includes('input.message')).toBe(false);
    expect(source.includes('user message')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('selectConversationFollowUpQuestion')).toBe(false);
    expect(source.includes('renderConversationReplyPlan')).toBe(false);
    expect(source.includes('generateConversationReply')).toBe(false);
    expect(source.includes('processConversationTurn')).toBe(false);
    expect(source.includes('selectConversationalObjective')).toBe(true);
    expect(source.includes('createConversationalLayerInput')).toBe(true);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'buildConversationalLayerInput',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'buildConversationalLayerInput',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'buildConversationalLayerInput',
      ),
    ).toBe(false);
  });

  it('retains the exact structured reply-plan reference', () => {
    const replyPlan = plan({
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    });
    const input = buildConversationalLayerInput(replyPlan);
    expect(input.plan).toBe(replyPlan);
  });

  it('derives objective exclusively through selectConversationalObjective', () => {
    const replyPlan = plan({
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const expectedObjective = selectConversationalObjective(replyPlan);
    const expectedInput = createConversationalLayerInput(
      replyPlan,
      expectedObjective,
    );

    const input = buildConversationalLayerInput(replyPlan);

    expect(input.objective).toEqual(expectedObjective);
    expect(input).toEqual(expectedInput);
    expect(Object.isFrozen(input)).toBe(true);
  });

  it('maps a destination follow-up plan to the destination objective', () => {
    const replyPlan = plan({ followUpQuestion: FOLLOW_UPS.destination });
    const input = buildConversationalLayerInput(replyPlan);
    expect(input.objective).toEqual({
      id: 'destination',
      catalogueWording: FOLLOW_UPS.destination,
    });
  });

  it('maps an origin follow-up plan to the origin objective', () => {
    const replyPlan = plan({ followUpQuestion: FOLLOW_UPS.origin });
    const input = buildConversationalLayerInput(replyPlan);
    expect(input.objective).toEqual({
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    });
  });

  it('maps a neutral continuation plan to the neutralContinuation objective', () => {
    const replyPlan = plan({
      followUpQuestion: FOLLOW_UPS.neutralContinuation,
    });
    const input = buildConversationalLayerInput(replyPlan);
    expect(input.objective).toEqual({
      id: 'neutralContinuation',
      catalogueWording: FOLLOW_UPS.neutralContinuation,
    });
  });

  it('maps a plan with no follow-up or continuation to a null objective', () => {
    const replyPlan = plan();
    const input = buildConversationalLayerInput(replyPlan);
    expect(input.objective).toBeNull();
    expect(input.objective).not.toEqual({
      id: 'none',
      catalogueWording: null,
    });
  });

  it('includes each reference style profile unchanged when supplied', () => {
    const replyPlan = plan({ followUpQuestion: FOLLOW_UPS.destination });

    const professional = buildConversationalLayerInput(
      replyPlan,
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );
    expect(professional.styleProfile).toBe(
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );
    expect(professional.styleProfile).toEqual(
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );

    const warm = buildConversationalLayerInput(
      replyPlan,
      REFERENCE_CONVERSATIONAL_STYLE_WARM,
    );
    expect(warm.styleProfile).toBe(REFERENCE_CONVERSATIONAL_STYLE_WARM);
    expect(warm.styleProfile).toEqual(REFERENCE_CONVERSATIONAL_STYLE_WARM);

    const luxury = buildConversationalLayerInput(
      replyPlan,
      REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
    );
    expect(luxury.styleProfile).toBe(REFERENCE_CONVERSATIONAL_STYLE_LUXURY);
    expect(luxury.styleProfile).toEqual(REFERENCE_CONVERSATIONAL_STYLE_LUXURY);
  });

  it('omits styleProfile when none is supplied', () => {
    const replyPlan = plan({ followUpQuestion: FOLLOW_UPS.origin });
    const input = buildConversationalLayerInput(replyPlan);
    expect(input.styleProfile).toBeUndefined();
    expect('styleProfile' in input).toBe(false);
  });

  it('ignores acknowledgement and messageInterpreted for objective identity', () => {
    const wording = FOLLOW_UPS.destination;
    const baselines = [
      plan({
        acknowledgements: [],
        followUpQuestion: wording,
        messageInterpreted: false,
      }),
      plan({
        acknowledgements: ['Great — Brisbane.'],
        followUpQuestion: wording,
        messageInterpreted: true,
      }),
      plan({
        acknowledgements: ['Perfect.'],
        followUpQuestion: wording,
        messageInterpreted: false,
      }),
    ];

    for (const entry of baselines) {
      expect(buildConversationalLayerInput(entry).objective).toEqual({
        id: 'destination',
        catalogueWording: wording,
      });
    }
  });

  it('does not mutate a frozen plan or frozen style profile', () => {
    const frozenPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const planBefore = structuredClone(frozenPlan);
    const styleBefore = structuredClone(
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );

    const input = buildConversationalLayerInput(
      frozenPlan,
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );

    expect(input.plan).toBe(frozenPlan);
    expect(input.styleProfile).toBe(
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    );
    expect(frozenPlan).toEqual(planBefore);
    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL).toEqual(styleBefore);
    expect(Object.isFrozen(frozenPlan)).toBe(true);
    expect(Object.isFrozen(frozenPlan.acknowledgements)).toBe(true);
    expect(Object.isFrozen(REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL)).toBe(
      true,
    );
    expect(Object.isFrozen(input)).toBe(true);
  });

  it('produces equivalent results for identical arguments', () => {
    const replyPlan = plan({
      followUpQuestion: FOLLOW_UPS.activities,
      messageInterpreted: true,
    });
    const style = REFERENCE_CONVERSATIONAL_STYLE_WARM;

    const first = buildConversationalLayerInput(replyPlan, style);
    const second = buildConversationalLayerInput(replyPlan, style);
    const third = buildConversationalLayerInput(
      structuredClone(replyPlan),
      style,
    );

    expect(first).toEqual(second);
    expect(first).toEqual(third);
    expect(first.plan).toBe(replyPlan);
    expect(second.plan).toBe(replyPlan);
    expect(first.styleProfile).toBe(style);
    expect(second.styleProfile).toBe(style);
  });
});
