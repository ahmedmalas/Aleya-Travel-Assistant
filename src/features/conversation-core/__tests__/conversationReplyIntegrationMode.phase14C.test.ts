import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  generateConversationReply,
  type GenerateConversationReplyInput,
} from '../generateConversationReply';
import { generateIntegratedConversationReply } from '../generateIntegratedConversationReply';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 14C — explicit deterministic integration-mode characterisation.
 *
 * Proves the runtime seam declares only `'deterministic'`, delegates through
 * an exhaustive switch to generateConversationReply, and does not expose any
 * alternate mode selection path.
 */

const ROOT = process.cwd();
const INTEGRATED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateIntegratedConversationReply.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-14c',
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
  message = 'phase-14c',
): GenerateConversationReplyInput {
  return { message, previousState, state };
}

function turn(
  message: string,
  state: ConversationCoreState,
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-14c',
    assistantEntryId: 'assistant-14c',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
  });
}

describe('phase 14C — conversation reply integration mode', () => {
  it('declares only the deterministic mode and uses an exhaustive internal switch', () => {
    const source = readFileSync(INTEGRATED_SOURCE, 'utf8');

    expect(source).toMatch(
      /type ConversationReplyIntegrationMode = 'deterministic'/,
    );
    expect(source).toMatch(
      /const mode: ConversationReplyIntegrationMode = 'deterministic'/,
    );
    expect(source).toMatch(/switch \(mode\)/);
    expect(source).toMatch(
      /case 'deterministic':\s*return generateConversationReply\(input\)/,
    );

    expect(source.includes("'conversational'")).toBe(false);
    expect(source.includes("'baseline'")).toBe(false);
    expect(source.includes("'experimental'")).toBe(false);
    expect(source.includes('process.env')).toBe(false);
    expect(source.includes('import.meta.env')).toBe(false);
    expect(source.includes('featureFlag')).toBe(false);
    expect(source.includes('mode?:')).toBe(false);
    expect(source.includes('integrationMode')).toBe(false);

    // Function signature accepts only GenerateConversationReplyInput — no mode arg.
    expect(source).toMatch(
      /export function generateIntegratedConversationReply\(\s*input: GenerateConversationReplyInput,\s*\): string/,
    );

    // Exactly one case arm in the mode switch.
    expect(source.match(/case '/g)?.length).toBe(1);
    expect(source.match(/case 'deterministic'/g)?.length).toBe(1);

    expect(readFileSync(INDEX_SOURCE, 'utf8').includes(
      'ConversationReplyIntegrationMode',
    )).toBe(false);
    expect(readFileSync(INDEX_SOURCE, 'utf8').includes(
      'generateIntegratedConversationReply',
    )).toBe(false);
    expect(readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
      'ConversationReplyIntegrationMode',
    )).toBe(false);
  });

  it('keeps the seam free of conversational-layer imports and invocation', () => {
    const source = readFileSync(INTEGRATED_SOURCE, 'utf8');

    expect(source.includes('generateBaselineConversationalReply')).toBe(false);
    expect(source.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(source.includes('buildConversationalLayerInput')).toBe(false);
    expect(source.includes('executeConversationalLayerRenderer')).toBe(false);
    expect(source.includes('createBaselineConversationalRendererRegistry')).toBe(
      false,
    );
    expect(source.includes('invokeConversationalLayerRenderer')).toBe(false);
    expect(source.includes('ConversationalLayerRenderer')).toBe(false);
  });

  it('preserves exact deterministic outputs through the explicit mode branch', () => {
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
    ];

    for (const entry of cases) {
      const input = replyInput(entry.previous, entry.state);
      const previousBefore = structuredClone(entry.previous);
      const stateBefore = structuredClone(entry.state);

      const authoritative = generateConversationReply(input);
      const integrated = generateIntegratedConversationReply(input);

      expect(integrated, entry.label).toBe(authoritative);
      expect(generateIntegratedConversationReply(input), `${entry.label} / repeat`).toBe(
        authoritative,
      );
      expect(entry.previous).toEqual(previousBefore);
      expect(entry.state).toEqual(stateBefore);
    }

    const viaProcessTurn = turn('go to Brisbane', createState());
    expect(viaProcessTurn.reply).toBe(
      `${transformBaselineAcknowledgement(ACKS.destination('Brisbane'))} ${FOLLOW_UPS.origin}`,
    );
  });
});
