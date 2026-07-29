import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as conversationCore from '../index';
import * as extractorFactory from '../createConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { extractConversationState } from '../extractConversationState';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
  type ConversationStateExtractionResult,
  type ConversationStateExtractor,
} from '../types';

const ROOT = process.cwd();
const EXECUTION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractConversationState.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5f',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    ...overrides,
  };
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') {
        continue;
      }
      files.push(...listSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('phase 5F — extractConversationState execution only', () => {
  it('accepts exactly one ConversationStateExtractionInput argument', () => {
    expectTypeOf(extractConversationState).parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf(extractConversationState).returns.toEqualTypeOf<ConversationStateExtractionResult>();
  });

  it('accepts valid input and returns exactly an empty explicit update', () => {
    const input: ConversationStateExtractionInput = {
      message: 'Take me somewhere tropical',
      currentState: createState(),
    };

    expect(extractConversationState(input)).toEqual({ stateUpdate: {} });
  });

  it('returns the same empty value for different message text', () => {
    const currentState = createState();

    expect(
      extractConversationState({ message: 'Sydney to Brisbane', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractConversationState({ message: 'Forget everything', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('returns the same empty value for different canonical state', () => {
    expect(
      extractConversationState({ message: 'hello', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractConversationState({
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

  it('extracts origin, adult count, flights, and accommodation requests from explicit from-route wording without inventing other fields', () => {
    const result = extractConversationState({
      message:
        'From Sydney to Cairns on 28 August for two adults; book flights, hotel and activities',
      currentState: createState(),
    });

    expect(result).toEqual({
      stateUpdate: {
        origin: 'Sydney',
        adultCount: 2,
        flightsRequested: true,
        accommodationRequested: true,
      },
    });
    expect(result.stateUpdate).not.toHaveProperty('destination');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
  });

  it('does not copy existing canonical travel values into the result', () => {
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

    const result = extractConversationState({
      message: 'keep it',
      currentState,
    });

    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toEqual(
      expect.objectContaining({ destination: 'Cairns' }),
    );
  });

  it('does not mutate the input object or canonical state', () => {
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

    expect(() => extractConversationState(input)).not.toThrow();
    expect(input).toEqual(beforeInput);
    expect(currentState).toEqual(beforeInput.currentState);
  });

  it('returns separate result and stateUpdate objects for separate calls', () => {
    const input: ConversationStateExtractionInput = {
      message: 'anything',
      currentState: createState(),
    };

    const first = extractConversationState(input);
    const second = extractConversationState(input);

    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(first).toEqual(second);
  });

  it('retains no extraction state between calls', () => {
    const first = extractConversationState({
      message: 'Go to Brisbane',
      currentState: createState({ destination: 'Sydney' }),
    });
    expect(first).toEqual({ stateUpdate: { destination: 'Brisbane' } });
    first.stateUpdate.destination = 'mutated outside extractor';

    const second = extractConversationState({
      message: 'Go to Cairns',
      currentState: createState({ destination: 'Melbourne' }),
    });

    expect(second).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(second.stateUpdate).not.toBe(first.stateUpdate);

    const unsupported = extractConversationState({
      message: 'Brisbane',
      currentState: createState({ destination: 'Perth' }),
    });
    expect(unsupported).toEqual({ stateUpdate: {} });
    expect(unsupported.stateUpdate).not.toHaveProperty('destination');
  });

  it('delegates through createConversationStateExtractor without duplicating empty logic', () => {
    const source = readFileSync(EXECUTION_SOURCE, 'utf8');

    expect(source).toMatch(/createConversationStateExtractor\(\)/);
    expect(source).toMatch(/extractor\.extract\(input\)/);
    expect(source).not.toMatch(/new EmptyConversationStateExtractor/);
    expect(source).not.toMatch(/EmptyConversationStateExtractor/);
    expect(source).not.toMatch(/stateUpdate:\s*\{\s*\}/);
  });

  it('creates a fresh extractor, passes the original input, calls extract once, and returns the result directly', () => {
    const input: ConversationStateExtractionInput = {
      message: 'delegation probe',
      currentState: createState(),
    };
    const delegatedResult: ConversationStateExtractionResult = {
      stateUpdate: {},
    };
    const extract = vi.fn(
      (_received: ConversationStateExtractionInput): ConversationStateExtractionResult =>
        delegatedResult,
    );
    const firstExtractor: ConversationStateExtractor = { extract };
    const secondExtract = vi.fn(
      (_received: ConversationStateExtractionInput): ConversationStateExtractionResult => ({
        stateUpdate: {},
      }),
    );
    const secondExtractor: ConversationStateExtractor = { extract: secondExtract };

    const factorySpy = vi
      .spyOn(extractorFactory, 'createConversationStateExtractor')
      .mockReturnValueOnce(firstExtractor)
      .mockReturnValueOnce(secondExtractor);

    const firstResult = extractConversationState(input);
    const secondResult = extractConversationState(input);

    expect(factorySpy).toHaveBeenCalledTimes(2);
    expect(factorySpy.mock.results[0]?.value).toBe(firstExtractor);
    expect(factorySpy.mock.results[1]?.value).toBe(secondExtractor);
    expect(firstExtractor).not.toBe(secondExtractor);

    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledWith(input);
    expect(extract.mock.calls[0]?.[0]).toBe(input);

    expect(secondExtract).toHaveBeenCalledTimes(1);
    expect(secondExtract).toHaveBeenCalledWith(input);

    expect(firstResult).toBe(delegatedResult);
    expect(secondResult).not.toBe(firstResult);
    expect(Object.keys(firstResult)).toEqual(['stateUpdate']);
    expect(firstResult).not.toHaveProperty('metadata');
    expect(firstResult).not.toHaveProperty('confidence');
    expect(firstResult).not.toHaveProperty('warnings');
  });

  it('keeps extraction runtime off the public index', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );

    expect(index).not.toMatch(/extractConversationState/);
    expect(index).not.toMatch(/createConversationStateExtractor/);
    expect(index).not.toMatch(/EmptyConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('extractConversationState');
    expect(conversationCore).not.toHaveProperty('createConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('EmptyConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('defaultExtractor');
    expect(conversationCore).not.toHaveProperty('conversationStateExtractor');
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);
    expect(index).not.toMatch(/export function extract/);
  });

  it('keeps processConversationTurn unchanged as the only public runtime processor', () => {
    const processTurn = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
          'function' && name !== 'createInitialConversationCoreState',
    );

    expect(processTurn).not.toMatch(/extractConversationState/);
    expect(processTurn).not.toMatch(/createConversationStateExtractor/);
    expect(processTurn).not.toMatch(/EmptyConversationStateExtractor/);
    expect(runtimeExports).toEqual(['processConversationTurn']);
    expect(typeof conversationCore.processConversationTurn).toBe('function');
  });

  it('is not imported by processor or application files', () => {
    const allowed = new Set([
      EXECUTION_SOURCE,
      resolve(ROOT, 'src/features/conversation-core/extractAndApplyConversationState.ts'),
      resolve(
        ROOT,
        'src/features/conversation-core/transitionConversationStateFromExtraction.ts',
      ),
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowed.has(path),
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('extractConversationState'), file).toBe(false);
    }

    // Real empty extractor path still works when factory is not mocked.
    const live = extractConversationState({
      message: 'live path',
      currentState: createState(),
    });
    expect(live).toEqual({ stateUpdate: {} });
    expect(new EmptyConversationStateExtractor().extract({
      message: 'direct',
      currentState: createState(),
    })).toEqual({ stateUpdate: {} });
  });
});
