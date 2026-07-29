import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as conversationCore from '../index';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
  type ConversationStateExtractionResult,
  type ConversationStateExtractor,
} from '../types';

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5d',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    ...overrides,
  };
}

describe('phase 5D — EmptyConversationStateExtractor', () => {
  it('implements the extractor contract', () => {
    expectTypeOf<EmptyConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<EmptyConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<EmptyConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();
  });

  it('accepts valid input and returns exactly an empty explicit update', () => {
    const extractor = new EmptyConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'Take me somewhere tropical',
      currentState: createState(),
    };

    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('returns the same empty value for different message text', () => {
    const extractor = new EmptyConversationStateExtractor();
    const currentState = createState();

    expect(
      extractor.extract({ message: 'Sydney to Brisbane', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'Forget everything', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('returns the same empty value for different canonical state', () => {
    const extractor = new EmptyConversationStateExtractor();

    expect(
      extractor.extract({ message: 'hello', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'hello',
        currentState: createState({
          destination: 'Hamilton Island',
          origin: 'Sydney',
          adultCount: 2,
          flightsRequested: true,
          accommodationRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('cannot create an update from user message text', () => {
    const extractor = new EmptyConversationStateExtractor();
    const result = extractor.extract({
      message:
        'From Sydney to Cairns on 28 August for two adults; book flights, hotel and activities',
      currentState: createState(),
    });

    expect(result).toEqual({ stateUpdate: {} });
    expect(Object.keys(result.stateUpdate)).toEqual([]);
  });

  it('does not copy existing canonical travel values into the result', () => {
    const extractor = new EmptyConversationStateExtractor();
    const currentState = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-08-31',
      adultCount: 2,
      childCount: 1,
      flightsRequested: true,
      accommodationRequested: true,
      activitiesRequested: true,
    });

    const result = extractor.extract({ message: 'keep it', currentState });

    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toEqual(
      expect.objectContaining({ destination: 'Cairns' }),
    );
  });

  it('does not mutate the input object or canonical state', () => {
    const extractor = new EmptyConversationStateExtractor();
    const currentState = createState({
      destination: 'Brisbane',
      transcript: [
        {
          id: 'user-1',
          role: 'user',
          message: 'Brisbane',
          timestamp: '2026-07-29T00:00:00.000Z',
        },
      ],
    });
    const input: ConversationStateExtractionInput = {
      message: 'Change it to Cairns',
      currentState,
    };
    const beforeInput = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    expect(() => extractor.extract(input)).not.toThrow();
    expect(input).toEqual(beforeInput);
    expect(currentState).toEqual(beforeInput.currentState);
  });

  it('returns separate result and stateUpdate objects for separate calls', () => {
    const extractor = new EmptyConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'anything',
      currentState: createState(),
    };

    const first = extractor.extract(input);
    const second = extractor.extract(input);

    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(first).toEqual(second);
  });

  it('retains no state between calls', () => {
    const extractor = new EmptyConversationStateExtractor();
    const first = extractor.extract({
      message: 'Go to Brisbane',
      currentState: createState({ destination: 'Sydney' }),
    });
    first.stateUpdate.destination = 'mutated outside extractor';

    const second = extractor.extract({
      message: 'Go to Cairns',
      currentState: createState({ destination: 'Melbourne' }),
    });

    expect(second).toEqual({ stateUpdate: {} });
    expect(second.stateUpdate).not.toHaveProperty('destination');
  });

  it('remains internal and adds no public extraction function', () => {
    const index = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );

    expect(index).not.toMatch(/EmptyConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('EmptyConversationStateExtractor');
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);
    expect(index).not.toMatch(/export function extract/);
  });

  it('keeps processConversationTurn as the only public runtime processor', () => {
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
          'function' && name !== 'createInitialConversationCoreState',
    );

    expect(runtimeExports).toEqual(['processConversationTurn']);
  });
});
