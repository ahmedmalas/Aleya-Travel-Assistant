import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';
import { selectConversationalObjective } from '../selectConversationalObjective';

/**
 * Phase 13Q — baseline conversational generator parity audit.
 *
 * Proves generateBaselineConversationalReply(plan[, style]) matches
 * renderConversationReplyPlan(plan) exactly for representative plan shapes.
 * Style profiles remain intentionally ignored by the baseline renderer.
 * Adds no production behaviour and no runtime wiring.
 */

const ROOT = process.cwd();
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

const STYLE_PROFILES = [
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
] as const;

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

function assertExactParity(replyPlan: ConversationReplyPlan, label: string) {
  const before = structuredClone(replyPlan);
  const deterministic = renderConversationReplyPlan(replyPlan);

  const experimental = generateBaselineConversationalReply(replyPlan);
  expect(experimental, label).toBe(deterministic);

  const professional = generateBaselineConversationalReply(
    replyPlan,
    REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  );
  const warm = generateBaselineConversationalReply(
    replyPlan,
    REFERENCE_CONVERSATIONAL_STYLE_WARM,
  );
  const luxury = generateBaselineConversationalReply(
    replyPlan,
    REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  );

  expect(professional, `${label} / professional`).toBe(deterministic);
  expect(warm, `${label} / warm`).toBe(deterministic);
  expect(luxury, `${label} / luxury`).toBe(deterministic);

  expect(replyPlan, `${label} / plan unchanged`).toEqual(before);

  expect(generateBaselineConversationalReply(replyPlan), `${label} / repeat`).toBe(
    experimental,
  );
  expect(generateBaselineConversationalReply(replyPlan), `${label} / repeat 2`).toBe(
    deterministic,
  );

  return deterministic;
}

describe('phase 13Q — baseline conversational generator parity audit', () => {
  it('stays free of runtime wiring and does not mock the compared boundaries', () => {
    const auditSource = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/__tests__/baselineConversationalGeneratorParity.phase13Q.test.ts',
      ),
      'utf8',
    );

    expect(auditSource.includes(['vi', 'mock'].join('.'))).toBe(false);
    expect(auditSource.includes(['vi', 'fn'].join('.'))).toBe(false);
    expect(auditSource.includes('renderConversationReplyPlan')).toBe(true);
    expect(auditSource.includes('generateBaselineConversationalReply')).toBe(
      true,
    );

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

  it('matches deterministic wording for acknowledgement + catalogue follow-ups', () => {
    const cases: Array<{ label: string; replyPlan: ConversationReplyPlan }> = [
      {
        label: 'acknowledgement + destination follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.destination('Brisbane')],
          followUpQuestion: FOLLOW_UPS.destination,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement + origin follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.origin('Sydney')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement + departure-date follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.departureDate('12 March')],
          followUpQuestion: FOLLOW_UPS.departureDate,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement + return-date follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.returnDate('20 March')],
          followUpQuestion: FOLLOW_UPS.returnDate,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement + adult-count follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.adultCount(2)],
          followUpQuestion: FOLLOW_UPS.flightsAdultCount,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement + accommodation guest-count follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.genericTravelFieldChange],
          followUpQuestion: FOLLOW_UPS.accommodationGuestCount,
          messageInterpreted: true,
        }),
      },
    ];

    for (const entry of cases) {
      const wording = assertExactParity(entry.replyPlan, entry.label);
      expect(wording.includes('\n')).toBe(true);
      expect(wording).toBe(
        `${entry.replyPlan.acknowledgements[0]}\n${entry.replyPlan.followUpQuestion}`,
      );
    }
  });

  it('matches deterministic wording for follow-up-only, continuation, ack-only, interpreted-only, and empty plans', () => {
    const cases: Array<{ label: string; replyPlan: ConversationReplyPlan }> = [
      {
        label: 'specific follow-up only',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.activities,
          messageInterpreted: true,
        }),
      },
      {
        label: 'neutral continuation only',
        replyPlan: plan({
          followUpQuestion: FOLLOW_UPS.neutralContinuation,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement only',
        replyPlan: plan({
          acknowledgements: [ACKS.genericTravelFieldChange],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      },
      {
        label: 'message-interpreted only',
        replyPlan: plan({
          acknowledgements: [],
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      },
      {
        label: 'acknowledgement + message-interpreted + follow-up',
        replyPlan: plan({
          acknowledgements: [ACKS.destination('Melbourne')],
          followUpQuestion: FOLLOW_UPS.origin,
          messageInterpreted: true,
        }),
      },
      {
        label: 'empty plan',
        replyPlan: plan(),
      },
    ];

    for (const entry of cases) {
      assertExactParity(entry.replyPlan, entry.label);
    }
  });

  it('matches deterministic wording when the conversational objective is null', () => {
    const nullObjectivePlan = plan({
      acknowledgements: [ACKS.genericTravelFieldChange],
      followUpQuestion: null,
      messageInterpreted: true,
    });
    expect(selectConversationalObjective(nullObjectivePlan)).toBeNull();
    expect(buildConversationalLayerInput(nullObjectivePlan).objective).toBeNull();

    const wording = assertExactParity(
      nullObjectivePlan,
      'null conversational objective',
    );
    expect(wording).toBe(ACKS.genericTravelFieldChange);
  });

  it('preserves catalogue punctuation and spacing exactly across styled and unstyled paths', () => {
    const replyPlan = plan({
      acknowledgements: [ACKS.destination('Brisbane')],
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });
    const deterministic = assertExactParity(
      replyPlan,
      'punctuation and spacing preservation',
    );

    expect(deterministic).toBe(
      `Great — Brisbane.\n${FOLLOW_UPS.origin}`,
    );
    expect(deterministic.includes('Great — Brisbane.')).toBe(true);
    expect(deterministic.includes('Great - Brisbane.')).toBe(false);
    expect(deterministic.includes('\n')).toBe(true);
    expect(deterministic.startsWith(' ')).toBe(false);
    expect(deterministic.endsWith(' ')).toBe(false);
    expect(deterministic.includes('  ')).toBe(false);

    for (const style of STYLE_PROFILES) {
      expect(generateBaselineConversationalReply(replyPlan, style)).toBe(
        deterministic,
      );
    }
  });

  it('leaves a frozen plan unmodified while preserving parity', () => {
    const replyPlan = Object.freeze(
      plan({
        acknowledgements: Object.freeze([ACKS.origin('Sydney')]),
        followUpQuestion: FOLLOW_UPS.departureDate,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(replyPlan);
    const deterministic = renderConversationReplyPlan(replyPlan);

    expect(generateBaselineConversationalReply(replyPlan)).toBe(deterministic);
    for (const style of STYLE_PROFILES) {
      expect(generateBaselineConversationalReply(replyPlan, style)).toBe(
        deterministic,
      );
    }

    expect(replyPlan).toEqual(before);
    expect(Object.isFrozen(replyPlan)).toBe(true);
    expect(Object.isFrozen(replyPlan.acknowledgements)).toBe(true);
    expect(generateBaselineConversationalReply(replyPlan)).toBe(
      generateBaselineConversationalReply(replyPlan),
    );
  });
});
