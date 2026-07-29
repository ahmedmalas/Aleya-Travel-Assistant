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

const ROOT = process.cwd();
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
      conversationId: 'conversation-7x',
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
    wineriesFoodTrailsRequested: false,
    eventsFestivalsRequested: false,
    wildlifeRequested: false,
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

describe('phase 7X — WineriesFoodTrailsRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit wineriesFoodTrailsRequested true contract', () => {
    expectTypeOf<WineriesFoodTrailsRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<WineriesFoodTrailsRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<WineriesFoodTrailsRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'add wineries',
        currentState: createState({ wineriesFoodTrailsRequested: null }),
      }),
    ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
  });

  it('extracts supported explicit wineries/food-trails-request forms as true', () => {
    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    const cases = [
      'wineries and food trails',
      'wineries',
      'winery',
      'food trails',
      'food trail',
      'show wineries',
      'show food trails',
      'show me wineries',
      'show me food trails',
      'find wineries',
      'find food trails',
      'I need wineries',
      'I need food trails',
      'include wineries',
      'include food trails',
      'add wineries',
      'add food trails',
      'need wineries',
      'need food trails',
      'book wineries',
      'book food trails',
    ];

    for (const message of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ wineriesFoodTrailsRequested: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
    }
  });

  it('returns empty for wine/food/restaurants/vineyards/tours, named places, typed variants, nearby, negation, remove/forget, and keep wording', () => {
    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    const unsupported = [
      'wine',
      'food',
      'restaurants',
      'vineyards',
      'cellar doors',
      'markets',
      'food tours',
      'wine tours',
      'Penfolds',
      'Barossa Valley',
      'boutique wineries',
      'organic winery',
      'guided food trails',
      'wineries near the hotel',
      'nearby wineries',
      'food trails in Hunter Valley',
      'wineries in Margaret River',
      'do not include wineries',
      'no wineries',
      'no food trails',
      "don't add wineries",
      'without wineries',
      'remove wineries',
      'forget food trails',
      'keep wineries',
      'actually show me wineries',
      'instead food trails',
      'not wineries but restaurants',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ wineriesFoodTrailsRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits wineriesFoodTrailsRequested false or null from extraction', () => {
    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no wineries',
      currentState: createState({ wineriesFoodTrailsRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('wineriesFoodTrailsRequested');

    const update = extractor.extract({
      message: 'add wineries',
      currentState: createState({ wineriesFoodTrailsRequested: null }),
    }).stateUpdate;
    expect(update.wineriesFoodTrailsRequested).toBe(true);
    expect(update.wineriesFoodTrailsRequested).not.toBe(false);
    expect(update.wineriesFoodTrailsRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    const currentState = createState({
      wineriesFoodTrailsRequested: false,
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
      message: 'show me wineries',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.wineriesFoodTrailsRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });

    const other =
      new WineriesFoodTrailsRequestedConversationStateExtractor() as WineriesFoodTrailsRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as WineriesFoodTrailsRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'wineries',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(WINERIES_FOOD_TRAILS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/wineriesFoodTrailsRequested\s*:\s*true/);
    expect(source).not.toMatch(/wineriesFoodTrailsRequested\s*:\s*false/);
    expect(source).not.toMatch(/wineriesFoodTrailsRequested\s*:\s*null/);
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
      WINERIES_FOOD_TRAILS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/WineriesFoodTrailsRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'WineriesFoodTrailsRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/WineriesFoodTrailsRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new WineriesFoodTrailsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('WineriesFoodTrailsRequestedConversationStateExtractor'), file).toBe(
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
    expect(readFileSync(DIVING_SNORKELLING_REQUESTED_SOURCE, 'utf8')).toContain('Phase 7W');
    expect(
      new DivingSnorkellingRequestedConversationStateExtractor().extract({
        message: 'add diving',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { divingSnorkellingRequested: true } });
    expect(
      new FishingRequestedConversationStateExtractor().extract({
        message: 'add fishing',
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

  it('applies extracted wineriesFoodTrailsRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: false,
      eventsFestivalsRequested: false,
      wildlifeRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'add wineries',
      state: currentState,
      userEntryId: 'user-7x-a',
      assistantEntryId: 'assistant-7x-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no wineries',
      state: currentState,
      userEntryId: 'user-7x-b',
      assistantEntryId: 'assistant-7x-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { wineriesFoodTrailsRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add wineries',
      state: currentState,
      userEntryId: 'user-7x-c',
      assistantEntryId: 'assistant-7x-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { wineriesFoodTrailsRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add wineries',
      state: currentState,
      userEntryId: 'user-7x-d',
      assistantEntryId: 'assistant-7x-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { wineriesFoodTrailsRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'wine tours',
      state: currentState,
      userEntryId: 'user-7x-e',
      assistantEntryId: 'assistant-7x-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'add wineries. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-7x-f',
      assistantEntryId: 'assistant-7x-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'add wineries. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-7x-g',
      assistantEntryId: 'assistant-7x-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        wineriesFoodTrailsRequested: false,
      },
    });

    expect(extracted.state.wineriesFoodTrailsRequested).toBe(true);
    expect(extracted.state.divingSnorkellingRequested).toBe(true);
    expect(extracted.state.fishingRequested).toBe(true);
    expect(extracted.state.hikingWalkingRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.wineriesFoodTrailsRequested).toBe(true);
    expect(overriddenFalse.state.wineriesFoodTrailsRequested).toBe(false);
    expect(nullOverride.state.wineriesFoodTrailsRequested).toBeNull();
    expect(preserved.state.wineriesFoodTrailsRequested).toBe(false);
    expect(composed.state.wineriesFoodTrailsRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.wineriesFoodTrailsRequested).toBe(false);
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

  it('keeps Destination through DivingSnorkellingRequested as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(28);
    expect(extractors[19]).toBeInstanceOf(
      SnowActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[20]).toBeInstanceOf(
      HikingWalkingRequestedConversationStateExtractor,
    );
    expect(extractors[21]).toBeInstanceOf(FishingRequestedConversationStateExtractor);
    expect(extractors[22]).toBeInstanceOf(DivingSnorkellingRequestedConversationStateExtractor);
    expect(extractors[23]).toBeInstanceOf(WineriesFoodTrailsRequestedConversationStateExtractor);
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
      scenicDrivesRequested: false,
      attractionsRequested: false,
      snowActivitiesRequested: false,
      hikingWalkingRequested: false,
      fishingRequested: false,
      divingSnorkellingRequested: false,
      wineriesFoodTrailsRequested: false,
      eventsFestivalsRequested: false,
      wildlifeRequested: false,
    });

    // ActivitiesRequested intentionally ignores messages that also mention snow
    // activities, so this composed cue set omits an activities emission.
    const wineriesActiveMessage =
      'add wineries. add diving. add fishing. add hiking. add snow activities. add attractions. add scenic drives. add four-wheel driving. add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: wineriesActiveMessage,
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
      },
    });
    expect(
      extractors[10]?.extract({
        message: 'book activities',
        currentState,
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });

    for (let index = 24; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: wineriesActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[23]?.extract({
        message: wineriesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
    expect(
      extractors[22]?.extract({
        message: wineriesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { divingSnorkellingRequested: true } });
    expect(
      extractors[21]?.extract({
        message: wineriesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });
    expect(
      extractors[20]?.extract({
        message: wineriesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractors[19]?.extract({
        message: wineriesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });

    const divingOnlyMessage = 'add diving';
    expect(
      extractors[22]?.extract({
        message: divingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { divingSnorkellingRequested: true } });
    expect(
      extractors[23]?.extract({
        message: divingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 24; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: divingOnlyMessage,
          currentState,
        }),
        `extractor ${index} on diving message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
