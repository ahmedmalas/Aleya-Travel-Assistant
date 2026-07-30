import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as conversationCore from '../index';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  generateConversationReply,
} from '../generateConversationReply';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';

const ROOT = process.cwd();
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const REPLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-10b',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

function turn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-10b',
    assistantEntryId: 'assistant-10b',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    stateUpdate,
  });
}

describe('phase 10B/10C — generateConversationReply boundary', () => {
  it('is internal-only and invoked by processConversationTurn after final state precedence', () => {
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const replySource = readFileSync(REPLY_SOURCE, 'utf8');

    expect(replySource).toMatch(/export function generateConversationReply/);
    expect(replySource).toContain('Phase 10B');
    expect(replySource).toContain('Phase 10G');
    expect(replySource).toContain('Phase 10I');
    expect(replySource).toContain('Phase 10J');
    expect(replySource).toContain('Phase 10K');
    expect(replySource).toContain('Phase 10L');
    expect(replySource).toMatch(/selectConversationFollowUpQuestion/);
    expect(replySource).toMatch(/selectConversationAcknowledgement/);
    expect(replySource).toMatch(/selectConversationMessageInterpreted/);
    expect(replySource).toMatch(/selectConversationContinuationPrompt/);
    expect(replySource).toMatch(/CONVERSATION_REPLY_CATALOGUE/);
    expect(replySource).toMatch(/classifyConversationStateChange\(/);
    expect(replySource).toMatch(/createConversationReplyPlan\(/);
    expect(replySource).toMatch(/renderConversationReplyPlan\(/);
    expect(processTurn).toMatch(/generateConversationReply\(/);
    expect(processTurn).toMatch(
      /applyConversationStateUpdate\([\s\S]*generateConversationReply\(/,
    );
    expect(processTurn).toMatch(
      /generateConversationReply\([\s\S]*assistantEntry/,
    );
    expect(processTurn).not.toMatch(/ENGINE_NOT_ASSEMBLED_REPLY/);
    expect(index).not.toMatch(/export\s*\{[^}]*generateConversationReply/);
    expect(index).not.toMatch(/ENGINE_NOT_ASSEMBLED_REPLY/);
    expect(conversationCore).not.toHaveProperty('generateConversationReply');
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });

  it('acknowledges a newly recognised destination and asks for origin', () => {
    const result = turn('go to Cairns', createState());
    expect(result.state.destination).toBe('Cairns');
    expect(result.reply).toBe(
      'Sounds good — Cairns.\nWhere will you be travelling from?',
    );
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.state.transcript.at(-1)?.message).toBe(result.reply);
  });

  it('acknowledges a newly recognised origin and asks for departure date', () => {
    const result = turn('from Sydney', createState({ destination: 'Cairns' }));
    expect(result.state.origin).toBe('Sydney');
    expect(result.reply).toBe(
      'Got it — travelling from Sydney.\nWhen would you like to depart?',
    );
    expect(result.trace.messageInterpreted).toBe(true);
    expect(result.state.transcript.at(-1)?.message).toBe(result.reply);
  });

  it('acknowledges a single newly requested capability with progression', () => {
    const result = turn(
      'add accommodation',
      createState({
        destination: 'Cairns',
        flightsRequested: true,
      }),
    );
    expect(result.state.accommodationRequested).toBe(true);
    expect(result.reply).toBe(
      "I've added accommodation to your trip requirements.\nWhere will you be travelling from?",
    );
    expect(result.trace.messageInterpreted).toBe(true);
  });

  it('acknowledges multiple newly requested capabilities in stable label order', () => {
    const result = turn(
      'show me beaches. show me kayaking. park options',
      createState(),
    );
    expect(result.state.beachesRequested).toBe(true);
    expect(result.state.kayakingRequested).toBe(true);
    expect(result.state.nationalParksRequested).toBe(true);
    expect(result.reply).toBe(
      "I've added beaches, kayaking and national parks to your trip requirements.\nWhere would you like to travel?",
    );
    expect(result.trace.messageInterpreted).toBe(true);
  });

  it('lists flights before accommodation when both are newly requested', () => {
    const result = turn(
      'book flights. book a hotel',
      createState(),
    );
    expect(result.reply).toBe(
      "I've added flights and accommodation to your trip requirements.\nWhere would you like to travel?",
    );
  });

  it('isolates the current turn from requirements already stored in state', () => {
    const previous = createState({
      destination: 'Cairns',
      flightsRequested: true,
      accommodationRequested: false,
    });
    const result = turn('add accommodation', previous);
    expect(result.reply).toBe(
      "I've added accommodation to your trip requirements.\nWhere will you be travelling from?",
    );
    expect(result.reply).not.toMatch(/Cairns|flights/i);
  });

  it('lets explicit stateUpdate changes influence the reply after extraction', () => {
    const overriddenDestination = turn('go to Cairns', createState(), {
      destination: 'Hobart',
    });
    expect(overriddenDestination.state.destination).toBe('Hobart');
    expect(overriddenDestination.reply).toBe(
      'Sounds good — Hobart.\nWhere will you be travelling from?',
    );

    const forcedCapability = turn('Hello', createState(), {
      wildlifeRequested: true,
    });
    expect(forcedCapability.state.wildlifeRequested).toBe(true);
    expect(forcedCapability.reply).toBe(
      "I've added wildlife to your trip requirements.\nWhere would you like to travel?",
    );
    expect(forcedCapability.trace.messageInterpreted).toBe(true);

    const forcedFalse = turn('book flights', createState(), {
      flightsRequested: false,
    });
    expect(forcedFalse.state.flightsRequested).toBe(false);
    expect(forcedFalse.reply).toBe(
      'Got it.\nWhere would you like to travel?',
    );
    expect(forcedFalse.reply).not.toMatch(/flights/);
    expect(forcedFalse.trace.messageInterpreted).toBe(true);
  });

  it('returns the neutral fallback and messageInterpreted false when nothing changes', () => {
    const result = turn('Hello there', createState({ destination: 'Cairns' }));
    expect(result.reply).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(result.trace.messageInterpreted).toBe(false);
    expect(result.state.transcript.at(-1)?.message).toBe(result.reply);
    expect(result.reply).not.toMatch(/assembled|unavailable/i);
  });

  it('prefers capability acknowledgement over destination when both are new', () => {
    const result = turn(
      'book flights. Fly from Sydney to Cairns',
      createState(),
    );
    expect(result.state.flightsRequested).toBe(true);
    expect(result.state.destination).toBe('Cairns');
    expect(result.state.origin).toBe('Sydney');
    expect(result.reply).toBe(
      "I've added flights to your trip requirements.\nWhen would you like to depart?",
    );
  });

  it('generateConversationReply itself uses only current-turn diffs', () => {
    const previousState = createState({
      destination: 'Cairns',
      beachesRequested: true,
      kayakingRequested: false,
    });
    const state = createState({
      destination: 'Cairns',
      beachesRequested: true,
      kayakingRequested: true,
      nationalParksRequested: true,
    });
    expect(
      generateConversationReply({
        message: 'show me kayaking. park options',
        state,
        previousState,
      }),
    ).toBe(
      "I've added kayaking and national parks to your trip requirements.\nWhere will you be travelling from?",
    );
  });

  it('keeps extractor factory order and architecture unchanged', () => {
    const extractors = (
      createConversationStateExtractor() as unknown as {
        extractors: readonly unknown[];
      }
    ).extractors;
    expect(extractors).toHaveLength(28);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[7]).toBeInstanceOf(FlightsRequestedConversationStateExtractor);
    expect(extractors[26]).toBeInstanceOf(
      NationalParksRequestedConversationStateExtractor,
    );
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);
  });
});
