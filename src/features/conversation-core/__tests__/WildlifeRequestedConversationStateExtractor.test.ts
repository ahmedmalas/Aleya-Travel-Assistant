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

const ROOT = process.cwd();
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
      conversationId: 'conversation-7z',
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

describe('phase 9C — WildlifeRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit wildlifeRequested true contract', () => {
    expectTypeOf<WildlifeRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<WildlifeRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<WildlifeRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new WildlifeRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'add wildlife',
        currentState: createState({ wildlifeRequested: null }),
      }),
    ).toEqual({ stateUpdate: { wildlifeRequested: true } });
  });

  it('extracts supported explicit wildlife-request forms as true', () => {
    const extractor = new WildlifeRequestedConversationStateExtractor();
    const cases = [
      'wildlife',
      'show wildlife',
      'show me wildlife',
      'find wildlife',
      'I need wildlife',
      'include wildlife',
      'add wildlife',
      'need wildlife',
      'book wildlife',
      'wildlife experiences',
      'wildlife encounters',
      'wildlife watching',
      'animal spotting',
      'birdwatching',
      'bird watching',
      'marine wildlife',
      'native animals',
      'wildlife locations',
      'wildlife spots',
      'wildlife options',
      'nearby wildlife',
      'places to see wildlife',
      'places to watch animals',
      'search wildlife spots',
      'recommend birdwatching',
      'see wildlife',
      'watch animals',
      'visit wildlife',
      'explore wildlife',
      'discover wildlife',
      'wildlife near me',
      'wildlife near the hotel',
      'wildlife in Cairns',
      'where can I see wildlife?',
      'show me wildlife and beaches',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ wildlifeRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { wildlifeRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty(
        'eventsFestivalsRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'wineriesFoodTrailsRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'divingSnorkellingRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('fishingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'hikingWalkingRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('beachesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nationalParksRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nearbyDiscoveryRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('returns empty for zoos, pets, hunting, parks, named animals alone, historical, informational, and negation wording', () => {
    const extractor = new WildlifeRequestedConversationStateExtractor();
    const unsupported = [
      'kangaroo',
      'koala',
      'wombat',
      'dolphin',
      'whale',
      'parrot',
      'zoo',
      'aquarium',
      'sanctuary',
      'wildlife park',
      'wildlife parks',
      'Lone Pine',
      'pet shop',
      'veterinary clinic',
      'adopt a koala',
      'hunting',
      'fishing',
      'wildlife rescue',
      'wildlife photography equipment',
      'wildlife tours',
      'wildlife tickets',
      'wildlife licence',
      'wildlife sightings',
      'we saw wildlife yesterday',
      'what is wildlife watching',
      'wildlife?',
      'do not include wildlife',
      'no wildlife',
      "don't add wildlife",
      'without wildlife',
      'remove wildlife',
      'cancel wildlife',
      'avoid wildlife',
      'skip wildlife',
      'forget wildlife',
      'keep wildlife',
      'actually show me wildlife',
      'instead wildlife',
      'not wildlife but beaches',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ wildlifeRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits wildlifeRequested false or null from extraction', () => {
    const extractor = new WildlifeRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no wildlife',
      currentState: createState({ wildlifeRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('wildlifeRequested');

    const update = extractor.extract({
      message: 'add wildlife',
      currentState: createState({ wildlifeRequested: null }),
    }).stateUpdate;
    expect(update.wildlifeRequested).toBe(true);
    expect(update.wildlifeRequested).not.toBe(false);
    expect(update.wildlifeRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new WildlifeRequestedConversationStateExtractor();
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
      message: 'show me wildlife',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.wildlifeRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { wildlifeRequested: true } });

    const other =
      new WildlifeRequestedConversationStateExtractor() as WildlifeRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as WildlifeRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'wildlife',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { wildlifeRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(WILDLIFE_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7Z');
    expect(source).toContain('Phase 9C');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/wildlifeRequested\s*:\s*true/);
    expect(source).not.toMatch(/wildlifeRequested\s*:\s*false/);
    expect(source).not.toMatch(/wildlifeRequested\s*:\s*null/);
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
      WILDLIFE_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/WildlifeRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'WildlifeRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/WildlifeRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new WildlifeRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('WildlifeRequestedConversationStateExtractor'), file).toBe(
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
    expect(readFileSync(EVENTS_FESTIVALS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7Y',
    );
    expect(readFileSync(EVENTS_FESTIVALS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 9B',
    );
    expect(readFileSync(HIKING_WALKING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8X',
    );
    expect(readFileSync(SNOW_ACTIVITIES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8W',
    );
    expect(readFileSync(ATTRACTIONS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8V',
    );
    expect(
      new WineriesFoodTrailsRequestedConversationStateExtractor().extract({
        message: 'winery options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
    expect(
      new EventsFestivalsRequestedConversationStateExtractor().extract({
        message: 'festival options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { eventsFestivalsRequested: true } });
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
        message: 'walking track options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      new SnowActivitiesRequestedConversationStateExtractor().extract({
        message: 'skiing options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      new AttractionsRequestedConversationStateExtractor().extract({
        message: 'attraction options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { attractionsRequested: true } });
    expect(
      new ScenicDrivesRequestedConversationStateExtractor().extract({
        message: 'scenic drive options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { scenicDrivesRequested: true } });
    expect(
      new FourWheelDrivingRequestedConversationStateExtractor().extract({
        message: '4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      new KayakingRequestedConversationStateExtractor().extract({
        message: 'kayaking spots',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      new CampingRequestedConversationStateExtractor().extract({
        message: 'camping spots',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      new BeachesRequestedConversationStateExtractor().extract({
        message: 'beach options',
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

  it('applies extracted wildlifeRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: true,
      eventsFestivalsRequested: true,
      wildlifeRequested: false,
      nationalParksRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'add wildlife',
      state: currentState,
      userEntryId: 'user-7z-a',
      assistantEntryId: 'assistant-7z-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no wildlife',
      state: currentState,
      userEntryId: 'user-7z-b',
      assistantEntryId: 'assistant-7z-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { wildlifeRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add wildlife',
      state: currentState,
      userEntryId: 'user-7z-c',
      assistantEntryId: 'assistant-7z-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { wildlifeRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add wildlife',
      state: currentState,
      userEntryId: 'user-7z-d',
      assistantEntryId: 'assistant-7z-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { wildlifeRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'kangaroo',
      state: currentState,
      userEntryId: 'user-7z-e',
      assistantEntryId: 'assistant-7z-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'add wildlife. Fly from Sydney to Cairns',
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
      userEntryId: 'user-7z-f',
      assistantEntryId: 'assistant-7z-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'add wildlife. Fly from Sydney to Cairns',
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
      userEntryId: 'user-7z-g',
      assistantEntryId: 'assistant-7z-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        wildlifeRequested: false,
      },
    });

    expect(extracted.state.wildlifeRequested).toBe(true);
    expect(extracted.state.eventsFestivalsRequested).toBe(true);
    expect(extracted.state.wineriesFoodTrailsRequested).toBe(true);
    expect(extracted.state.divingSnorkellingRequested).toBe(true);
    expect(extracted.state.fishingRequested).toBe(true);
    expect(extracted.state.hikingWalkingRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.wildlifeRequested).toBe(true);
    expect(overriddenFalse.state.wildlifeRequested).toBe(false);
    expect(nullOverride.state.wildlifeRequested).toBeNull();
    expect(preserved.state.wildlifeRequested).toBe(false);
    expect(composed.state.wildlifeRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.wildlifeRequested).toBe(false);
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

  it('keeps Destination through DivingSnorkellingRequested as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(36);
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
    expect(extractors[35]).toBeInstanceOf(EmptyConversationStateExtractor);

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
    const wildlifeActiveMessage =
      'add wildlife. add festivals. add wineries. add diving. add fishing. add hiking. add snow activities. add attractions. add scenic drives. add four-wheel driving. add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: wildlifeActiveMessage,
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
      },
    });
    expect(
      extractors[10]?.extract({
        message: 'book activities',
        currentState,
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });

    for (let index = 27; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: wildlifeActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[26]?.extract({
        message: wildlifeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { wildlifeRequested: true } });
    expect(
      extractors[25]?.extract({
        message: wildlifeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { eventsFestivalsRequested: true } });
    expect(
      extractors[24]?.extract({
        message: wildlifeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { wineriesFoodTrailsRequested: true } });
    expect(
      extractors[23]?.extract({
        message: wildlifeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { divingSnorkellingRequested: true } });
    expect(
      extractors[22]?.extract({
        message: wildlifeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });
    expect(
      extractors[21]?.extract({
        message: wildlifeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractors[20]?.extract({
        message: wildlifeActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });

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

    for (let index = 27; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: eventsOnlyMessage,
          currentState,
        }),
        `extractor ${index} on events message`,
      ).toEqual({ stateUpdate: {} });
    }

    const wildlifeOnlyMessage = 'wildlife options';
    expect(
      extractors[26]?.extract({
        message: wildlifeOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { wildlifeRequested: true } });
    expect(
      extractors[25]?.extract({
        message: wildlifeOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[24]?.extract({
        message: wildlifeOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[22]?.extract({
        message: wildlifeOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
  });
});
