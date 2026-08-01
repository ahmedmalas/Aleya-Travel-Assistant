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
} from '../index';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import { ACTIVATED_NEUTRAL_CONTINUATION_REPLY } from '../renderBaselineNeutralContinuation';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 18B — preserve required-field follow-up for unsupported input.
 * Production change is limited to selectConversationReplyComponents.
 */

const ROOT = process.cwd();
const COMPONENTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationReplyComponents.ts',
);
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const ACTIVATED_NEUTRAL = ACTIVATED_NEUTRAL_CONTINUATION_REPLY;

const UNSUPPORTED = [
  "I'm not sure",
  "I don't know",
  'Maybe',
  'Okay',
  'Thanks',
  'Can you help me?',
  'What do you recommend?',
  'Let me think',
  'My favourite colour is blue',
  'I have a flexible budget',
] as const;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-18b',
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

function runTurn(
  message: string,
  seed: Partial<ConversationCoreState> = {},
) {
  const previous = createState(seed);
  const extractedPatch = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-18b',
    assistantEntryId: 'assistant-18b',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const components = selectConversationReplyComponents({
    state: result.state,
    classification,
  });
  const plan = assembleConversationReplyPlan(components);
  const planned = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return {
    previous,
    extractedPatch,
    classification,
    components,
    plan,
    planned,
    reply: result.reply,
    state: result.state,
  };
}

describe('Phase 18B — preserve follow-up for unsupported input', () => {
  it('removes the messageInterpreted gate around follow-up selection', () => {
    const source = readFileSync(COMPONENTS_SOURCE, 'utf8');
    expect(source).toContain('Phase 18B');
    expect(source).toContain(
      'const followUpQuestion = selectConversationFollowUpQuestion(state);',
    );
    expect(source).not.toMatch(
      /const followUpQuestion = messageInterpreted\s*\?/,
    );
  });

  it('keeps specific required-field follow-ups for unsupported incomplete trips', () => {
    const cases: Array<{
      label: string;
      seed: Partial<ConversationCoreState>;
      followUp: string;
    }> = [
      {
        label: 'destination',
        seed: {},
        followUp: FOLLOW_UPS.destination,
      },
      {
        label: 'origin',
        seed: { destination: 'Cairns', flightsRequested: true },
        followUp: FOLLOW_UPS.origin,
      },
      {
        label: 'departureDate',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          flightsRequested: true,
        },
        followUp: FOLLOW_UPS.departureDate,
      },
      {
        label: 'returnDate',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          flightsRequested: true,
        },
        followUp: FOLLOW_UPS.returnDate,
      },
      {
        label: 'adultCount for flights',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          flightsRequested: true,
        },
        followUp: FOLLOW_UPS.flightsAdultCount,
      },
      {
        label: 'guest count for accommodation',
        seed: {
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
          returnDate: '2026-09-04',
          accommodationRequested: true,
        },
        followUp: FOLLOW_UPS.accommodationGuestCount,
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
        followUp: FOLLOW_UPS.activities,
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
        followUp: FOLLOW_UPS.restaurants,
      },
    ];

    for (const entry of cases) {
      const t = runTurn("I'm not sure yet", entry.seed);
      expect(t.extractedPatch, entry.label).toEqual({});
      expect(t.classification.updated, entry.label).toEqual([]);
      expect(t.classification.hasInterpretedChange, entry.label).toBe(false);
      expect(t.components.messageInterpreted, entry.label).toBe(false);
      expect(t.components.acknowledgement, entry.label).toBeNull();
      expect(t.components.acknowledgementEvent, entry.label).toBeNull();
      expect(t.components.followUpQuestion, entry.label).toBe(entry.followUp);
      expect(t.components.continuationPrompt, entry.label).toBeNull();
      expect(t.plan.followUpQuestion, entry.label).toBe(entry.followUp);
      expect(t.planned).toEqual(t.plan);
      expect(t.reply, entry.label).toBe(activatedFollowUp(entry.followUp));
      expect(t.reply, entry.label).not.toContain(NEUTRAL);
    }
  });

  it('applies the same incomplete-trip follow-up across unsupported phrases', () => {
    const seed = { destination: 'Cairns', flightsRequested: true as const };
    for (const message of UNSUPPORTED) {
      const t = runTurn(message, seed);
      expect(t.extractedPatch, message).toEqual({});
      expect(t.components.messageInterpreted, message).toBe(false);
      expect(t.components.acknowledgement, message).toBeNull();
      expect(t.components.acknowledgementEvent, message).toBeNull();
      expect(t.components.followUpQuestion, message).toBe(FOLLOW_UPS.origin);
      expect(t.components.continuationPrompt, message).toBeNull();
      expect(t.reply, message).toBe(activatedFollowUp(FOLLOW_UPS.origin));
    }
  });

  it('retains terminal neutral for complete-trip unsupported input', () => {
    const t = runTurn("I'm not sure yet", {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-04',
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(t.components.messageInterpreted).toBe(false);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.acknowledgementEvent).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.components.continuationPrompt).toBeNull();
    expect(t.plan.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).toBe(ACTIVATED_NEUTRAL);
  });

  it('gives empty and whitespace input the required-field follow-up when incomplete', () => {
    const seed = { destination: 'Cairns', flightsRequested: true as const };
    for (const message of ['', '   ']) {
      const t = runTurn(message, seed);
      expect(t.components.messageInterpreted, JSON.stringify(message)).toBe(
        false,
      );
      expect(t.components.acknowledgement, JSON.stringify(message)).toBeNull();
      expect(t.components.followUpQuestion, JSON.stringify(message)).toBe(
        FOLLOW_UPS.origin,
      );
      expect(t.components.continuationPrompt, JSON.stringify(message)).toBeNull();
      expect(t.reply, JSON.stringify(message)).toBe(
        activatedFollowUp(FOLLOW_UPS.origin),
      );
    }
  });

  it('preserves supported interpreted paths', () => {
    const setDestination = runTurn('go to Cairns', {});
    expect(setDestination.components.messageInterpreted).toBe(true);
    expect(setDestination.components.acknowledgement).not.toBeNull();
    expect(setDestination.components.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'destination',
    });
    expect(setDestination.components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(setDestination.components.continuationPrompt).toBeNull();
    expect(setDestination.reply).toBe(
      `Great, Cairns it is. ${FOLLOW_UPS.origin}`,
    );

    const changeDestination = runTurn('go to Hobart', {
      destination: 'Cairns',
      flightsRequested: true,
    });
    expect(changeDestination.components.messageInterpreted).toBe(true);
    expect(changeDestination.components.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(changeDestination.components.followUpQuestion).toBe(
      FOLLOW_UPS.origin,
    );
    expect(changeDestination.reply).toBe(
      `Updated — Hobart it is. ${FOLLOW_UPS.origin}`,
    );

    const setOrigin = runTurn('from Sydney', {
      destination: 'Cairns',
      flightsRequested: true,
    });
    expect(setOrigin.components.messageInterpreted).toBe(true);
    expect(setOrigin.components.followUpQuestion).toBe(
      FOLLOW_UPS.departureDate,
    );
    expect(setOrigin.reply).toContain(FOLLOW_UPS.departureDate);

    const completeSet = runTurn('2 adults', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-04',
      flightsRequested: true,
    });
    expect(completeSet.components.messageInterpreted).toBe(true);
    expect(completeSet.components.acknowledgement).not.toBeNull();
    expect(completeSet.components.followUpQuestion).toBe(FOLLOW_UPS.childCount);
    expect(completeSet.reply).toContain(FOLLOW_UPS.childCount);
  });

  it('preserves same-value and unchanged-repair paths with specific follow-up', () => {
    const seed = { destination: 'Cairns', flightsRequested: true as const };

    const repeated = runTurn('Cairns', seed);
    expect(repeated.extractedPatch).toEqual({});
    expect(repeated.components.messageInterpreted).toBe(false);
    expect(repeated.components.acknowledgement).toBeNull();
    expect(repeated.components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(repeated.reply).toBe(activatedFollowUp(FOLLOW_UPS.origin));

    const unchangedRepair = runTurn('Sorry, I meant Cairns', seed);
    expect(unchangedRepair.extractedPatch).toEqual({ destination: 'Cairns' });
    expect(unchangedRepair.components.messageInterpreted).toBe(false);
    expect(unchangedRepair.components.acknowledgement).toBeNull();
    expect(unchangedRepair.components.acknowledgementEvent).toBeNull();
    expect(unchangedRepair.components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(unchangedRepair.components.continuationPrompt).toBeNull();
    expect(unchangedRepair.reply).toBe(activatedFollowUp(FOLLOW_UPS.origin));

    const completeUnchanged = runTurn('Sorry, I meant Cairns', {
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-04',
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(completeUnchanged.components.messageInterpreted).toBe(false);
    expect(completeUnchanged.components.acknowledgement).toBeNull();
    expect(completeUnchanged.components.followUpQuestion).toBe(NEUTRAL);
    expect(completeUnchanged.reply).toBe(ACTIVATED_NEUTRAL);
  });

  it('never invents acknowledgement for unsupported input', () => {
    const t = runTurn('Thanks', {
      destination: 'Cairns',
      origin: null,
      flightsRequested: true,
    });
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.acknowledgementEvent).toBeNull();
    expect(t.plan.acknowledgements).toEqual([]);
    expect(t.reply).not.toMatch(/Perfect/i);
    expect(t.reply).not.toMatch(/got it/i);
    expect(t.reply).not.toMatch(/Great,/i);
  });
});
