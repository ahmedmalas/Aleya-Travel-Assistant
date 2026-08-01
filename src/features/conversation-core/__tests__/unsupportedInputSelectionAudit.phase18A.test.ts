import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationMessageInterpreted } from '../selectConversationMessageInterpreted';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 18A — unsupported input selection audit.
 *
 * Pre-18B observed defect (characterized here, fixed in 18B):
 *   messageInterpreted === false gated follow-up to null, so incomplete trips
 *   received activated neutral continuation instead of the required-field
 *   question.
 *
 * Post-18B required behaviour (asserted below after the 18B fix):
 *   follow-up selection always inspects final state; uninterpreted incomplete
 *   turns keep the specific required-field follow-up and no acknowledgement.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const ACTIVATED_NEUTRAL = ACTIVATED_NEUTRAL_CONTINUATION_REPLY;

const UNSUPPORTED_FAMILIES = [
  "I'm not sure yet",
  "I'm not sure",
  "I don't know",
  'Maybe',
  'Okay',
  'Thanks',
  'Can you help me?',
  'What do you recommend?',
  'Tell me more',
  'That sounds good',
  'Let me think',
  'My favourite colour is blue',
  'I like warm weather',
  'This is for my anniversary',
  'I have a flexible budget',
] as const;

type AuditTrace = {
  message: string;
  extractedPatch: ConversationStateUpdate;
  final: ConversationCoreState;
  classificationUpdated: readonly string[];
  classificationNewlyPopulated: readonly string[];
  hasRemovedProperty: boolean;
  hasInterpretedChange: boolean;
  messageInterpreted: boolean;
  acknowledgement: string | null;
  acknowledgementEvent: unknown;
  /** Follow-up if selectConversationFollowUpQuestion(final) is called. */
  followUpIfCalled: string | null;
  /** Follow-up selected by reply components. */
  followUpQuestion: string | null;
  continuation: string | null;
  assembledPlanFollowUp: string | null;
  assembledPlanMessageInterpreted: boolean;
  exactFinalReply: string;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-18a',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function activatedFollowUp(followUp: string): string {
  return renderBaselineFollowUpOnly({ followUpQuestion: followUp });
}

function trace(
  message: string,
  seed: Partial<ConversationCoreState> = {},
): AuditTrace {
  const previous = createState(seed);
  const extractedPatch = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-18a',
    assistantEntryId: 'assistant-18a',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const messageInterpreted =
    selectConversationMessageInterpreted(classification);
  const followUpIfCalled = selectConversationFollowUpQuestion(result.state);
  const components = selectConversationReplyComponents({
    state: result.state,
    classification,
  });
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return {
    message,
    extractedPatch,
    final: result.state,
    classificationUpdated: classification.updated,
    classificationNewlyPopulated: classification.newlyPopulated,
    hasRemovedProperty: Object.prototype.hasOwnProperty.call(
      classification,
      'removed',
    ),
    hasInterpretedChange: classification.hasInterpretedChange,
    messageInterpreted,
    acknowledgement: components.acknowledgement,
    acknowledgementEvent: components.acknowledgementEvent,
    followUpIfCalled,
    followUpQuestion: components.followUpQuestion,
    continuation: components.continuationPrompt,
    assembledPlanFollowUp: plan.followUpQuestion,
    assembledPlanMessageInterpreted: plan.messageInterpreted,
    exactFinalReply: result.reply,
  };
}

/** Post-18B: uninterpreted incomplete turns keep the required-field follow-up. */
function assertUnsupportedKeepsRequiredFollowUp(
  t: AuditTrace,
  expectedFollowUp: string,
) {
  expect(t.extractedPatch).toEqual({});
  expect(t.classificationUpdated).toEqual([]);
  expect(t.classificationNewlyPopulated).toEqual([]);
  expect(t.hasRemovedProperty).toBe(false);
  expect(t.hasInterpretedChange).toBe(false);
  expect(t.messageInterpreted).toBe(false);
  expect(t.acknowledgement).toBeNull();
  expect(t.acknowledgementEvent).toBeNull();
  expect(t.followUpIfCalled).toBe(expectedFollowUp);
  expect(t.followUpQuestion).toBe(expectedFollowUp);
  expect(t.continuation).toBeNull();
  expect(t.assembledPlanFollowUp).toBe(expectedFollowUp);
  expect(t.assembledPlanMessageInterpreted).toBe(false);
  expect(t.exactFinalReply).toBe(activatedFollowUp(expectedFollowUp));
}

describe('Phase 18A — unsupported input selection audit', () => {
  it('records pre-18B root-cause evidence and post-18B gate removal', () => {
    const source = readFileSync(
      resolve(CORE_SRC, 'selectConversationReplyComponents.ts'),
      'utf8',
    );
    // Historical defect (pre-18B): follow-up was gated on messageInterpreted.
    expect(source).toContain('Phase 18B');
    expect(source).toMatch(/not\s*\n\s*\*\s*gated on messageInterpreted/);
    // Post-18B required behaviour: always select follow-up from final state.
    expect(source).toContain(
      'const followUpQuestion = selectConversationFollowUpQuestion(state);',
    );
    expect(source).not.toMatch(
      /const followUpQuestion = messageInterpreted\s*\?/,
    );
    expect(source).toContain('selectConversationContinuationPrompt');

    const continuationSource = readFileSync(
      resolve(CORE_SRC, 'selectConversationContinuationPrompt.ts'),
      'utf8',
    );
    expect(continuationSource).toContain(
      'if (input.followUpQuestion !== null)',
    );
    expect(continuationSource).toContain('return NEUTRAL_TRIP_FALLBACK_REPLY');

    const assembleSource = readFileSync(
      resolve(CORE_SRC, 'assembleConversationReplyPlan.ts'),
      'utf8',
    );
    expect(assembleSource).toContain(
      'followUpQuestion: input.followUpQuestion ?? input.continuationPrompt',
    );
  });

  it('characterizes unsupported input families on missing origin', () => {
    const seed = {
      destination: 'Cairns',
      flightsRequested: true as const,
    };
    for (const message of UNSUPPORTED_FAMILIES) {
      const t = trace(message, seed);
      assertUnsupportedKeepsRequiredFollowUp(t, FOLLOW_UPS.origin);
      expect(t.final.destination, message).toBe('Cairns');
      expect(t.final.origin, message).toBeNull();
    }
  });

  it('characterizes required-field state matrix for unsupported input', () => {
    const message = "I'm not sure yet";
    const cases: Array<{
      label: string;
      seed: Partial<ConversationCoreState>;
      expectedFollowUpIfCalled: string;
    }> = [
      {
        label: 'missing destination',
        seed: {},
        expectedFollowUpIfCalled: FOLLOW_UPS.destination,
      },
      {
        label: 'missing origin',
        seed: { destination: 'Cairns', flightsRequested: true },
        expectedFollowUpIfCalled: FOLLOW_UPS.origin,
      },
      {
        label: 'missing departureDate',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
        },
        expectedFollowUpIfCalled: FOLLOW_UPS.departureDate,
      },
      {
        label: 'missing returnDate',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          flightsRequested: true,
        },
        expectedFollowUpIfCalled: FOLLOW_UPS.returnDate,
      },
      {
        label: 'missing adultCount for flights',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          flightsRequested: true,
        },
        expectedFollowUpIfCalled: FOLLOW_UPS.flightsAdultCount,
      },
      {
        label: 'missing guest count for accommodation',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          accommodationRequested: true,
        },
        expectedFollowUpIfCalled: FOLLOW_UPS.accommodationGuestCount,
      },
      {
        label: 'activities preference',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          adultCount: 2,
          activitiesRequested: true,
        },
        expectedFollowUpIfCalled: FOLLOW_UPS.activities,
      },
      {
        label: 'restaurant preference',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          adultCount: 2,
          restaurantsRequested: true,
        },
        expectedFollowUpIfCalled: FOLLOW_UPS.restaurants,
      },
      {
        label: 'multiple required fields missing',
        seed: { destination: 'Cairns', flightsRequested: true },
        expectedFollowUpIfCalled: FOLLOW_UPS.origin,
      },
      {
        label: 'only one required field missing (origin)',
        seed: {
          destination: 'Cairns',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          adultCount: 2,
          flightsRequested: true,
        },
        expectedFollowUpIfCalled: FOLLOW_UPS.origin,
      },
    ];

    for (const entry of cases) {
      const t = trace(message, entry.seed);
      assertUnsupportedKeepsRequiredFollowUp(t, entry.expectedFollowUpIfCalled);
    }
  });

  it('retains neutral continuation when the trip is already complete or has no services', () => {
    const message = "I'm not sure yet";
    const complete = trace(message, {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-04',
      adultCount: 2,
      childCount: 2,
      flightsRequested: true,
    });
    expect(complete.followUpIfCalled).toBe(NEUTRAL);
    expect(complete.messageInterpreted).toBe(false);
    expect(complete.followUpQuestion).toBe(NEUTRAL);
    expect(complete.continuation).toBeNull();
    expect(complete.assembledPlanFollowUp).toBe(NEUTRAL);
    expect(complete.exactFinalReply).toBe(ACTIVATED_NEUTRAL);

    const noServices = trace(message, {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-04',
      adultCount: 2,
    });
    expect(noServices.followUpIfCalled).toBe(NEUTRAL);
    expect(noServices.exactFinalReply).toBe(ACTIVATED_NEUTRAL);
  });

  it('proves interpreted-state shape for unsupported vs supported turns', () => {
    const unsupported = trace("I'm not sure yet", {
      destination: 'Cairns',
      flightsRequested: true,
    });
    expect(unsupported).toMatchObject({
      messageInterpreted: false,
      acknowledgement: null,
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.origin,
      continuation: null,
      assembledPlanFollowUp: FOLLOW_UPS.origin,
    });

    const supported = trace('go to Cairns from Sydney', {});
    expect(supported.extractedPatch).toEqual({
      destination: 'Cairns',
      origin: 'Sydney',
    });
    expect(supported.messageInterpreted).toBe(true);
    expect(supported.acknowledgement).not.toBeNull();
    expect(supported.followUpQuestion).toBe(FOLLOW_UPS.departureDate);
    expect(supported.continuation).toBeNull();
    expect(supported.assembledPlanFollowUp).toBe(FOLLOW_UPS.departureDate);
  });

  it('proves follow-up vs continuation precedence on uninterpreted incomplete turns', () => {
    const previous = createState({
      destination: 'Cairns',
      flightsRequested: true,
    });
    const next = previous;
    const classification = classifyConversationStateChange(previous, next);
    expect(selectConversationMessageInterpreted(classification)).toBe(false);

    const followUpIfCalled = selectConversationFollowUpQuestion(next);
    expect(followUpIfCalled).toBe(FOLLOW_UPS.origin);

    const components = selectConversationReplyComponents({
      state: next,
      classification,
    });
    // Post-18B: follow-up is retained; continuation suppressed.
    expect(components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(components.continuationPrompt).toBeNull();
    expect(
      selectConversationContinuationPrompt({
        followUpQuestion: followUpIfCalled,
      }),
    ).toBeNull();

    const plan = assembleConversationReplyPlan(components);
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(plan.messageInterpreted).toBe(false);
    expect(plan.acknowledgements).toEqual([]);
  });

  it('captures the exact reply matrix for representative incomplete states', () => {
    const matrix: Array<{
      label: string;
      seed: Partial<ConversationCoreState>;
      expectedFollowUp: string;
      expectedReply: string;
    }> = [
      {
        label: 'Missing destination + unsupported input',
        seed: {},
        expectedFollowUp: FOLLOW_UPS.destination,
        expectedReply: activatedFollowUp(FOLLOW_UPS.destination),
      },
      {
        label: 'Missing origin + unsupported input',
        seed: { destination: 'Cairns', flightsRequested: true },
        expectedFollowUp: FOLLOW_UPS.origin,
        expectedReply: activatedFollowUp(FOLLOW_UPS.origin),
      },
      {
        label: 'Missing departure date + unsupported input',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
        },
        expectedFollowUp: FOLLOW_UPS.departureDate,
        expectedReply: activatedFollowUp(FOLLOW_UPS.departureDate),
      },
      {
        label: 'Missing return date + unsupported input',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          flightsRequested: true,
        },
        expectedFollowUp: FOLLOW_UPS.returnDate,
        expectedReply: activatedFollowUp(FOLLOW_UPS.returnDate),
      },
      {
        label: 'Missing adult count + unsupported input',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          flightsRequested: true,
        },
        expectedFollowUp: FOLLOW_UPS.flightsAdultCount,
        expectedReply: activatedFollowUp(FOLLOW_UPS.flightsAdultCount),
      },
      {
        label: 'Complete trip + unsupported input',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          adultCount: 2,
          childCount: 2,
          flightsRequested: true,
        },
        expectedFollowUp: NEUTRAL,
        expectedReply: ACTIVATED_NEUTRAL,
      },
    ];

    for (const entry of matrix) {
      const t = trace("I'm not sure yet", entry.seed);
      expect(t.acknowledgement, entry.label).toBeNull();
      expect(t.followUpQuestion, entry.label).toBe(entry.expectedFollowUp);
      expect(t.assembledPlanFollowUp, entry.label).toBe(entry.expectedFollowUp);
      expect(t.exactFinalReply, entry.label).toBe(entry.expectedReply);
      if (entry.expectedFollowUp !== NEUTRAL) {
        expect(t.continuation, entry.label).toBeNull();
        expect(t.exactFinalReply, entry.label).not.toContain(NEUTRAL);
      }
    }
  });

  it('compares unsupported input against adjacent empty / unchanged / unknown paths', () => {
    const seed = { destination: 'Cairns', flightsRequested: true as const };
    const comparisons: Array<{
      label: string;
      message: string;
      expectedPatch: ConversationStateUpdate;
    }> = [
      { label: 'empty message', message: '', expectedPatch: {} },
      { label: 'whitespace-only message', message: '   ', expectedPatch: {} },
      {
        label: 'supported-shaped text with no state change',
        message: 'Hello there friend',
        expectedPatch: {},
      },
      {
        label: 'same value repeated (bare place already set)',
        message: 'Cairns',
        expectedPatch: {},
      },
      {
        label: 'explicit repair with unchanged value',
        message: 'Sorry, I meant Cairns',
        expectedPatch: { destination: 'Cairns' },
      },
      {
        label: 'unknown destination-like text',
        message: 'Xyzzyville',
        expectedPatch: {},
      },
      {
        label: 'unsupported hedge',
        message: "I'm not sure yet",
        expectedPatch: {},
      },
    ];

    for (const entry of comparisons) {
      const t = trace(entry.message, seed);
      expect(t.extractedPatch, entry.label).toEqual(entry.expectedPatch);
      expect(t.messageInterpreted, entry.label).toBe(false);
      expect(t.followUpIfCalled, entry.label).toBe(FOLLOW_UPS.origin);
      expect(t.followUpQuestion, entry.label).toBe(FOLLOW_UPS.origin);
      expect(t.continuation, entry.label).toBeNull();
      expect(t.exactFinalReply, entry.label).toBe(
        activatedFollowUp(FOLLOW_UPS.origin),
      );
    }
  });

  it('shows required follow-up after a prior turn just set a field, and when prior state is unchanged', () => {
    const first = processConversationTurn({
      message: 'go to Cairns',
      state: createState(),
      userEntryId: 'user-18a-1',
      assistantEntryId: 'assistant-18a-1',
      userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    });
    expect(first.state.destination).toBe('Cairns');
    expect(selectConversationFollowUpQuestion(first.state)).toBe(
      FOLLOW_UPS.origin,
    );
    expect(first.reply).toContain(FOLLOW_UPS.origin);

    const second = processConversationTurn({
      message: "I'm not sure yet",
      state: first.state,
      userEntryId: 'user-18a-2',
      assistantEntryId: 'assistant-18a-2',
      userMessageAt: new Date('2026-07-29T00:00:02.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:03.000Z'),
    });
    const classification = classifyConversationStateChange(
      first.state,
      second.state,
    );
    const components = selectConversationReplyComponents({
      state: second.state,
      classification,
    });
    expect(classification.hasInterpretedChange).toBe(false);
    expect(components.messageInterpreted).toBe(false);
    expect(selectConversationFollowUpQuestion(second.state)).toBe(
      FOLLOW_UPS.origin,
    );
    expect(components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(components.continuationPrompt).toBeNull();
    expect(second.reply).toBe(activatedFollowUp(FOLLOW_UPS.origin));

    const unchangedPrior = trace("I'm not sure yet", {
      destination: 'Cairns',
      flightsRequested: true,
    });
    expect(unchangedPrior.final).toMatchObject({
      destination: 'Cairns',
      origin: null,
    });
    expect(unchangedPrior.exactFinalReply).toBe(
      activatedFollowUp(FOLLOW_UPS.origin),
    );
  });

  it('confirms the renderer preserves the assembled required-field follow-up plan', () => {
    const previous = createState({
      destination: 'Cairns',
      flightsRequested: true,
    });
    const classification = classifyConversationStateChange(previous, previous);
    const plan = createConversationReplyPlan({
      state: previous,
      classification,
    });
    expect(plan).toEqual({
      acknowledgements: [],
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: false,
    });
    const result = processConversationTurn({
      message: "I'm not sure yet",
      state: previous,
      userEntryId: 'user-18a-r',
      assistantEntryId: 'assistant-18a-r',
      userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    });
    expect(result.reply).toBe(activatedFollowUp(FOLLOW_UPS.origin));
    expect(result.reply).toContain(FOLLOW_UPS.origin);
  });
});
