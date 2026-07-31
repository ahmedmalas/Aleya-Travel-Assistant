import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 12Y — reply architecture release-readiness characterisation.
 *
 * Final consolidated audit of the deterministic reply architecture through
 * Phase 12X. Proves end-to-end structural readiness without changing wording,
 * priority, eligibility, or introducing AI behaviour.
 */

const ROOT = process.cwd();

const SOURCE_PATHS = {
  components: 'src/features/conversation-core/selectConversationReplyComponents.ts',
  acknowledgement: 'src/features/conversation-core/selectConversationAcknowledgement.ts',
  followUp: 'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
  continuation: 'src/features/conversation-core/selectConversationContinuationPrompt.ts',
  assemble: 'src/features/conversation-core/assembleConversationReplyPlan.ts',
  generate: 'src/features/conversation-core/generateConversationReply.ts',
  catalogue: 'src/features/conversation-core/conversationReplyCatalogue.ts',
  createPlan: 'src/features/conversation-core/createConversationReplyPlan.ts',
} as const;

const CONVERSATION_ID = 'conversation-core-phase-12y-release-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const ALL_PROMPTS = Object.values(FOLLOW_UPS);

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

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
  const planFromComponents = assembleConversationReplyPlan(components);
  const plan = createConversationReplyPlan({ state, classification });
  const rendered = renderConversationReplyPlan(plan);
  const generated = generateConversationReply({
    message: 'phase-12y-unused-message',
    previousState,
    state,
  });
  return {
    classification,
    components,
    planFromComponents,
    plan,
    rendered,
    generated,
  };
}

function assertSinglePrompt(rendered: string, expected: string, label: string) {
  expect((rendered.match(/\?/g) ?? []).length, label).toBe(1);
  expect(
    ALL_PROMPTS.filter((prompt) => rendered.includes(prompt)),
    label,
  ).toEqual([expected]);
}

describe('phase 12Y — reply architecture release-readiness characterisation', () => {
  it('keeps the reply architecture free of AI, tools, booking, and external-data responsibility', () => {
    for (const relativePath of Object.values(SOURCE_PATHS)) {
      const source = readSrc(relativePath);
      expect(source.includes('OpenAI'), relativePath).toBe(false);
      expect(source.includes('Anthropic'), relativePath).toBe(false);
      expect(source.includes('LLM'), relativePath).toBe(false);
      expect(source.includes('persona'), relativePath).toBe(false);
      expect(source.includes('tool-call'), relativePath).toBe(false);
      expect(source.includes('fetch('), relativePath).toBe(false);
      expect(source.includes('supabase'), relativePath).toBe(false);
      expect(source.includes('booking'), relativePath).toBe(false);
      expect(source.includes('recommend'), relativePath).toBe(false);
    }

    const createPlan = readSrc(SOURCE_PATHS.createPlan);
    expect(createPlan).toMatch(/selectConversationReplyComponents\(/);
    expect(createPlan).toMatch(/assembleConversationReplyPlan\(/);

    const generate = readSrc(SOURCE_PATHS.generate);
    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(generate).toMatch(
      /export function renderConversationReplyPlan\(\s*plan: ConversationReplyPlan,/,
    );
  });

  it('selects reply components before assembly and rendering', () => {
    const previous = createState();
    const state = createState({ destination: 'Brisbane' });
    const classification = classifyConversationStateChange(previous, state);

    const components = selectConversationReplyComponents({
      state,
      classification,
    });
    expect(components.acknowledgement).toBe(ACKS.destination('Brisbane'));
    expect(components.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(components.continuationPrompt).toBeNull();
    expect(components.messageInterpreted).toBe(true);

    const plan = assembleConversationReplyPlan(components);
    expect(plan).toEqual({
      acknowledgements: [ACKS.destination('Brisbane')],
      acknowledgementEvent: { kind: 'field-set', field: 'destination' },
      followUpQuestion: FOLLOW_UPS.origin,
      messageInterpreted: true,
    });

    const rendered = renderConversationReplyPlan(plan);
    expect(rendered).toBe(
      `${ACKS.destination('Brisbane')}
${FOLLOW_UPS.origin}`,
    );
  });

  it('keeps acknowledgement, follow-up, continuation, and messageInterpreted as separate concerns', () => {
    const result = pipeline(
      createState(),
      createState({ destination: 'Hobart' }),
    );

    expect(result.components).toEqual({
      acknowledgement: ACKS.destination('Hobart'),
      acknowledgementEvent: { kind: 'field-set', field: 'destination' },
      followUpQuestion: FOLLOW_UPS.origin,
      continuationPrompt: null,
      messageInterpreted: true,
    });
    expect(result.plan.acknowledgements).toEqual([ACKS.destination('Hobart')]);
    expect(result.plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(result.plan.messageInterpreted).toBe(true);
    expect(typeof result.plan.messageInterpreted).toBe('boolean');
    expect(result.plan.acknowledgements[0]).not.toBe(result.plan.followUpQuestion);
  });

  it('lets authoritative final state control the next required objective across representative flows', () => {
    // Changed destination → origin objective
    const destinationChange = pipeline(
      createState(),
      createState({ destination: 'Brisbane' }),
    );
    expect(destinationChange.plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(destinationChange.components.continuationPrompt).toBeNull();
    assertSinglePrompt(
      destinationChange.rendered,
      FOLLOW_UPS.origin,
      'destination→origin',
    );

    // Changed date → next missing objective (return date)
    const dateChange = pipeline(
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-01',
      }),
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
      }),
    );
    expect(dateChange.plan.followUpQuestion).toBe(FOLLOW_UPS.returnDate);
    expect(dateChange.components.continuationPrompt).toBeNull();
    assertSinglePrompt(
      dateChange.rendered,
      FOLLOW_UPS.returnDate,
      'departureDate→returnDate',
    );

    // Enabled flights → adult-count objective
    const flightsEnabled = pipeline(
      completeCore(),
      completeCore({ flightsRequested: true }),
    );
    expect(flightsEnabled.plan.followUpQuestion).toBe(
      FOLLOW_UPS.flightsAdultCount,
    );
    expect(flightsEnabled.components.continuationPrompt).toBeNull();
    assertSinglePrompt(
      flightsEnabled.rendered,
      FOLLOW_UPS.flightsAdultCount,
      'flights→adultCount',
    );

    // Completed required state → neutral continuation
    const completed = pipeline(
      completeCore({ adultCount: 2 }),
      completeCore({ adultCount: 2, beachesRequested: true }),
    );
    expect(completed.plan.followUpQuestion).toBe(FOLLOW_UPS.neutralContinuation);
    expect(completed.components.continuationPrompt).toBeNull();
    assertSinglePrompt(
      completed.rendered,
      FOLLOW_UPS.neutralContinuation,
      'completed→neutral',
    );

    // Uninterpreted input → follow-up from final state (Phase 18B)
    const uninterpreted = pipeline(completeCore(), completeCore());
    expect(uninterpreted.components.messageInterpreted).toBe(false);
    expect(uninterpreted.components.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(uninterpreted.components.continuationPrompt).toBeNull();
    expect(uninterpreted.plan.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    assertSinglePrompt(
      uninterpreted.rendered,
      FOLLOW_UPS.neutralContinuation,
      'uninterpreted→continuation',
    );
  });

  it('excludes neutral continuation whenever a specific follow-up is selected', () => {
    const cases = [
      pipeline(createState(), createState({ destination: 'Brisbane' })),
      pipeline(
        createState({ destination: 'Cairns', origin: 'Sydney' }),
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
      ),
      pipeline(completeCore(), completeCore({ flightsRequested: true })),
    ];

    for (const [index, result] of cases.entries()) {
      expect(result.components.followUpQuestion, String(index)).not.toBe(
        FOLLOW_UPS.neutralContinuation,
      );
      expect(result.components.continuationPrompt, String(index)).toBeNull();
      expect(result.plan.followUpQuestion, String(index)).not.toBe(
        FOLLOW_UPS.neutralContinuation,
      );
      expect(
        result.rendered.includes(FOLLOW_UPS.neutralContinuation),
        String(index),
      ).toBe(false);
      expect((result.rendered.match(/\?/g) ?? []).length, String(index)).toBe(1);
    }
  });

  it('assembles and renders acknowledgement + objective as a single conversational prompt', () => {
    const result = pipeline(
      createState(),
      createState({ destination: 'Brisbane' }),
    );

    expect(result.planFromComponents).toEqual(result.plan);
    expect(result.plan.acknowledgements).toHaveLength(1);
    expect(result.plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(result.rendered).toBe(
      `${ACKS.destination('Brisbane')}
${FOLLOW_UPS.origin}`,
    );
    expect(result.generated).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`,
    );
    assertSinglePrompt(result.rendered, FOLLOW_UPS.origin, 'ack+objective');
    expect(result.plan.acknowledgements[0]!.includes('?')).toBe(false);
  });

  it('renders a frozen structured plan deterministically without recalculating state or eligibility', () => {
    const previous = createState();
    const state = createState({ destination: 'Brisbane' });
    const stateBefore = JSON.stringify(state);

    const { plan, rendered } = pipeline(previous, state);
    const planBefore = JSON.stringify(plan);

    const first = renderConversationReplyPlan(plan);
    const second = renderConversationReplyPlan(plan);
    const third = renderConversationReplyPlan(structuredClone(plan));

    expect(first).toBe(rendered);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(JSON.stringify(plan)).toBe(planBefore);
    expect(JSON.stringify(state)).toBe(stateBefore);

    // Later state mutation must not affect the frozen plan outcome.
    const mutated = {
      ...state,
      destination: 'Perth',
      origin: 'Melbourne',
      flightsRequested: true,
    };
    expect(renderConversationReplyPlan(plan)).toBe(first);
    expect(mutated.destination).toBe('Perth');
    expect(JSON.stringify(state)).toBe(stateBefore);
  });

  it('keeps all deterministic user-facing wording catalogue-owned', () => {
    const result = pipeline(
      completeCore(),
      completeCore({ flightsRequested: true }),
    );

    expect(result.components.acknowledgement).toBe(
      ACKS.addedCapabilities('flights'),
    );
    expect(result.components.followUpQuestion).toBe(
      FOLLOW_UPS.flightsAdultCount,
    );
    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(FOLLOW_UPS.neutralContinuation);

    const followUpSource = readSrc(SOURCE_PATHS.followUp);
    const continuationSource = readSrc(SOURCE_PATHS.continuation);
    const componentsSource = readSrc(SOURCE_PATHS.components);
    const assembleSource = readSrc(SOURCE_PATHS.assemble);

    for (const wording of ALL_PROMPTS) {
      expect(followUpSource.includes(`'${wording}'`)).toBe(false);
      expect(continuationSource.includes(`'${wording}'`)).toBe(false);
      expect(componentsSource.includes(`'${wording}'`)).toBe(false);
      expect(assembleSource.includes(`'${wording}'`)).toBe(false);
    }

    const catalogue = readSrc(SOURCE_PATHS.catalogue);
    for (const wording of ALL_PROMPTS) {
      expect(catalogue.includes(wording)).toBe(true);
    }
  });

  it('exposes a stable boundary for a future conversational layer without changing control surfaces', () => {
    const previous = createState();
    const state = createState({ destination: 'Brisbane' });
    const { components, plan } = pipeline(previous, state);

    // Control surface remains structured slots + interpreted flag + event.
    expect(Object.keys(components).sort()).toEqual([
      'acknowledgement',
      'acknowledgementEvent',
      'continuationPrompt',
      'followUpQuestion',
      'messageInterpreted',
    ]);
    expect(Object.keys(plan).sort()).toEqual([
      'acknowledgementEvent',
      'acknowledgements',
      'followUpQuestion',
      'messageInterpreted',
    ]);

    const rephrased = {
      acknowledgements: ['Nice choice — Brisbane.'],
      acknowledgementEvent: null,
      followUpQuestion: 'Where are you flying from?',
      messageInterpreted: plan.messageInterpreted,
    };
    expect(rephrased.messageInterpreted).toBe(true);
    expect(renderConversationReplyPlan(rephrased)).toBe(
      'Nice choice — Brisbane.\nWhere are you flying from?',
    );

    // Authoritative control from the deterministic pipeline is unchanged.
    expect(plan.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(plan.acknowledgements).toEqual([ACKS.destination('Brisbane')]);
    expect(state.destination).toBe('Brisbane');
    expect(state.origin).toBeNull();
  });
});
