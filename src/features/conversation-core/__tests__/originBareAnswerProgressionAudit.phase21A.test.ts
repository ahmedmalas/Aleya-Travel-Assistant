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
  it('locks origin extractor ownership: registered; Phase 21B adds active-origin bare path', () => {
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

    // Phase 21A root cause: cue-only extraction. Phase 21B repaired bare
    // answers via isOriginFollowUpActive — history retained in phase21A doc.
    expect(originSource).toMatch(/Phase 21B/);
    expect(originSource).toMatch(/isOriginFollowUpActive/);
    expect(originSource).toMatch(/\\bfrom\\s\+\(\.\+\)\$\/i/);
    expect(originSource).not.toMatch(
      /import \{[^}]*selectConversationFollowUpQuestion/,
    );

    // Active panel uses Consultant Turn Governor with in-memory state hydration.
    expect(panel).toMatch(/runConsultantTurn\(/);
    expect(panel).toMatch(/state:\s*coreState/);
    expect(panel).toMatch(/setCoreState\(result\.state\)/);
    expect(panel).toMatch(/Persistence:\s*disabled/);
    expect(panel).not.toMatch(/persistenceUsed/);
  });

  it('Melbourne → Sydney.: Phase 21B corrected — bare origin extracts and advances', () => {
    // Phase 21A characterized the pre-fix loop (origin stayed null; origin
    // question repeated). Phase 21B replaces that production expectation.
    let s = createState();
    let t = turn('I want to go to Melbourne.', s, 0);
    expect(t.result.state.destination).toBe('Melbourne');
    expect(t.result.state.origin).toBeNull();
    expect(t.result.reply).toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(ORIGIN_Q);
    expect(t.result.trace.persistenceUsed).toBe(false);
    expect(t.result.trace.turnCount).toBe(1);

    s = t.result.state;
    expect(s.destination).toBe('Melbourne');
    expect(s.origin).toBeNull();

    t = turn('Sydney.', s, 1);
    expect(t.isolatedOrigin).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(t.compositeExtraction.stateUpdate.origin).toBe('Sydney');
    expect(t.extractionTransition.hasStateChanged).toBe(true);
    expect(t.extractionTransition.nextState.origin).toBe('Sydney');
    expect(t.extractionTransition.nextState.destination).toBe('Melbourne');

    expect(t.result.state.origin).toBe('Sydney');
    expect(t.result.state.destination).toBe('Melbourne');
    expect(t.result.trace.messageInterpreted).toBe(true);
    expect(t.result.trace.turnCount).toBe(2);
    expect(t.result.reply).toContain(DEPARTURE_Q);
    expect(t.result.reply).not.toContain(ORIGIN_Q);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(DEPARTURE_Q);
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

  it('Melbourne → Sydney → Sydney: first bare sets origin; second does not overwrite', () => {
    // Phase 21A expected both turns uninterpreted (loop). Phase 21B: first
    // bare succeeds; once origin is set, bare place no longer owns the field.
    let s = createState();
    let t = turn('I want to go to Melbourne.', s, 0);
    s = t.result.state;
    t = turn('Sydney', s, 1);
    expect(t.result.state.origin).toBe('Sydney');
    expect(t.result.trace.messageInterpreted).toBe(true);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(DEPARTURE_Q);
    s = t.result.state;
    t = turn('Sydney', s, 2);
    expect(t.result.state.origin).toBe('Sydney');
    expect(t.result.trace.messageInterpreted).toBe(false);
    expect(selectConversationFollowUpQuestion(t.result.state)).toBe(DEPARTURE_Q);
  });

  it('blast radius: bare destination fixed in 21D; bare dates still fail; bare passengers succeed', () => {
    // Bare destination (no cue) — Phase 21D repairs this path.
    let t = turn('Melbourne', createState(), 0);
    expect(t.result.state.destination).toBe('Melbourne');
    expect(t.result.trace.messageInterpreted).toBe(true);

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
    // Phase 21B: bare place when origin follow-up is active.
    const bareActive = extractConversationState({
      message: 'Hobart',
      currentState: createState({ destination: 'Melbourne', origin: null }),
    });
    expect(bareActive.stateUpdate.origin).toBe('Hobart');
    // Guard: bare place when destination still required does not set origin.
    // Phase 21D: destination extractor may claim the bare place instead.
    const bareInactive = extractConversationState({
      message: 'Hobart',
      currentState: createState({ destination: null, origin: null }),
    });
    expect(bareInactive.stateUpdate.origin).toBeUndefined();
    expect(bareInactive.stateUpdate.destination).toBe('Hobart');
    void composite;
  });
});
