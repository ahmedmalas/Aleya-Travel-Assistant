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
import { AccommodationRequestedConversationStateExtractor } from '../AccommodationRequestedConversationStateExtractor';
import { ActivitiesRequestedConversationStateExtractor } from '../ActivitiesRequestedConversationStateExtractor';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { BeachesRequestedConversationStateExtractor } from '../BeachesRequestedConversationStateExtractor';
import { CampingRequestedConversationStateExtractor } from '../CampingRequestedConversationStateExtractor';
import { CarHireRequestedConversationStateExtractor } from '../CarHireRequestedConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';
import { FourWheelDrivingRequestedConversationStateExtractor } from '../FourWheelDrivingRequestedConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { KayakingRequestedConversationStateExtractor } from '../KayakingRequestedConversationStateExtractor';
import { NearbyDiscoveryRequestedConversationStateExtractor } from '../NearbyDiscoveryRequestedConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { RestaurantsRequestedConversationStateExtractor } from '../RestaurantsRequestedConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
const FOUR_WHEEL_DRIVING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/FourWheelDrivingRequestedConversationStateExtractor.ts',
);
const KAYAKING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/KayakingRequestedConversationStateExtractor.ts',
);
const CAMPING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/CampingRequestedConversationStateExtractor.ts',
);
const BEACHES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/BeachesRequestedConversationStateExtractor.ts',
);
const NEARBY_DISCOVERY_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/NearbyDiscoveryRequestedConversationStateExtractor.ts',
);
const RESTAURANTS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/RestaurantsRequestedConversationStateExtractor.ts',
);
const ACTIVITIES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ActivitiesRequestedConversationStateExtractor.ts',
);
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
      conversationId: 'conversation-7q',
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
    carHireRequested: true,
    activitiesRequested: true,
    restaurantsRequested: true,
    nearbyDiscoveryRequested: true,
    beachesRequested: true,
    campingRequested: true,
    kayakingRequested: true,
    fourWheelDriveRequested: false,
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

describe('phase 7Q — FourWheelDrivingRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit fourWheelDriveRequested true contract', () => {
    expectTypeOf<FourWheelDrivingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<FourWheelDrivingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<FourWheelDrivingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'add four-wheel driving',
        currentState: createState({ fourWheelDriveRequested: null }),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
  });

  it('extracts supported explicit four-wheel-driving-request forms as true', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const cases = [
      'four wheel driving',
      'four-wheel driving',
      '4 wheel driving',
      '4-wheel driving',
      '4wd',
      '4WD',
      'show four wheel driving',
      'show me four-wheel driving',
      'find four-wheel driving',
      'I need four wheel driving',
      'include 4-wheel driving',
      'add 4wd',
      'need 4 wheel driving',
      'book four wheel driving',
    ];

    for (const message of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ fourWheelDriveRequested: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    }
  });

  it('returns empty for 4x4/SUV/off-road alone, vehicle hire, tracks/trails, typed variants, negation, remove/forget, and keep wording', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const unsupported = [
      '4x4',
      'SUV',
      'off-road',
      'off road adventure',
      'hire a 4WD',
      'rent a four-wheel drive',
      'vehicle hire',
      'show me 4WD tracks',
      'four wheel drive trail',
      '4WD route near Alice Springs',
      '4WD tour',
      'Finke Desert Race',
      'Larapinta Trail',
      'easy four-wheel driving',
      'guided four wheel driving',
      'family 4WD',
      'family-friendly 4WD',
      'beginner-friendly four-wheel driving',
      'scenic 4wd',
      'do not include four-wheel driving',
      'no 4WD',
      "don't add 4wd",
      'without four wheel driving',
      'remove four-wheel driving',
      'forget 4wd',
      'keep four-wheel driving',
      'actually show me 4wd',
      'instead 4wd',
      'not four wheel driving but scenic drives',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ fourWheelDriveRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits fourWheelDriveRequested false or null from extraction', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no 4WD',
      currentState: createState({ fourWheelDriveRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('fourWheelDriveRequested');

    const update = extractor.extract({
      message: 'add four-wheel driving',
      currentState: createState({ fourWheelDriveRequested: null }),
    }).stateUpdate;
    expect(update.fourWheelDriveRequested).toBe(true);
    expect(update.fourWheelDriveRequested).not.toBe(false);
    expect(update.fourWheelDriveRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const currentState = createState({
      fourWheelDriveRequested: false,
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
      message: 'show me four-wheel driving',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.fourWheelDriveRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });

    const other =
      new FourWheelDrivingRequestedConversationStateExtractor() as FourWheelDrivingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as FourWheelDrivingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: '4wd',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(FOUR_WHEEL_DRIVING_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/fourWheelDriveRequested\s*:\s*true/);
    expect(source).not.toMatch(/fourWheelDriveRequested\s*:\s*false/);
    expect(source).not.toMatch(/fourWheelDriveRequested\s*:\s*null/);
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
      FOUR_WHEEL_DRIVING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/FourWheelDrivingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'FourWheelDrivingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /FourWheelDrivingRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new FourWheelDrivingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('FourWheelDrivingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
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
    expect(readFileSync(FLIGHTS_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7H');
    expect(readFileSync(ACCOMMODATION_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7I',
    );
    expect(readFileSync(CAR_HIRE_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7J');
    expect(readFileSync(ACTIVITIES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7K',
    );
    expect(readFileSync(RESTAURANTS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7L',
    );
    expect(readFileSync(NEARBY_DISCOVERY_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7M',
    );
    expect(readFileSync(BEACHES_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7N');
    expect(readFileSync(CAMPING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7O');
    expect(readFileSync(KAYAKING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7P');

    expect(
      new KayakingRequestedConversationStateExtractor().extract({
        message: 'add kayaking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      new CampingRequestedConversationStateExtractor().extract({
        message: 'add camping',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      new BeachesRequestedConversationStateExtractor().extract({
        message: 'show me beaches',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
    expect(
      new NearbyDiscoveryRequestedConversationStateExtractor().extract({
        message: 'what is nearby',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nearbyDiscoveryRequested: true } });
    expect(
      new RestaurantsRequestedConversationStateExtractor().extract({
        message: 'find restaurants',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { restaurantsRequested: true } });
    expect(
      new ActivitiesRequestedConversationStateExtractor().extract({
        message: 'book activities',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });
    expect(
      new CarHireRequestedConversationStateExtractor().extract({
        message: 'book car hire',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { carHireRequested: true } });
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

  it('applies extracted fourWheelDriveRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: true,
      campingRequested: true,
      kayakingRequested: true,
      fourWheelDriveRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'add four-wheel driving',
      state: currentState,
      userEntryId: 'user-7q-a',
      assistantEntryId: 'assistant-7q-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no 4WD',
      state: currentState,
      userEntryId: 'user-7q-b',
      assistantEntryId: 'assistant-7q-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { fourWheelDriveRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add four-wheel driving',
      state: currentState,
      userEntryId: 'user-7q-c',
      assistantEntryId: 'assistant-7q-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { fourWheelDriveRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add four-wheel driving',
      state: currentState,
      userEntryId: 'user-7q-d',
      assistantEntryId: 'assistant-7q-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { fourWheelDriveRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'hire a 4WD',
      state: currentState,
      userEntryId: 'user-7q-e',
      assistantEntryId: 'assistant-7q-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'add four-wheel driving. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        accommodationRequested: null,
        flightsRequested: null,
        carHireRequested: null,
        activitiesRequested: null,
        restaurantsRequested: null,
        nearbyDiscoveryRequested: null,
        beachesRequested: null,
        campingRequested: null,
        kayakingRequested: null,
        fourWheelDriveRequested: null,
      }),
      userEntryId: 'user-7q-f',
      assistantEntryId: 'assistant-7q-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'add four-wheel driving. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        accommodationRequested: null,
        flightsRequested: null,
        carHireRequested: null,
        activitiesRequested: null,
        restaurantsRequested: null,
        nearbyDiscoveryRequested: null,
        beachesRequested: null,
        campingRequested: null,
        kayakingRequested: null,
        fourWheelDriveRequested: null,
      }),
      userEntryId: 'user-7q-g',
      assistantEntryId: 'assistant-7q-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        fourWheelDriveRequested: false,
      },
    });

    expect(extracted.state.fourWheelDriveRequested).toBe(true);
    expect(extracted.state.kayakingRequested).toBe(true);
    expect(extracted.state.campingRequested).toBe(true);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.fourWheelDriveRequested).toBe(true);
    expect(overriddenFalse.state.fourWheelDriveRequested).toBe(false);
    expect(nullOverride.state.fourWheelDriveRequested).toBeNull();
    expect(preserved.state.fourWheelDriveRequested).toBe(false);
    expect(composed.state.fourWheelDriveRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.fourWheelDriveRequested).toBe(false);
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

  it('keeps Destination through FourWheelDrivingRequested as the only behaviourally active production extractors', () => {
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
    expect(extractors[8]).toBeInstanceOf(
      AccommodationRequestedConversationStateExtractor,
    );
    expect(extractors[9]).toBeInstanceOf(CarHireRequestedConversationStateExtractor);
    expect(extractors[10]).toBeInstanceOf(
      ActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[11]).toBeInstanceOf(
      RestaurantsRequestedConversationStateExtractor,
    );
    expect(extractors[12]).toBeInstanceOf(
      NearbyDiscoveryRequestedConversationStateExtractor,
    );
    expect(extractors[13]).toBeInstanceOf(BeachesRequestedConversationStateExtractor);
    expect(extractors[14]).toBeInstanceOf(CampingRequestedConversationStateExtractor);
    expect(extractors[15]).toBeInstanceOf(KayakingRequestedConversationStateExtractor);
    expect(extractors[16]).toBeInstanceOf(
      FourWheelDrivingRequestedConversationStateExtractor,
    );
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      flightsRequested: false,
      accommodationRequested: false,
      carHireRequested: false,
      activitiesRequested: false,
      restaurantsRequested: false,
      nearbyDiscoveryRequested: false,
      beachesRequested: false,
      campingRequested: false,
      kayakingRequested: false,
      fourWheelDriveRequested: false,
    });

    const fourWheelActiveMessage =
      'add four-wheel driving. add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: fourWheelActiveMessage,
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
        activitiesRequested: true,
        restaurantsRequested: true,
        nearbyDiscoveryRequested: true,
        beachesRequested: true,
        campingRequested: true,
        kayakingRequested: true,
        fourWheelDriveRequested: true,
      },
    });

    for (let index = 17; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: fourWheelActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[16]?.extract({
        message: fourWheelActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      extractors[15]?.extract({
        message: fourWheelActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      extractors[14]?.extract({
        message: fourWheelActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });

    const kayakingOnlyMessage = 'add kayaking';
    expect(
      extractors[15]?.extract({
        message: kayakingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      extractors[16]?.extract({
        message: kayakingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 17; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: kayakingOnlyMessage,
          currentState,
        }),
        `extractor ${index} on kayaking message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
