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
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
const RETURN_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ReturnDateConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5n',
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

describe('phase 5N — ReturnDateConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<ReturnDateConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<ReturnDateConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<ReturnDateConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new ReturnDateConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'Return on 2026-10-22',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear return date from return-like message text', () => {
    const extractor = new ReturnDateConversationStateExtractor();
    const withReturn = createState({
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
    });

    expect(
      extractor.extract({
        message: 'Coming back 22 October 2026',
        currentState: createState({ returnDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Return next Sunday',
        currentState: createState({ returnDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Back tomorrow / next week',
        currentState: createState({ returnDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Stay for 7 nights then return',
        currentState: createState({ returnDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Actually return on 2026-11-01 instead of 2026-09-08',
        currentState: withReturn,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Forget the return date / not 2026-09-08',
        currentState: withReturn,
      }),
    ).toEqual({ stateUpdate: {} });

    const result = extractor.extract({
      message: 'keep 2026-09-08',
      currentState: withReturn,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('returnDate');
    expect(result.stateUpdate).not.toHaveProperty('departureDate');
    expect(withReturn.returnDate).toBe('2026-09-08');
    expect(withReturn.departureDate).toBe('2026-09-01');
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new ReturnDateConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'Return on Monday',
        currentState: createState({ returnDate: '2026-08-10' }),
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
        message: 'Take me to Cairns from Sydney leaving Friday',
        currentState: createState({ returnDate: null }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new ReturnDateConversationStateExtractor();
    const currentState = createState({
      returnDate: '2026-09-08',
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
      message: 'Return next Sunday',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.returnDate = 'mutated';

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new ReturnDateConversationStateExtractor() as ReturnDateConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as ReturnDateConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, date, duration, regex, lexicon, or provider imports', () => {
    const source = readFileSync(RETURN_DATE_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/returnDate\s*:/);
    expect(source).not.toMatch(/departureDate\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(/new Date\b|Date\.now|Date\.parse/);
    expect(source).not.toMatch(
      /lexicon|weekday|monthNames|relativeDate|timezone|nights|duration/i,
    );
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
      RETURN_DATE_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/ReturnDateConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('ReturnDateConversationStateExtractor');
    expect(processTurn).not.toMatch(/ReturnDateConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new ReturnDateConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('ReturnDateConversationStateExtractor'), file).toBe(false);
    }
  });

  it('keeps processor return-date behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'Come back on Sunday instead',
      state: currentState,
      userEntryId: 'user-5n',
      assistantEntryId: 'assistant-5n',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { returnDate: '2026-10-22' },
    });
    const cleared = processConversationTurn({
      message: 'Forget the return date',
      state: currentState,
      userEntryId: 'user-5n-b',
      assistantEntryId: 'assistant-5n-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { returnDate: null },
    });
    const messageOnly = processConversationTurn({
      message: 'Returning tomorrow after 5 nights',
      state: currentState,
      userEntryId: 'user-5n-c',
      assistantEntryId: 'assistant-5n-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
    });
    const departureInjected = processConversationTurn({
      message: 'Leave earlier',
      state: currentState,
      userEntryId: 'user-5n-d',
      assistantEntryId: 'assistant-5n-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { departureDate: '2026-08-20' },
    });
    const placesInjected = processConversationTurn({
      message: 'Sydney to Perth',
      state: currentState,
      userEntryId: 'user-5n-e',
      assistantEntryId: 'assistant-5n-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { origin: 'Sydney', destination: 'Perth' },
    });

    expect(injected.state.returnDate).toBe('2026-10-22');
    expect(injected.state.departureDate).toBe('2026-09-01');
    expect(injected.state.origin).toBe('Melbourne');
    expect(cleared.state.returnDate).toBeNull();
    expect(messageOnly.state.returnDate).toBe('2026-09-08');
    expect(departureInjected.state.departureDate).toBe('2026-08-20');
    expect(departureInjected.state.returnDate).toBe('2026-09-08');
    expect(placesInjected.state.origin).toBe('Sydney');
    expect(placesInjected.state.destination).toBe('Perth');
    expect(placesInjected.state.returnDate).toBe('2026-09-08');
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
