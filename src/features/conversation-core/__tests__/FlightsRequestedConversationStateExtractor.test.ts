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
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
const FLIGHTS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/FlightsRequestedConversationStateExtractor.ts',
);
const INFANT_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/InfantCountConversationStateExtractor.ts',
);
const CHILD_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ChildCountConversationStateExtractor.ts',
);
const ADULT_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/AdultCountConversationStateExtractor.ts',
);
const DESTINATION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/DestinationConversationStateExtractor.ts',
);
const ORIGIN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/OriginConversationStateExtractor.ts',
);
const DEPARTURE_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/DepartureDateConversationStateExtractor.ts',
);
const RETURN_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ReturnDateConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-7h',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
    adultCount: 2,
    childCount: 1,
    infantCount: 0,
    flightsRequested: false,
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

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

describe('phase 7H — FlightsRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit flightsRequested true contract', () => {
    expectTypeOf<FlightsRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<FlightsRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<FlightsRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new FlightsRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'I need flights',
        currentState: createState({ flightsRequested: null }),
      }),
    ).toEqual({ stateUpdate: { flightsRequested: true } });
  });

  it('extracts supported explicit flights-request forms as true', () => {
    const extractor = new FlightsRequestedConversationStateExtractor();
    const cases = [
      'flights',
      'book flights',
      'I need flights',
      'include flights',
      'add flights',
      'flights please',
      'need flights',
    ];

    for (const message of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ flightsRequested: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { flightsRequested: true } });
    }
  });

  it('returns empty for airline/flight-number, negation, remove/forget, keep, and vague wording', () => {
    const extractor = new FlightsRequestedConversationStateExtractor();
    const unsupported = [
      'Qantas',
      'Virgin',
      'flight QF400',
      'QF123',
      'fly with Qantas',
      'I want to fly',
      'find airfare',
      'airline plane Virgin',
      'departing from Sydney Airport',
      'do not book flights',
      'no flights',
      'remove the flights',
      'forget flights',
      'keep flights',
      'keep the hotel but remove flights',
      'actually add flights',
      'yes add flights instead',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ flightsRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits flightsRequested false or null from extraction', () => {
    const extractor = new FlightsRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no flights',
      currentState: createState({ flightsRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('flightsRequested');

    const update = extractor.extract({
      message: 'book flights',
      currentState: createState({ flightsRequested: null }),
    }).stateUpdate;
    expect(update.flightsRequested).toBe(true);
    expect(update.flightsRequested).not.toBe(false);
    expect(update.flightsRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new FlightsRequestedConversationStateExtractor();
    const currentState = createState({
      flightsRequested: false,
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
      message: 'book flights',
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
    expect(second).toEqual({ stateUpdate: { flightsRequested: true } });

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
      other.extract({
        message: 'flights please',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { flightsRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(FLIGHTS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/flightsRequested\s*:\s*true/);
    expect(source).not.toMatch(/flightsRequested\s*:\s*false/);
    expect(source).not.toMatch(/flightsRequested\s*:\s*null/);
    expect(source).not.toMatch(/\.trim\(/);
    expect(source).not.toMatch(/\.toLowerCase\(/);
    expect(source).not.toMatch(/\.includes\(/);
    expect(source).not.toMatch(/provider|travel-location/i);
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

  it('proves existing active extractors remain unchanged', () => {
    expect(readFileSync(DESTINATION_SOURCE, 'utf8')).toContain('Phase 7A');
    expect(readFileSync(ORIGIN_SOURCE, 'utf8')).toContain('Phase 7B');
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 7C');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 7D');
    expect(readFileSync(ADULT_COUNT_SOURCE, 'utf8')).toContain('Phase 7E');
    expect(readFileSync(CHILD_COUNT_SOURCE, 'utf8')).toContain('Phase 7F');
    expect(readFileSync(INFANT_COUNT_SOURCE, 'utf8')).toContain('Phase 7G');

    expect(
      new DestinationConversationStateExtractor().extract({
        message: 'go to Cairns',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(
      new OriginConversationStateExtractor().extract({
        message: 'from Sydney',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      new DepartureDateConversationStateExtractor().extract({
        message: 'Depart on 28 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
    expect(
      new ReturnDateConversationStateExtractor().extract({
        message: 'Return on 31 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { returnDate: '2026-08-31' } });
    expect(
      new AdultCountConversationStateExtractor().extract({
        message: '2 adults',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { adultCount: 2 } });
    expect(
      new ChildCountConversationStateExtractor().extract({
        message: '2 children',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { childCount: 2 } });
    expect(
      new InfantCountConversationStateExtractor().extract({
        message: '1 infant',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { infantCount: 1 } });
  });

  it('applies extracted flightsRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      flightsRequested: false,
      accommodationRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'I need flights',
      state: currentState,
      userEntryId: 'user-7h-a',
      assistantEntryId: 'assistant-7h-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no flights',
      state: currentState,
      userEntryId: 'user-7h-b',
      assistantEntryId: 'assistant-7h-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { flightsRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'book flights',
      state: currentState,
      userEntryId: 'user-7h-c',
      assistantEntryId: 'assistant-7h-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { flightsRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'book flights',
      state: currentState,
      userEntryId: 'user-7h-d',
      assistantEntryId: 'assistant-7h-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { flightsRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'I want to fly',
      state: currentState,
      userEntryId: 'user-7h-e',
      assistantEntryId: 'assistant-7h-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'book flights. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        flightsRequested: null,
      }),
      userEntryId: 'user-7h-f',
      assistantEntryId: 'assistant-7h-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'book flights. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        flightsRequested: null,
      }),
      userEntryId: 'user-7h-g',
      assistantEntryId: 'assistant-7h-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        flightsRequested: false,
      },
    });

    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.flightsRequested).toBe(true);
    expect(overriddenFalse.state.flightsRequested).toBe(false);
    expect(nullOverride.state.flightsRequested).toBeNull();
    expect(preserved.state.flightsRequested).toBe(false);
    expect(composed.state.flightsRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.flightsRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(extracted.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(extracted).sort()).toEqual(['reply', 'state', 'trace']);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });

  it('keeps Destination through FlightsRequested as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(28);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[4]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(extractors[5]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(extractors[6]).toBeInstanceOf(InfantCountConversationStateExtractor);
    expect(extractors[7]).toBeInstanceOf(FlightsRequestedConversationStateExtractor);
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      flightsRequested: false,
    });

    const flightsActiveMessage =
      'book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: flightsActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        flightsRequested: true,
      },
    });

    for (let index = 8; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: flightsActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[7]?.extract({
        message: flightsActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { flightsRequested: true } });
    expect(
      extractors[6]?.extract({
        message: flightsActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    const infantActiveMessage = '1 infant';
    expect(
      extractors[6]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { infantCount: 1 } });
    expect(
      extractors[7]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 8; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: infantActiveMessage,
          currentState,
        }),
        `extractor ${index} on infant message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
