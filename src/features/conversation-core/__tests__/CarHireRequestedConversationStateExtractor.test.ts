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
import { CarHireRequestedConversationStateExtractor } from '../CarHireRequestedConversationStateExtractor';

const ROOT = process.cwd();
const CAR_HIRE_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/CarHireRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5t',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    flightsRequested: true,
    accommodationRequested: true,
    carHireRequested: true,
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

describe('phase 5T — CarHireRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<CarHireRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<CarHireRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<CarHireRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new CarHireRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'I need car hire',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear carHireRequested from car-hire-like message text', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();
    const withCarHire = createState({
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutCarHire = createState({
      carHireRequested: false,
      accommodationRequested: true,
      flightsRequested: true,
    });

    const messages = [
      'I need car hire',
      'book me a rental car',
      'find a hire car',
      'I need a vehicle',
      'I want to drive',
      'pick up the car at the airport',
      'drop it off on Monday',
      'airport pickup please',
      'I need an SUV',
      'find me a 4WD',
      'a ute would be better',
      'book a van',
      'flights accommodation and car hire',
      'yes add car hire',
      'actually add a rental car',
      'do not book a car',
      'no car hire',
      'remove the car',
      'forget car hire',
      'I will use public transport instead',
      'keep the hotel but remove the rental car',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ carHireRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withCarHire,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutCarHire,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the rental car',
      currentState: withCarHire,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withCarHire.carHireRequested).toBe(true);
    expect(withoutCarHire.carHireRequested).toBe(false);
    expect(withCarHire.accommodationRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'I want to drive',
        currentState: createState({ carHireRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          carHireRequested: false,
          accommodationRequested: true,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();
    const currentState = createState({
      carHireRequested: true,
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
      message: 'book me a rental car',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.carHireRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new CarHireRequestedConversationStateExtractor() as CarHireRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as CarHireRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(CAR_HIRE_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/carHireRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|rental|SUV|4WD|pickup|drop-?off/i,
    );
    expect(source).not.toMatch(/provider|search|discovery|travel-location|hertz|avis/i);
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
      CAR_HIRE_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/CarHireRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'CarHireRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/CarHireRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new CarHireRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('CarHireRequestedConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('keeps processor carHireRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'actually add a rental car',
      state: currentState,
      userEntryId: 'user-5t',
      assistantEntryId: 'assistant-5t',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { carHireRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no car hire',
      state: currentState,
      userEntryId: 'user-5t-b',
      assistantEntryId: 'assistant-5t-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { carHireRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove the car',
      state: currentState,
      userEntryId: 'user-5t-c',
      assistantEntryId: 'assistant-5t-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { carHireRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'I need car hire and an SUV',
      state: currentState,
      userEntryId: 'user-5t-d',
      assistantEntryId: 'assistant-5t-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const accommodationInjected = processConversationTurn({
      message: 'add hotel',
      state: currentState,
      userEntryId: 'user-5t-e',
      assistantEntryId: 'assistant-5t-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { accommodationRequested: false },
    });

    expect(injected.state.carHireRequested).toBe(true);
    expect(cleared.state.carHireRequested).toBe(false);
    expect(nullCleared.state.carHireRequested).toBeNull();
    expect(messageOnly.state.carHireRequested).toBe(true);
    expect(accommodationInjected.state.accommodationRequested).toBe(false);
    expect(accommodationInjected.state.carHireRequested).toBe(true);
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
