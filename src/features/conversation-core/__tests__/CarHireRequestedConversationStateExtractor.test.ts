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
import { CarHireRequestedConversationStateExtractor } from '../CarHireRequestedConversationStateExtractor';
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
const CAR_HIRE_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/CarHireRequestedConversationStateExtractor.ts',
);
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
      conversationId: 'conversation-8j',
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
    accommodationRequested: true,
    carHireRequested: false,
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

describe('phase 8J — CarHireRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit carHireRequested true contract', () => {
    expectTypeOf<CarHireRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<CarHireRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<CarHireRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new CarHireRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'I need car hire',
        currentState: createState({ carHireRequested: null }),
      }),
    ).toEqual({ stateUpdate: { carHireRequested: true } });
  });

  it('extracts supported explicit car-hire-request forms as true', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();
    const cases = [
      'car hire',
      'rental car',
      'car rental',
      'hire a car',
      'rent a car',
      'book car hire',
      'find car hire',
      'search car hire',
      'I need car hire',
      'I want a rental car',
      'include car hire',
      'add car hire',
      'show me rental cars',
      'compare car rentals',
      'car hire options',
      'rental car options',
      'vehicle hire',
      'book a rental car',
      'need hire a car',
      'add rent a car',
      'I need car hire in Brisbane',
      'book flights, accommodation and car hire',
      'find a rental car for 2 adults',
      'I want to rent a car at the airport',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ carHireRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { carHireRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty('flightsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'accommodationRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
      expect(result.stateUpdate, message).not.toHaveProperty('adultCount');
    }
  });

  it('emits only carHireRequested from combined flights, accommodation and car-hire wording', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'book flights, accommodation and car hire',
        currentState: createState({ carHireRequested: null }),
      }),
    ).toEqual({ stateUpdate: { carHireRequested: true } });
  });

  it('returns empty for personal car, parking, insurance, taxi/transfer, driving, already-booked, negation, and vague wording', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();
    const unsupported = [
      'my car',
      'drive my car',
      'car park',
      'parking',
      'car accident',
      'car insurance',
      'car registration',
      'car service',
      'car repair',
      'car dealership',
      'car price',
      'car model',
      'car seat',
      'vehicle details',
      'airport transfer',
      'taxi',
      'rideshare',
      'Uber',
      'bus',
      'train',
      'driving to Brisbane',
      'road trip',
      'I have a rental car',
      'the rental car is booked',
      'car hire?',
      'what is car hire',
      'Tesla',
      'BMW X5',
      'Ferrari',
      'Hertz',
      'Avis Brisbane',
      'I need a taxi',
      'book a transfer',
      'airport transfer please',
      'chauffeur to the hotel',
      'uber to the airport',
      'rideshare from the station',
      'I need a vehicle',
      'I want to drive',
      'find transport',
      'get around town',
      'pick up the car at the airport',
      'I need an SUV',
      'find me a 4WD',
      'a ute would be better',
      'book a van',
      'find a hire car',
      'no car hire',
      'do not include car hire',
      "don't include car hire",
      'without a rental car',
      'remove car hire',
      'cancel the rental car',
      "I don't need a car",
      'no rental car',
      'do not book car hire',
      'remove the car hire',
      'forget car hire',
      'keep the car hire',
      'keep flights but remove car hire',
      'actually add car hire',
      'I will use public transport instead',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ carHireRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits carHireRequested false or null from extraction', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no car hire',
      currentState: createState({ carHireRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('carHireRequested');

    const update = extractor.extract({
      message: 'book car hire',
      currentState: createState({ carHireRequested: null }),
    }).stateUpdate;
    expect(update.carHireRequested).toBe(true);
    expect(update.carHireRequested).not.toBe(false);
    expect(update.carHireRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new CarHireRequestedConversationStateExtractor();
    const currentState = createState({
      carHireRequested: false,
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
      message: 'book a rental car',
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
    expect(second).toEqual({ stateUpdate: { carHireRequested: true } });

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
      other.extract({
        message: 'car hire',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { carHireRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(CAR_HIRE_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7J');
    expect(source).toContain('Phase 8J');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/carHireRequested\s*:\s*true/);
    expect(source).not.toMatch(/carHireRequested\s*:\s*false/);
    expect(source).not.toMatch(/carHireRequested\s*:\s*null/);
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
    expect(readFileSync(ACCOMMODATION_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7I',
    );
    expect(readFileSync(ACCOMMODATION_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8I',
    );

    expect(
      new AccommodationRequestedConversationStateExtractor().extract({
        message: 'book a hotel',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
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

  it('applies extracted carHireRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
      adultCount: 2,
    });
    const extracted = processConversationTurn({
      message: 'I need car hire',
      state: currentState,
      userEntryId: 'user-8j-a',
      assistantEntryId: 'assistant-8j-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no car hire',
      state: currentState,
      userEntryId: 'user-8j-b',
      assistantEntryId: 'assistant-8j-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { carHireRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'book car hire',
      state: currentState,
      userEntryId: 'user-8j-c',
      assistantEntryId: 'assistant-8j-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { carHireRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'book car hire',
      state: currentState,
      userEntryId: 'user-8j-d',
      assistantEntryId: 'assistant-8j-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { carHireRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'I need a vehicle',
      state: currentState,
      userEntryId: 'user-8j-e',
      assistantEntryId: 'assistant-8j-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'book car hire. book flights. book a hotel. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        accommodationRequested: null,
        flightsRequested: null,
        carHireRequested: null,
      }),
      userEntryId: 'user-8j-f',
      assistantEntryId: 'assistant-8j-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message:
        'book car hire. book flights. book a hotel. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        accommodationRequested: null,
        flightsRequested: null,
        carHireRequested: null,
      }),
      userEntryId: 'user-8j-g',
      assistantEntryId: 'assistant-8j-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        carHireRequested: false,
      },
    });
    const vehicleHire = processConversationTurn({
      message: 'vehicle hire',
      state: currentState,
      userEntryId: 'user-8j-h',
      assistantEntryId: 'assistant-8j-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const rentalCars = processConversationTurn({
      message: 'show me rental cars',
      state: currentState,
      userEntryId: 'user-8j-i',
      assistantEntryId: 'assistant-8j-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });
    const alreadyBookedPreserved = processConversationTurn({
      message: 'I have a rental car',
      state: currentState,
      userEntryId: 'user-8j-j',
      assistantEntryId: 'assistant-8j-j',
      userMessageAt: new Date('2026-07-29T00:00:28.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:29.000Z'),
    });

    expect(extracted.state.carHireRequested).toBe(true);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.accommodationRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(extracted.state.adultCount).toBe(2);
    expect(overriddenTrue.state.carHireRequested).toBe(true);
    expect(overriddenFalse.state.carHireRequested).toBe(false);
    expect(nullOverride.state.carHireRequested).toBeNull();
    expect(preserved.state.carHireRequested).toBe(false);
    expect(composed.state.carHireRequested).toBe(true);
    expect(composed.state.flightsRequested).toBe(true);
    expect(composed.state.accommodationRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.carHireRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(vehicleHire.state.carHireRequested).toBe(true);
    expect(rentalCars.state.carHireRequested).toBe(true);
    expect(alreadyBookedPreserved.state.carHireRequested).toBe(false);
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

  it('keeps Destination through CarHireRequested as the only behaviourally active production extractors', () => {
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
    expect(extractors[10]).toBeInstanceOf(CarHireRequestedConversationStateExtractor);
    expect(extractors[37]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      flightsRequested: false,
      accommodationRequested: false,
      carHireRequested: false,
    });

    const carHireActiveMessage =
      'book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: carHireActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        flightsRequested: true,
        accommodationRequested: true,
        carHireRequested: true,
      },
    });

    for (let index = 11; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: carHireActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[10]?.extract({
        message: carHireActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { carHireRequested: true } });
    expect(
      extractors[9]?.extract({
        message: carHireActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
    expect(
      extractors[8]?.extract({
        message: carHireActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { flightsRequested: true } });

    const accommodationOnlyMessage = 'book a hotel';
    expect(
      extractors[9]?.extract({
        message: accommodationOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { accommodationRequested: true } });
    expect(
      extractors[10]?.extract({
        message: accommodationOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 10; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: accommodationOnlyMessage,
          currentState,
        }),
        `extractor ${index} on accommodation message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
