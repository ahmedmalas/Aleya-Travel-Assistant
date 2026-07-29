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
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
const RETURN_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ReturnDateConversationStateExtractor.ts',
);
const DEPARTURE_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/DepartureDateConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-7d',
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

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

describe('phase 7D — ReturnDateConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit returnDate result contract', () => {
    expectTypeOf<ReturnDateConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<ReturnDateConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<ReturnDateConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new ReturnDateConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'Return on 2026-10-22',
        currentState: createState({ returnDate: null }),
      }),
    ).toEqual({ stateUpdate: { returnDate: '2026-10-22' } });
  });

  it('extracts supported explicit return-date forms into canonical ISO', () => {
    const extractor = new ReturnDateConversationStateExtractor();
    const cases: Array<[string, string]> = [
      ['Return on 31 August 2026', '2026-08-31'],
      ['returning 31 August 2026', '2026-08-31'],
      ['come back on 31 August 2026', '2026-08-31'],
      ['coming back 31 August 2026', '2026-08-31'],
      ['return date is 31 August 2026', '2026-08-31'],
      ['Return on 2026-10-22', '2026-10-22'],
      ['Coming back 22 October 2026', '2026-10-22'],
    ];

    for (const [message, returnDate] of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ returnDate: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { returnDate } });
    }
  });

  it('replaces an existing returnDate when a new explicit date is stated', () => {
    const extractor = new ReturnDateConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'Return on 31 August 2026',
        currentState: createState({ returnDate: '2026-08-22' }),
      }),
    ).toEqual({ stateUpdate: { returnDate: '2026-08-31' } });
  });

  it('returns empty for departure-date, vague, relative, price, time, negation, and keep wording', () => {
    const extractor = new ReturnDateConversationStateExtractor();
    const unsupported = [
      'Depart on 28 August 2026',
      'Leave on 2026-10-15',
      'Fly on 28 August 2026',
      'Travel on 28 August 2026',
      'Departure date is 28 August 2026',
      'Returning soon',
      'Return next week',
      'Come back tomorrow',
      'Return on Friday',
      'Return on Monday',
      'Flights from $450',
      'Return at 10am',
      'Back after 7 nights',
      'Stay for 7 nights then return',
      'Do not return on 31 August 2026',
      'Keep my return date',
      'Forget the return date',
      'Return on 31 August 2026 instead',
      'Actually return on 31 August 2026',
      'Actually return on 2026-11-01 instead of 2026-09-08',
      'Forget the return date / not 2026-09-08',
      'Returning tomorrow after 5 nights',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ returnDate: '2026-09-08' }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits returnDate null from extraction', () => {
    const extractor = new ReturnDateConversationStateExtractor();
    const result = extractor.extract({
      message: 'Forget the return date',
      currentState: createState({ returnDate: '2026-09-08' }),
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('returnDate');

    const update = extractor.extract({
      message: 'Return on 31 August 2026',
      currentState: createState({ returnDate: null }),
    }).stateUpdate;
    expect(update.returnDate).toBe('2026-08-31');
    expect(update.returnDate).not.toBeNull();
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
      message: 'Return on 2026-10-22',
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
    expect(second).toEqual({ stateUpdate: { returnDate: '2026-10-22' } });

    const other =
      new ReturnDateConversationStateExtractor() as ReturnDateConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as ReturnDateConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'Return on 31 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { returnDate: '2026-08-31' } });
  });

  it('contains no trim/toLowerCase, Date API, currentState inspection, or provider imports', () => {
    const source = readFileSync(RETURN_DATE_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/returnDate\s*:/);
    expect(source).not.toMatch(/departureDate\s*:/);
    expect(source).not.toMatch(/\.trim\(/);
    expect(source).not.toMatch(/\.toLowerCase\(/);
    expect(source).not.toMatch(/new Date\b|Date\.now|Date\.parse/);
    expect(source).not.toMatch(/monthNames|relativeDate|timezone/i);
    expect(source).not.toMatch(/date-fns|dayjs|luxon|moment|Temporal/);
    expect(source).not.toMatch(/provider|travel-location|calendar/i);
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
    expect(conversationCore).not.toHaveProperty(
      'ReturnDateConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/ReturnDateConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new ReturnDateConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('ReturnDateConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('proves DepartureDate production source remains unchanged', () => {
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain(
      'Phase 7C: recognises only narrow, explicit departure-date statements',
    );
    const departure = new DepartureDateConversationStateExtractor();
    expect(
      departure.extract({
        message: 'Depart on 28 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
    expect(
      departure.extract({
        message: 'Return on 31 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('applies extracted returnDate through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'Return on 31 August 2026',
      state: currentState,
      userEntryId: 'user-7d-a',
      assistantEntryId: 'assistant-7d-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const replaced = processConversationTurn({
      message: 'Return on 2026-10-22',
      state: currentState,
      userEntryId: 'user-7d-b',
      assistantEntryId: 'assistant-7d-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
    });
    const overridden = processConversationTurn({
      message: 'Return on 31 August 2026',
      state: currentState,
      userEntryId: 'user-7d-c',
      assistantEntryId: 'assistant-7d-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { returnDate: '2026-11-12' },
    });
    const nullOverride = processConversationTurn({
      message: 'Return on 31 August 2026',
      state: currentState,
      userEntryId: 'user-7d-d',
      assistantEntryId: 'assistant-7d-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { returnDate: null },
    });
    const preserved = processConversationTurn({
      message: 'Returning tomorrow after 5 nights',
      state: currentState,
      userEntryId: 'user-7d-e',
      assistantEntryId: 'assistant-7d-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'Return on 31 August 2026. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        returnDate: null,
      }),
      userEntryId: 'user-7d-f',
      assistantEntryId: 'assistant-7d-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'Return on 31 August 2026. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        returnDate: null,
      }),
      userEntryId: 'user-7d-g',
      assistantEntryId: 'assistant-7d-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        returnDate: '2026-12-15',
      },
    });

    expect(extracted.state.returnDate).toBe('2026-08-31');
    expect(extracted.state.departureDate).toBe('2026-09-01');
    expect(extracted.state.origin).toBe('Melbourne');
    expect(replaced.state.returnDate).toBe('2026-10-22');
    expect(overridden.state.returnDate).toBe('2026-11-12');
    expect(nullOverride.state.returnDate).toBeNull();
    expect(preserved.state.returnDate).toBe('2026-09-08');
    expect(composed.state.returnDate).toBe('2026-08-31');
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(composed.state.departureDate).toBe('2026-09-01');
    expect(independentOverride.state.returnDate).toBe('2026-12-15');
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(extracted.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(extracted).sort()).toEqual(['reply', 'state', 'trace']);
    expect(Object.keys(extracted.trace).sort()).toEqual([
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

  it('keeps Destination, Origin, DepartureDate, and ReturnDate as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(28);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      departureDate: '2026-01-01',
      returnDate: '2026-01-10',
    });

    const returnActiveMessage = 'Return on 31 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: returnActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        returnDate: '2026-08-31',
      },
    });

    for (let index = 4; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: returnActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[0]?.extract({
        message: returnActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(
      extractors[1]?.extract({
        message: returnActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      extractors[2]?.extract({
        message: returnActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[3]?.extract({
        message: returnActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { returnDate: '2026-08-31' } });

    const departureActiveMessage =
      'Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: departureActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
      },
    });
    expect(
      extractors[3]?.extract({
        message: departureActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 4; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: departureActiveMessage,
          currentState,
        }),
        `extractor ${index} on departure message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
