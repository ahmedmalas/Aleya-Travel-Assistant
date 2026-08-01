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
import { AccommodationRequestedConversationStateExtractor } from '../AccommodationRequestedConversationStateExtractor';
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
const ACCOMMODATION_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/AccommodationRequestedConversationStateExtractor.ts',
);
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
      conversationId: 'conversation-8i',
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

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

describe('phase 8I — AccommodationRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit accommodationRequested true contract', () => {
    expectTypeOf<AccommodationRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<AccommodationRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<AccommodationRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new AccommodationRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'I need accommodation',
        currentState: createState({ accommodationRequested: null }),
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
  });

  it('extracts supported explicit accommodation-request forms as true', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();
    const cases = [
      'accommodation',
      'hotel',
      'hotels',
      'book accommodation',
      'find accommodation',
      'search accommodation',
      'I need accommodation',
      'I want accommodation',
      'include accommodation',
      'add accommodation',
      'show me accommodation',
      'compare accommodation',
      'book a hotel',
      'find me a hotel',
      'hotel options',
      'a place to stay',
      'somewhere to stay',
      'lodging',
      'I need a hotel',
      'need hotel',
      'book me a hotel',
      'I need accommodation in Brisbane',
      'book flights and accommodation',
      'find a hotel for 2 adults',
      'I want somewhere to stay in Surfers Paradise',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ accommodationRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { accommodationRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty('flightsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
      expect(result.stateUpdate, message).not.toHaveProperty('adultCount');
    }
  });

  it('emits only accommodationRequested from combined flights-and-accommodation wording', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'book flights and accommodation',
        currentState: createState({ accommodationRequested: null }),
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
  });

  it('returns empty for metadata, named hotels, stay-location, negation, and vague wording', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();
    const unsupported = [
      'hotel address',
      'hotel phone number',
      'hotel check-in time',
      'hotel checkout time',
      'hotel cancellation policy',
      'hotel review',
      'hotel rating',
      'hotel restaurant',
      'hotel transfer',
      'hotel booked',
      'my hotel is cancelled',
      'staying in Surfers Paradise',
      'stay in Brisbane',
      'three-night stay',
      'lodging a complaint',
      'accommodation?',
      'what is accommodation',
      'stay in Docklands',
      'we will stay near the airport',
      'travel',
      'trip',
      'holiday',
      'go to Brisbane',
      'from Sydney to Melbourne',
      'departing 28 August 2026',
      'Hilton',
      'Marriott Surfers Paradise',
      'I want a resort',
      'a motel is fine',
      'find a hostel',
      'I need an apartment',
      'look for an Airbnb',
      'book one room',
      'check in Friday and out Monday',
      'do not book accommodation',
      'no hotel',
      'no accommodation',
      'no hotels',
      'without accommodation',
      'remove the accommodation',
      'cancel the hotel',
      "I don't need a hotel",
      'do not include accommodation',
      'forget the hotel',
      'keep the hotel',
      'keep flights but remove the hotel',
      'actually add a hotel',
      'I will stay with family instead',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ accommodationRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits accommodationRequested false or null from extraction', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no hotel',
      currentState: createState({ accommodationRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('accommodationRequested');

    const update = extractor.extract({
      message: 'book accommodation',
      currentState: createState({ accommodationRequested: null }),
    }).stateUpdate;
    expect(update.accommodationRequested).toBe(true);
    expect(update.accommodationRequested).not.toBe(false);
    expect(update.accommodationRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();
    const currentState = createState({
      accommodationRequested: false,
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
      message: 'book a hotel',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.accommodationRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { accommodationRequested: true } });

    const other =
      new AccommodationRequestedConversationStateExtractor() as AccommodationRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as AccommodationRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'hotel',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(ACCOMMODATION_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/accommodationRequested\s*:\s*true/);
    expect(source).not.toMatch(/accommodationRequested\s*:\s*false/);
    expect(source).not.toMatch(/accommodationRequested\s*:\s*null/);
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
      ACCOMMODATION_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/AccommodationRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'AccommodationRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /AccommodationRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new AccommodationRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('AccommodationRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('proves existing active extractors remain unchanged', () => {
    expect(readFileSync(DESTINATION_SOURCE, 'utf8')).toContain('Phase 7A');
    expect(readFileSync(ORIGIN_SOURCE, 'utf8')).toContain('Phase 7B');
    expect(readFileSync(ORIGIN_SOURCE, 'utf8')).toContain('Phase 8B');
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 7C');
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 8C');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 7D');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 8D');
    expect(readFileSync(ADULT_COUNT_SOURCE, 'utf8')).toContain('Phase 7E');
    expect(readFileSync(ADULT_COUNT_SOURCE, 'utf8')).toContain('Phase 8E');
    expect(readFileSync(CHILD_COUNT_SOURCE, 'utf8')).toContain('Phase 7F');
    expect(readFileSync(CHILD_COUNT_SOURCE, 'utf8')).toContain('Phase 8F');
    expect(readFileSync(INFANT_COUNT_SOURCE, 'utf8')).toContain('Phase 7G');
    expect(readFileSync(INFANT_COUNT_SOURCE, 'utf8')).toContain('Phase 8G');
    expect(readFileSync(FLIGHTS_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7H');
    expect(readFileSync(FLIGHTS_REQUESTED_SOURCE, 'utf8')).toContain('Phase 8H');

    expect(
      new FlightsRequestedConversationStateExtractor().extract({
        message: 'book flights',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { flightsRequested: true } });
    expect(
      new InfantCountConversationStateExtractor().extract({
        message: '1 infant',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { infantCount: 1 } });
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
  });

  it('applies extracted accommodationRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      flightsRequested: true,
      accommodationRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
      adultCount: 2,
    });
    const extracted = processConversationTurn({
      message: 'I need accommodation',
      state: currentState,
      userEntryId: 'user-8i-a',
      assistantEntryId: 'assistant-8i-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no hotel',
      state: currentState,
      userEntryId: 'user-8i-b',
      assistantEntryId: 'assistant-8i-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { accommodationRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'book a hotel',
      state: currentState,
      userEntryId: 'user-8i-c',
      assistantEntryId: 'assistant-8i-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { accommodationRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'book a hotel',
      state: currentState,
      userEntryId: 'user-8i-d',
      assistantEntryId: 'assistant-8i-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { accommodationRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'staying in Surfers Paradise',
      state: currentState,
      userEntryId: 'user-8i-e',
      assistantEntryId: 'assistant-8i-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'book a hotel. book flights. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        accommodationRequested: null,
        flightsRequested: null,
      }),
      userEntryId: 'user-8i-f',
      assistantEntryId: 'assistant-8i-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'book a hotel. book flights. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        accommodationRequested: null,
        flightsRequested: null,
      }),
      userEntryId: 'user-8i-g',
      assistantEntryId: 'assistant-8i-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        accommodationRequested: false,
      },
    });
    const lodging = processConversationTurn({
      message: 'lodging',
      state: currentState,
      userEntryId: 'user-8i-h',
      assistantEntryId: 'assistant-8i-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const metadataPreserved = processConversationTurn({
      message: 'hotel review',
      state: currentState,
      userEntryId: 'user-8i-i',
      assistantEntryId: 'assistant-8i-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });

    expect(extracted.state.accommodationRequested).toBe(true);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(extracted.state.adultCount).toBe(2);
    expect(overriddenTrue.state.accommodationRequested).toBe(true);
    expect(overriddenFalse.state.accommodationRequested).toBe(false);
    expect(nullOverride.state.accommodationRequested).toBeNull();
    expect(preserved.state.accommodationRequested).toBe(false);
    expect(composed.state.accommodationRequested).toBe(true);
    expect(composed.state.flightsRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.accommodationRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(lodging.state.accommodationRequested).toBe(true);
    expect(metadataPreserved.state.accommodationRequested).toBe(false);
    expect(extracted.reply).toBe(extracted.state.transcript.at(-1)?.message);
    expect(extracted.reply).not.toMatch(/assembled|unavailable/i);
    expect(Object.keys(extracted).sort()).toEqual(['reply', 'state', 'trace']);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });

  it('keeps Destination through AccommodationRequested as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(38);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[5]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(extractors[6]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(extractors[7]).toBeInstanceOf(InfantCountConversationStateExtractor);
    expect(extractors[8]).toBeInstanceOf(FlightsRequestedConversationStateExtractor);
    expect(extractors[9]).toBeInstanceOf(
      AccommodationRequestedConversationStateExtractor,
    );
    expect(extractors[37]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      flightsRequested: false,
      accommodationRequested: false,
    });

    const accommodationActiveMessage =
      'book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: accommodationActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        flightsRequested: true,
        accommodationRequested: true,
      },
    });

    for (let index = 10; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: accommodationActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[9]?.extract({
        message: accommodationActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
    expect(
      extractors[8]?.extract({
        message: accommodationActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { flightsRequested: true } });

    const flightsOnlyMessage = 'book flights';
    expect(
      extractors[8]?.extract({
        message: flightsOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { flightsRequested: true } });
    expect(
      extractors[9]?.extract({
        message: flightsOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 9; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: flightsOnlyMessage,
          currentState,
        }),
        `extractor ${index} on flights message`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[9]?.extract({
        message: 'book flights and accommodation',
        currentState,
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
  });
});
