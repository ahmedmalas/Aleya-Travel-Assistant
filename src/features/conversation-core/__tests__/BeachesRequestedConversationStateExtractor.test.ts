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
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
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
      conversationId: 'conversation-8n',
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
    beachesRequested: false,
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

describe('phase 8N — BeachesRequestedConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit beachesRequested true contract', () => {
    expectTypeOf<BeachesRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<BeachesRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<BeachesRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new BeachesRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'show me beaches',
        currentState: createState({ beachesRequested: null }),
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
  });

  it('extracts supported explicit beaches-request forms as true', () => {
    const extractor = new BeachesRequestedConversationStateExtractor();
    const cases = [
      'beaches',
      'beach',
      'find beaches',
      'search beaches',
      'show me beaches',
      'recommend beaches',
      'beach recommendations',
      'beach options',
      'best beaches',
      'nearby beaches',
      'beaches near me',
      'places to swim',
      'where can I swim',
      'find a beach',
      'I want beaches',
      'include beaches',
      'add beaches',
      'show beaches',
      'need beaches',
      'book beaches',
      'show me beaches in Brisbane',
      'find the best beaches near Surfers Paradise',
      'I want beaches and restaurants',
      'find beaches for the family',
      'show me nearby beaches',
    ];

    for (const message of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ beachesRequested: null }),
      });
      expect(result, message).toEqual({
        stateUpdate: { beachesRequested: true },
      });
      expect(result.stateUpdate, message).not.toHaveProperty(
        'nearbyDiscoveryRequested',
      );
      expect(result.stateUpdate, message).not.toHaveProperty('activitiesRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('restaurantsRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('campingRequested');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('emits only beachesRequested from nearby-beach and beaches-and-restaurants wording', () => {
    const extractor = new BeachesRequestedConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'nearby beaches',
        currentState: createState({ beachesRequested: null }),
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
    expect(
      extractor.extract({
        message: 'I want beaches and restaurants',
        currentState: createState({ beachesRequested: null }),
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
  });

  it('returns empty for proximity, metadata, named beaches, historical, negation, and ambiguous wording', () => {
    const extractor = new BeachesRequestedConversationStateExtractor();
    const unsupported = [
      'hotel near the beach',
      'stay by the beach',
      'beachfront hotel',
      'beach address',
      'beach weather',
      'beach conditions',
      'beach warning',
      'beach closure',
      'beach towel',
      'beach bag',
      'beach house',
      'beach wedding',
      'the beach was crowded',
      'we visited the beach',
      'Bondi Beach',
      'Surfers Paradise beach',
      'beaches?',
      'what is a beach',
      'Surfers Paradise',
      'I want to visit the coast',
      'somewhere by the seaside',
      'where can we swim',
      'find somewhere to snorkel',
      'waterfront places',
      'find a quiet bay',
      'show me secluded coves',
      'find a lagoon',
      'find an ocean beach',
      'show me surf beaches',
      'family-friendly beaches',
      'quiet beaches away from crowds',
      'no beaches',
      'do not include beaches',
      'without beach recommendations',
      'remove beaches',
      'cancel the beach plans',
      "I don't want beaches",
      'avoid beaches',
      'remove the beaches',
      'forget beaches',
      'keep the beaches',
      'keep activities but remove beaches',
      'actually show me beaches',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ beachesRequested: false }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits beachesRequested false or null from extraction', () => {
    const extractor = new BeachesRequestedConversationStateExtractor();
    const blocked = extractor.extract({
      message: 'no beaches',
      currentState: createState({ beachesRequested: true }),
    });
    expect(blocked.stateUpdate).toEqual({});
    expect(blocked.stateUpdate).not.toHaveProperty('beachesRequested');

    const update = extractor.extract({
      message: 'add beaches',
      currentState: createState({ beachesRequested: null }),
    }).stateUpdate;
    expect(update.beachesRequested).toBe(true);
    expect(update.beachesRequested).not.toBe(false);
    expect(update.beachesRequested).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new BeachesRequestedConversationStateExtractor();
    const currentState = createState({
      beachesRequested: false,
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
      message: 'show me beaches',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.beachesRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { beachesRequested: true } });

    const other =
      new BeachesRequestedConversationStateExtractor() as BeachesRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as BeachesRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'beaches',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
  });

  it('contains no trim/toLowerCase/includes, currentState inspection, or provider imports', () => {
    const source = readFileSync(BEACHES_REQUESTED_SOURCE, 'utf8');

    expect(source).toContain('Phase 7N');
    expect(source).toContain('Phase 8N');
    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/beachesRequested\s*:\s*true/);
    expect(source).not.toMatch(/beachesRequested\s*:\s*false/);
    expect(source).not.toMatch(/beachesRequested\s*:\s*null/);
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
    const adapterConstruct = new Set([
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      BEACHES_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !adapterConstruct.has(path),
    );

    expect(index).not.toMatch(/BeachesRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'BeachesRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/BeachesRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new BeachesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('BeachesRequestedConversationStateExtractor'),
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

    expect(
      new NearbyDiscoveryRequestedConversationStateExtractor().extract({
        message: 'what is nearby',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { nearbyDiscoveryRequested: true } });
    expect(
      new NearbyDiscoveryRequestedConversationStateExtractor().extract({
        message: 'show me beaches',
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
        message: 'show me beaches',
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

  it('applies extracted beachesRequested through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: false,
      origin: 'Melbourne',
      destination: 'Brisbane',
      adultCount: 2,
    });
    const extracted = processConversationTurn({
      message: 'show me beaches',
      state: currentState,
      userEntryId: 'user-8n-a',
      assistantEntryId: 'assistant-8n-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenTrue = processConversationTurn({
      message: 'no beaches',
      state: currentState,
      userEntryId: 'user-8n-b',
      assistantEntryId: 'assistant-8n-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { beachesRequested: true },
    });
    const overriddenFalse = processConversationTurn({
      message: 'add beaches',
      state: currentState,
      userEntryId: 'user-8n-c',
      assistantEntryId: 'assistant-8n-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { beachesRequested: false },
    });
    const nullOverride = processConversationTurn({
      message: 'add beaches',
      state: currentState,
      userEntryId: 'user-8n-d',
      assistantEntryId: 'assistant-8n-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { beachesRequested: null },
    });
    const preserved = processConversationTurn({
      message: 'I want to visit the coast',
      state: currentState,
      userEntryId: 'user-8n-e',
      assistantEntryId: 'assistant-8n-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message:
        'show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8n-f',
      assistantEntryId: 'assistant-8n-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message:
        'show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Fly from Sydney to Cairns',
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
      }),
      userEntryId: 'user-8n-g',
      assistantEntryId: 'assistant-8n-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        beachesRequested: false,
      },
    });
    const bestBeaches = processConversationTurn({
      message: 'best beaches',
      state: currentState,
      userEntryId: 'user-8n-h',
      assistantEntryId: 'assistant-8n-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const placesToSwim = processConversationTurn({
      message: 'places to swim',
      state: currentState,
      userEntryId: 'user-8n-i',
      assistantEntryId: 'assistant-8n-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });
    const metadataPreserved = processConversationTurn({
      message: 'beach weather',
      state: currentState,
      userEntryId: 'user-8n-j',
      assistantEntryId: 'assistant-8n-j',
      userMessageAt: new Date('2026-07-29T00:00:28.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:29.000Z'),
    });

    expect(extracted.state.beachesRequested).toBe(true);
    expect(extracted.state.nearbyDiscoveryRequested).toBe(true);
    expect(extracted.state.activitiesRequested).toBe(true);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(extracted.state.adultCount).toBe(2);
    expect(overriddenTrue.state.beachesRequested).toBe(true);
    expect(overriddenFalse.state.beachesRequested).toBe(false);
    expect(nullOverride.state.beachesRequested).toBeNull();
    expect(preserved.state.beachesRequested).toBe(false);
    expect(composed.state.beachesRequested).toBe(true);
    expect(composed.state.nearbyDiscoveryRequested).toBe(true);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.beachesRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(bestBeaches.state.beachesRequested).toBe(true);
    expect(placesToSwim.state.beachesRequested).toBe(true);
    expect(metadataPreserved.state.beachesRequested).toBe(false);
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

  it('keeps Destination through BeachesRequested as the only behaviourally active production extractors', () => {
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
    });

    const beachesActiveMessage =
      'show me beaches. find nearby. find restaurants. book activities. book car hire. book a hotel. book flights. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: beachesActiveMessage,
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
      },
    });

    for (let index = 14; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: beachesActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[13]?.extract({
        message: beachesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { beachesRequested: true } });
    expect(
      extractors[12]?.extract({
        message: beachesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { nearbyDiscoveryRequested: true } });
    expect(
      extractors[11]?.extract({
        message: beachesActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { restaurantsRequested: true } });

    const nearbyOnlyMessage = 'what is nearby';
    expect(
      extractors[12]?.extract({
        message: nearbyOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { nearbyDiscoveryRequested: true } });
    expect(
      extractors[13]?.extract({
        message: nearbyOnlyMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 14; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: nearbyOnlyMessage,
          currentState,
        }),
        `extractor ${index} on nearby message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
