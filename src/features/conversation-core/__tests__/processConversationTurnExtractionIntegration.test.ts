import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as conversationCore from '../index';
import * as applyModule from '../applyConversationStateUpdate';
import * as transitionModule from '../transitionConversationStateFromExtraction';
import type { TransitionConversationStateFromExtractionResult } from '../transitionConversationStateFromExtraction';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ProcessConversationTurnResult,
  type ProcessConversationTurnTrace,
} from '../index';

const ROOT = process.cwd();
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function seededState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5i',
      now: CREATED_AT,
    }),
    status: 'active',
    turnCount: 2,
    updatedAt: '2026-07-29T00:00:04.000Z',
    ageMs: 4000,
    destination: 'Brisbane',
    origin: 'Melbourne',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
    adultCount: 2,
    childCount: 1,
    infantCount: 0,
    flightsRequested: true,
    accommodationRequested: false,
    transcript: [
      {
        id: 'user-0',
        role: 'user',
        message: 'seed',
        timestamp: '2026-07-29T00:00:00.000Z',
      },
      {
        id: 'assistant-0',
        role: 'assistant',
        message: 'seed-assistant',
        timestamp: '2026-07-29T00:00:01.000Z',
      },
    ],
    ...overrides,
  };
}

function runTurn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: 'user-5i',
    assistantEntryId: 'assistant-5i',
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('phase 5I — processConversationTurn extraction integration', () => {
  it('calls the extraction transition once with the original message and state', () => {
    const currentState = seededState();
    const order: string[] = [];
    const realApply = applyModule.applyConversationStateUpdate;

    const transitionSpy = vi
      .spyOn(transitionModule, 'transitionConversationStateFromExtraction')
      .mockImplementation(({ message, currentState: received }) => {
        order.push('extract');
        expect(message).toBe('exact message text');
        expect(received).toBe(currentState);
        return {
          extractionResult: { stateUpdate: {} },
          hasStateChanged: false,
          nextState: { ...received },
        };
      });
    const applySpy = vi
      .spyOn(applyModule, 'applyConversationStateUpdate')
      .mockImplementation((state, update) => {
        order.push('apply-explicit');
        return realApply(state, update);
      });

    runTurn('exact message text', currentState, { destination: 'Sydney' });

    expect(transitionSpy).toHaveBeenCalledTimes(1);
    expect(transitionSpy).toHaveBeenCalledWith({
      message: 'exact message text',
      currentState,
    });
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['extract', 'apply-explicit']);
  });

  it('uses transition nextState for explicit update and gives explicit fields precedence', () => {
    const currentState = seededState({
      destination: 'Brisbane',
      origin: 'Melbourne',
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      flightsRequested: true,
      accommodationRequested: false,
      carHireRequested: null,
      activitiesRequested: null,
    });

    vi.spyOn(
      transitionModule,
      'transitionConversationStateFromExtraction',
    ).mockImplementation(({ currentState: received }) => {
      const nextState: ConversationCoreState = {
        ...received,
        destination: 'Cairns',
        origin: 'Hobart',
        departureDate: '2026-10-01',
        returnDate: '2026-10-10',
        adultCount: 4,
        childCount: 3,
        infantCount: 2,
        flightsRequested: false,
        accommodationRequested: true,
        carHireRequested: true,
        activitiesRequested: true,
      };
      return {
        extractionResult: {
          stateUpdate: {
            destination: 'Cairns',
            origin: 'Hobart',
            departureDate: '2026-10-01',
            returnDate: '2026-10-10',
            adultCount: 4,
            childCount: 3,
            infantCount: 2,
            flightsRequested: false,
            accommodationRequested: true,
            carHireRequested: true,
            activitiesRequested: true,
          },
        },
        hasStateChanged: true,
        nextState,
      };
    });

    const overridden = runTurn('ignored extraction text', currentState, {
      destination: 'Sydney',
      origin: 'Perth',
      departureDate: '2026-11-01',
      returnDate: '2026-11-12',
      adultCount: 1,
      childCount: 0,
      infantCount: 0,
      flightsRequested: true,
      accommodationRequested: false,
      carHireRequested: false,
      activitiesRequested: false,
    });

    expect(overridden.state.destination).toBe('Sydney');
    expect(overridden.state.origin).toBe('Perth');
    expect(overridden.state.departureDate).toBe('2026-11-01');
    expect(overridden.state.returnDate).toBe('2026-11-12');
    expect(overridden.state.adultCount).toBe(1);
    expect(overridden.state.childCount).toBe(0);
    expect(overridden.state.infantCount).toBe(0);
    expect(overridden.state.flightsRequested).toBe(true);
    expect(overridden.state.accommodationRequested).toBe(false);
    expect(overridden.state.carHireRequested).toBe(false);
    expect(overridden.state.activitiesRequested).toBe(false);

    const nullOverride = runTurn('null wins', currentState, {
      destination: null,
      flightsRequested: false,
    });
    expect(nullOverride.state.destination).toBeNull();
    expect(nullOverride.state.flightsRequested).toBe(false);
    expect(nullOverride.state.origin).toBe('Hobart');

    const omittedKeepsExtracted = runTurn('omit explicit', currentState);
    expect(omittedKeepsExtracted.state.destination).toBe('Cairns');
    expect(omittedKeepsExtracted.state.origin).toBe('Hobart');
    expect(omittedKeepsExtracted.state.adultCount).toBe(4);
    expect(omittedKeepsExtracted.state.flightsRequested).toBe(false);
  });

  it('does not import lower-level extraction modules or expose extraction metadata', () => {
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const result = runTurn('hello', seededState(), { destination: 'Sydney' });

    expect(processTurn).toMatch(/transitionConversationStateFromExtraction/);
    expect(processTurn).not.toMatch(/EmptyConversationStateExtractor/);
    expect(processTurn).not.toMatch(/createConversationStateExtractor/);
    expect(processTurn).not.toMatch(
      /from '\.\/extractConversationState'|extractConversationState\(/,
    );
    expect(processTurn).not.toMatch(/extractAndApplyConversationState/);
    expect(result).not.toHaveProperty('extractionResult');
    expect(result).not.toHaveProperty('hasStateChanged');
    expect(Object.keys(result).sort()).toEqual(['reply', 'state', 'trace']);
    expectTypeOf(result).toEqualTypeOf<ProcessConversationTurnResult>();
    expectTypeOf(result.trace).toEqualTypeOf<ProcessConversationTurnTrace>();
    expect(Object.keys(result.trace).sort()).toEqual([
      'assistantMessageRecorded',
      'entryPoint',
      'messageInterpreted',
      'persistenceUsed',
      'stateChanged',
      'stateStatus',
      'turnCount',
      'userMessageRecorded',
    ]);
    expect(index).not.toMatch(/transitionConversationStateFromExtraction/);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });

  it('preserves existing empty-extractor runtime behaviour', () => {
    const currentState = seededState();
    const before = structuredClone(currentState);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript[1]);
    Object.freeze(currentState.transcript);

    const result = runTurn(
      'From Sydney to Cairns with flights for three adults',
      currentState,
      { destination: '  Gold Coast!!!!  ', adultCount: 0, flightsRequested: false },
    );

    expect(result.reply).toBe(result.state.transcript.at(-1)?.message);
    expect(result.reply).not.toMatch(/assembled|unavailable/i);
    expect(result.state.destination).toBe('  Gold Coast!!!!  ');
    expect(result.state.origin).toBe('Sydney');
    expect(result.state.departureDate).toBe('2026-09-01');
    expect(result.state.returnDate).toBe('2026-09-08');
    expect(result.state.adultCount).toBe(0);
    expect(result.state.childCount).toBe(1);
    expect(result.state.infantCount).toBe(0);
    expect(result.state.flightsRequested).toBe(false);
    expect(result.state.accommodationRequested).toBe(false);
    expect(result.state.status).toBe('active');
    expect(result.state.turnCount).toBe(3);
    expect(result.state.createdAt).toBe(currentState.createdAt);
    expect(result.state.updatedAt).toBe('2026-07-29T00:00:11.000Z');
    expect(result.state.ageMs).toBe(
      new Date('2026-07-29T00:00:11.000Z').getTime() -
        new Date(currentState.createdAt).getTime(),
    );
    expect(result.state.transcript).toHaveLength(4);
    expect(result.state.transcript[0]).toEqual(before.transcript[0]);
    expect(result.state.transcript[1]).toEqual(before.transcript[1]);
    expect(result.state.transcript[2]).toEqual({
      id: 'user-5i',
      role: 'user',
      message: 'From Sydney to Cairns with flights for three adults',
      timestamp: '2026-07-29T00:00:10.000Z',
    });
    expect(result.state.transcript[3]).toEqual({
      id: 'assistant-5i',
      role: 'assistant',
      message: result.reply,
      timestamp: '2026-07-29T00:00:11.000Z',
    });
    expect(result.reply).toBe(
      "I've removed flights from your trip requirements.\nWhat else should I know about your trip?",
    );
    expect(result.trace).toEqual({
      entryPoint: 'processConversationTurn',
      stateStatus: 'active',
      turnCount: 3,
      stateChanged: true,
      messageInterpreted: true,
      persistenceUsed: false,
      userMessageRecorded: true,
      assistantMessageRecorded: true,
    });

    expect(currentState).toEqual(before);
    expect(currentState.transcript).toEqual(before.transcript);

    const clearedAttempt = runTurn('Forget Brisbane', currentState);
    expect(clearedAttempt.state.destination).toBe('Brisbane');

    const replacedAttempt = runTurn('Actually go to Cairns', currentState);
    expect(replacedAttempt.state.destination).toBe('Cairns');

    const first = runTurn('one', seededState({ destination: 'Hobart' }));
    first.state.destination = 'mutated';
    const second = runTurn('two', seededState({ destination: 'Hobart' }));
    expect(second.state.destination).toBe('Hobart');
  });

  it('passes transition nextState into explicit apply when mocked', () => {
    const currentState = seededState({ destination: 'Brisbane' });
    const nextState: ConversationCoreState = {
      ...currentState,
      destination: 'Cairns',
    };
    const transitionResult: TransitionConversationStateFromExtractionResult = {
      extractionResult: { stateUpdate: { destination: 'Cairns' } },
      hasStateChanged: true,
      nextState,
    };

    vi.spyOn(
      transitionModule,
      'transitionConversationStateFromExtraction',
    ).mockReturnValue(transitionResult);

    const applySpy = vi.spyOn(applyModule, 'applyConversationStateUpdate');

    runTurn('probe', currentState, { destination: 'Sydney' });

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(applySpy.mock.calls[0]?.[0]).toBe(nextState);
    expect(applySpy.mock.calls[0]?.[1]).toEqual({ destination: 'Sydney' });
  });
});
