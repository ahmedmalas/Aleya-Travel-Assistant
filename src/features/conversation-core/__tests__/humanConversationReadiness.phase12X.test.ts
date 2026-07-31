import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 12X — human-conversation readiness characterisation.
 *
 * Locks the architecture boundary that makes a future conversational layer
 * safe: authoritative state selects one objective; acknowledgement and
 * messageInterpreted stay separate; rendering consumes a structured plan;
 * wording remains catalogue-owned. Does not add AI behaviour or rephrase
 * deterministic wording.
 */

const ROOT = process.cwd();
const COMPONENTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationReplyComponents.ts',
);
const ASSEMBLE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/assembleConversationReplyPlan.ts',
);
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);

const CONVERSATION_ID = 'conversation-core-phase-12x-readiness-001';
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

function pipeline(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
) {
  const classification = classifyConversationStateChange(previousState, state);
  const components = selectConversationReplyComponents({
    state,
    classification,
  });
  const plan = assembleConversationReplyPlan(components);
  const rendered = renderConversationReplyPlan(plan);
  return { classification, components, plan, rendered };
}

function snapshotState(state: ConversationCoreState): string {
  return JSON.stringify(state);
}

describe('phase 12X — human-conversation readiness characterisation', () => {
  it('keeps reply orchestration free of extraction, AI, and wording ownership', () => {
    const components = readFileSync(COMPONENTS_SOURCE, 'utf8');
    const assemble = readFileSync(ASSEMBLE_SOURCE, 'utf8');
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');

    for (const source of [components, assemble, generate]) {
      expect(source.includes('OpenAI')).toBe(false);
      expect(source.includes('LLM')).toBe(false);
      expect(source.includes('persona')).toBe(false);
      expect(source.includes('tool-call')).toBe(false);
      expect(source.includes('recommend')).toBe(false);
      expect(source.includes('fetch(')).toBe(false);
    }

    // Component selector coordinates existing selectors; does not own literals.
    expect(components).toMatch(/selectConversationFollowUpQuestion/);
    expect(components).toMatch(/selectConversationAcknowledgement/);
    expect(components).toMatch(/selectConversationMessageInterpreted/);
    expect(components).toMatch(/selectConversationContinuationPrompt/);
    expect(components.includes("'Where would you like to travel?'")).toBe(false);
    expect(components.includes("'What else should I know about your trip?'")).toBe(
      false,
    );

    // Assembler merges selected slots only.
    expect(assemble).toMatch(
      /followUpQuestion: input\.followUpQuestion \?\? input\.continuationPrompt/,
    );
    expect(assemble.includes('ConversationCoreState')).toBe(false);
    expect(assemble.includes('selectConversation')).toBe(false);

    // Generator classifies + plans, then renders via the plan-level seam.
    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(generate).toMatch(
      /export function renderConversationReplyPlan\(\s*plan: ConversationReplyPlan,/,
    );
    expect(generate).toMatch(/Does not re-extract/);
    expect(generate.includes('use an AI provider')).toBe(true);
  });

  it('lets authoritative final state determine the next conversational objective', () => {
    const previous = createState();
    const withFlights = createState({ flightsRequested: true });
    const { components, plan } = pipeline(previous, withFlights);

    // Destination remains missing in final state → destination is the objective.
    expect(withFlights.destination).toBeNull();
    expect(components.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.destination);

    const afterDestination = createState({
      destination: 'Hobart',
      flightsRequested: true,
    });
    const next = pipeline(withFlights, afterDestination);
    expect(afterDestination.destination).toBe('Hobart');
    expect(afterDestination.origin).toBeNull();
    expect(next.components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(next.plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
  });

  it('selects at most one follow-up objective per turn', () => {
    const previous = createState();
    const state = createState({
      flightsRequested: true,
      accommodationRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
    });
    const { components, plan, rendered } = pipeline(previous, state);

    const promptSlots = [
      components.followUpQuestion,
      components.continuationPrompt,
    ].filter((value) => value !== null);
    expect(promptSlots).toHaveLength(1);
    expect(components.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(components.continuationPrompt).toBeNull();
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect((rendered.match(/\?/g) ?? []).length).toBe(1);
  });

  it('keeps acknowledgement separate from the follow-up objective', () => {
    // Interpreted + acknowledgement-eligible: ack and follow-up are distinct slots.
    const withAck = pipeline(
      createState(),
      createState({ flightsRequested: true }),
    );
    expect(withAck.classification.hasInterpretedChange).toBe(true);
    expect(withAck.classification.hasAcknowledgementEligibleChange).toBe(true);
    expect(withAck.components.acknowledgement).toBe(
      ACKS.addedCapabilities('flights'),
    );
    expect(withAck.components.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(withAck.components.acknowledgement).not.toBe(
      withAck.components.followUpQuestion,
    );
    expect(withAck.plan.acknowledgements).toEqual([
      ACKS.addedCapabilities('flights'),
    ]);
    expect(withAck.plan.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(withAck.rendered).toBe(
      `${ACKS.addedCapabilities('flights')}\n${FOLLOW_UPS.destination}`,
    );

    // Interpreted but acknowledgement-inert clear: follow-up without acknowledgement.
    const withoutAck = pipeline(
      createState({ flightsRequested: true }),
      createState({ flightsRequested: null }),
    );
    expect(withoutAck.classification.hasInterpretedChange).toBe(true);
    expect(withoutAck.classification.hasAcknowledgementEligibleChange).toBe(
      false,
    );
    expect(withoutAck.components.acknowledgement).toBeNull();
    expect(withoutAck.components.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(withoutAck.plan.acknowledgements).toEqual([]);
    expect(withoutAck.plan.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(withoutAck.rendered).toBe(FOLLOW_UPS.destination);
  });

  it('keeps messageInterpreted signalling separate from the follow-up objective', () => {
    const interpreted = pipeline(
      completeCore({ adultCount: 2 }),
      completeCore({ adultCount: 2, beachesRequested: true }),
    );
    expect(interpreted.components.messageInterpreted).toBe(true);
    expect(interpreted.plan.messageInterpreted).toBe(true);
    expect(interpreted.plan.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(typeof interpreted.plan.messageInterpreted).toBe('boolean');
    expect(interpreted.plan.messageInterpreted).not.toBe(
      interpreted.plan.followUpQuestion,
    );

    const uninterpreted = pipeline(
      completeCore({ adultCount: 2 }),
      completeCore({ adultCount: 2 }),
    );
    expect(uninterpreted.components.messageInterpreted).toBe(false);
    // Phase 18B: complete uninterpreted → follow-up NEUTRAL; continuation null.
    expect(uninterpreted.components.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(uninterpreted.components.continuationPrompt).toBeNull();
    expect(uninterpreted.plan.messageInterpreted).toBe(false);
    expect(uninterpreted.plan.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
  });

  it('covers the readiness flows through structured plan rendering', () => {
    // 1) state change + acknowledgement + specific follow-up
    const acknowledgedFollowUp = pipeline(
      createState({ destination: 'Cairns' }),
      createState({
        destination: 'Cairns',
        accommodationRequested: true,
      }),
    );
    expect(acknowledgedFollowUp.components.acknowledgement).not.toBeNull();
    expect(acknowledgedFollowUp.plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(acknowledgedFollowUp.rendered).toContain('\n');
    expect(acknowledgedFollowUp.rendered.endsWith(FOLLOW_UPS.origin)).toBe(
      true,
    );

    // 2) specific follow-up without acknowledgement
    const followUpOnly = pipeline(
      createState({ flightsRequested: true }),
      createState({ flightsRequested: null }),
    );
    expect(followUpOnly.plan.acknowledgements).toEqual([]);
    expect(followUpOnly.plan.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(followUpOnly.rendered).toBe(FOLLOW_UPS.destination);

    // 3) neutral continuation after required fields are satisfied
    const neutral = pipeline(
      completeCore({ adultCount: 2 }),
      completeCore({ adultCount: 2, beachesRequested: true }),
    );
    expect(neutral.plan.followUpQuestion).toBe(FOLLOW_UPS.neutralContinuation);
    expect(neutral.rendered).toContain(FOLLOW_UPS.neutralContinuation);

    // 4) uninterpreted message on complete state
    const uninterpreted = pipeline(completeCore(), completeCore());
    expect(uninterpreted.components.messageInterpreted).toBe(false);
    // Phase 18B: follow-up selected directly; continuation stays null.
    expect(uninterpreted.components.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(uninterpreted.components.continuationPrompt).toBeNull();
    expect(uninterpreted.plan.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(uninterpreted.rendered).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('renders a structured plan without recalculating or mutating authoritative state', () => {
    const previous = createState();
    const state = createState({ destination: 'Brisbane' });
    const before = snapshotState(state);

    const { plan } = pipeline(previous, state);
    expect(snapshotState(state)).toBe(before);

    const renderedOnce = renderConversationReplyPlan(plan);
    const mutatedCopy: ConversationCoreState = {
      ...state,
      destination: 'Perth',
      origin: 'Melbourne',
      flightsRequested: true,
    };
    const renderedTwice = renderConversationReplyPlan(plan);

    // Renderer ignores later state mutation; same plan → same objective text.
    expect(renderedOnce).toBe(renderedTwice);
    expect(renderedOnce).toContain(FOLLOW_UPS.origin);
    expect(renderedOnce.includes(FOLLOW_UPS.destination)).toBe(false);
    expect(mutatedCopy.destination).toBe('Perth');
    expect(snapshotState(state)).toBe(before);

    // Hand-built plan proves rendering consumes structure only.
    const handBuilt = assembleConversationReplyPlan({
      acknowledgement: ACKS.destination('Brisbane'),
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.origin,
      continuationPrompt: null,
      messageInterpreted: true,
    });
    expect(renderConversationReplyPlan(handBuilt)).toBe(
      `${ACKS.destination('Brisbane')}
${FOLLOW_UPS.origin}`,
    );
    expect(generateConversationReply({
      message: 'unused by reply boundary',
      previousState: previous,
      state,
    })).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`,
    );
  });

  it('keeps user-facing wording catalogue-owned so a future layer can vary tone without changing control', () => {
    const previous = createState();
    const state = createState({ flightsRequested: true });
    const { components, plan, rendered } = pipeline(previous, state);

    expect(components.followUpQuestion).toBe(
      CONVERSATION_REPLY_CATALOGUE.followUps.destination,
    );
    expect(components.acknowledgement).toBe(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.addedCapabilities('flights'),
    );
    expect(plan.followUpQuestion).toBe(
      CONVERSATION_REPLY_CATALOGUE.followUps.destination,
    );
    expect(plan.acknowledgements[0]).toBe(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.addedCapabilities('flights'),
    );
    expect(rendered).toContain(
      CONVERSATION_REPLY_CATALOGUE.followUps.destination,
    );

    // Structured slots are independently addressable: a future conversational
    // layer could rephrase acknowledgement and/or follow-up text while the
    // selected objective slot and interpreted flag remain the control surface.
    const rephrasedPlan = {
      ...plan,
      acknowledgements: ['Thanks — flights are noted.'],
      followUpQuestion: 'Which destination are you considering?',
    };
    expect(rephrasedPlan.messageInterpreted).toBe(plan.messageInterpreted);
    expect(rephrasedPlan.messageInterpreted).toBe(true);
    expect(rephrasedPlan.acknowledgements).not.toEqual(plan.acknowledgements);
    expect(rephrasedPlan.followUpQuestion).not.toBe(plan.followUpQuestion);
    expect(renderConversationReplyPlan(rephrasedPlan)).toBe(
      'Thanks — flights are noted.\nWhich destination are you considering?',
    );

    // Authoritative state and selected objective from the real pipeline are unchanged.
    expect(state.destination).toBeNull();
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(components.continuationPrompt).toBeNull();
  });
});
