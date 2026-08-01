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
import { AttractionsRequestedConversationStateExtractor } from '../AttractionsRequestedConversationStateExtractor';
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
import { ScenicDrivesRequestedConversationStateExtractor } from '../ScenicDrivesRequestedConversationStateExtractor';
import { SnowActivitiesRequestedConversationStateExtractor } from '../SnowActivitiesRequestedConversationStateExtractor';
import { HikingWalkingRequestedConversationStateExtractor } from '../extractors/HikingWalkingRequestedConversationStateExtractor';
import { FishingRequestedConversationStateExtractor } from '../extractors/FishingRequestedConversationStateExtractor';
import { DivingSnorkellingRequestedConversationStateExtractor } from '../extractors/DivingSnorkellingRequestedConversationStateExtractor';
import { WineriesFoodTrailsRequestedConversationStateExtractor } from '../extractors/WineriesFoodTrailsRequestedConversationStateExtractor';
import { EventsFestivalsRequestedConversationStateExtractor } from '../extractors/EventsFestivalsRequestedConversationStateExtractor';
import { WildlifeRequestedConversationStateExtractor } from '../extractors/WildlifeRequestedConversationStateExtractor';
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';

const ROOT = process.cwd();
const NATIONAL_PARKS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/NationalParksRequestedConversationStateExtractor.ts',
);
const WILDLIFE_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/WildlifeRequestedConversationStateExtractor.ts',
);
const EVENTS_FESTIVALS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/EventsFestivalsRequestedConversationStateExtractor.ts',
);
const WINERIES_FOOD_TRAILS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/WineriesFoodTrailsRequestedConversationStateExtractor.ts',
);
const DIVING_SNORKELLING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/DivingSnorkellingRequestedConversationStateExtractor.ts',
);
const FISHING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/FishingRequestedConversationStateExtractor.ts',
);
const HIKING_WALKING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/HikingWalkingRequestedConversationStateExtractor.ts',
);
const SNOW_ACTIVITIES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/SnowActivitiesRequestedConversationStateExtractor.ts',
);
const ATTRACTIONS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/AttractionsRequestedConversationStateExtractor.ts',
);
const SCENIC_DRIVES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ScenicDrivesRequestedConversationStateExtractor.ts',
);
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
      conversationId: 'conversation-8q',
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
    fourWheelDriveRequested: true,
    scenicDrivesRequested: true,
    attractionsRequested: true,
    snowActivitiesRequested: true,
    hikingWalkingRequested: true,
    fishingRequested: true,
    divingSnorkellingRequested: true,
    wineriesFoodTrailsRequested: true,
    eventsFestivalsRequested: true,
    wildlifeRequested: true,
    nationalParksRequested: false,
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

describe('phase 9D — NationalParksRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit nationalParksRequested true contract', () => {
    expectTypeOf<NationalParksRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<NationalParksRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<NationalParksRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new NationalParksRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'show me national parks',
        currentState: createState({ nationalParksRequested: null }),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
  });

  it('extracts supported explicit national-parks-request forms as true', () => {
    const extractor = new NationalParksRequestedConversationStateExtractor();
    const cases = [
      'national parks',
      'national park',
      'find national parks',
      'find a national park',
      'search national parks',
      'show me national parks',
      'recommend national parks',
      'national park recommendations',
      'national park options',
      'best national parks',
      'nearby national parks',
      'national parks near me',
      'parks to visit',
      'which national parks should I visit',
      'include national parks',
      'add national parks',
      'I want national parks',
      'visit a national park',
      'need national parks',
      'book national parks',
      'show me national parks near Brisbane',
      'find the best national parks near Cairns',
      'I want national parks and camping',
      'include national parks on this trip',
      'recommend family-friendly national parks',
      'find national parks near the Gold Coast',
      'state parks',
      'nature reserves',
      'protected parks',
      'park locations',
      'park options',
      'places to visit in national parks',
      'places to explore nature',
      'explore nature reserves',
      'discover state parks',
      'see national parks',
      'where can I visit national parks?',
      'show me Kakadu National Park',
      'visit Royal National Park',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ nationalParksRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { nationalParksRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nearbyDiscoveryRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('activitiesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('beachesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('campingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('wildlifeRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'eventsFestivalsRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('restaurantsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
      expect(JSON.stringify(result.stateUpdate), message).not.toMatch(
        /Kakadu|Royal|Brisbane|Cairns/i,
      );
    }
  });

  it('emits only nationalParksRequested from nearby-national-parks and parks-and-camping wording', () => {
    const extractor = new NationalParksRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'nearby national parks',
        currentState: createState({ nationalParksRequested: null }),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
    expect(
      extractor.extract({
        message: 'national parks near me',
        currentState: createState({ nationalParksRequested: null }),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
    expect(
      extractor.extract({
        message: 'I want national parks and camping',
        currentState: createState({ nationalParksRequested: null }),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
  });

  it('returns empty for tickets, camping bookings, named-alone, weather, maps, historical, and negation wording', () => {
    const extractor = new NationalParksRequestedConversationStateExtractor();
    const unsupported = [
      'national park pass',
      'national park permit',
      'park entry tickets',
      'camping bookings',
      'book camping',
      'national park fees',
      'national park rules',
      'national park regulations',
      'national park map',
      'national park address',
      'national park weather',
      'national park conditions',
      'national park warning',
      'national park closure',
      'national park fire ban',
      'national park accommodation',
      'park employment',
      'hotel near a national park',
      'we visited a national park',
      'the national park was crowded',
      'I like national parks',
      'national parks?',
      'what is a national park',
      'Royal National Park',
      'Kakadu National Park',
      'Blue Mountains National Park',
      'Daintree National Park',
      'Sydney',
      'Melbourne',
      'parks',
      'park',
      'playground',
      'gardens',
      'reserves',
      'conservation areas',
      'protected areas',
      'coastal national parks',
      'Australian national parks',
      'local national parks',
      'guided national parks',
      'no national parks',
      'do not include national parks',
      "don't include national parks",
      'without national parks',
      'remove national parks',
      'cancel the national park plans',
      "I don't want national parks",
      'avoid national parks',
      'skip national parks',
      'forget national parks',
      'keep national parks',
      'actually show me national parks',
      'instead national parks',
      'not national parks but beaches',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ nationalParksRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits nationalParksRequested false or null from extraction', () => {
    const extractor = new NationalParksRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no national parks',
      currentState: createState({ nationalParksRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('nationalParksRequested');

    const update = extractor.extract({
      message: 'add national parks',
      currentState: createState({ nationalParksRequested: null }),
    }).stateUpdate;
    expect(update.nationalParksRequested).toBe(true);
    expect(update.nationalParksRequested).not.toBe(false);
    expect(update.nationalParksRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new NationalParksRequestedConversationStateExtractor();
    const currentState = createState({
      wildlifeRequested: false,
      nationalParksRequested: false,
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
      message: 'show me national parks',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.nationalParksRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { nationalParksRequested: true } });

    const other =
      new NationalParksRequestedConversationStateExtractor() as NationalParksRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as NationalParksRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'national parks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(NATIONAL_PARKS_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7AA');
    expect(source).toContain('Phase 8Q');
    expect(source).toContain('Phase 9D');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/nationalParksRequested\s*:\s*true/);
    expect(source).not.toMatch(/nationalParksRequested\s*:\s*false/);
    expect(source).not.toMatch(/nationalParksRequested\s*:\s*null/);
    expect(source).not.toMatch(/\.trim\(/);
    expect(source).not.toMatch(/\.toLowerCase\(/);
    expect(source).not.toMatch(/\.includes\(/);
    expect(source).not.toMatch(/provider|travel-location/i);
    expect(source).not.toMatch(/metadata|confidence|warnings/);
    expect(source).not.toMatch(/from '\.\.\/\.\.|from '\.\.\/\.\.\/\.\./);
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
      NATIONAL_PARKS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/NationalParksRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'NationalParksRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/NationalParksRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new NationalParksRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('NationalParksRequestedConversationStateExtractor'), file).toBe(
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
    expect(readFileSync(KAYAKING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7P');
    expect(readFileSync(FOUR_WHEEL_DRIVING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7Q',
    );
    expect(readFileSync(SCENIC_DRIVES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7R',
    );
    expect(readFileSync(ATTRACTIONS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7S',
    );
    expect(readFileSync(SNOW_ACTIVITIES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7T',
    );
    expect(readFileSync(HIKING_WALKING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7U',
    );

    expect(readFileSync(FISHING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7V');
    expect(readFileSync(FISHING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 8Y');
    expect(readFileSync(DIVING_SNORKELLING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7W',
    );
    expect(readFileSync(DIVING_SNORKELLING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8Z',
    );
    expect(readFileSync(WINERIES_FOOD_TRAILS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7X',
    );
    expect(readFileSync(WINERIES_FOOD_TRAILS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 9A',
    );
    expect(
      new WineriesFoodTrailsRequestedConversationStateExtractor().extract({
        message: 'winery options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
    expect(readFileSync(EVENTS_FESTIVALS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7Y',
    );
    expect(readFileSync(EVENTS_FESTIVALS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 9B',
    );
    expect(
      new EventsFestivalsRequestedConversationStateExtractor().extract({
        message: 'festival options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { eventsFestivalsRequested: true } });
    expect(readFileSync(WILDLIFE_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7Z');
    expect(readFileSync(WILDLIFE_REQUESTED_SOURCE, 'utf8')).toContain('Phase 9C');
    expect(
      new WildlifeRequestedConversationStateExtractor().extract({
        message: 'wildlife options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { wildlifeRequested: true } });
    expect(
      new DivingSnorkellingRequestedConversationStateExtractor().extract({
        message: 'diving options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { divingSnorkellingRequested: true } });
    expect(
      new FishingRequestedConversationStateExtractor().extract({
        message: 'fishing options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });

    expect(
      new HikingWalkingRequestedConversationStateExtractor().extract({
        message: 'add hiking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      new SnowActivitiesRequestedConversationStateExtractor().extract({
        message: 'add snow activities',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      new AttractionsRequestedConversationStateExtractor().extract({
        message: 'add attractions',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { attractionsRequested: true } });
    expect(
      new ScenicDrivesRequestedConversationStateExtractor().extract({
        message: 'add scenic drives',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { scenicDrivesRequested: true } });
    expect(
      new FourWheelDrivingRequestedConversationStateExtractor().extract({
        message: 'add four-wheel driving',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
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
      new CampingRequestedConversationStateExtractor().extract({
        message: 'show me national parks',
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
      new BeachesRequestedConversationStateExtractor().extract({
        message: 'show me national parks',
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
        message: 'show me national parks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
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
      new ActivitiesRequestedConversationStateExtractor().extract({
        message: 'show me national parks',
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

  it('applies extracted nationalParksRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: true,
      eventsFestivalsRequested: true,
      wildlifeRequested: true,
      nationalParksRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'show me national parks',
      state: currentState,
      userEntryId: 'user-8q-a',
      assistantEntryId: 'assistant-8q-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no national parks',
      state: currentState,
      userEntryId: 'user-8q-b',
      assistantEntryId: 'assistant-8q-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { nationalParksRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add national parks',
      state: currentState,
      userEntryId: 'user-8q-c',
      assistantEntryId: 'assistant-8q-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { nationalParksRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add national parks',
      state: currentState,
      userEntryId: 'user-8q-d',
      assistantEntryId: 'assistant-8q-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { nationalParksRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'national park weather',
      state: currentState,
      userEntryId: 'user-8q-e',
      assistantEntryId: 'assistant-8q-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'show me national parks. show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
        scenicDrivesRequested: null,
        attractionsRequested: null,
        snowActivitiesRequested: null,
        hikingWalkingRequested: null,
        fishingRequested: null,
        divingSnorkellingRequested: null,
        wineriesFoodTrailsRequested: null,
        eventsFestivalsRequested: null,
        wildlifeRequested: null,
        nationalParksRequested: null,
      }),
      userEntryId: 'user-8q-f',
      assistantEntryId: 'assistant-8q-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message:
        'show me national parks. show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
        scenicDrivesRequested: null,
        attractionsRequested: null,
        snowActivitiesRequested: null,
        hikingWalkingRequested: null,
        fishingRequested: null,
        divingSnorkellingRequested: null,
        wineriesFoodTrailsRequested: null,
        eventsFestivalsRequested: null,
        wildlifeRequested: null,
        nationalParksRequested: null,
      }),
      userEntryId: 'user-8q-g',
      assistantEntryId: 'assistant-8q-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        nationalParksRequested: false,
      },
    });
    const bestParks = processConversationTurn({
      message: 'best national parks',
      state: currentState,
      userEntryId: 'user-8q-h',
      assistantEntryId: 'assistant-8q-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const parksToVisit = processConversationTurn({
      message: 'parks to visit',
      state: currentState,
      userEntryId: 'user-8q-i',
      assistantEntryId: 'assistant-8q-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });
    const namedPreserved = processConversationTurn({
      message: 'Kakadu National Park',
      state: currentState,
      userEntryId: 'user-8q-j',
      assistantEntryId: 'assistant-8q-j',
      userMessageAt: new Date('2026-07-29T00:00:28.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:29.000Z'),
    });

    expect(extracted.state.nationalParksRequested).toBe(true);
    expect(extracted.state.campingRequested).toBe(true);
    expect(extracted.state.beachesRequested).toBe(true);
    expect(extracted.state.eventsFestivalsRequested).toBe(true);
    expect(extracted.state.wineriesFoodTrailsRequested).toBe(true);
    expect(extracted.state.divingSnorkellingRequested).toBe(true);
    expect(extracted.state.fishingRequested).toBe(true);
    expect(extracted.state.hikingWalkingRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.nationalParksRequested).toBe(true);
    expect(overriddenFalse.state.nationalParksRequested).toBe(false);
    expect(nullOverride.state.nationalParksRequested).toBeNull();
    expect(preserved.state.nationalParksRequested).toBe(false);
    expect(composed.state.nationalParksRequested).toBe(true);
    expect(composed.state.campingRequested).toBe(true);
    expect(composed.state.beachesRequested).toBe(true);
    expect(composed.state.nearbyDiscoveryRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.nationalParksRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(bestParks.state.nationalParksRequested).toBe(true);
    expect(parksToVisit.state.nationalParksRequested).toBe(true);
    expect(namedPreserved.state.nationalParksRequested).toBe(false);
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

  it('keeps Destination through WildlifeRequested as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(35);
    expect(extractors[20]).toBeInstanceOf(
      SnowActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[21]).toBeInstanceOf(
      HikingWalkingRequestedConversationStateExtractor,
    );
    expect(extractors[22]).toBeInstanceOf(FishingRequestedConversationStateExtractor);
    expect(extractors[23]).toBeInstanceOf(DivingSnorkellingRequestedConversationStateExtractor);
    expect(extractors[24]).toBeInstanceOf(WineriesFoodTrailsRequestedConversationStateExtractor);
    expect(extractors[25]).toBeInstanceOf(EventsFestivalsRequestedConversationStateExtractor);
    expect(extractors[26]).toBeInstanceOf(WildlifeRequestedConversationStateExtractor);
    expect(extractors[27]).toBeInstanceOf(NationalParksRequestedConversationStateExtractor);
    expect(extractors[34]).toBeInstanceOf(EmptyConversationStateExtractor);

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
      scenicDrivesRequested: false,
      attractionsRequested: false,
      snowActivitiesRequested: false,
      hikingWalkingRequested: false,
      fishingRequested: false,
      divingSnorkellingRequested: false,
      wineriesFoodTrailsRequested: false,
      eventsFestivalsRequested: false,
      wildlifeRequested: false,
      nationalParksRequested: false,
    });

    // ActivitiesRequested intentionally ignores messages that also mention snow
    // activities, so this composed cue set omits an activities emission.
    const nationalParksActiveMessage =
      'add national parks. add wildlife. add festivals. add wineries. add diving. add fishing. add hiking. add snow activities. add attractions. add scenic drives. add four-wheel driving. add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: nationalParksActiveMessage,
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
        restaurantsRequested: true,
        nearbyDiscoveryRequested: true,
        beachesRequested: true,
        campingRequested: true,
        kayakingRequested: true,
        fourWheelDriveRequested: true,
        scenicDrivesRequested: true,
        attractionsRequested: true,
        snowActivitiesRequested: true,
        hikingWalkingRequested: true,
        fishingRequested: true,
        divingSnorkellingRequested: true,
        wineriesFoodTrailsRequested: true,
        eventsFestivalsRequested: true,
        wildlifeRequested: true,
        nationalParksRequested: true,
      },
    });
    expect(
      extractors[10]?.extract({
        message: 'book activities',
        currentState,
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });

    for (let index = 28; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: nationalParksActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[27]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
    expect(
      extractors[26]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { wildlifeRequested: true } });
    expect(
      extractors[25]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { eventsFestivalsRequested: true } });
    expect(
      extractors[24]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
    expect(
      extractors[23]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { divingSnorkellingRequested: true } });
    expect(
      extractors[22]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });
    expect(
      extractors[21]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractors[20]?.extract({
        message: nationalParksActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });

    const wildlifeOnlyMessage = 'wildlife options';
    expect(
      extractors[26]?.extract({
        message: wildlifeOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { wildlifeRequested: true } });
    expect(
      extractors[27]?.extract({
        message: wildlifeOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    const eventsOnlyMessage = 'festival options';
    expect(
      extractors[25]?.extract({
        message: eventsOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { eventsFestivalsRequested: true } });
    expect(
      extractors[26]?.extract({
        message: eventsOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[27]?.extract({
        message: eventsOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 28; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: eventsOnlyMessage,
          currentState,
        }),
        `extractor ${index} on events message`,
      ).toEqual({ stateUpdate: {} });
    }

    const parksOnlyMessage = 'park options';
    expect(
      extractors[27]?.extract({
        message: parksOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
    expect(
      extractors[26]?.extract({
        message: parksOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[25]?.extract({
        message: parksOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[22]?.extract({
        message: parksOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
  });
});
