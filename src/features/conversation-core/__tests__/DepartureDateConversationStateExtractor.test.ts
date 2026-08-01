import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as conversationCore from '../index';
import {
  createInitialConversationCoreState,
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
      conversationId: 'conversation-7c',
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

describe('phase 8C — DepartureDateConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit departureDate result contract', () => {
    expectTypeOf<DepartureDateConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<DepartureDateConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<DepartureDateConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new DepartureDateConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'Leave on 2026-10-15',
        currentState: createState({ departureDate: null }),
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-10-15' } });
  });

  it('extracts supported explicit departure-date forms into canonical ISO', () => {
    const extractor = new DepartureDateConversationStateExtractor();
    const cases: Array<[string, string]> = [
      ['Depart on 28 August 2026', '2026-08-28'],
      ['departing 28 August 2026', '2026-08-28'],
      ['leave on 28 August 2026', '2026-08-28'],
      ['leaving 28 August 2026', '2026-08-28'],
      ['flying on 28 August 2026', '2026-08-28'],
      ['fly on 28 August 2026', '2026-08-28'],
      ['travel on 28 August 2026', '2026-08-28'],
      ['departure date is 28 August 2026', '2026-08-28'],
      ['departure is 28 August 2026', '2026-08-28'],
      ['I want to leave on 28 August 2026', '2026-08-28'],
      ['from Sydney on 28 August 2026', '2026-08-28'],
      ['Leave on 2026-10-15', '2026-10-15'],
      ['Departing 15 October 2026', '2026-10-15'],
    ];

    for (const [message, departureDate] of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ departureDate: null }),
      });
      expect(result, message).toEqual({ stateUpdate: { departureDate } });
      expect(result.stateUpdate, message).not.toHaveProperty('returnDate');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('replaces an existing departureDate when a new explicit date is stated', () => {
    const extractor = new DepartureDateConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'Depart on 28 August 2026',
        currentState: createState({ departureDate: '2026-08-15' }),
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
  });

  it('returns empty for return-date, vague, relative, price, time, negation, and keep wording', () => {
    const extractor = new DepartureDateConversationStateExtractor();
    const unsupported = [
      'Return on 5 September 2026',
      'returning 31 August 2026',
      'Come back on 5 September 2026',
      'come back 31 August 2026',
      'until 31 August 2026',
      'hotel booked for 28 August 2026',
      'event on 28 August 2026',
      '28 August 2026?',
      'what dates are available',
      'sometime in August',
      'late August',
      'the 28th',
      'Departing soon',
      'Leave next week',
      'Fly tomorrow',
      'Travel on Friday',
      'Depart on Monday',
      'Flights from $450',
      'Leave at 10am',
      'Travel for 5 days',
      'Do not depart on 28 August 2026',
      'Keep my departure date',
      'Forget the departure date',
      'Depart on 28 August 2026 instead',
      // Phase 17D: bare "Actually depart on …" is now supported; "instead"
      // forms remain blocked.
      'Actually leave on 2026-11-01 instead of 2026-09-01',
      'Forget the departure date / not 2026-09-01',
      'Leave on Monday',
      'Departing tomorrow',
      'Flying next Friday',
      'next month',
      'Friday',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ departureDate: '2026-09-01' }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits departureDate null from extraction', () => {
    const extractor = new DepartureDateConversationStateExtractor();
    const result = extractor.extract({
      message: 'Forget the departure date',
      currentState: createState({ departureDate: '2026-09-01' }),
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('departureDate');

    const update = extractor.extract({
      message: 'Depart on 28 August 2026',
      currentState: createState({ departureDate: null }),
    }).stateUpdate;
    expect(update.departureDate).toBe('2026-08-28');
    expect(update.departureDate).not.toBeNull();
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
      message: 'Leave on 2026-10-15',
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
    expect(second).toEqual({ stateUpdate: { departureDate: '2026-10-15' } });

    const other =
      new DepartureDateConversationStateExtractor() as DepartureDateConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as DepartureDateConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'Depart on 28 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
  });

  it('contains no trim/toLowerCase, Date API, currentState inspection, or provider imports', () => {
    const source = readFileSync(DEPARTURE_DATE_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/departureDate\s*:/);
    expect(source).not.toMatch(/returnDate\s*:/);
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

  it('applies extracted departureDate through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
      origin: 'Melbourne',
      destination: 'Brisbane',
      flightsRequested: true,
      adultCount: 2,
    });
    const extracted = processConversationTurn({
      message: 'Depart on 28 August 2026',
      state: currentState,
      userEntryId: 'user-8c-a',
      assistantEntryId: 'assistant-8c-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const replaced = processConversationTurn({
      message: 'Leave on 2026-10-15',
      state: currentState,
      userEntryId: 'user-8c-b',
      assistantEntryId: 'assistant-8c-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
    });
    const overridden = processConversationTurn({
      message: 'Depart on 28 August 2026',
      state: currentState,
      userEntryId: 'user-8c-c',
      assistantEntryId: 'assistant-8c-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { departureDate: '2026-11-01' },
    });
    const nullOverride = processConversationTurn({
      message: 'Depart on 28 August 2026',
      state: currentState,
      userEntryId: 'user-8c-d',
      assistantEntryId: 'assistant-8c-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { departureDate: null },
    });
    const preserved = processConversationTurn({
      message: 'returning 31 August 2026',
      state: currentState,
      userEntryId: 'user-8c-e',
      assistantEntryId: 'assistant-8c-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'Depart on 28 August 2026. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        departureDate: null,
      }),
      userEntryId: 'user-8c-f',
      assistantEntryId: 'assistant-8c-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'Depart on 28 August 2026. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        departureDate: null,
      }),
      userEntryId: 'user-8c-g',
      assistantEntryId: 'assistant-8c-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        departureDate: '2026-12-01',
      },
    });
    const fromPlaceOnDate = processConversationTurn({
      message: 'from Sydney on 28 August 2026',
      state: currentState,
      userEntryId: 'user-8c-h',
      assistantEntryId: 'assistant-8c-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });

    expect(extracted.state.departureDate).toBe('2026-08-28');
    expect(extracted.state.returnDate).toBe('2026-09-08');
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.adultCount).toBe(2);
    expect(replaced.state.departureDate).toBe('2026-10-15');
    expect(overridden.state.departureDate).toBe('2026-11-01');
    expect(nullOverride.state.departureDate).toBeNull();
    expect(preserved.state.departureDate).toBe('2026-09-01');
    expect(composed.state.departureDate).toBe('2026-08-28');
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.departureDate).toBe('2026-12-01');
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(fromPlaceOnDate.state.departureDate).toBe('2026-08-28');
    expect(extracted.reply).toBe(extracted.state.transcript.at(-1)?.message);
    expect(extracted.reply).not.toMatch(/assembled|unavailable/i);
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

  it('keeps Origin and Destination extractors behaviourally unchanged', () => {
    const originSource = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/OriginConversationStateExtractor.ts'),
      'utf8',
    );
    const destinationSource = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/DestinationConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(originSource).toContain('Phase 7B');
    expect(originSource).toContain('Phase 8B');
    expect(destinationSource).toContain('Phase 7A');
    expect(
      new OriginConversationStateExtractor().extract({
        message: 'from Sydney',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      new DestinationConversationStateExtractor().extract({
        message: 'go to Cairns',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
  });

  it('keeps Destination, Origin, and DepartureDate as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(36);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[35]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      departureDate: '2026-01-01',
    });
    const threeActiveMessage = 'Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: threeActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
      },
    });

    for (let index = 3; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: threeActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[0]?.extract({
        message: threeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(
      extractors[1]?.extract({
        message: threeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      extractors[2]?.extract({
        message: threeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });

    expect(
      createConversationStateExtractor().extract({
        message: 'fly from Sydney to Brisbane',
        currentState,
      }),
    ).toEqual({
      stateUpdate: { destination: 'Brisbane', origin: 'Sydney' },
    });
  });
});
