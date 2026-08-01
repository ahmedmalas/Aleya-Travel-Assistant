import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
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
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 20A — production conversational integration boundary audit.
 *
 * Characterization only. Proves the live expression seam, state-before-render
 * ordering, single-question invariant, and activated baseline parity for
 * representative paths. Does not wire or change production behaviour.
 */

const ROOT = process.cwd();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const SELECTABLE_QUESTIONS = Object.values(FOLLOW_UPS);

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
} as const;

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-20a',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(message: string, seed: Partial<ConversationCoreState> = {}) {
  const previous = createState(seed);
  const previousSnapshot = structuredClone(previous);
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-20a',
    assistantEntryId: 'assistant-20a',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  const baseline = generateBaselineConversationalReply(plan);
  const expected = expectedActivatedBaselineReply(plan);
  const deterministic = renderConversationReplyPlan(plan);
  return {
    previous,
    previousSnapshot,
    result,
    classification,
    plan,
    baseline,
    expected,
    deterministic,
  };
}

function assertSingleSelectedQuestion(reply: string): void {
  expect(
    SELECTABLE_QUESTIONS.filter((question) => reply.includes(question)).length,
  ).toBeLessThanOrEqual(1);
}

describe('Phase 20A — production conversational integration boundary audit', () => {
  it('locks the live production expression seam without processTurn experimental imports', () => {
    const processTurn = readSrc(
      'src/features/conversation-core/processTurn.ts',
    );
    const integrated = readSrc(
      'src/features/conversation-core/generateIntegratedConversationReply.ts',
    );
    const generate = readSrc(
      'src/features/conversation-core/generateConversationReply.ts',
    );
    const seam = readSrc(
      'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
    );
    const modeDriven = readSrc(
      'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
    );
    const index = readSrc('src/features/conversation-core/index.ts');
    const auditDoc = readSrc(
      'docs/conversation-engine/phase20A-production-conversational-integration-boundary-audit.md',
    );

    expect(processTurn).toMatch(/generateIntegratedConversationReply\(/);
    expect(processTurn).not.toMatch(/generateConversationReply\(/);
    expect(processTurn).not.toMatch(/generateBaselineConversationalReply/);
    expect(processTurn).not.toMatch(/buildConversationalLayerInput/);
    expect(processTurn).not.toMatch(/invokeConversationalLayerRenderer/);
    expect(processTurn).not.toMatch(/selectConversationalObjective/);
    expect(processTurn).not.toMatch(/executeBaselineConversationalRenderer/);
    expect(processTurn).not.toMatch(/renderBaselineConversationalLayer/);

    expect(integrated).toMatch(
      /const mode: ConversationReplyIntegrationMode = 'deterministic'/,
    );
    expect(integrated).toMatch(/return generateConversationReply\(input\)/);
    expect(integrated).not.toMatch(/baseline-conversational/);
    expect(integrated).not.toMatch(/generateBaselineConversationalReply/);

    expect(generate).toMatch(/classifyConversationStateChange\(/);
    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(generate).not.toMatch(/generateBaselineConversationalReply/);
    expect(generate).not.toMatch(/buildConversationalLayerInput/);
    expect(generate).not.toMatch(/invokeConversationalLayerRenderer/);

    expect(seam).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(seam).toMatch(
      /return renderConversationReplyPlanByIntegrationMode\(\{\s*plan: input\.plan,\s*mode,\s*\}\)/,
    );

    expect(modeDriven).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );
    expect(modeDriven).toMatch(
      /case 'deterministic':\s*return renderConversationReplyPlan\(input\.plan\)/,
    );

    expect(index).not.toMatch(/generateBaselineConversationalReply/);
    expect(index).not.toMatch(/renderIntegratedConversationReplyPlan/);
    expect(index).not.toMatch(/buildConversationalLayerInput/);

    expect(auditDoc).toContain('Phase 20A');
    expect(auditDoc).toContain('renderIntegratedConversationReplyPlan');
    expect(auditDoc).toContain('NO-GO for new production wiring');
  });

  it.each([
    {
      name: 'acknowledgement + follow-up',
      message: 'Cairns',
      seed: {},
    },
    {
      name: 'follow-up only (unsupported during adult Q)',
      message: 'asdf qwerty',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'neutral continuation',
      message: '2 adults, 0 children and 0 infants',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'uninterpreted message (empty prior state)',
      message: 'hello there',
      seed: {},
    },
    {
      name: 'passenger progression (adult answer)',
      message: '2 adults',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'activity request',
      message: 'add beaches',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: 0,
        activitiesRequested: true,
      },
    },
    {
      name: 'restaurant preference',
      message: 'italian food',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: 0,
        restaurantsRequested: true,
      },
    },
    {
      name: 'state removal',
      message: 'Hello',
      seed: {
        destination: 'Cairns',
      },
      stateUpdate: { destination: null as unknown as string },
    },
    {
      name: 'multi-passenger update',
      message: '2 adults and 1 child',
      seed: {
        ...COMPLETE_CORE,
        adultCount: null,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'zero child count',
      message: '0 children',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: null,
        infantCount: null,
        flightsRequested: true,
      },
    },
    {
      name: 'zero infant count',
      message: '0 infants',
      seed: {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 0,
        infantCount: null,
        flightsRequested: true,
      },
    },
  ])(
    '$name → production reply equals activated baseline; one reply; one question; render is pure',
    ({ name, message, seed, stateUpdate }) => {
      void name;
      const previous = createState(seed);
      const previousSnapshot = structuredClone(previous);
      const result = processConversationTurn({
        message,
        state: previous,
        userEntryId: 'user-20a-path',
        assistantEntryId: 'assistant-20a-path',
        userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
        assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
        ...(stateUpdate ? { stateUpdate } : {}),
      });

      // State mutation for travel fields is complete before reply generation;
      // previous input state is not mutated by rendering.
      expect(previous).toEqual(previousSnapshot);

      const classification = classifyConversationStateChange(
        previous,
        result.state,
      );
      const plan = createConversationReplyPlan({
        state: result.state,
        classification,
      });
      const expected = expectedActivatedBaselineReply(plan);
      const baseline = generateBaselineConversationalReply(plan);

      // Current production reply source = activated baseline expression.
      expect(result.reply).toBe(expected);
      expect(result.reply).toBe(baseline);
      expect(result.reply).toBe(result.state.transcript.at(-1)?.message);

      // Reply-plan shape is what rendering consumes (one ack max, one follow-up slot).
      expect(plan.acknowledgements.length).toBeLessThanOrEqual(1);
      expect(
        plan.followUpQuestion === null ||
          typeof plan.followUpQuestion === 'string',
      ).toBe(true);

      // One reply returned; single-question invariant.
      expect(typeof result.reply).toBe('string');
      expect(result.reply.length).toBeGreaterThan(0);
      assertSingleSelectedQuestion(result.reply);

      // Pure re-render from the same plan does not require state and matches.
      expect(generateBaselineConversationalReply(plan)).toBe(result.reply);
      expect(expectedActivatedBaselineReply(plan)).toBe(result.reply);

      // Plan assembly path through generateConversationReply matches production.
      const fromGenerate = generateConversationReply({
        message,
        state: result.state,
        previousState: previous,
      });
      expect(fromGenerate).toBe(result.reply);
    },
  );

  it('acknowledgement-only plan shape remains parity-equivalent through activated baseline', () => {
    // Force a completed passenger party with no outstanding follow-up beyond
    // neutral, then remove a non-travel concern is unnecessary — use destination
    // set with all later gaps already filled so ack+neutral may apply.
    const t = turn('Cairns', {
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      flightsRequested: true,
    });
    expect(t.result.reply).toBe(t.expected);
    expect(t.result.reply).toBe(t.baseline);
    assertSingleSelectedQuestion(t.result.reply);
  });

  it('proves rendering does not mutate conversation state fields', () => {
    const previous = createState({
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      flightsRequested: true,
    });
    const result = processConversationTurn({
      message: '0 children',
      state: previous,
      userEntryId: 'user-20a-pure',
      assistantEntryId: 'assistant-20a-pure',
      userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    });
    const classification = classifyConversationStateChange(
      previous,
      result.state,
    );
    const plan = createConversationReplyPlan({
      state: result.state,
      classification,
    });
    const planBefore = structuredClone(plan);
    const stateBeforeRender = structuredClone({
      adultCount: result.state.adultCount,
      childCount: result.state.childCount,
      infantCount: result.state.infantCount,
      destination: result.state.destination,
      flightsRequested: result.state.flightsRequested,
    });

    const again = generateBaselineConversationalReply(plan);
    expect(again).toBe(result.reply);
    expect(plan).toEqual(planBefore);
    expect({
      adultCount: result.state.adultCount,
      childCount: result.state.childCount,
      infantCount: result.state.infantCount,
      destination: result.state.destination,
      flightsRequested: result.state.flightsRequested,
    }).toEqual(stateBeforeRender);
  });

  it('proves state mutation occurs before rendering for multi-passenger and zero counts', () => {
    const multi = turn('2 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(multi.result.state.adultCount).toBe(2);
    expect(multi.result.state.childCount).toBe(1);
    expect(multi.result.state.infantCount).toBeNull();
    expect(multi.classification.hasInterpretedChange).toBe(true);
    expect(multi.result.reply).toBe(multi.expected);

    const zeroChild = turn('no children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      infantCount: null,
      flightsRequested: true,
    });
    expect(zeroChild.result.state.childCount).toBe(0);
    expect(zeroChild.result.reply).toBe(zeroChild.expected);

    const zeroInfant = turn('no infants', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 0,
      infantCount: null,
      flightsRequested: true,
    });
    expect(zeroInfant.result.state.infantCount).toBe(0);
    expect(zeroInfant.result.reply).toBe(zeroInfant.expected);
  });

  it('keeps deterministic renderer available as fallback contract (not deleted)', () => {
    const generate = readSrc(
      'src/features/conversation-core/generateConversationReply.ts',
    );
    expect(generate).toMatch(/export function renderConversationReplyPlan/);
    const modeDriven = readSrc(
      'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
    );
    expect(modeDriven).toMatch(
      /catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );

    const plan = createConversationReplyPlan({
      state: createState({ destination: 'Cairns' }),
      classification: classifyConversationStateChange(
        createState(),
        createState({ destination: 'Cairns' }),
      ),
    });
    expect(typeof renderConversationReplyPlan(plan)).toBe('string');
  });
});
