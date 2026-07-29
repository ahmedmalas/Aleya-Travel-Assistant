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
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';

const ROOT = process.cwd();
const HIKING_WALKING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/HikingWalkingRequestedConversationStateExtractor.ts',
);
const NATIONAL_PARKS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/NationalParksRequestedConversationStateExtractor.ts',
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
      conversationId: 'conversation-8r',
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
    hikingWalkingRequested: false,
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

describe('phase 8R — HikingWalkingRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit hikingWalkingRequested true contract', () => {
    expectTypeOf<HikingWalkingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<HikingWalkingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<HikingWalkingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'show me hiking',
        currentState: createState({ hikingWalkingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
  });

  it('extracts supported explicit hiking-request forms as true', () => {
    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    const cases = [
      'hiking',
      'hike',
      'hikes',
      'walking trails',
      'hiking trails',
      'hiking routes',
      'find hiking',
      'find hikes',
      'find hiking trails',
      'search hiking',
      'show me hiking',
      'show me hiking trails',
      'recommend hiking',
      'recommend hikes',
      'hiking recommendations',
      'hiking options',
      'best hikes',
      'best hiking trails',
      'nearby hiking',
      'hiking near me',
      'hikes near me',
      'trails near me',
      'places to hike',
      'where can I hike',
      'include hiking',
      'add hiking',
      'I want hiking',
      'go hiking',
      'walking',
      'show me walking',
      'hiking and walking',
      'show me hiking trails near Brisbane',
      'find the best hikes near Cairns',
      'I want hiking and camping',
      'include hiking on this trip',
      'recommend family-friendly hiking trails',
      'find places to hike near the national park',
      'hiking in national parks',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ hikingWalkingRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { hikingWalkingRequested: true },
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
      expect(result.stateUpdate, message).not.toHaveProperty('restaurantsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('emits only hikingWalkingRequested from nearby-hiking and hiking-and-camping wording', () => {
    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'nearby hiking',
        currentState: createState({ hikingWalkingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractor.extract({
        message: 'hikes near me',
        currentState: createState({ hikingWalkingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractor.extract({
        message: 'I want hiking and camping',
        currentState: createState({ hikingWalkingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractor.extract({
        message: 'hiking in national parks',
        currentState: createState({ hikingWalkingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
  });

  it('returns empty for equipment, trail metadata, named trails, historical, negation, and ambiguous wording', () => {
    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    const unsupported = [
      'hiking boots',
      'hiking shoes',
      'hiking gear',
      'hiking equipment',
      'hiking backpack',
      'hiking poles',
      'hiking clothes',
      'hiking store',
      'hiking shop',
      'hiking permit',
      'hiking rules',
      'hiking map',
      'hiking weather',
      'hiking conditions',
      'hiking warning',
      'hiking closure',
      'trail closure',
      'trail conditions',
      'trail difficulty',
      'we went hiking',
      'we hiked there',
      'I like hiking',
      'hiking?',
      'what is hiking',
      'Bondi to Coogee Walk',
      'Overland Track',
      'Larapinta Trail',
      'Three Capes Track',
      'trek',
      'trekking',
      'bushwalking',
      'walking directions',
      'walking distance',
      'walkable',
      'go for a walk',
      'easy hiking',
      'guided walking',
      'coastal walking',
      'family-friendly hiking',
      'no hiking',
      'do not include hiking',
      "don't include hiking",
      'without hiking',
      'remove hiking',
      'cancel the hiking plans',
      "I don't want hiking",
      'avoid hiking',
      'skip hiking',
      'no hiking trails',
      'forget hiking',
      'keep walking',
      'actually show me hiking',
      'instead walking',
      'not hiking but snow activities',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ hikingWalkingRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits hikingWalkingRequested false or null from extraction', () => {
    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no hiking',
      currentState: createState({ hikingWalkingRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('hikingWalkingRequested');

    const update = extractor.extract({
      message: 'add walking',
      currentState: createState({ hikingWalkingRequested: null }),
    }).stateUpdate;
    expect(update.hikingWalkingRequested).toBe(true);
    expect(update.hikingWalkingRequested).not.toBe(false);
    expect(update.hikingWalkingRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    const currentState = createState({
      hikingWalkingRequested: false,
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
    });
    const input: ConversationStateExtractionInput = {
      message: 'show me hiking',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.hikingWalkingRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { hikingWalkingRequested: true } });

    const other =
      new HikingWalkingRequestedConversationStateExtractor() as HikingWalkingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as HikingWalkingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'walking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(HIKING_WALKING_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7U');
    expect(source).toContain('Phase 8R');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/hikingWalkingRequested\s*:\s*true/);
    expect(source).not.toMatch(/hikingWalkingRequested\s*:\s*false/);
    expect(source).not.toMatch(/hikingWalkingRequested\s*:\s*null/);
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
      HIKING_WALKING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/HikingWalkingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'HikingWalkingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /HikingWalkingRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new HikingWalkingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('HikingWalkingRequestedConversationStateExtractor'),
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

    expect(
      new NationalParksRequestedConversationStateExtractor().extract({
        message: 'show me national parks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
    expect(
      new NationalParksRequestedConversationStateExtractor().extract({
        message: 'show me hiking',
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
        message: 'show me hiking',
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
        message: 'show me hiking',
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
        message: 'show me hiking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
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

  it('applies extracted hikingWalkingRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      snowActivitiesRequested: true,
      attractionsRequested: true,
      hikingWalkingRequested: false,
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
      message: 'show me hiking',
      state: currentState,
      userEntryId: 'user-8r-a',
      assistantEntryId: 'assistant-8r-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no hiking',
      state: currentState,
      userEntryId: 'user-8r-b',
      assistantEntryId: 'assistant-8r-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { hikingWalkingRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add hiking',
      state: currentState,
      userEntryId: 'user-8r-c',
      assistantEntryId: 'assistant-8r-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { hikingWalkingRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add hiking',
      state: currentState,
      userEntryId: 'user-8r-d',
      assistantEntryId: 'assistant-8r-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { hikingWalkingRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'hiking weather',
      state: currentState,
      userEntryId: 'user-8r-e',
      assistantEntryId: 'assistant-8r-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'show me hiking. show me national parks. show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      userEntryId: 'user-8r-f',
      assistantEntryId: 'assistant-8r-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message:
        'show me hiking. show me national parks. show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      userEntryId: 'user-8r-g',
      assistantEntryId: 'assistant-8r-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        hikingWalkingRequested: false,
      },
    });
    const bestHikes = processConversationTurn({
      message: 'best hikes',
      state: currentState,
      userEntryId: 'user-8r-h',
      assistantEntryId: 'assistant-8r-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const placesToHike = processConversationTurn({
      message: 'places to hike',
      state: currentState,
      userEntryId: 'user-8r-i',
      assistantEntryId: 'assistant-8r-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });
    const namedPreserved = processConversationTurn({
      message: 'Overland Track',
      state: currentState,
      userEntryId: 'user-8r-j',
      assistantEntryId: 'assistant-8r-j',
      userMessageAt: new Date('2026-07-29T00:00:28.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:29.000Z'),
    });

    expect(extracted.state.hikingWalkingRequested).toBe(true);
    expect(extracted.state.snowActivitiesRequested).toBe(true);
    expect(extracted.state.attractionsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.hikingWalkingRequested).toBe(true);
    expect(overriddenFalse.state.hikingWalkingRequested).toBe(false);
    expect(nullOverride.state.hikingWalkingRequested).toBeNull();
    expect(preserved.state.hikingWalkingRequested).toBe(false);
    expect(composed.state.hikingWalkingRequested).toBe(true);
    expect(composed.state.nationalParksRequested).toBe(true);
    expect(composed.state.campingRequested).toBe(true);
    expect(composed.state.beachesRequested).toBe(true);
    expect(composed.state.nearbyDiscoveryRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.hikingWalkingRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(bestHikes.state.hikingWalkingRequested).toBe(true);
    expect(placesToHike.state.hikingWalkingRequested).toBe(true);
    expect(namedPreserved.state.hikingWalkingRequested).toBe(false);
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

  it('keeps Destination through HikingWalkingRequested as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(28);
    expect(extractors[18]).toBeInstanceOf(
      AttractionsRequestedConversationStateExtractor,
    );
    expect(extractors[19]).toBeInstanceOf(
      SnowActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[20]).toBeInstanceOf(
      HikingWalkingRequestedConversationStateExtractor,
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
    const hikingActiveMessage =
      'add hiking. add snow activities. add attractions. add scenic drives. add four-wheel driving. add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: hikingActiveMessage,
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
      },
    });
    expect(
      extractors[10]?.extract({
        message: 'book activities',
        currentState,
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });

    for (let index = 21; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: hikingActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[20]?.extract({
        message: hikingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      extractors[19]?.extract({
        message: hikingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      extractors[18]?.extract({
        message: hikingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { attractionsRequested: true } });

    const snowOnlyMessage = 'add snow activities';
    expect(
      extractors[19]?.extract({
        message: snowOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      extractors[20]?.extract({
        message: snowOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 21; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: snowOnlyMessage,
          currentState,
        }),
        `extractor ${index} on snow-activities message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
