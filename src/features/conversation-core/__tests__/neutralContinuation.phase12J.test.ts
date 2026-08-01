import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from '../conversationReplyCatalogue';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12J — neutral continuation boundary characterisation.
 *
 * Locks the terminal neutral-continuation behaviour after all specific
 * follow-up requirements are satisfied. Does not change production behaviour.
 */

const CONVERSATION_ID = 'conversation-core-phase-12j-neutral-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    }),
    status: 'active',
    turnCount: 1,
    ...overrides,
  };
}

/** Core progression fields complete; no contextual service requested. */
function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
    ...overrides,
  });
}

/** All core fields and enabled service-specific count requirements satisfied. */
function fullySatisfied(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return completeCore({
    flightsRequested: true,
    accommodationRequested: true,
    adultCount: 2,
    childCount: 2,
    activitiesRequested: false,
    restaurantsRequested: false,
    ...overrides,
  });
}

function assembleFromFollowUp(followUpQuestion: string | null) {
  const continuationPrompt = selectConversationContinuationPrompt({
    followUpQuestion,
  });
  return assembleConversationReplyPlan({
    acknowledgement: null,
      acknowledgementEvent: null,
    followUpQuestion,
    continuationPrompt,
    messageInterpreted: followUpQuestion !== null,
  });
}

describe('phase 12J — neutral continuation boundary characterisation', () => {
  it('uses the exact catalogue neutral-continuation wording', () => {
    expect(FOLLOW_UPS.neutralContinuation).toBe(
      'What else should I know about your trip?',
    );
    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('selects the neutral continuation when all core and enabled service-specific requirements are satisfied', () => {
    expect(selectConversationFollowUpQuestion(completeCore())).toBe(
      FOLLOW_UPS.neutralContinuation,
    );

    expect(selectConversationFollowUpQuestion(fullySatisfied())).toBe(
      FOLLOW_UPS.neutralContinuation,
    );

    expect(
      selectConversationFollowUpQuestion(
        fullySatisfied({
          activitiesRequested: null,
          restaurantsRequested: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          accommodationRequested: true,
          adultCount: 2,
          childCount: 2,
          activitiesRequested: false,
          restaurantsRequested: false,
        }),
      ),
    ).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('lets any specific follow-up beat the neutral continuation when it becomes pending', () => {
    expect(selectConversationFollowUpQuestion(createState())).toBe(
      FOLLOW_UPS.destination,
    );
    expect(selectConversationFollowUpQuestion(createState())).not.toBe(
      FOLLOW_UPS.neutralContinuation,
    );

    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: 'Cairns' }),
      ),
    ).toBe(FOLLOW_UPS.origin);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
        }),
      ),
    ).toBe(FOLLOW_UPS.departureDate);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
    ).toBe(FOLLOW_UPS.returnDate);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          flightsRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.flightsAdultCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          accommodationRequested: true,
          adultCount: null,
        }),
      ),
    ).toBe(FOLLOW_UPS.accommodationGuestCount);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          activitiesRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.activities);

    expect(
      selectConversationFollowUpQuestion(
        completeCore({
          adultCount: 2,
          restaurantsRequested: true,
        }),
      ),
    ).toBe(FOLLOW_UPS.restaurants);
  });

  it('renders the neutral continuation exactly once', () => {
    const selected = selectConversationFollowUpQuestion(fullySatisfied());
    expect(selected).toBe(FOLLOW_UPS.neutralContinuation);

    const plan = assembleFromFollowUp(selected);
    const rendered = renderConversationReplyPlan(plan);

    expect(rendered).toBe(FOLLOW_UPS.neutralContinuation);
    expect(rendered).toBe('What else should I know about your trip?');
    expect(
      rendered.split(FOLLOW_UPS.neutralContinuation).length - 1,
    ).toBe(1);
    expect(rendered.includes('\n')).toBe(false);
  });

  it('does not emit the neutral continuation alongside a specific follow-up', () => {
    const specific = selectConversationFollowUpQuestion(
      completeCore({
        flightsRequested: true,
        adultCount: null,
      }),
    );
    expect(specific).toBe(FOLLOW_UPS.flightsAdultCount);

    const continuationPrompt = selectConversationContinuationPrompt({
      followUpQuestion: specific,
    });
    expect(continuationPrompt).toBeNull();

    const plan = assembleConversationReplyPlan({
      acknowledgement: null,
      acknowledgementEvent: null,
      followUpQuestion: specific,
      continuationPrompt,
      messageInterpreted: true,
    });
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.flightsAdultCount);
    expect(plan.followUpQuestion).not.toBe(FOLLOW_UPS.neutralContinuation);

    const rendered = renderConversationReplyPlan(plan);
    expect(rendered).toBe(FOLLOW_UPS.flightsAdultCount);
    expect(rendered.includes(FOLLOW_UPS.neutralContinuation)).toBe(false);
  });

  it('preserves a maximum of one prompt in the assembled reply plan', () => {
    const terminalFollowUp = selectConversationFollowUpQuestion(
      fullySatisfied(),
    );
    expect(terminalFollowUp).toBe(FOLLOW_UPS.neutralContinuation);

    const terminalContinuation = selectConversationContinuationPrompt({
      followUpQuestion: terminalFollowUp,
    });
    // Follow-up selector already returned the neutral string, so continuation
    // stays null and assembly does not duplicate the prompt.
    expect(terminalContinuation).toBeNull();

    const terminalPlan = assembleConversationReplyPlan({
      acknowledgement: null,
      acknowledgementEvent: null,
      followUpQuestion: terminalFollowUp,
      continuationPrompt: terminalContinuation,
      messageInterpreted: true,
    });
    expect(terminalPlan.followUpQuestion).toBe(FOLLOW_UPS.neutralContinuation);
    expect(typeof terminalPlan.followUpQuestion).toBe('string');
    expect(terminalPlan.followUpQuestion!.includes('\n')).toBe(false);

    const specificFollowUp = selectConversationFollowUpQuestion(
      completeCore({
        adultCount: 2,
        activitiesRequested: true,
        restaurantsRequested: true,
      }),
    );
    expect(specificFollowUp).toBe(FOLLOW_UPS.activities);

    const specificContinuation = selectConversationContinuationPrompt({
      followUpQuestion: specificFollowUp,
    });
    expect(specificContinuation).toBeNull();

    const specificPlan = assembleConversationReplyPlan({
      acknowledgement: "I've added activities and restaurants to your trip requirements.",
      acknowledgementEvent: null,
      followUpQuestion: specificFollowUp,
      continuationPrompt: specificContinuation,
      messageInterpreted: true,
    });
    expect(specificPlan.followUpQuestion).toBe(FOLLOW_UPS.activities);
    expect(specificPlan.followUpQuestion).not.toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(specificPlan.acknowledgements).toHaveLength(1);

    const rendered = renderConversationReplyPlan(specificPlan);
    expect(rendered).toBe(
      `${specificPlan.acknowledgements[0]}\n${FOLLOW_UPS.activities}`,
    );
    expect(rendered.includes(FOLLOW_UPS.neutralContinuation)).toBe(false);
    expect(rendered.includes(FOLLOW_UPS.restaurants)).toBe(false);

    // Uninterpreted path: follow-up null → continuation supplies the single prompt.
    const uninterpretedContinuation = selectConversationContinuationPrompt({
      followUpQuestion: null,
    });
    expect(uninterpretedContinuation).toBe(FOLLOW_UPS.neutralContinuation);

    const uninterpretedPlan = assembleConversationReplyPlan({
      acknowledgement: null,
      acknowledgementEvent: null,
      followUpQuestion: null,
      continuationPrompt: uninterpretedContinuation,
      messageInterpreted: false,
    });
    expect(uninterpretedPlan.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(renderConversationReplyPlan(uninterpretedPlan)).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
  });
});
