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
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';

const ROOT = process.cwd();
const DEPARTURE_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/DepartureDateConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5m',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
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

describe('phase 5M — DepartureDateConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<DepartureDateConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<DepartureDateConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<DepartureDateConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new DepartureDateConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'Leave on 2026-10-15',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear departure date from date-like message text', () => {
    const extractor = new DepartureDateConversationStateExtractor();
    const withDeparture = createState({
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
    });

    expect(
      extractor.extract({
        message: 'Departing 15 October 2026',
        currentState: createState({ departureDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Leave next Friday',
        currentState: createState({ departureDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Flying tomorrow / next week',
        currentState: createState({ departureDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Actually leave on 2026-11-01 instead of 2026-09-01',
        currentState: withDeparture,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Forget the departure date / not 2026-09-01',
        currentState: withDeparture,
      }),
    ).toEqual({ stateUpdate: {} });

    const result = extractor.extract({
      message: 'keep 2026-09-01',
      currentState: withDeparture,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('departureDate');
    expect(result.stateUpdate).not.toHaveProperty('returnDate');
    expect(withDeparture.departureDate).toBe('2026-09-01');
    expect(withDeparture.returnDate).toBe('2026-09-08');
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new DepartureDateConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'Leave on Monday',
        currentState: createState({ departureDate: '2026-08-01' }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          departureDate: '2026-12-01',
          returnDate: '2026-12-10',
          adultCount: 4,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Take me to Cairns from Sydney',
        currentState: createState({ departureDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new DepartureDateConversationStateExtractor();
    const currentState = createState({
      departureDate: '2026-09-01',
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
      message: 'Leave next Friday',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.departureDate = 'mutated';

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new DepartureDateConversationStateExtractor() as DepartureDateConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as DepartureDateConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, date, regex, lexicon, or provider imports', () => {
    const source = readFileSync(DEPARTURE_DATE_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/departureDate\s*:/);
    expect(source).not.toMatch(/returnDate\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(/new Date\b|Date\.now|Date\.parse/);
    expect(source).not.toMatch(/lexicon|weekday|monthNames|relativeDate|timezone/i);
    expect(source).not.toMatch(/date-fns|dayjs|luxon|moment|Temporal/);
    expect(source).not.toMatch(/provider|search|discovery|travel-location|calendar/i);
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
      DEPARTURE_DATE_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/DepartureDateConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'DepartureDateConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/DepartureDateConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new DepartureDateConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('DepartureDateConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('keeps processor departure-date behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'Leave on Friday instead',
      state: currentState,
      userEntryId: 'user-5m',
      assistantEntryId: 'assistant-5m',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { departureDate: '2026-10-15' },
    });
    const cleared = processConversationTurn({
      message: 'Forget the departure date',
      state: currentState,
      userEntryId: 'user-5m-b',
      assistantEntryId: 'assistant-5m-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { departureDate: null },
    });
    const messageOnly = processConversationTurn({
      message: 'Departing tomorrow',
      state: currentState,
      userEntryId: 'user-5m-c',
      assistantEntryId: 'assistant-5m-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
    });
    const returnInjected = processConversationTurn({
      message: 'Come back later',
      state: currentState,
      userEntryId: 'user-5m-d',
      assistantEntryId: 'assistant-5m-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { returnDate: '2026-09-20' },
    });
    const placesInjected = processConversationTurn({
      message: 'Sydney to Perth',
      state: currentState,
      userEntryId: 'user-5m-e',
      assistantEntryId: 'assistant-5m-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { origin: 'Sydney', destination: 'Perth' },
    });

    expect(injected.state.departureDate).toBe('2026-10-15');
    expect(injected.state.returnDate).toBe('2026-09-08');
    expect(injected.state.origin).toBe('Melbourne');
    expect(cleared.state.departureDate).toBeNull();
    expect(messageOnly.state.departureDate).toBe('2026-09-01');
    expect(returnInjected.state.returnDate).toBe('2026-09-20');
    expect(returnInjected.state.departureDate).toBe('2026-09-01');
    expect(placesInjected.state.origin).toBe('Sydney');
    expect(placesInjected.state.destination).toBe('Perth');
    expect(placesInjected.state.departureDate).toBe('2026-09-01');
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
