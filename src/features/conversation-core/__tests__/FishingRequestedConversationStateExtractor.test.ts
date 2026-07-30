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

const ROOT = process.cwd();
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
      conversationId: 'conversation-7v',
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
    fishingRequested: false,
    divingSnorkellingRequested: false,
    wineriesFoodTrailsRequested: false,
    eventsFestivalsRequested: false,
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

describe('phase 8Y — FishingRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit fishingRequested true contract', () => {
    expectTypeOf<FishingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<FishingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<FishingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new FishingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'add fishing',
        currentState: createState({ fishingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });
  });

  it('extracts supported explicit fishing-request forms as true', () => {
    const extractor = new FishingRequestedConversationStateExtractor();
    const cases = [
      'fishing',
      'show fishing',
      'show me fishing',
      'find fishing',
      'I need fishing',
      'include fishing',
      'add fishing',
      'need fishing',
      'book fishing',
      'go fishing',
      'show me fishing spots',
      'find fishing near me',
      'recommend somewhere to fish',
      'where can I go fishing?',
      'I want to go fishing',
      'include fishing on the trip',
      'find family-friendly fishing spots',
      'show me beach fishing locations',
      'fishing spots',
      'fishing locations',
      'fishing places',
      'shore fishing',
      'beach fishing',
      'river fishing',
      'lake fishing',
      'fishing options',
      'search fishing spots',
      'suggest fishing places',
      'try fishing',
      'nearby fishing',
      'fishing near me',
      'fishing in Cairns',
      'fishing near the hotel',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ fishingRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { fishingRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty(
        'hikingWalkingRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'snowActivitiesRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('attractionsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'scenicDrivesRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'fourWheelDriveRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('kayakingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('campingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('beachesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nearbyDiscoveryRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('activitiesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('returns empty for licences, charters, equipment, accommodation-near-fishing, historical, informational, named-alone, and negation wording', () => {
    const extractor = new FishingRequestedConversationStateExtractor();
    const unsupported = [
      'fish',
      'seafood',
      'Port Hacking',
      'charters',
      'boats',
      'tackle',
      'fishing charter',
      'fishing boat',
      'fishing tackle',
      'deep-sea fishing',
      'fly fishing',
      'guided fishing',
      'show me fishing charters',
      'fishing licence',
      'fishing regulations',
      'tide times',
      'fishing rod',
      'bait shop',
      'boat hire',
      'fishing charter price',
      'fishing map',
      'hotel near fishing spots',
      'we went fishing yesterday',
      'what is fly fishing',
      'fishing?',
      'do not include fishing',
      'no fishing',
      "don't add fishing",
      "I don't want to fish",
      'without fishing',
      'remove fishing',
      'cancel fishing',
      'avoid fishing',
      'skip fishing',
      'forget fishing',
      'keep fishing',
      'actually show me fishing',
      'instead fishing',
      'not fishing but kayaking',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ fishingRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits fishingRequested false or null from extraction', () => {
    const extractor = new FishingRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no fishing',
      currentState: createState({ fishingRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('fishingRequested');

    const update = extractor.extract({
      message: 'add fishing',
      currentState: createState({ fishingRequested: null }),
    }).stateUpdate;
    expect(update.fishingRequested).toBe(true);
    expect(update.fishingRequested).not.toBe(false);
    expect(update.fishingRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new FishingRequestedConversationStateExtractor();
    const currentState = createState({
      fishingRequested: false,
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
      message: 'show me fishing',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.fishingRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { fishingRequested: true } });

    const other =
      new FishingRequestedConversationStateExtractor() as FishingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as FishingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'fishing',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(FISHING_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7V');
    expect(source).toContain('Phase 8Y');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/fishingRequested\s*:\s*true/);
    expect(source).not.toMatch(/fishingRequested\s*:\s*false/);
    expect(source).not.toMatch(/fishingRequested\s*:\s*null/);
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
      FISHING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/FishingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'FishingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/FishingRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new FishingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('FishingRequestedConversationStateExtractor'), file).toBe(
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

  it('applies extracted fishingRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      hikingWalkingRequested: true,
      fishingRequested: false,
      divingSnorkellingRequested: false,
      wineriesFoodTrailsRequested: false,
      eventsFestivalsRequested: false,
      wildlifeRequested: false,
      nationalParksRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'add fishing',
      state: currentState,
      userEntryId: 'user-7v-a',
      assistantEntryId: 'assistant-7v-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no fishing',
      state: currentState,
      userEntryId: 'user-7v-b',
      assistantEntryId: 'assistant-7v-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { fishingRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add fishing',
      state: currentState,
      userEntryId: 'user-7v-c',
      assistantEntryId: 'assistant-7v-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { fishingRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add fishing',
      state: currentState,
      userEntryId: 'user-7v-d',
      assistantEntryId: 'assistant-7v-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { fishingRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'fishing charters',
      state: currentState,
      userEntryId: 'user-7v-e',
      assistantEntryId: 'assistant-7v-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'add fishing. Fly from Sydney to Cairns',
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
      userEntryId: 'user-7v-f',
      assistantEntryId: 'assistant-7v-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'add fishing. Fly from Sydney to Cairns',
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
      userEntryId: 'user-7v-g',
      assistantEntryId: 'assistant-7v-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        fishingRequested: false,
      },
    });

    expect(extracted.state.fishingRequested).toBe(true);
    expect(extracted.state.hikingWalkingRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.fishingRequested).toBe(true);
    expect(overriddenFalse.state.fishingRequested).toBe(false);
    expect(nullOverride.state.fishingRequested).toBeNull();
    expect(preserved.state.fishingRequested).toBe(false);
    expect(composed.state.fishingRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.fishingRequested).toBe(false);
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

  it('keeps Destination through FishingRequested as the only behaviourally active production extractors', () => {
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
      nationalParksRequested: false,
    });

    // ActivitiesRequested intentionally ignores messages that also mention snow
    // activities, so this composed cue set omits an activities emission.
    const fishingActiveMessage =
      'add fishing. add hiking. add snow activities. add attractions. add scenic drives. add four-wheel driving. add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: fishingActiveMessage,
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
      },
    });
    expect(
      extractors[10]?.extract({
        message: 'book activities',
        currentState,
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });

    for (let index = 22; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: fishingActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[21]?.extract({
        message: fishingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });
    expect(
      extractors[20]?.extract({
        message: fishingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractors[19]?.extract({
        message: fishingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });

    const hikingOnlyMessage = 'walking track options';
    expect(
      extractors[20]?.extract({
        message: hikingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractors[21]?.extract({
        message: hikingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 22; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: hikingOnlyMessage,
          currentState,
        }),
        `extractor ${index} on hiking message`,
      ).toEqual({ stateUpdate: {} });
    }

    const fishingOnlyMessage = 'fishing options';
    expect(
      extractors[21]?.extract({
        message: fishingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { fishingRequested: true } });
    expect(
      extractors[20]?.extract({
        message: fishingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[19]?.extract({
        message: fishingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
  });
});
