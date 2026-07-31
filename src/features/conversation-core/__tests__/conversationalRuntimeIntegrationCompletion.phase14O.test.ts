import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import type { ConversationalStyleProfile } from '../conversationalLayerContracts';
import * as baselineModule from '../generateBaselineConversationalReply';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL } from '../referenceConversationalStyleProfiles';
import { renderConversationReplyPlanByIntegrationMode } from '../renderConversationReplyPlanByIntegrationMode';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 14O — runtime integration completion audit and freeze.
 *
 * Audit-only characterisation of the activated baseline conversational runtime.
 * Does not add conversational behaviour.
 */

const ROOT = process.cwd();
const CONVERSATION_CORE_DIR = resolve(ROOT, 'src/features/conversation-core');
const INDEX_SOURCE = resolve(CONVERSATION_CORE_DIR, 'index.ts');
const PROCESS_TURN_SOURCE = resolve(CONVERSATION_CORE_DIR, 'processTurn.ts');
const INTEGRATED_REPLY_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'generateIntegratedConversationReply.ts',
);
const GENERATE_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'generateConversationReply.ts',
);
const SEAM_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'renderIntegratedConversationReplyPlan.ts',
);
const MODE_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'renderConversationReplyPlanByIntegrationMode.ts',
);
const CREATE_PLAN_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'createConversationReplyPlan.ts',
);
const BASELINE_SOURCE = resolve(
  CONVERSATION_CORE_DIR,
  'generateBaselineConversationalReply.ts',
);

const PRODUCTION_PATH_SOURCES = [
  PROCESS_TURN_SOURCE,
  INTEGRATED_REPLY_SOURCE,
  GENERATE_SOURCE,
  SEAM_SOURCE,
  MODE_SOURCE,
  CREATE_PLAN_SOURCE,
] as const;

const EVALUATION_ONLY_MARKERS = [
  'evaluateBaselineConversationalReplyPlan',
  'evaluateBaselineConversationalReplyPlanOutcome',
  'compareBaselineConversationalReplyPlan',
  'BaselineConversationalComparisonStatus',
] as const;

const INTERNAL_INTEGRATION_MARKERS = [
  'renderIntegratedConversationReplyPlan',
  'renderConversationReplyPlanByIntegrationMode',
  'generateBaselineConversationalReply',
  'generateIntegratedConversationReply',
  'ConversationReplyPlanIntegrationMode',
  'buildConversationalLayerInput',
  'selectConversationalObjective',
  'executeBaselineConversationalRenderer',
] as const;

const RUNTIME_SELECTION_MARKERS = [
  'process.env',
  'import.meta.env',
  'featureFlag',
  'Math.random',
  'percentage',
  'URLSearchParams',
  'localStorage',
  'sessionStorage',
  'console.',
  'telemetry',
  'analytics',
  'async ',
  'await ',
  'Promise',
] as const;

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const BASELINE_MODE_CONST =
  /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/;
const DETERMINISTIC_MODE_CONST =
  /const mode: ConversationReplyPlanIntegrationMode = 'deterministic'/;

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
      conversationId: 'conversation-14o',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function freezePlan(replyPlan: ConversationReplyPlan): ConversationReplyPlan {
  return Object.freeze({
    ...replyPlan,
    acknowledgements: Object.freeze([...replyPlan.acknowledgements]),
  });
}

function turn(message: string, state: ConversationCoreState) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-14o',
    assistantEntryId: 'assistant-14o',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
  });
}

/** Complete characterised reply-catalogue coverage for Phase 14O parity. */
const CATALOGUE_REPLY_CASES: Array<{
  label: string;
  replyPlan: ConversationReplyPlan;
}> = [
  {
    label: 'acknowledgement destination',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement origin',
    replyPlan: plan({
      acknowledgements: [ACKS.origin('Sydney')],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement departure date',
    replyPlan: plan({
      acknowledgements: [ACKS.departureDate('2026-08-01')],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement return date',
    replyPlan: plan({
      acknowledgements: [ACKS.returnDate('2026-08-10')],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement adult count singular',
    replyPlan: plan({
      acknowledgements: [ACKS.adultCount(1)],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement adult count plural',
    replyPlan: plan({
      acknowledgements: [ACKS.adultCount(2)],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement child count singular',
    replyPlan: plan({
      acknowledgements: [ACKS.childCount(1)],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement child count plural',
    replyPlan: plan({
      acknowledgements: [ACKS.childCount(2)],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement infant count singular',
    replyPlan: plan({
      acknowledgements: [ACKS.infantCount(1)],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement infant count plural',
    replyPlan: plan({
      acknowledgements: [ACKS.infantCount(2)],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement generic',
    replyPlan: plan({
      acknowledgements: [ACKS.genericTravelFieldChange],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement destination removed',
    replyPlan: plan({
      acknowledgements: [ACKS.destinationRemoved],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement origin removed',
    replyPlan: plan({
      acknowledgements: [ACKS.originRemoved],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement departure date removed',
    replyPlan: plan({
      acknowledgements: [ACKS.departureDateRemoved],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement return date removed',
    replyPlan: plan({
      acknowledgements: [ACKS.returnDateRemoved],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement adult count removed',
    replyPlan: plan({
      acknowledgements: [ACKS.adultCountRemoved],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement child count removed',
    replyPlan: plan({
      acknowledgements: [ACKS.childCountRemoved],
      messageInterpreted: true,
    }),
  },
  {
    label: 'acknowledgement infant count removed',
    replyPlan: plan({
      acknowledgements: [ACKS.infantCountRemoved],
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
    label: 'follow-up destination',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.destination,
      messageInterpreted: true,
    }),
  },
  {
    label: 'follow-up origin',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    }),
  },
  {
    label: 'follow-up departure date',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    }),
  },
  {
    label: 'follow-up return date',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.returnDate,
      messageInterpreted: true,
    }),
  },
  {
    label: 'follow-up flights adult count',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.flightsAdultCount,
      messageInterpreted: true,
    }),
  },
  {
    label: 'follow-up accommodation guest count',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.accommodationGuestCount,
      messageInterpreted: true,
    }),
  },
  {
    label: 'follow-up activities',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.activities,
      messageInterpreted: true,
    }),
  },
  {
    label: 'follow-up restaurants',
    replyPlan: plan({
      followUpQuestion: FOLLOW_UPS.restaurants,
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
    label: 'acknowledgement plus follow-up',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Melbourne')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    }),
  },
  {
    label: 'multi-component reply',
    replyPlan: plan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    }),
  },
  {
    label: 'empty reply plan',
    replyPlan: plan(),
  },
];

describe('phase 14O — conversational runtime integration completion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proves the final accepted architecture path and static baseline activation', () => {
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const integrated = readFileSync(INTEGRATED_REPLY_SOURCE, 'utf8');
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const modeDriven = readFileSync(MODE_SOURCE, 'utf8');
    const createPlan = readFileSync(CREATE_PLAN_SOURCE, 'utf8');
    const baseline = readFileSync(BASELINE_SOURCE, 'utf8');

    expect(processTurn).toMatch(/generateIntegratedConversationReply\(/);
    expect(processTurn).not.toMatch(/generateConversationReply\(/);
    expect(processTurn.includes('mode:')).toBe(false);
    expect(processTurn.includes('baseline-conversational')).toBe(false);

    expect(integrated).toMatch(
      /const mode: ConversationReplyIntegrationMode = 'deterministic'/,
    );
    expect(integrated).toMatch(/return generateConversationReply\(input\)/);
    expect(integrated.includes('baseline-conversational')).toBe(false);
    expect(integrated.includes('mode?:')).toBe(false);

    expect(generate).toMatch(/classifyConversationStateChange\(/);
    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(generate.includes('mode:')).toBe(false);
    expect(generate.includes('baseline-conversational')).toBe(false);

    expect(createPlan).toMatch(/selectConversationReplyComponents\(/);
    expect(createPlan).toMatch(/assembleConversationReplyPlan\(/);

    expect(seam).toMatch(BASELINE_MODE_CONST);
    expect(seam).not.toMatch(DETERMINISTIC_MODE_CONST);
    expect(seam.includes('mode?:')).toBe(false);
    expect(seam.includes('input.mode')).toBe(false);
    expect(seam).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );

    expect(modeDriven).toMatch(
      /export type ConversationReplyPlanIntegrationMode =\s*\|\s*'deterministic'\s*\|\s*'baseline-conversational'/,
    );
    expect(modeDriven).toMatch(/switch \(input\.mode\)/);
    expect(modeDriven.match(/case '/g)?.length).toBe(2);
    expect(modeDriven).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );
    expect(modeDriven).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );

    expect(baseline).toMatch(
      /export function generateBaselineConversationalReply\(\s*plan: Readonly<ConversationReplyPlan>/,
    );
    expect(modeDriven).toMatch(/plan: Readonly<ConversationReplyPlan>/);
  });

  it('proves deterministic ownership and completed-plan conversational input', () => {
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const seam = readFileSync(SEAM_SOURCE, 'utf8');
    const modeDriven = readFileSync(MODE_SOURCE, 'utf8');
    const createPlan = readFileSync(CREATE_PLAN_SOURCE, 'utf8');

    expect(generate).toMatch(/classifyConversationStateChange\(/);
    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(createPlan).toMatch(/selectConversationReplyComponents\(/);
    expect(createPlan).toMatch(/assembleConversationReplyPlan\(/);

    for (const source of [seam, modeDriven] as const) {
      expect(source.includes('classifyConversationStateChange')).toBe(false);
      expect(source.includes('createConversationReplyPlan')).toBe(false);
      expect(source.includes('assembleConversationReplyPlan(')).toBe(false);
      expect(source.includes('selectConversationReplyComponents')).toBe(false);
      expect(source.includes('selectConversationFollowUpQuestion')).toBe(false);
      expect(source.includes('selectConversationAcknowledgement')).toBe(false);
    }

    const previous = Object.freeze(createState());
    const next = Object.freeze(createState({ destination: 'Brisbane' }));
    const previousBefore = structuredClone(previous);
    const nextBefore = structuredClone(next);

    const classification = classifyConversationStateChange(previous, next);
    const frozenClassification = Object.freeze({
      ...classification,
      newlyPopulated: Object.freeze([...classification.newlyPopulated]),
      updated: Object.freeze([...classification.updated]),
      unchanged: Object.freeze([...classification.unchanged]),
      newlyEnabledRequestFlags: Object.freeze([
        ...classification.newlyEnabledRequestFlags,
      ]),
      newlyDisabledRequestFlags: Object.freeze([
        ...classification.newlyDisabledRequestFlags,
      ]),
    });
    const classificationBefore = structuredClone(frozenClassification);

    const baselineSpy = vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    );

    const reply = generateConversationReply({
      message: 'go to Brisbane',
      previousState: previous,
      state: next,
    });

    expect(reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`,
    );
    expect(baselineSpy).toHaveBeenCalledTimes(1);
    const receivedPlan = baselineSpy.mock.calls[0]?.[0] as ConversationReplyPlan;
    expect(receivedPlan).toEqual({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    expect(baselineSpy.mock.calls[0]?.length).toBe(1);

    const viaTurn = turn('go to Brisbane', createState());
    expect(viaTurn.reply).toBe(reply);
    expect(baselineSpy).toHaveBeenCalledTimes(2);

    expect(previous).toEqual(previousBefore);
    expect(next).toEqual(nextBefore);
    expect(frozenClassification).toEqual(classificationBefore);
  });

  it('proves activated baseline parity across the complete characterised catalogue', () => {
    for (const entry of CATALOGUE_REPLY_CASES) {
      const frozen = freezePlan(entry.replyPlan);
      const before = structuredClone(frozen);
      const deterministic = renderConversationReplyPlan(frozen);
      const expected = expectedActivatedBaselineReply(frozen);
      const viaProduction = renderIntegratedConversationReplyPlan({
        plan: frozen,
      });
      const viaMode = renderConversationReplyPlanByIntegrationMode({
        plan: frozen,
        mode: 'baseline-conversational',
      });
      const viaBaseline = generateBaselineConversationalReply(frozen);

      expect(viaProduction, entry.label).toBe(expected);
      expect(viaMode, `${entry.label} / mode`).toBe(expected);
      expect(viaBaseline, `${entry.label} / baseline`).toBe(expected);
      if (expected === deterministic) {
        expect(viaBaseline, `${entry.label} / deterministic parity`).toBe(
          deterministic,
        );
      } else {
        expect(viaBaseline, `${entry.label} / intentional divergence`).not.toBe(
          deterministic,
        );
      }
      expect(frozen, `${entry.label} / unchanged`).toEqual(before);
      expect(Object.isFrozen(frozen), entry.label).toBe(true);
    }
  });

  it('proves deterministic same-plan fallback and frozen immutability', () => {
    const failurePlan = freezePlan(
      plan({
        acknowledgements: [ACKS.origin('Sydney')],
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const failureBefore = structuredClone(failurePlan);
    const failureExpected = renderConversationReplyPlan(failurePlan);

    const styleProfile = Object.freeze({
      ...REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
    }) as Readonly<ConversationalStyleProfile>;
    const styleBefore = structuredClone(styleProfile);

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      expect(receivedPlan).toBe(failurePlan);
      throw new Error('forced-baseline-failure:14o');
    });

    const viaProduction = renderIntegratedConversationReplyPlan({
      plan: failurePlan,
    });
    const viaMode = renderConversationReplyPlanByIntegrationMode({
      plan: failurePlan,
      mode: 'baseline-conversational',
    });

    expect(viaProduction).toBe(failureExpected);
    expect(viaMode).toBe(failureExpected);
    expect(failurePlan).toEqual(failureBefore);
    expect(Object.isFrozen(failurePlan)).toBe(true);

    vi.restoreAllMocks();
    const wording = generateBaselineConversationalReply(
      failurePlan,
      styleProfile,
    );
    expect(wording).toBe(expectedActivatedBaselineReply(failurePlan));
    expect(styleProfile).toEqual(styleBefore);
    expect(Object.isFrozen(styleProfile)).toBe(true);
    expect(failurePlan).toEqual(failureBefore);
  });

  it('proves runtime safety, evaluation isolation, and public barrel freeze', () => {
    for (const sourcePath of PRODUCTION_PATH_SOURCES) {
      const source = readFileSync(sourcePath, 'utf8');
      for (const marker of RUNTIME_SELECTION_MARKERS) {
        expect(
          source.includes(marker),
          `${sourcePath} must not contain ${marker}`,
        ).toBe(false);
      }
      for (const marker of EVALUATION_ONLY_MARKERS) {
        expect(
          source.includes(marker),
          `${sourcePath} must not import ${marker}`,
        ).toBe(false);
      }
    }

    const index = readFileSync(INDEX_SOURCE, 'utf8');
    for (const marker of [
      ...EVALUATION_ONLY_MARKERS,
      ...INTERNAL_INTEGRATION_MARKERS,
    ] as const) {
      expect(index.includes(marker), `barrel must not expose ${marker}`).toBe(
        false,
      );
    }
    expect(index).toMatch(/processConversationTurn/);
    expect(index).toMatch(/createInitialConversationCoreState/);

    for (const name of readdirSync(CONVERSATION_CORE_DIR)) {
      if (!name.endsWith('.ts')) continue;
      if (
        name === 'evaluateBaselineConversationalReplyPlan.ts' ||
        name === 'evaluateBaselineConversationalReplyPlanOutcome.ts' ||
        name === 'compareBaselineConversationalReplyPlan.ts'
      ) {
        continue;
      }
      if (
        name === 'processTurn.ts' ||
        name === 'generateIntegratedConversationReply.ts' ||
        name === 'generateConversationReply.ts' ||
        name === 'renderIntegratedConversationReplyPlan.ts' ||
        name === 'renderConversationReplyPlanByIntegrationMode.ts' ||
        name === 'createConversationReplyPlan.ts' ||
        name === 'index.ts'
      ) {
        const contents = readFileSync(
          resolve(CONVERSATION_CORE_DIR, name),
          'utf8',
        );
        for (const marker of EVALUATION_ONLY_MARKERS) {
          expect(
            contents.includes(marker),
            `${name} must not reference ${marker}`,
          ).toBe(false);
        }
      }
    }
  });
});
