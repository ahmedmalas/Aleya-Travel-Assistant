import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationMessageInterpreted } from '../selectConversationMessageInterpreted';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 12Z — deterministic conversation engine final characterisation.
 *
 * Proves the engine is fully deterministic from authoritative structured state:
 * selection, assembly, and rendering never mutate state; identical inputs
 * always yield identical plans and renders. Does not change production
 * behaviour or introduce AI/conversational layers.
 */

const CONVERSATION_ID = 'conversation-core-phase-12z-engine-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;

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

function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

function runEngine(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
  message = 'phase-12z-unused-message',
) {
  const previousBefore = snapshot(previousState);
  const stateBefore = snapshot(state);

  const classification = classifyConversationStateChange(previousState, state);
  const components = selectConversationReplyComponents({
    state,
    classification,
  });
  const assembled = assembleConversationReplyPlan(components);
  const plan = createConversationReplyPlan({ state, classification });
  const rendered = renderConversationReplyPlan(plan);
  const generated = generateConversationReply({
    message,
    previousState,
    state,
  });

  expect(snapshot(previousState)).toBe(previousBefore);
  expect(snapshot(state)).toBe(stateBefore);

  return {
    classification,
    components,
    assembled,
    plan,
    rendered,
    generated,
    previousBefore,
    stateBefore,
  };
}

type Scenario = {
  name: string;
  previous: ConversationCoreState;
  state: ConversationCoreState;
  expectedFollowUp: string;
  expectedAcknowledgement: string | null;
  expectedInterpreted: boolean;
};

const SCENARIOS: readonly Scenario[] = [
  {
    name: 'destination collection',
    previous: createState(),
    state: createState({ flightsRequested: true }),
    expectedFollowUp: FOLLOW_UPS.destination,
    expectedAcknowledgement: ACKS.addedCapabilities('flights'),
    expectedInterpreted: true,
  },
  {
    name: 'origin collection',
    previous: createState(),
    state: createState({ destination: 'Brisbane' }),
    expectedFollowUp: FOLLOW_UPS.origin,
    expectedAcknowledgement: ACKS.destination('Brisbane'),
    expectedInterpreted: true,
  },
  {
    name: 'date collection',
    previous: createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-01',
    }),
    state: createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    }),
    expectedFollowUp: FOLLOW_UPS.returnDate,
    expectedAcknowledgement: ACKS.departureDate('2026-08-28'),
    expectedInterpreted: true,
  },
  {
    name: 'flight passenger collection',
    previous: completeCore(),
    state: completeCore({ flightsRequested: true }),
    expectedFollowUp: FOLLOW_UPS.flightsAdultCount,
    expectedAcknowledgement: ACKS.addedCapabilities('flights'),
    expectedInterpreted: true,
  },
  {
    name: 'completed-trip continuation',
    previous: completeCore({ adultCount: 2 }),
    state: completeCore({ adultCount: 2, beachesRequested: true }),
    expectedFollowUp: FOLLOW_UPS.neutralContinuation,
    expectedAcknowledgement: ACKS.addedCapabilities('beaches'),
    expectedInterpreted: true,
  },
  {
    name: 'uninterpreted input',
    previous: completeCore({ adultCount: 2 }),
    state: completeCore({ adultCount: 2 }),
    expectedFollowUp: FOLLOW_UPS.neutralContinuation,
    expectedAcknowledgement: null,
    expectedInterpreted: false,
  },
  {
    name: 'acknowledgement + follow-up',
    previous: createState({ destination: 'Cairns' }),
    state: createState({
      destination: 'Cairns',
      accommodationRequested: true,
    }),
    expectedFollowUp: FOLLOW_UPS.origin,
    expectedAcknowledgement: ACKS.addedCapabilities('accommodation'),
    expectedInterpreted: true,
  },
];

describe('phase 12Z — deterministic conversation engine characterisation', () => {
  it('treats conversation state as the sole source of conversational truth', () => {
    const previous = createState();
    const missingDestination = createState({ flightsRequested: true });
    const withDestination = createState({
      destination: 'Hobart',
      flightsRequested: true,
    });

    const first = runEngine(previous, missingDestination);
    expect(missingDestination.destination).toBeNull();
    expect(first.plan.followUpQuestion).toBe(FOLLOW_UPS.destination);

    const second = runEngine(missingDestination, withDestination);
    expect(withDestination.destination).toBe('Hobart');
    expect(withDestination.origin).toBeNull();
    expect(second.plan.followUpQuestion).toBe(FOLLOW_UPS.origin);

    // Message text is unused by the reply boundary.
    const fromMessageA = generateConversationReply({
      message: 'completely different user text',
      previousState: previous,
      state: missingDestination,
    });
    const fromMessageB = generateConversationReply({
      message: 'another unrelated message',
      previousState: previous,
      state: missingDestination,
    });
    expect(fromMessageA).toBe(fromMessageB);
    expect(fromMessageA).toBe(first.generated);
  });

  it('keeps selection, assembly, rendering, and catalogue wording fully deterministic', () => {
    for (const scenario of SCENARIOS) {
      const first = runEngine(scenario.previous, scenario.state);
      const second = runEngine(
        structuredClone(scenario.previous),
        structuredClone(scenario.state),
      );

      expect(first.components, scenario.name).toEqual(second.components);
      expect(first.assembled, scenario.name).toEqual(second.assembled);
      expect(first.plan, scenario.name).toEqual(second.plan);
      expect(first.rendered, scenario.name).toBe(second.rendered);
      expect(first.generated, scenario.name).toBe(second.generated);
      expect(first.plan, scenario.name).toEqual(first.assembled);
      expect(first.generated, scenario.name).toBe(
        expectedActivatedBaselineReply(first.plan),
      );
      if (first.plan.acknowledgements.length === 1) {
        expect(first.generated, `${scenario.name} / diverges`).not.toBe(
          first.rendered,
        );
      } else {
        expect(first.generated, `${scenario.name} / parity`).toBe(first.rendered);
      }

      expect(first.components.followUpQuestion ?? first.components.continuationPrompt, scenario.name).toBe(
        scenario.expectedFollowUp,
      );
      expect(first.plan.followUpQuestion, scenario.name).toBe(
        scenario.expectedFollowUp,
      );
      expect(first.components.acknowledgement, scenario.name).toBe(
        scenario.expectedAcknowledgement,
      );
      expect(first.components.messageInterpreted, scenario.name).toBe(
        scenario.expectedInterpreted,
      );
      expect(first.plan.messageInterpreted, scenario.name).toBe(
        scenario.expectedInterpreted,
      );

      if (scenario.expectedFollowUp !== FOLLOW_UPS.neutralContinuation) {
        expect(Object.values(FOLLOW_UPS), scenario.name).toContain(
          scenario.expectedFollowUp,
        );
      } else {
        expect(scenario.expectedFollowUp, scenario.name).toBe(
          NEUTRAL_TRIP_FALLBACK_REPLY,
        );
        expect(scenario.expectedFollowUp, scenario.name).toBe(
          FOLLOW_UPS.neutralContinuation,
        );
      }

      if (scenario.expectedAcknowledgement !== null) {
        expect(first.plan.acknowledgements, scenario.name).toEqual([
          scenario.expectedAcknowledgement,
        ]);
      } else {
        expect(first.plan.acknowledgements, scenario.name).toEqual([]);
      }
    }
  });

  it('ensures acknowledgement, follow-up, continuation, and messageInterpreted never mutate authoritative state', () => {
    const previous = createState({ destination: 'Cairns' });
    const state = createState({
      destination: 'Cairns',
      accommodationRequested: true,
    });
    const previousBefore = snapshot(previous);
    const stateBefore = snapshot(state);

    const classification = classifyConversationStateChange(previous, state);
    const acknowledgement = selectConversationAcknowledgement(
      state,
      classification,
    );
    const messageInterpreted =
      selectConversationMessageInterpreted(classification);
    const followUpQuestion = messageInterpreted
      ? selectConversationFollowUpQuestion(state)
      : null;
    const continuationPrompt = selectConversationContinuationPrompt({
      followUpQuestion,
    });

    expect(snapshot(previous)).toBe(previousBefore);
    expect(snapshot(state)).toBe(stateBefore);

    expect(acknowledgement).toBe(ACKS.addedCapabilities('accommodation'));
    expect(followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(continuationPrompt).toBeNull();
    expect(messageInterpreted).toBe(true);

    // Acknowledgement and interpreted signalling do not replace the objective.
    expect(acknowledgement).not.toBe(followUpQuestion);
    expect(messageInterpreted).not.toBe(followUpQuestion as unknown as boolean);

    // Follow-up / continuation selection do not alter state.
    expect(state.destination).toBe('Cairns');
    expect(state.origin).toBeNull();
    expect(state.accommodationRequested).toBe(true);
  });

  it('ensures no reply-generation stage mutates authoritative state', () => {
    for (const scenario of SCENARIOS) {
      const previous = structuredClone(scenario.previous);
      const state = structuredClone(scenario.state);
      const previousBefore = snapshot(previous);
      const stateBefore = snapshot(state);

      classifyConversationStateChange(previous, state);
      expect(snapshot(previous), scenario.name).toBe(previousBefore);
      expect(snapshot(state), scenario.name).toBe(stateBefore);

      selectConversationReplyComponents({
        state,
        classification: classifyConversationStateChange(previous, state),
      });
      expect(snapshot(previous), scenario.name).toBe(previousBefore);
      expect(snapshot(state), scenario.name).toBe(stateBefore);

      createConversationReplyPlan({
        state,
        classification: classifyConversationStateChange(previous, state),
      });
      expect(snapshot(previous), scenario.name).toBe(previousBefore);
      expect(snapshot(state), scenario.name).toBe(stateBefore);

      generateConversationReply({
        message: 'mutation-check',
        previousState: previous,
        state,
      });
      expect(snapshot(previous), scenario.name).toBe(previousBefore);
      expect(snapshot(state), scenario.name).toBe(stateBefore);
    }
  });

  it('produces an identical structured reply plan from identical authoritative state', () => {
    for (const scenario of SCENARIOS) {
      const plans = Array.from({ length: 5 }, () => {
        const classification = classifyConversationStateChange(
          structuredClone(scenario.previous),
          structuredClone(scenario.state),
        );
        return createConversationReplyPlan({
          state: structuredClone(scenario.state),
          classification,
        });
      });

      for (const plan of plans) {
        expect(plan, scenario.name).toEqual(plans[0]);
        expect(plan.followUpQuestion, scenario.name).toBe(
          scenario.expectedFollowUp,
        );
        expect(plan.messageInterpreted, scenario.name).toBe(
          scenario.expectedInterpreted,
        );
      }
    }
  });

  it('renders identical structured reply plans identically, including repeated generation', () => {
    for (const scenario of SCENARIOS) {
      const first = runEngine(scenario.previous, scenario.state);
      const planClone = structuredClone(first.plan);

      const renders = [
        renderConversationReplyPlan(first.plan),
        renderConversationReplyPlan(first.plan),
        renderConversationReplyPlan(planClone),
        renderConversationReplyPlan(structuredClone(first.plan)),
      ];
      for (const rendered of renders) {
        expect(rendered, scenario.name).toBe(first.rendered);
      }

      const generations = [
        generateConversationReply({
          message: 'repeat-a',
          previousState: scenario.previous,
          state: scenario.state,
        }),
        generateConversationReply({
          message: 'repeat-b',
          previousState: structuredClone(scenario.previous),
          state: structuredClone(scenario.state),
        }),
        generateConversationReply({
          message: 'repeat-c',
          previousState: scenario.previous,
          state: scenario.state,
        }),
      ];
      for (const generated of generations) {
        expect(generated, scenario.name).toBe(first.generated);
      }

      expect(snapshot(first.plan), scenario.name).toBe(snapshot(planClone));
      expect(snapshot(scenario.state), scenario.name).toBe(
        snapshot(structuredClone(scenario.state)),
      );
    }
  });

  it('keeps catalogue wording externally owned and deterministic', () => {
    expect(FOLLOW_UPS.destination).toBe('Where would you like to travel?');
    expect(FOLLOW_UPS.origin).toBe('Where will you be travelling from?');
    expect(FOLLOW_UPS.departureDate).toBe('When would you like to depart?');
    expect(FOLLOW_UPS.returnDate).toBe('When would you like to return?');
    expect(FOLLOW_UPS.flightsAdultCount).toBe(
      'How many adults will be travelling?',
    );
    expect(FOLLOW_UPS.neutralContinuation).toBe(
      'What else should I know about your trip?',
    );
    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(FOLLOW_UPS.neutralContinuation);

    const first = selectConversationFollowUpQuestion(createState());
    const second = selectConversationFollowUpQuestion(createState());
    expect(first).toBe(FOLLOW_UPS.destination);
    expect(second).toBe(first);
    expect(first).toBe(CONVERSATION_REPLY_CATALOGUE.followUps.destination);
  });
});
