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
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { NearbyDiscoveryRequestedConversationStateExtractor } from '../NearbyDiscoveryRequestedConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { RestaurantsRequestedConversationStateExtractor } from '../RestaurantsRequestedConversationStateExtractor';
import { RestaurantPreferenceConversationStateExtractor } from '../RestaurantPreferenceConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
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
      conversationId: 'conversation-8p',
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
    campingRequested: false,
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

describe('phase 8P — CampingRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit campingRequested true contract', () => {
    expectTypeOf<CampingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<CampingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<CampingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new CampingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'show me camping',
        currentState: createState({ campingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
  });

  it('extracts supported explicit camping-request forms as true', () => {
    const extractor = new CampingRequestedConversationStateExtractor();
    const cases = [
      'camping',
      'camp',
      'campsites',
      'camp sites',
      'campgrounds',
      'camp grounds',
      'find camping',
      'find campsites',
      'search camping',
      'show me camping',
      'show me campsites',
      'recommend camping',
      'recommend campsites',
      'camping recommendations',
      'camping options',
      'best campsites',
      'nearby camping',
      'camping near me',
      'campgrounds near me',
      'include camping',
      'add camping',
      'I want camping',
      'book camping',
      'need camping',
      'show me camping near Brisbane',
      'find campsites near Byron Bay',
      'I want camping and beaches',
      'include camping on this trip',
      'find family camping',
      'recommend camping near the national park',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ campingRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { campingRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nearbyDiscoveryRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('activitiesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('beachesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('restaurantsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nationalParksRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('emits only campingRequested from nearby-camping and camping-and-beaches wording', () => {
    const extractor = new CampingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'nearby camping',
        currentState: createState({ campingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      extractor.extract({
        message: 'camping near me',
        currentState: createState({ campingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      extractor.extract({
        message: 'I want camping and beaches',
        currentState: createState({ campingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
  });

  it('returns empty for equipment, rules, weather, historical, negation, and ambiguous wording', () => {
    const extractor = new CampingRequestedConversationStateExtractor();
    const unsupported = [
      'camping store',
      'camping shop',
      'camping equipment',
      'camping gear',
      'camping stove',
      'camping chair',
      'camping tent',
      'camping supplies',
      'camping permit',
      'camping rules',
      'camping regulations',
      'camping weather',
      'camping conditions',
      'camping ban',
      'camping fire restrictions',
      'camping warning',
      'camping closure',
      'we went camping',
      'we camped there',
      'I like camping',
      'camping?',
      'what is camping',
      'I want a caravan park',
      'show me places for a tent',
      'where can I use a swag',
      'find glamping',
      'find a holiday park',
      'I need a powered site',
      'find an unpowered site',
      'somewhere we can have a campfire',
      'show me camping cabins',
      'find bush camping',
      'show me free camping',
      'family-friendly camping',
      'dog-friendly campsites',
      'remote camping away from crowds',
      'no camping',
      'do not include camping',
      "don't include camping",
      'without camping',
      'remove camping',
      'cancel camping',
      'cancel the camping plans',
      "I don't want camping",
      'avoid camping',
      'skip camping',
      'forget camping',
      'keep the camping',
      'keep beaches but remove camping',
      'actually show me camping',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ campingRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits campingRequested false or null from extraction', () => {
    const extractor = new CampingRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no camping',
      currentState: createState({ campingRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('campingRequested');

    const update = extractor.extract({
      message: 'add camping',
      currentState: createState({ campingRequested: null }),
    }).stateUpdate;
    expect(update.campingRequested).toBe(true);
    expect(update.campingRequested).not.toBe(false);
    expect(update.campingRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new CampingRequestedConversationStateExtractor();
    const currentState = createState({
      campingRequested: false,
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
      message: 'show me camping',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.campingRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { campingRequested: true } });

    const other =
      new CampingRequestedConversationStateExtractor() as CampingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as CampingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'camping',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(CAMPING_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7O');
    expect(source).toContain('Phase 8P');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/campingRequested\s*:\s*true/);
    expect(source).not.toMatch(/campingRequested\s*:\s*false/);
    expect(source).not.toMatch(/campingRequested\s*:\s*null/);
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
      CAMPING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/CampingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'CampingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/CampingRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new CampingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('CampingRequestedConversationStateExtractor'),
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

    expect(
      new BeachesRequestedConversationStateExtractor().extract({
        message: 'show me beaches',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
    expect(
      new BeachesRequestedConversationStateExtractor().extract({
        message: 'show me camping',
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
        message: 'show me camping',
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
        message: 'show me camping',
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

  it('applies extracted campingRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: true,
      campingRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
      adultCount: 2,
    });
    const extracted = processConversationTurn({
      message: 'show me camping',
      state: currentState,
      userEntryId: 'user-8p-a',
      assistantEntryId: 'assistant-8p-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no camping',
      state: currentState,
      userEntryId: 'user-8p-b',
      assistantEntryId: 'assistant-8p-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { campingRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add camping',
      state: currentState,
      userEntryId: 'user-8p-c',
      assistantEntryId: 'assistant-8p-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { campingRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add camping',
      state: currentState,
      userEntryId: 'user-8p-d',
      assistantEntryId: 'assistant-8p-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { campingRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'camping weather',
      state: currentState,
      userEntryId: 'user-8p-e',
      assistantEntryId: 'assistant-8p-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8p-f',
      assistantEntryId: 'assistant-8p-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message:
        'show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8p-g',
      assistantEntryId: 'assistant-8p-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        campingRequested: false,
      },
    });
    const bestCampsites = processConversationTurn({
      message: 'best campsites',
      state: currentState,
      userEntryId: 'user-8p-h',
      assistantEntryId: 'assistant-8p-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const campingOptions = processConversationTurn({
      message: 'camping options',
      state: currentState,
      userEntryId: 'user-8p-i',
      assistantEntryId: 'assistant-8p-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });
    const equipmentPreserved = processConversationTurn({
      message: 'camping gear',
      state: currentState,
      userEntryId: 'user-8p-j',
      assistantEntryId: 'assistant-8p-j',
      userMessageAt: new Date('2026-07-29T00:00:28.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:29.000Z'),
    });

    expect(extracted.state.campingRequested).toBe(true);
    expect(extracted.state.beachesRequested).toBe(true);
    expect(extracted.state.nearbyDiscoveryRequested).toBe(true);
    expect(extracted.state.activitiesRequested).toBe(true);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(extracted.state.adultCount).toBe(2);
    expect(overriddenTrue.state.campingRequested).toBe(true);
    expect(overriddenFalse.state.campingRequested).toBe(false);
    expect(nullOverride.state.campingRequested).toBeNull();
    expect(preserved.state.campingRequested).toBe(false);
    expect(composed.state.campingRequested).toBe(true);
    expect(composed.state.beachesRequested).toBe(true);
    expect(composed.state.nearbyDiscoveryRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.campingRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(bestCampsites.state.campingRequested).toBe(true);
    expect(campingOptions.state.campingRequested).toBe(true);
    expect(equipmentPreserved.state.campingRequested).toBe(false);
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

  it('keeps Destination through CampingRequested as the only behaviourally active production extractors', () => {
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
    });

    const campingActiveMessage =
      'show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: campingActiveMessage,
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
      },
    });

    for (let index = 17; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: campingActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[16]?.extract({
        message: campingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      extractors[15]?.extract({
        message: campingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
    expect(
      extractors[14]?.extract({
        message: campingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { nearbyDiscoveryRequested: true } });

    const beachesOnlyMessage = 'show me beaches';
    expect(
      extractors[15]?.extract({
        message: beachesOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
    expect(
      extractors[16]?.extract({
        message: beachesOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 16; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: beachesOnlyMessage,
          currentState,
        }),
        `extractor ${index} on beaches message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
