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
import { KayakingRequestedConversationStateExtractor } from '../KayakingRequestedConversationStateExtractor';
import { NearbyDiscoveryRequestedConversationStateExtractor } from '../NearbyDiscoveryRequestedConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { RestaurantsRequestedConversationStateExtractor } from '../RestaurantsRequestedConversationStateExtractor';
import { RestaurantPreferenceConversationStateExtractor } from '../RestaurantPreferenceConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';
import { HikingWalkingRequestedConversationStateExtractor } from '../extractors/HikingWalkingRequestedConversationStateExtractor';
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';

const ROOT = process.cwd();
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
      conversationId: 'conversation-8s',
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
    kayakingRequested: false,
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

describe('phase 8S — KayakingRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit kayakingRequested true contract', () => {
    expectTypeOf<KayakingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<KayakingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<KayakingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new KayakingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'show me kayaking',
        currentState: createState({ kayakingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
  });

  it('extracts supported explicit kayaking-request forms as true', () => {
    const extractor = new KayakingRequestedConversationStateExtractor();
    const cases = [
      'kayaking',
      'kayak',
      'kayaks',
      'kayak trips',
      'kayak tours',
      'kayaking tours',
      'kayak experiences',
      'kayaking activities',
      'find kayaking',
      'find kayak tours',
      'search kayaking',
      'show me kayaking',
      'show me kayak tours',
      'recommend kayaking',
      'recommend kayak tours',
      'kayaking recommendations',
      'kayaking options',
      'best kayaking',
      'best kayak tours',
      'nearby kayaking',
      'kayaking near me',
      'kayak tours near me',
      'places to kayak',
      'where can I kayak',
      'include kayaking',
      'add kayaking',
      'I want kayaking',
      'go kayaking',
      'book kayaking',
      'show me kayaking near Brisbane',
      'find kayak tours near Byron Bay',
      'I want kayaking and beaches',
      'include kayaking on this trip',
      'recommend family-friendly kayaking',
      'find places to kayak near the national park',
      'kayaking in national parks',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ kayakingRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { kayakingRequested: true },
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
      expect(result.stateUpdate, message).not.toHaveProperty('restaurantsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('emits only kayakingRequested from nearby-kayaking and kayaking-and-beaches wording', () => {
    const extractor = new KayakingRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'nearby kayaking',
        currentState: createState({ kayakingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      extractor.extract({
        message: 'kayaking near me',
        currentState: createState({ kayakingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      extractor.extract({
        message: 'I want kayaking and beaches',
        currentState: createState({ kayakingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      extractor.extract({
        message: 'kayaking in national parks',
        currentState: createState({ kayakingRequested: null }),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
  });

  it('returns empty for equipment, weather, named operators, historical, negation, and ambiguous wording', () => {
    const extractor = new KayakingRequestedConversationStateExtractor();
    const unsupported = [
      'kayak shop',
      'kayak store',
      'kayak equipment',
      'kayaking equipment',
      'kayak gear',
      'kayaking gear',
      'kayak paddle',
      'kayak paddles',
      'kayak roof rack',
      'kayak trailer',
      'kayak hire price',
      'kayak permit',
      'kayaking rules',
      'kayaking regulations',
      'kayaking weather',
      'kayaking conditions',
      'kayaking warning',
      'kayaking closure',
      'water conditions for kayaking',
      'hire a kayak',
      'we went kayaking',
      'we kayaked there',
      'I like kayaking',
      'kayaking?',
      'what is kayaking',
      'Noosa Kayak Tours',
      'Sea Kayak Adventures',
      'show me paddling activities',
      'show me SUP activities',
      'I want a canoe',
      'rafting nearby',
      'harbour kayaking',
      'ocean kayaking',
      'mangrove kayaking',
      'white-water kayaking',
      'guided kayak tours',
      'beginner-friendly kayaking',
      'family-friendly kayaking',
      'calm-water kayaking',
      'no kayaking',
      'do not include kayaking',
      "don't include kayaking",
      'without kayaking',
      'remove kayaking',
      'cancel kayaking',
      'cancel the kayaking plans',
      "I don't want kayaking",
      'avoid kayaking',
      'skip kayaking',
      'no kayak tours',
      'forget kayaking',
      'keep the kayaking',
      'keep camping but remove kayaking',
      'actually show me kayaking',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ kayakingRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits kayakingRequested false or null from extraction', () => {
    const extractor = new KayakingRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no kayaking',
      currentState: createState({ kayakingRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('kayakingRequested');

    const update = extractor.extract({
      message: 'add kayaking',
      currentState: createState({ kayakingRequested: null }),
    }).stateUpdate;
    expect(update.kayakingRequested).toBe(true);
    expect(update.kayakingRequested).not.toBe(false);
    expect(update.kayakingRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new KayakingRequestedConversationStateExtractor();
    const currentState = createState({
      kayakingRequested: false,
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
      message: 'show me kayaking',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.kayakingRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { kayakingRequested: true } });

    const other =
      new KayakingRequestedConversationStateExtractor() as KayakingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as KayakingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'kayaking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(KAYAKING_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7P');
    expect(source).toContain('Phase 8S');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/kayakingRequested\s*:\s*true/);
    expect(source).not.toMatch(/kayakingRequested\s*:\s*false/);
    expect(source).not.toMatch(/kayakingRequested\s*:\s*null/);
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
      KAYAKING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/KayakingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'KayakingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /KayakingRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new KayakingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('KayakingRequestedConversationStateExtractor'),
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

    expect(
      new HikingWalkingRequestedConversationStateExtractor().extract({
        message: 'show me hiking',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { hikingWalkingRequested: true } });
    expect(
      new HikingWalkingRequestedConversationStateExtractor().extract({
        message: 'show me kayaking',
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
        message: 'show me kayaking',
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
        message: 'show me kayaking',
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
        message: 'show me kayaking',
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
        message: 'show me kayaking',
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

  it('applies extracted kayakingRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: true,
      campingRequested: true,
      kayakingRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: 'show me kayaking',
      state: currentState,
      userEntryId: 'user-8s-a',
      assistantEntryId: 'assistant-8s-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no kayaking',
      state: currentState,
      userEntryId: 'user-8s-b',
      assistantEntryId: 'assistant-8s-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { kayakingRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add kayaking',
      state: currentState,
      userEntryId: 'user-8s-c',
      assistantEntryId: 'assistant-8s-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { kayakingRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add kayaking',
      state: currentState,
      userEntryId: 'user-8s-d',
      assistantEntryId: 'assistant-8s-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { kayakingRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'kayaking weather',
      state: currentState,
      userEntryId: 'user-8s-e',
      assistantEntryId: 'assistant-8s-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'show me kayaking. show me hiking. show me national parks. show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8s-f',
      assistantEntryId: 'assistant-8s-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message:
        'show me kayaking. show me hiking. show me national parks. show me camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8s-g',
      assistantEntryId: 'assistant-8s-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        kayakingRequested: false,
      },
    });
    const bestKayaking = processConversationTurn({
      message: 'best kayaking',
      state: currentState,
      userEntryId: 'user-8s-h',
      assistantEntryId: 'assistant-8s-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const placesToKayak = processConversationTurn({
      message: 'places to kayak',
      state: currentState,
      userEntryId: 'user-8s-i',
      assistantEntryId: 'assistant-8s-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });
    const equipmentPreserved = processConversationTurn({
      message: 'kayak gear',
      state: currentState,
      userEntryId: 'user-8s-j',
      assistantEntryId: 'assistant-8s-j',
      userMessageAt: new Date('2026-07-29T00:00:28.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:29.000Z'),
    });

    expect(extracted.state.kayakingRequested).toBe(true);
    expect(extracted.state.campingRequested).toBe(true);
    expect(extracted.state.beachesRequested).toBe(true);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(overriddenTrue.state.kayakingRequested).toBe(true);
    expect(overriddenFalse.state.kayakingRequested).toBe(false);
    expect(nullOverride.state.kayakingRequested).toBeNull();
    expect(preserved.state.kayakingRequested).toBe(false);
    expect(composed.state.kayakingRequested).toBe(true);
    expect(composed.state.hikingWalkingRequested).toBe(true);
    expect(composed.state.nationalParksRequested).toBe(true);
    expect(composed.state.campingRequested).toBe(true);
    expect(composed.state.beachesRequested).toBe(true);
    expect(composed.state.nearbyDiscoveryRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.kayakingRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(bestKayaking.state.kayakingRequested).toBe(true);
    expect(placesToKayak.state.kayakingRequested).toBe(true);
    expect(equipmentPreserved.state.kayakingRequested).toBe(false);
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

  it('keeps Destination through KayakingRequested as the only behaviourally active production extractors', () => {
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
    });

    const kayakingActiveMessage =
      'add kayaking. add camping. show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: kayakingActiveMessage,
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
      },
    });

    for (let index = 18; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: kayakingActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[17]?.extract({
        message: kayakingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { kayakingRequested: true } });
    expect(
      extractors[16]?.extract({
        message: kayakingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      extractors[15]?.extract({
        message: kayakingActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });

    const campingOnlyMessage = 'add camping';
    expect(
      extractors[16]?.extract({
        message: campingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { campingRequested: true } });
    expect(
      extractors[17]?.extract({
        message: campingOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 17; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: campingOnlyMessage,
          currentState,
        }),
        `extractor ${index} on camping message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
