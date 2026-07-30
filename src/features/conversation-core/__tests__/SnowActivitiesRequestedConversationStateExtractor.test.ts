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
      conversationId: 'conversation-8w',
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
    snowActivitiesRequested: false,
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

describe('phase 8W — SnowActivitiesRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit snowActivitiesRequested true contract', () => {
    expectTypeOf<SnowActivitiesRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<SnowActivitiesRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<SnowActivitiesRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'add snow activities',
        currentState: createState({ snowActivitiesRequested: null }),
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
  });

  it('extracts supported explicit snow-activity-request forms as true', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    const cases = [
      'snow activities',
      'show me snow activities',
      'find nearby snow activities',
      'family-friendly snow activities',
      'snow activities in Thredbo',
      'show me skiing options',
      'where can I go skiing',
      'where can I go skiing?',
      'I want to go skiing',
      'recommend somewhere to snowboard',
      'find tobogganing near me',
      'where can we go sledding',
      'recommend ski resorts',
      'show me nearby snow fields',
      'skiing',
      'snowboarding',
      'tobogganing',
      'sledding',
      'snow play',
      'snow resorts',
      'snow fields',
      'what snow activities can I do?',
      'can you recommend snow activities?',
      'I want skiing and restaurants',
      'show me snow activities and attractions',
      'include snowboarding on this trip',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ snowActivitiesRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { snowActivitiesRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nearbyDiscoveryRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('activitiesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('restaurantsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('attractionsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'scenicDrivesRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'fourWheelDriveRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('beachesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('campingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nationalParksRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty(
        'hikingWalkingRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('kayakingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('emits only snowActivitiesRequested from combined skiing-and-restaurants wording', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'I want skiing and restaurants',
        currentState: createState({ snowActivitiesRequested: null }),
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      extractor.extract({
        message: 'show me snow activities and attractions',
        currentState: createState({ snowActivitiesRequested: null }),
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      extractor.extract({
        message: 'include snowboarding on this trip',
        currentState: createState({ snowActivitiesRequested: null }),
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
  });

  it('returns empty for bare snow/winter, named resorts, hire, conditions, historical, and negation wording', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    const unsupported = [
      'snow',
      'winter',
      'alpine',
      'Thredbo',
      'Perisher',
      'Falls Creek',
      'we went skiing yesterday',
      'what is skiing',
      'snow forecast',
      'ski conditions',
      'lift pass prices',
      'ski hire',
      'snow chains',
      'ski lesson prices',
      'ski resort map',
      'hotel near a ski resort',
      'no snow activities',
      'do not include skiing',
      'without snow activities',
      'remove snow activities',
      'cancel the ski plans',
      "I don't want to ski",
      'avoid ski resorts',
      'skip snow activities',
      'forget snowboarding',
      'keep snow activities',
      'actually show me snow activities',
      'instead snow activities',
      'not snow activities but attractions',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ snowActivitiesRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits snowActivitiesRequested false or null from extraction', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no snow activities',
      currentState: createState({ snowActivitiesRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('snowActivitiesRequested');

    const update = extractor.extract({
      message: 'add snow activities',
      currentState: createState({ snowActivitiesRequested: null }),
    }).stateUpdate;
    expect(update.snowActivitiesRequested).toBe(true);
    expect(update.snowActivitiesRequested).not.toBe(false);
    expect(update.snowActivitiesRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    const currentState = createState({
      snowActivitiesRequested: false,
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
      message: 'show me snow activities',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.snowActivitiesRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { snowActivitiesRequested: true } });

    const other =
      new SnowActivitiesRequestedConversationStateExtractor() as SnowActivitiesRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as SnowActivitiesRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'skiing',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(SNOW_ACTIVITIES_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7T');
    expect(source).toContain('Phase 8W');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/snowActivitiesRequested\s*:\s*true/);
    expect(source).not.toMatch(/snowActivitiesRequested\s*:\s*false/);
    expect(source).not.toMatch(/snowActivitiesRequested\s*:\s*null/);
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
      SNOW_ACTIVITIES_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/SnowActivitiesRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'SnowActivitiesRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /SnowActivitiesRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new SnowActivitiesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('SnowActivitiesRequestedConversationStateExtractor'),
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
    expect(readFileSync(FOUR_WHEEL_DRIVING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7Q',
    );
    expect(readFileSync(FOUR_WHEEL_DRIVING_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8T',
    );
    expect(readFileSync(SCENIC_DRIVES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7R',
    );
    expect(readFileSync(SCENIC_DRIVES_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8U',
    );
    expect(readFileSync(ATTRACTIONS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 7S',
    );
    expect(readFileSync(ATTRACTIONS_REQUESTED_SOURCE, 'utf8')).toContain(
      'Phase 8V',
    );

    expect(
      new AttractionsRequestedConversationStateExtractor().extract({
        message: 'attraction options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { attractionsRequested: true } });
    expect(
      new AttractionsRequestedConversationStateExtractor().extract({
        message: 'skiing options',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      new ScenicDrivesRequestedConversationStateExtractor().extract({
        message: 'show me scenic drives',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { scenicDrivesRequested: true } });
    expect(
      new FourWheelDrivingRequestedConversationStateExtractor().extract({
        message: 'show me 4wd tracks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { fourWheelDriveRequested: true } });
    expect(
      new KayakingRequestedConversationStateExtractor().extract({
        message: 'show me kayaking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      new NearbyDiscoveryRequestedConversationStateExtractor().extract({
        message: 'what is nearby',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nearbyDiscoveryRequested: true } });
    expect(
      new NearbyDiscoveryRequestedConversationStateExtractor().extract({
        message: 'skiing options',
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
        message: 'show me snow activities',
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
      new HikingWalkingRequestedConversationStateExtractor().extract({
        message: 'show me hiking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      new NationalParksRequestedConversationStateExtractor().extract({
        message: 'show me national parks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nationalParksRequested: true } });
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

  it('applies extracted snowActivitiesRequested through the live processor with trusted explicit precedence', () => {
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
      fourWheelDriveRequested: true,
      scenicDrivesRequested: true,
      attractionsRequested: true,
      snowActivitiesRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'skiing options',
      state: currentState,
      userEntryId: 'user-8w-a',
      assistantEntryId: 'assistant-8w-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no snow activities',
      state: currentState,
      userEntryId: 'user-8w-b',
      assistantEntryId: 'assistant-8w-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { snowActivitiesRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add snow activities',
      state: currentState,
      userEntryId: 'user-8w-c',
      assistantEntryId: 'assistant-8w-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { snowActivitiesRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add snow activities',
      state: currentState,
      userEntryId: 'user-8w-d',
      assistantEntryId: 'assistant-8w-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { snowActivitiesRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'ski hire',
      state: currentState,
      userEntryId: 'user-8w-e',
      assistantEntryId: 'assistant-8w-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'skiing options. attraction options. show me scenic drives. show me 4wd tracks. show me kayaking. show me hiking. show me national parks. show me camping. show me beaches. find nearby. find restaurants. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8w-f',
      assistantEntryId: 'assistant-8w-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'add snow activities. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8w-g',
      assistantEntryId: 'assistant-8w-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        snowActivitiesRequested: false,
      },
    });

    expect(extracted.state.snowActivitiesRequested).toBe(true);
    expect(extracted.state.attractionsRequested).toBe(true);
    expect(extracted.state.scenicDrivesRequested).toBe(true);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.snowActivitiesRequested).toBe(true);
    expect(overriddenFalse.state.snowActivitiesRequested).toBe(false);
    expect(nullOverride.state.snowActivitiesRequested).toBeNull();
    expect(preserved.state.snowActivitiesRequested).toBe(false);
    expect(composed.state.snowActivitiesRequested).toBe(true);
    expect(composed.state.attractionsRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.snowActivitiesRequested).toBe(false);
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

  it('keeps Destination through SnowActivitiesRequested as the only behaviourally active production extractors', () => {
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
    expect(extractors[17]).toBeInstanceOf(
      ScenicDrivesRequestedConversationStateExtractor,
    );
    expect(extractors[18]).toBeInstanceOf(
      AttractionsRequestedConversationStateExtractor,
    );
    expect(extractors[19]).toBeInstanceOf(
      SnowActivitiesRequestedConversationStateExtractor,
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
    });

    // ActivitiesRequested intentionally ignores messages that also mention snow
    // activities, so this composed cue set omits an activities emission.
    const snowActiveMessage =
      'add snow activities. add attractions. add scenic drives. add four-wheel driving. add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: snowActiveMessage,
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
      },
    });
    expect(
      extractors[10]?.extract({
        message: snowActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[10]?.extract({
        message: 'book activities',
        currentState,
      }),
    ).toEqual({ stateUpdate: { activitiesRequested: true } });

    for (let index = 20; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: snowActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[19]?.extract({
        message: snowActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      extractors[18]?.extract({
        message: snowActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { attractionsRequested: true } });
    expect(
      extractors[17]?.extract({
        message: snowActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { scenicDrivesRequested: true } });

    const snowOnlyMessage = 'skiing options';
    expect(
      extractors[19]?.extract({
        message: snowOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });
    expect(
      createConversationStateExtractor().extract({
        message: snowOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { snowActivitiesRequested: true } });

    for (let index = 0; index < extractors.length; index += 1) {
      if (index === 19) {
        continue;
      }
      expect(
        extractors[index]?.extract({
          message: snowOnlyMessage,
          currentState,
        }),
        `extractor ${index} on snow-only message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
