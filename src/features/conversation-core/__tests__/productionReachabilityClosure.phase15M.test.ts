import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import type { ConversationAcknowledgementEvent } from '../conversationAcknowledgementEvent';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import * as baselineModule from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderBaselineAcknowledgementNeutralContinuation } from '../renderBaselineAcknowledgementNeutralContinuation';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
} from '../renderBaselineNeutralContinuation';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 15M — production reachability closure audit.
 *
 * Proves which Phase 15 renderer-supported shapes are currently emitted by
 * production selection→assembly, without bypassing that path for primary
 * assertions. Unreachable shapes remain covered by earlier renderer-surface
 * tests as defensive contracts.
 */

const ROOT = process.cwd();
const ACK_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationAcknowledgement.ts',
);
const COMPONENTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationReplyComponents.ts',
);
const ASSEMBLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/assembleConversationReplyPlan.ts',
);
const CONTINUATION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationContinuationPrompt.ts',
);
const LAYER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-15m',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
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

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-15m',
    assistantEntryId: 'assistant-15m',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
}

function productionPlan(
  previous: ConversationCoreState,
  result: ReturnType<typeof turn>,
) {
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const components = selectConversationReplyComponents({
    state: result.state,
    classification,
  });
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return { classification, components, plan };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('phase 15M — production reachability and Phase 15 closure', () => {
  it('traces the production contracts that bound reachability', () => {
    const ackSource = readFileSync(ACK_SOURCE, 'utf8');
    const components = readFileSync(COMPONENTS_SOURCE, 'utf8');
    const assembly = readFileSync(ASSEMBLY_SOURCE, 'utf8');
    const continuation = readFileSync(CONTINUATION_SOURCE, 'utf8');
    const layer = readFileSync(LAYER_SOURCE, 'utf8');

    // Acknowledgement selection cardinality: selected pair | null → assembled 0..1.
    expect(ackSource).toMatch(/export function selectConversationAcknowledgement/);
    expect(ackSource).toMatch(
      /: SelectedConversationAcknowledgement \| null/,
    );
    expect(ackSource).toMatch(/return null;/);
    expect(assembly).toMatch(
      /acknowledgements:\s*input\.acknowledgement === null \? \[\] : \[input\.acknowledgement\]/,
    );

    // Phase 18B — follow-up always selected from final state; not gated on messageInterpreted.
    expect(components).toContain('Phase 18B');
    expect(components).toContain(
      'const followUpQuestion = selectConversationFollowUpQuestion(state);',
    );
    expect(components).not.toMatch(
      /const followUpQuestion = messageInterpreted\s*\?/,
    );

    // Continuation fills when follow-up is null.
    expect(continuation).toMatch(
      /if \(input\.followUpQuestion !== null\) \{\s*return null;/,
    );
    expect(continuation).toMatch(/return NEUTRAL_TRIP_FALLBACK_REPLY/);

    // Assembly always coalesces follow-up or continuation.
    expect(assembly).toMatch(
      /followUpQuestion: input\.followUpQuestion \?\? input\.continuationPrompt/,
    );

    // Renderer still keeps defensive 15B / multi-ack fall-through arms.
    expect(layer).toMatch(/transformBaselineAcknowledgement/);
    expect(layer).toMatch(/renderBaselineAcknowledgementFollowUp/);
    expect(layer).toMatch(/renderBaselineNeutralContinuation/);
    expect(layer).toMatch(/renderBaselineFollowUpOnly/);
    expect(layer).toMatch(/renderConversationReplyPlan\(plan\)/);
  });

  it('proves production acknowledgement selection emits zero or one acknowledgement', () => {
    const scenarios: Array<{
      label: string;
      message: string;
      previous: ConversationCoreState;
      stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'];
    }> = [
      {
        label: 'no change',
        message: 'hello there',
        previous: createState(),
      },
      {
        label: 'single field',
        message: 'go to Cairns',
        previous: createState(),
      },
      {
        label: 'capability pair in one message',
        message: 'book flights. book a hotel',
        previous: completeCore(),
      },
      {
        label: 'multi-field explicit update',
        message: 'update',
        previous: createState(),
        stateUpdate: { destination: 'Cairns', origin: 'Sydney' },
      },
      {
        label: 'inert flag clear',
        message: 'clear',
        previous: createState({ flightsRequested: true }),
        stateUpdate: { flightsRequested: null },
      },
    ];

    for (const scenario of scenarios) {
      const previous = structuredClone(scenario.previous);
      const result = turn(
        scenario.message,
        scenario.previous,
        scenario.stateUpdate,
      );
      const { classification, components, plan } = productionPlan(
        previous,
        result,
      );
      const selected = selectConversationAcknowledgement(
        result.state,
        classification,
      )?.text ?? null;

      expect(selected, scenario.label).toBe(components.acknowledgement);
      expect(
        selected === null || typeof selected === 'string',
        scenario.label,
      ).toBe(true);
      expect(plan.acknowledgements.length, scenario.label).toBeLessThanOrEqual(
        1,
      );
      expect(plan.acknowledgements.length, scenario.label).toBe(
        selected === null ? 0 : 1,
      );
      expect(plan.acknowledgements.length >= 2, scenario.label).toBe(false);
    }
  });

  it('proves production assembly always emits a specific follow-up or canonical continuation', () => {
    const scenarios: Array<{
      label: string;
      message: string;
      previous: ConversationCoreState;
      stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'];
      expectFollowUp: string;
    }> = [
      {
        label: 'interpreted missing origin',
        message: 'go to Cairns',
        previous: createState(),
        expectFollowUp: FOLLOW_UPS.origin,
      },
      {
        label: 'interpreted complete → catalogue neutral follow-up',
        message: 'Return on 5 September 2026',
        previous: createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-08-28',
        }),
        expectFollowUp: FOLLOW_UPS.neutralContinuation,
      },
      {
        label: 'uninterpreted → continuation coalesced to neutral',
        message: 'thanks',
        previous: completeCore({ flightsRequested: true, adultCount: 2 }),
        expectFollowUp: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      },
      {
        label: 'follow-up-only via inert clear',
        message: 'clear',
        previous: createState({ flightsRequested: true }),
        stateUpdate: { flightsRequested: null },
        expectFollowUp: FOLLOW_UPS.destination,
      },
    ];

    for (const scenario of scenarios) {
      const previous = structuredClone(scenario.previous);
      const result = turn(
        scenario.message,
        scenario.previous,
        scenario.stateUpdate,
      );
      const { components, plan } = productionPlan(previous, result);

      expect(
        components.followUpQuestion !== null ||
          components.continuationPrompt !== null,
        scenario.label,
      ).toBe(true);
      if (components.followUpQuestion !== null) {
        expect(components.continuationPrompt, scenario.label).toBeNull();
        expect(
          selectConversationContinuationPrompt({
            followUpQuestion: components.followUpQuestion,
          }),
          scenario.label,
        ).toBeNull();
      } else {
        expect(components.continuationPrompt, scenario.label).toBe(
          CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
        );
        expect(
          selectConversationFollowUpQuestion(result.state) === null ||
            !components.messageInterpreted,
          scenario.label,
        ).toBe(true);
      }

      expect(plan.followUpQuestion, scenario.label).not.toBeNull();
      expect(plan.followUpQuestion, scenario.label).toBe(scenario.expectFollowUp);
      expect(plan.followUpQuestion, scenario.label).toBe(
        components.followUpQuestion ?? components.continuationPrompt,
      );
    }
  });

  it('proves acknowledgement-only and multi-ack plans are not currently emitted', () => {
    const drives: Array<{
      label: string;
      message: string;
      previous: ConversationCoreState;
      stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'];
    }> = [
      { label: 'dest', message: 'go to Cairns', previous: createState() },
      {
        label: 'origin',
        message: 'from Sydney',
        previous: createState({ destination: 'Cairns' }),
      },
      {
        label: 'flights',
        message: 'I need flights',
        previous: completeCore(),
      },
      {
        label: 'pair',
        message: 'book flights. book a hotel',
        previous: completeCore(),
      },
      {
        label: 'neutral',
        message: 'thanks',
        previous: completeCore({ flightsRequested: true, adultCount: 2 }),
      },
      { label: 'uninterpreted', message: 'hello there', previous: createState() },
      {
        label: 'inert',
        message: 'clear',
        previous: createState({ flightsRequested: true }),
        stateUpdate: { flightsRequested: null },
      },
      {
        label: 'multi-field',
        message: 'update',
        previous: createState(),
        stateUpdate: { destination: 'Cairns', origin: 'Sydney' },
      },
    ];

    for (const drive of drives) {
      const previous = structuredClone(drive.previous);
      const result = turn(drive.message, drive.previous, drive.stateUpdate);
      const { plan } = productionPlan(previous, result);

      // Not 15B: never one ack with null follow-up.
      expect(
        !(
          plan.acknowledgements.length === 1 && plan.followUpQuestion === null
        ),
        drive.label,
      ).toBe(true);

      // Not multi-ack.
      expect(plan.acknowledgements.length < 2, drive.label).toBe(true);

      // Not empty-null: follow-up always filled.
      expect(plan.followUpQuestion, drive.label).not.toBeNull();
    }

    // Assembly contract alone forces the coalescing behaviour.
    const assembledFromAckOnlyComponents = assembleConversationReplyPlan({
      acknowledgement: ACKS.destination('Cairns'),
      acknowledgementEvent: null,
      followUpQuestion: null,
      continuationPrompt: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      messageInterpreted: true,
    });
    expect(assembledFromAckOnlyComponents.acknowledgements).toHaveLength(1);
    expect(assembledFromAckOnlyComponents.followUpQuestion).toBe(
      CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
    );
    expect(assembledFromAckOnlyComponents.followUpQuestion).not.toBeNull();
  });

  it('proves 15C, 15F, 15J, and 16B remain production-reachable', () => {
    // 15C — one ack + specific follow-up
    const previous15C = createState();
    const result15C = turn('go to Cairns', previous15C);
    const plan15C = productionPlan(previous15C, result15C).plan;
    expect(plan15C.acknowledgements).toHaveLength(1);
    expect(plan15C.followUpQuestion).toBe(FOLLOW_UPS.origin);
    expect(result15C.reply).toBe(
      renderBaselineAcknowledgementFollowUp({
        acknowledgement: ACKS.destination('Cairns'),
        followUpQuestion: FOLLOW_UPS.origin,
      }),
    );

    // 16B — one ack + canonical neutral continuation (supersedes prior 15C join)
    const previous16BNeutral = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    const result16BNeutral = turn(
      'Return on 5 September 2026',
      previous16BNeutral,
    );
    const plan16BNeutral = productionPlan(
      previous16BNeutral,
      result16BNeutral,
    ).plan;
    expect(plan16BNeutral.acknowledgements).toHaveLength(1);
    expect(plan16BNeutral.followUpQuestion).toBe(
      FOLLOW_UPS.neutralContinuation,
    );
    expect(result16BNeutral.reply).toBe(
      renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement: ACKS.returnDate('2026-09-05'),
        followUpQuestion: FOLLOW_UPS.neutralContinuation,
      }),
    );

    // 15F — zero acks + supported follow-up
    const previous15F = createState({ flightsRequested: true });
    const result15F = turn('clear', previous15F, { flightsRequested: null });
    const plan15F = productionPlan(previous15F, result15F).plan;
    expect(plan15F.acknowledgements).toEqual([]);
    expect(plan15F.followUpQuestion).toBe(FOLLOW_UPS.destination);
    expect(result15F.reply).toBe(
      renderBaselineFollowUpOnly({
        followUpQuestion: FOLLOW_UPS.destination,
      }),
    );

    // 15J — zero acks + canonical neutral
    const previous15J = completeCore({
      flightsRequested: true,
      adultCount: 2,
    });
    const result15J = turn('thanks', previous15J);
    const plan15J = productionPlan(previous15J, result15J).plan;
    expect(plan15J.acknowledgements).toEqual([]);
    expect(plan15J.followUpQuestion).toBe(CANONICAL_NEUTRAL_CONTINUATION_PROMPT);
    expect(result15J.reply).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
  });

  it('proves fully satisfied and uninterpreted safe states receive canonical neutral continuation', () => {
    const satisfied = turn(
      'thanks',
      completeCore({ flightsRequested: true, adultCount: 2 }),
    );
    expect(satisfied.trace.messageInterpreted).toBe(false);
    expect(satisfied.reply).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(satisfied.reply.endsWith(CANONICAL_NEUTRAL_CONTINUATION_PROMPT)).toBe(
      true,
    );

    // Phase 18B: uninterpreted incomplete state keeps the destination follow-up.
    const uninterpreted = turn('hello there', createState());
    expect(uninterpreted.trace.messageInterpreted).toBe(false);
    expect(uninterpreted.reply).toBe(
      renderBaselineFollowUpOnly({
        followUpQuestion: FOLLOW_UPS.destination,
      }),
    );
  });

  it('proves Phase 14I deterministic fallback remains reachable on baseline failure', () => {
    const previous = createState();
    let captured:
      | {
          acknowledgements: string[];
          acknowledgementEvent: ConversationAcknowledgementEvent;
          followUpQuestion: string | null;
          messageInterpreted: boolean;
        }
      | null = null;

    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation((receivedPlan) => {
      captured = {
        acknowledgements: [...receivedPlan.acknowledgements],
        acknowledgementEvent: receivedPlan.acknowledgementEvent,
        followUpQuestion: receivedPlan.followUpQuestion,
        messageInterpreted: receivedPlan.messageInterpreted,
      };
      throw new Error('forced-baseline-failure:phase15M');
    });

    const result = turn('go to Cairns', previous);
    const { plan } = productionPlan(previous, result);

    expect(captured).toEqual({
      acknowledgements: [...plan.acknowledgements],
      acknowledgementEvent: plan.acknowledgementEvent,
      followUpQuestion: plan.followUpQuestion,
      messageInterpreted: plan.messageInterpreted,
    });
    expect(result.reply).toBe(renderConversationReplyPlan(plan));
    expect(result.reply).toBe(
      `${ACKS.destination('Cairns')}\n${FOLLOW_UPS.origin}`,
    );
    expect(result.reply).not.toBe(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')) +
        ` ${FOLLOW_UPS.origin}`,
    );
  });

  it('keeps defensive renderer-surface contracts for unreachable production shapes', () => {
    // These shapes are not emitted by production assembly/selection, but the
    // conversational layer must still handle them if presented directly.
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Cairns')),
    ).toBe('Great, Cairns it is.');

    const multiAckDeterministic = renderConversationReplyPlan({
      acknowledgements: [ACKS.destination('Cairns'), ACKS.origin('Sydney')],
      acknowledgementEvent: null,
      followUpQuestion: FOLLOW_UPS.departureDate,
      messageInterpreted: true,
    });
    expect(multiAckDeterministic).toBe(
      `${ACKS.destination('Cairns')} ${ACKS.origin('Sydney')}\n${FOLLOW_UPS.departureDate}`,
    );

    const emptyDeterministic = renderConversationReplyPlan({
      acknowledgements: [],
      acknowledgementEvent: null,
      followUpQuestion: null,
      messageInterpreted: false,
    });
    expect(emptyDeterministic).toBe(CANONICAL_NEUTRAL_CONTINUATION_PROMPT);
  });
});
