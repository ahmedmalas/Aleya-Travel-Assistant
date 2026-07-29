import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as conversationCore from '../index';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
  type ConversationStateExtractionResult,
  type ConversationStateExtractor,
} from '../index';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';

const ROOT = process.cwd();
const FLIGHTS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/FlightsRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5r',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    flightsRequested: true,
    accommodationRequested: false,
    transcript: [
      {
        id: 'user-0',
        role: 'user',
        message: 'seed',
        timestamp: '2026-07-29T00:00:00.000Z',
      },
    ],
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

describe('phase 5R — FlightsRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<FlightsRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<FlightsRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<FlightsRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new FlightsRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'I need flights',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear flightsRequested from flight-like message text', () => {
    const extractor = new FlightsRequestedConversationStateExtractor();
    const withFlights = createState({
      flightsRequested: true,
      accommodationRequested: true,
    });
    const withoutFlights = createState({
      flightsRequested: false,
      accommodationRequested: true,
    });

    const messages = [
      'I need flights',
      'book me a flight',
      'find airfare',
      'I want to fly',
      'Qantas flights please',
      'departing from Sydney Airport',
      'return flights as well',
      'flights and accommodation',
      'yes add flights',
      'actually add flights',
      'do not book flights',
      'no flights',
      'remove the flights',
      'forget flights',
      'keep the hotel but remove flights',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ flightsRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withFlights,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutFlights,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep flights',
      currentState: withFlights,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(withFlights.flightsRequested).toBe(true);
    expect(withoutFlights.flightsRequested).toBe(false);
    expect(withFlights.accommodationRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new FlightsRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'I want to fly',
        currentState: createState({ flightsRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          flightsRequested: false,
          accommodationRequested: true,
          carHireRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new FlightsRequestedConversationStateExtractor();
    const currentState = createState({
      flightsRequested: true,
      transcript: [
        {
          id: 'user-0',
          role: 'user',
          message: 'seed',
          timestamp: '2026-07-29T00:00:00.000Z',
        },
      ],
    });
    const input: ConversationStateExtractionInput = {
      message: 'book me a flight',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.flightsRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new FlightsRequestedConversationStateExtractor() as FlightsRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as FlightsRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(FLIGHTS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/flightsRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|airline|airfare/i,
    );
    expect(source).not.toMatch(/provider|search|discovery|travel-location|qantas/i);
    expect(source).not.toMatch(/metadata|confidence|warnings/);
    expect(source).not.toMatch(/from '\.\.\/|from '\.\.\/\.\.\//);
  });

  it('stays off the public index and is only constructed by the factory', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const processTurn = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
      'utf8',
    );
    const allowedConstruct = new Set([
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      FLIGHTS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/FlightsRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'FlightsRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/FlightsRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new FlightsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('FlightsRequestedConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('keeps processor flightsRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      flightsRequested: true,
      accommodationRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'actually add flights',
      state: currentState,
      userEntryId: 'user-5r',
      assistantEntryId: 'assistant-5r',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { flightsRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no flights',
      state: currentState,
      userEntryId: 'user-5r-b',
      assistantEntryId: 'assistant-5r-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { flightsRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove the flights',
      state: currentState,
      userEntryId: 'user-5r-c',
      assistantEntryId: 'assistant-5r-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { flightsRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'I need flights and airfare',
      state: currentState,
      userEntryId: 'user-5r-d',
      assistantEntryId: 'assistant-5r-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const accommodationInjected = processConversationTurn({
      message: 'add accommodation',
      state: currentState,
      userEntryId: 'user-5r-e',
      assistantEntryId: 'assistant-5r-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { accommodationRequested: true },
    });

    expect(injected.state.flightsRequested).toBe(true);
    expect(cleared.state.flightsRequested).toBe(false);
    expect(nullCleared.state.flightsRequested).toBeNull();
    expect(messageOnly.state.flightsRequested).toBe(true);
    expect(accommodationInjected.state.accommodationRequested).toBe(true);
    expect(accommodationInjected.state.flightsRequested).toBe(true);
    expect(injected.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(injected).sort()).toEqual(['reply', 'state', 'trace']);
    expect(Object.keys(injected.trace).sort()).toEqual([
      'assistantMessageRecorded',
      'entryPoint',
      'messageInterpreted',
      'persistenceUsed',
      'stateChanged',
      'stateStatus',
      'turnCount',
      'userMessageRecorded',
    ]);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });
});
