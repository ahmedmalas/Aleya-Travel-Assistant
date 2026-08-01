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
import { RestaurantPreferenceConversationStateExtractor } from '../RestaurantPreferenceConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';
import { HikingWalkingRequestedConversationStateExtractor } from '../extractors/HikingWalkingRequestedConversationStateExtractor';
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';

const ROOT = process.cwd();
const FOUR_WHEEL_DRIVING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/FourWheelDrivingRequestedConversationStateExtractor.ts',
);
const KAYAKING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/KayakingRequestedConversationStateExtractor.ts',
);
const HIKING_WALKING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/HikingWalkingRequestedConversationStateExtractor.ts',
);
const NATIONAL_PARKS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/NationalParksRequestedConversationStateExtractor.ts',
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
      conversationId: 'conversation-8t',
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

describe('phase 8T — FourWheelDrivingRequestedConversationStateExtractor activation', () => {
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
      '4x4',
      'off road driving',
      'off-road driving',
      'four wheel drive tracks',
      '4wd tracks',
      '4x4 tracks',
      'off road tracks',
      'find 4wd tracks',
      'find four wheel drive tracks',
      'search 4wd tracks',
      'show me 4wd tracks',
      'recommend 4wd tracks',
      '4wd recommendations',
      '4wd options',
      'best 4wd tracks',
      'nearby 4wd tracks',
      '4wd tracks near me',
      'places to go four wheel driving',
      'where can I go 4wding',
      'include four wheel driving',
      'add 4wding',
      'I want 4wding',
      'go four wheel driving',
      'show me 4wd tracks near Brisbane',
      'find the best four wheel drive tracks near Cairns',
      'I want 4wding and camping',
      'include four wheel driving on this trip',
      'recommend beginner-friendly 4wd tracks',
      'find places to go off road near the national park',
      'four wheel driving in national parks',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ fourWheelDriveRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { fourWheelDriveRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nearbyDiscoveryRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('activitiesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('beachesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('campingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nationalParksRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'hikingWalkingRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('kayakingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('restaurantsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('carHireRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'scenicDrivesRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('emits only fourWheelDriveRequested from nearby-4wd, 4wding-and-camping, and national-parks wording', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'nearby 4wd tracks',
        currentState: createState({ fourWheelDriveRequested: null }),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      extractor.extract({
        message: '4wd tracks near me',
        currentState: createState({ fourWheelDriveRequested: null }),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      extractor.extract({
        message: 'I want 4wding and camping',
        currentState: createState({ fourWheelDriveRequested: null }),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      extractor.extract({
        message: 'four wheel driving in national parks',
        currentState: createState({ fourWheelDriveRequested: null }),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
  });

  it('returns empty for hire, equipment, conditions, named tracks, historical, negation, and ambiguous wording', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const unsupported = [
      '4wd hire',
      'four wheel drive hire',
      '4wd rental',
      '4x4 rental',
      'buy a 4wd',
      '4wd for sale',
      '4wd dealership',
      '4wd vehicle',
      '4wd tyres',
      '4wd accessories',
      '4wd equipment',
      '4wd recovery gear',
      '4wd winch',
      '4wd suspension',
      '4wd service',
      '4wd repairs',
      '4wd permit',
      '4wd rules',
      '4wd regulations',
      '4wd track map',
      '4wd track conditions',
      '4wd track closure',
      '4wd warning',
      'off road weather',
      'hire a 4WD',
      'rent a four-wheel drive',
      'vehicle hire',
      'SUV',
      'off-road',
      'off road adventure',
      'four-wheel drive',
      'Finke Desert Race',
      'Larapinta Trail',
      'we went four wheel driving',
      'we drove the track',
      'I own a 4wd',
      'I like 4wding',
      '4wd?',
      'what is four wheel driving',
      'no four wheel driving',
      'no 4wding',
      'do not include 4wding',
      "don't include four wheel driving",
      'without 4wd tracks',
      'remove four wheel driving',
      'cancel the 4wd plans',
      "I don't want 4wding",
      'avoid off road driving',
      'skip four wheel driving',
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

    expect(source).toContain('Phase 7Q');
    expect(source).toContain('Phase 8T');
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
    expect(readFileSync(CAR_HIRE_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7J');
    expect(readFileSync(CAR_HIRE_REQUESTED_SOURCE, 'utf8')).toContain('Phase 8J');
    expect(readFileSync(ACTIVITIES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7K',
    );
    expect(readFileSync(ACTIVITIES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8K',
    );
    expect(readFileSync(RESTAURANTS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7L',
    );
    expect(readFileSync(RESTAURANTS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8L',
    );
    expect(readFileSync(NEARBY_DISCOVERY_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7M',
    );
    expect(readFileSync(NEARBY_DISCOVERY_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8M',
    );
    expect(readFileSync(BEACHES_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7N');
    expect(readFileSync(BEACHES_REQUESTED_SOURCE, 'utf8')).toContain('Phase 8N');
    expect(readFileSync(CAMPING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7O');
    expect(readFileSync(CAMPING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 8P');
    expect(readFileSync(NATIONAL_PARKS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7AA',
    );
    expect(readFileSync(NATIONAL_PARKS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8Q',
    );
    expect(readFileSync(HIKING_WALKING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7U',
    );
    expect(readFileSync(HIKING_WALKING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8R',
    );
    expect(readFileSync(KAYAKING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7P');
    expect(readFileSync(KAYAKING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 8S');

    expect(
      new KayakingRequestedConversationStateExtractor().extract({
        message: 'show me kayaking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      new KayakingRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new HikingWalkingRequestedConversationStateExtractor().extract({
        message: 'show me hiking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      new HikingWalkingRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new NationalParksRequestedConversationStateExtractor().extract({
        message: 'show me national parks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
    expect(
      new NationalParksRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new CampingRequestedConversationStateExtractor().extract({
        message: 'add camping',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      new CampingRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new NearbyDiscoveryRequestedConversationStateExtractor().extract({
        message: 'what is nearby',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nearbyDiscoveryRequested: true } });
    expect(
      new NearbyDiscoveryRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new ActivitiesRequestedConversationStateExtractor().extract({
        message: 'book activities',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });
    expect(
      new ActivitiesRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new CarHireRequestedConversationStateExtractor().extract({
        message: 'book car hire',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { carHireRequested: true } });
    expect(
      new CarHireRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new BeachesRequestedConversationStateExtractor().extract({
        message: 'show me beaches',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
    expect(
      new RestaurantsRequestedConversationStateExtractor().extract({
        message: 'find restaurants',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { restaurantsRequested: true } });
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
      message: 'show me 4wd tracks',
      state: currentState,
      userEntryId: 'user-8t-a',
      assistantEntryId: 'assistant-8t-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no 4WD',
      state: currentState,
      userEntryId: 'user-8t-b',
      assistantEntryId: 'assistant-8t-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { fourWheelDriveRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add four-wheel driving',
      state: currentState,
      userEntryId: 'user-8t-c',
      assistantEntryId: 'assistant-8t-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { fourWheelDriveRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add four-wheel driving',
      state: currentState,
      userEntryId: 'user-8t-d',
      assistantEntryId: 'assistant-8t-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { fourWheelDriveRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'hire a 4WD',
      state: currentState,
      userEntryId: 'user-8t-e',
      assistantEntryId: 'assistant-8t-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'show me 4wd tracks. show me kayaking. show me hiking. show me national parks. show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      userEntryId: 'user-8t-f',
      assistantEntryId: 'assistant-8t-f',
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
      userEntryId: 'user-8t-g',
      assistantEntryId: 'assistant-8t-g',
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
    expect(composed.state.kayakingRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.fourWheelDriveRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
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

  it('keeps Destination through FourWheelDrivingRequested as the only behaviourally active production extractors', () => {
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
    expect(extractors[11]).toBeInstanceOf(
      ActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[12]).toBeInstanceOf(
      RestaurantsRequestedConversationStateExtractor,
    );
    expect(extractors[13]).toBeInstanceOf(
      RestaurantPreferenceConversationStateExtractor,
    );
    expect(extractors[14]).toBeInstanceOf(
      NearbyDiscoveryRequestedConversationStateExtractor,
    );
    expect(extractors[15]).toBeInstanceOf(BeachesRequestedConversationStateExtractor);
    expect(extractors[16]).toBeInstanceOf(CampingRequestedConversationStateExtractor);
    expect(extractors[17]).toBeInstanceOf(KayakingRequestedConversationStateExtractor);
    expect(extractors[18]).toBeInstanceOf(
      FourWheelDrivingRequestedConversationStateExtractor,
    );
    expect(extractors[37]).toBeInstanceOf(EmptyConversationStateExtractor);

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

    for (let index = 19; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: fourWheelActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[18]?.extract({
        message: fourWheelActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      extractors[17]?.extract({
        message: fourWheelActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      extractors[16]?.extract({
        message: fourWheelActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });

    const fourWheelOnlyMessage = '4wd options';
    expect(
      extractors[18]?.extract({
        message: fourWheelOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      createConversationStateExtractor().extract({
        message: fourWheelOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });

    for (let index = 0; index < extractors.length; index += 1) {
      if (index === 18) {
        continue;
      }
      expect(
        extractors[index]?.extract({
          message: fourWheelOnlyMessage,
          currentState,
        }),
        `extractor ${index} on 4wd-only message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
