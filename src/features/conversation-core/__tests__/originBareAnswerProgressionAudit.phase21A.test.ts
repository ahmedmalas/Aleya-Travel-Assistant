import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { extractConversationState } from '../extractConversationState';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { transitionConversationStateFromExtraction } from '../transitionConversationStateFromExtraction';

/**
 * Phase 21A — origin bare-answer progression failure audit (characterization only).
 *
 * Proves the Melbourne → bare Sydney loop through processConversationTurn.
 * Does not change production behaviour.
 */

const ROOT = process.cwd();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ORIGIN_Q = FOLLOW_UPS.origin;
const DEPARTURE_Q = FOLLOW_UPS.departureDate;

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-21a-origin-bare',
      now: new Date('2026-08-01T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(message: string, state: ConversationCoreState, index: number) {
  const previous = structuredClone(state);
  const extractionTransition = transitionConversationStateFromExtraction({
    message,
    currentState: state,
  });
  const isolatedOrigin = new OriginConversationStateExtractor().extract({
    message,
    currentState: state,
  });
  const compositeExtraction = extractConversationState({
    message,
    currentState: state,
  });
  const result = processConversationTurn({
    message,
    state,
    userEntryId: `user-21a-${index}`,
    assistantEntryId: `assistant-21a-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index * 2 + 1)),
  });
  return {
    previous,
    result,
    extractionTransition,
    isolatedOrigin,
    compositeExtraction,
  };
}

describe('Phase 21A — origin bare-answer progression failure audit', () => {
  it('locks origin extractor ownership: registered, cue-only, no currentState bare path', () => {
    const factory = readSrc(
      'src/features/conversation-core/createConversationStateExtractor.ts',
    );
    const originSource = readSrc(
      'src/features/conversation-core/OriginConversationStateExtractor.ts',
    );
    const panel = readSrc('src/components/trip-platform/AiPlanningPanel.tsx');

    expect(factory).toMatch(/new OriginConversationStateExtractor\(\)/);
    expect(factory).toMatch(
      /new DestinationConversationStateExtractor\(\),\s*new OriginConversationStateExtractor\(\)/,
    );

    expect(originSource).toMatch(/no[\s\S]*currentState inspection/i);
    expect(originSource).toMatch(/\\bfrom\\s\+\(\.\+\)\$\/i/);
    expect(originSource).not.toMatch(/selectConversationFollowUpQuestion/);
    expect(originSource).not.toMatch(/BarePlace/);

    // Active panel uses processConversationTurn with in-memory state hydration.
    expect(panel).toMatch(/processConversationTurn\(/);
    expect(panel).toMatch(/state:\s*coreState/);
    expect(panel).toMatch(/setCoreState\(result\.state\)/);
    expect(panel).toMatch(/Persistence:\s*disabled/);
    expect(panel).not.toMatch(/persistenceUsed/);
  });

  it('Melbourne → Sydney: bare origin does not extract; origin follow-up loops', () => {
    let s = createState();
    let t = turn('I want to go to Melbourne.', s, 0);
    expect(t.result.state.destination).toBe('Melbourne');
    expect(t.result.state.origin).toBeNull();
    expect(t.result.reply).toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(ORIGIN_Q);
    expect(t.result.trace.persistenceUsed).toBe(false);
    expect(t.result.trace.turnCount).toBe(1);

    // Canonical state into first Sydney turn: destination set, origin null.
    s = t.result.state;
    expect(s.destination).toBe('Melbourne');
    expect(s.origin).toBeNull();

    t = turn('Sydney.', s, 1);
    // Extractor invocation: registered origin extractor returns empty update.
    expect(t.isolatedOrigin).toEqual({ stateUpdate: {} });
    expect(t.compositeExtraction.stateUpdate.origin).toBeUndefined();
    expect(t.extractionTransition.extractionResult.stateUpdate.origin).toBeUndefined();
    expect(t.extractionTransition.hasStateChanged).toBe(false);
    expect(t.extractionTransition.nextState.origin).toBeNull();
    expect(t.extractionTransition.nextState.destination).toBe('Melbourne');

    // End-of-turn state: destination preserved; origin still null.
    expect(t.result.state.origin).toBeNull();
    expect(t.result.state.destination).toBe('Melbourne');
    expect(t.result.trace.messageInterpreted).toBe(false);
    expect(t.result.trace.turnCount).toBe(2);
    expect(t.result.reply).toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(ORIGIN_Q);
    // Observed production loop wording (baseline lead-in + catalogue).
    expect(t.result.reply).toBe(
      "Let's begin with where you're travelling from. Where will you be travelling from?",
    );

    // Following turn receives same canonical travel fields.
    s = t.result.state;
    t = turn('Sydney.', s, 2);
    expect(t.previous.origin).toBeNull();
    expect(t.previous.destination).toBe('Melbourne');
    expect(t.result.state.origin).toBeNull();
    expect(t.result.trace.turnCount).toBe(3);
    expect(t.result.reply).toBe(
      "Let's begin with where you're travelling from. Where will you be travelling from?",
    );
  });

  it('Melbourne → from Sydney / travelling-from cue: origin advances to departure', () => {
    let s = createState();
    let t = turn('I want to go to Melbourne.', s, 0);
    s = t.result.state;

    t = turn('from Sydney', s, 1);
    expect(t.isolatedOrigin.stateUpdate).toEqual({ origin: 'Sydney' });
    expect(t.compositeExtraction.stateUpdate.origin).toBe('Sydney');
    expect(t.extractionTransition.nextState.origin).toBe('Sydney');
    expect(t.result.state.origin).toBe('Sydney');
    expect(t.result.trace.messageInterpreted).toBe(true);
    expect(t.result.reply).toContain(DEPARTURE_Q);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(DEPARTURE_Q);

    s = createState();
    t = turn('I want to go to Melbourne.', s, 10);
    s = t.result.state;
    t = turn('I am travelling from Sydney', s, 11);
    expect(t.result.state.origin).toBe('Sydney');
    expect(t.result.reply).toContain(DEPARTURE_Q);
  });

  it('Melbourne → Sydney → Sydney: repeated bare origin remains uninterpreted', () => {
    let s = createState();
    let t = turn('I want to go to Melbourne.', s, 0);
    s = t.result.state;
    t = turn('Sydney', s, 1);
    expect(t.result.state.origin).toBeNull();
    expect(t.result.trace.messageInterpreted).toBe(false);
    s = t.result.state;
    t = turn('Sydney', s, 2);
    expect(t.result.state.origin).toBeNull();
    expect(t.result.trace.messageInterpreted).toBe(false);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(ORIGIN_Q);
  });

  it('blast radius: bare destination/date answers also fail; bare passenger counts succeed', () => {
    // Bare destination (no cue) — same ownership gap class.
    let t = turn('Melbourne', createState(), 0);
    expect(t.result.state.destination).toBeNull();
    expect(t.result.trace.messageInterpreted).toBe(false);

    // Bare departure date when origin complete.
    t = turn(
      '28 August 2026',
      createState({ destination: 'Melbourne', origin: 'Sydney' }),
      1,
    );
    expect(t.result.state.departureDate).toBeNull();
    expect(t.result.trace.messageInterpreted).toBe(false);

    // Bare return date when departure complete.
    t = turn(
      '1 September 2026',
      createState({
        destination: 'Melbourne',
        origin: 'Sydney',
        departureDate: '2026-08-28',
      }),
      2,
    );
    expect(t.result.state.returnDate).toBeNull();
    expect(t.result.trace.messageInterpreted).toBe(false);

    // Bare adult / guest counts — Phase 19I path works.
    t = turn(
      '2',
      createState({
        destination: 'Melbourne',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-01',
        flightsRequested: true,
        adultCount: null,
      }),
      3,
    );
    expect(t.result.state.adultCount).toBe(2);
    expect(t.result.trace.messageInterpreted).toBe(true);

    t = turn(
      '2',
      createState({
        destination: 'Melbourne',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-01',
        accommodationRequested: true,
        adultCount: null,
      }),
      4,
    );
    expect(t.result.state.adultCount).toBe(2);
    expect(t.result.trace.messageInterpreted).toBe(true);
  });

  it('persistenceUsed false does not reset in-memory destination across turns', () => {
    let s = createState();
    let t = turn('I want to go to Melbourne.', s, 0);
    expect(t.result.trace.persistenceUsed).toBe(false);
    s = t.result.state;
    t = turn('Sydney.', s, 1);
    expect(t.result.trace.persistenceUsed).toBe(false);
    expect(t.result.state.destination).toBe('Melbourne');
    expect(t.result.state.turnCount).toBe(2);
    expect(t.result.state.transcript).toHaveLength(4);
  });

  it('composite factory still includes OriginConversationStateExtractor instance', () => {
    const composite = createConversationStateExtractor() as unknown as {
      extractors?: unknown[];
    };
    // Production composite is opaque; prove via extract path instead.
    const withCue = extractConversationState({
      message: 'from Hobart',
      currentState: createState({ destination: 'Melbourne' }),
    });
    expect(withCue.stateUpdate.origin).toBe('Hobart');
    const bare = extractConversationState({
      message: 'Hobart',
      currentState: createState({ destination: 'Melbourne' }),
    });
    expect(bare.stateUpdate.origin).toBeUndefined();
    void composite;
  });
});
