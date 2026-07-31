import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import {
  generateConversationReply,
  type GenerateConversationReplyInput,
} from '../generateConversationReply';
import { generateIntegratedConversationReply } from '../generateIntegratedConversationReply';

/**
 * Phase 14A — controlled runtime integration seam characterisation.
 *
 * Proves generateIntegratedConversationReply is a pure, behaviour-identical
 * delegate to generateConversationReply with no conversational-layer wiring.
 */

const ROOT = process.cwd();
const INTEGRATED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateIntegratedConversationReply.ts',
);
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-14a',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function replyInput(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
  message = 'phase-14a',
): GenerateConversationReplyInput {
  return { message, previousState, state };
}

describe('phase 14A — generateIntegratedConversationReply', () => {
  it('is an internal-only pure delegate with no conversational-layer wiring', () => {
    const source = readFileSync(INTEGRATED_SOURCE, 'utf8');

    expect(source).toMatch(/export function generateIntegratedConversationReply/);
    expect(source).toMatch(/return generateConversationReply\(input\)/);
    expect(source.includes('generateBaselineConversationalReply')).toBe(false);
    expect(source.includes('renderBaselineConversational')).toBe(false);
    expect(source.includes('buildConversationalLayerInput')).toBe(false);
    expect(source.includes('executeConversationalLayerRenderer')).toBe(false);
    expect(source.includes('createBaselineConversationalRendererRegistry')).toBe(
      false,
    );
    expect(source.includes('featureFlag')).toBe(false);
    expect(source.includes('if (')).toBe(false);
    expect(source.includes('switch (')).toBe(false);

    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'generateIntegratedConversationReply',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'generateIntegratedConversationReply',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'generateConversationReply',
      ),
    ).toBe(true);
  });

  it('delegates directly to generateConversationReply with exact output parity', () => {
    const cases: Array<{
      label: string;
      previous: ConversationCoreState;
      state: ConversationCoreState;
    }> = [
      {
        label: 'empty → destination',
        previous: createState(),
        state: createState({ destination: 'Brisbane' }),
      },
      {
        label: 'destination → origin',
        previous: createState({ destination: 'Brisbane' }),
        state: createState({ destination: 'Brisbane', origin: 'Sydney' }),
      },
      {
        label: 'core complete → flights requested',
        previous: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '12 March',
          returnDate: '20 March',
          adultCount: 2,
        }),
        state: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '12 March',
          returnDate: '20 March',
          adultCount: 2,
          flightsRequested: true,
        }),
      },
      {
        label: 'unchanged complete state',
        previous: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '12 March',
          returnDate: '20 March',
          adultCount: 2,
          flightsRequested: true,
        }),
        state: createState({
          destination: 'Brisbane',
          origin: 'Sydney',
          departureDate: '12 March',
          returnDate: '20 March',
          adultCount: 2,
          flightsRequested: true,
        }),
      },
      {
        label: 'empty → empty',
        previous: createState(),
        state: createState(),
      },
    ];

    for (const entry of cases) {
      const input = replyInput(entry.previous, entry.state);
      const previousBefore = structuredClone(entry.previous);
      const stateBefore = structuredClone(entry.state);

      const authoritative = generateConversationReply(input);
      const integrated = generateIntegratedConversationReply(input);
      const integratedAgain = generateIntegratedConversationReply(input);

      expect(integrated, entry.label).toBe(authoritative);
      expect(integratedAgain, `${entry.label} / repeat`).toBe(authoritative);
      expect(typeof integrated).toBe('string');
      expect(entry.previous, `${entry.label} / previous unchanged`).toEqual(
        previousBefore,
      );
      expect(entry.state, `${entry.label} / state unchanged`).toEqual(
        stateBefore,
      );
    }
  });
});
