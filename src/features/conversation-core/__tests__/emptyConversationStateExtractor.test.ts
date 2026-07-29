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
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
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
const EMPTY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/emptyConversationStateExtractor.ts',
);

const PRODUCTION_EXTRACTOR_ORDER = [
  DestinationConversationStateExtractor,
  OriginConversationStateExtractor,
  DepartureDateConversationStateExtractor,
  ReturnDateConversationStateExtractor,
  AdultCountConversationStateExtractor,
  ChildCountConversationStateExtractor,
  InfantCountConversationStateExtractor,
  FlightsRequestedConversationStateExtractor,
  AccommodationRequestedConversationStateExtractor,
  CarHireRequestedConversationStateExtractor,
  ActivitiesRequestedConversationStateExtractor,
  RestaurantsRequestedConversationStateExtractor,
  NearbyDiscoveryRequestedConversationStateExtractor,
  BeachesRequestedConversationStateExtractor,
  CampingRequestedConversationStateExtractor,
  KayakingRequestedConversationStateExtractor,
  FourWheelDrivingRequestedConversationStateExtractor,
  ScenicDrivesRequestedConversationStateExtractor,
  AttractionsRequestedConversationStateExtractor,
  SnowActivitiesRequestedConversationStateExtractor,
  HikingWalkingRequestedConversationStateExtractor,
  FishingRequestedConversationStateExtractor,
  DivingSnorkellingRequestedConversationStateExtractor,
  WineriesFoodTrailsRequestedConversationStateExtractor,
  EventsFestivalsRequestedConversationStateExtractor,
  WildlifeRequestedConversationStateExtractor,
  NationalParksRequestedConversationStateExtractor,
  EmptyConversationStateExtractor,
] as const;

const PUBLIC_EXTRACTOR_NAMES = [
  'DestinationConversationStateExtractor',
  'OriginConversationStateExtractor',
  'DepartureDateConversationStateExtractor',
  'ReturnDateConversationStateExtractor',
  'AdultCountConversationStateExtractor',
  'ChildCountConversationStateExtractor',
  'InfantCountConversationStateExtractor',
  'FlightsRequestedConversationStateExtractor',
  'AccommodationRequestedConversationStateExtractor',
  'CarHireRequestedConversationStateExtractor',
  'ActivitiesRequestedConversationStateExtractor',
  'RestaurantsRequestedConversationStateExtractor',
  'NearbyDiscoveryRequestedConversationStateExtractor',
  'BeachesRequestedConversationStateExtractor',
  'CampingRequestedConversationStateExtractor',
  'KayakingRequestedConversationStateExtractor',
  'FourWheelDrivingRequestedConversationStateExtractor',
  'ScenicDrivesRequestedConversationStateExtractor',
  'AttractionsRequestedConversationStateExtractor',
  'SnowActivitiesRequestedConversationStateExtractor',
  'HikingWalkingRequestedConversationStateExtractor',
  'FishingRequestedConversationStateExtractor',
  'DivingSnorkellingRequestedConversationStateExtractor',
  'WineriesFoodTrailsRequestedConversationStateExtractor',
  'EventsFestivalsRequestedConversationStateExtractor',
  'WildlifeRequestedConversationStateExtractor',
  'NationalParksRequestedConversationStateExtractor',
  'EmptyConversationStateExtractor',
  'CompositeConversationStateExtractor',
  'createConversationStateExtractor',
] as const;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-7ab',
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
    nationalParksRequested: true,
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

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
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

describe('phase 7AB — EmptyConversationStateExtractor finalisation', () => {
  it('implements the extractor contract as an intentional no-op', () => {
    expectTypeOf<EmptyConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<EmptyConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<EmptyConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new EmptyConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'add national parks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('always returns { stateUpdate: {} } for every input shape', () => {
    const extractor = new EmptyConversationStateExtractor();
    const messages = [
      '',
      'Hello',
      'Sydney to Cairns',
      'add national parks',
      'add wildlife',
      'add events',
      'book flights',
      'show me beaches',
      'do not include national parks',
      'keep everything',
      'Forget everything',
      'From Sydney to Cairns on 28 August for two adults; book flights, hotel and activities',
    ];

    for (const message of messages) {
      const result = extractor.extract({
        message,
        currentState: createState({
          destination: 'Cairns',
          nationalParksRequested: false,
          wildlifeRequested: false,
        }),
      });
      expect(result, message).toEqual({ stateUpdate: {} });
      expect(Object.keys(result.stateUpdate), message).toEqual([]);
    }
  });

  it('emits no canonical fields and never true, false, or null', () => {
    const extractor = new EmptyConversationStateExtractor();
    const result = extractor.extract({
      message: 'add national parks. add wildlife. book flights',
      currentState: createState(),
    });

    expect(result).toEqual({ stateUpdate: {} });
    expect(JSON.stringify(result.stateUpdate)).toBe('{}');
    expect(result.stateUpdate).not.toHaveProperty('nationalParksRequested');
    expect(result.stateUpdate).not.toHaveProperty('wildlifeRequested');
    expect(result.stateUpdate).not.toHaveProperty('destination');
    expect(Object.values(result.stateUpdate)).not.toContain(true);
    expect(Object.values(result.stateUpdate)).not.toContain(false);
    expect(Object.values(result.stateUpdate)).not.toContain(null);

    const source = readFileSync(EMPTY_SOURCE, 'utf8');
    expect(source).toContain('Phase 7AB');
    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).toMatch(/stateUpdate:\s*\{\s*\}/);
    expect(source).not.toMatch(/:\s*true/);
    expect(source).not.toMatch(/:\s*false/);
    expect(source).not.toMatch(/:\s*null/);
    expect(source).not.toMatch(/\.trim\(/);
    expect(source).not.toMatch(/\.toLowerCase\(/);
    expect(source).not.toMatch(/\.includes\(/);
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new EmptyConversationStateExtractor();
    const currentState = createState({
      destination: 'Brisbane',
      transcript: [
        {
          id: 'user-1',
          role: 'user',
          message: 'Brisbane',
          timestamp: '2026-07-29T00:00:00.000Z',
        },
      ],
    });
    const input: ConversationStateExtractionInput = {
      message: 'Change it to Cairns',
      currentState,
    };
    const beforeInput = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.destination = 'mutated outside extractor';

    expect(input).toEqual(beforeInput);
    expect(currentState).toEqual(beforeInput.currentState);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other = new EmptyConversationStateExtractor() as EmptyConversationStateExtractor & {
      retained?: string;
    };
    (extractor as EmptyConversationStateExtractor & { retained?: string }).retained =
      'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: 'add national parks',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('remains last among 28 production extractors in the accepted composite order', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(PRODUCTION_EXTRACTOR_ORDER).toHaveLength(28);
    expect(extractors).toHaveLength(28);
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);

    for (let index = 0; index < PRODUCTION_EXTRACTOR_ORDER.length; index += 1) {
      expect(extractors[index], `extractor ${index}`).toBeInstanceOf(
        PRODUCTION_EXTRACTOR_ORDER[index]!,
      );
    }

    const factorySource = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      'utf8',
    );
    expect(factorySource).toMatch(
      /new NationalParksRequestedConversationStateExtractor\(\),\s*new EmptyConversationStateExtractor\(\),\s*\]\);/,
    );
  });

  it('keeps all 27 behavioural extractors active and Empty as the sole intentional no-op', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
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

    const behaviouralProofs: ReadonlyArray<{
      index: number;
      message: string;
      expected: Record<string, unknown>;
    }> = [
      { index: 0, message: 'go to Cairns', expected: { destination: 'Cairns' } },
      { index: 1, message: 'from Sydney', expected: { origin: 'Sydney' } },
      {
        index: 2,
        message: 'Depart on 28 August 2026',
        expected: { departureDate: '2026-08-28' },
      },
      {
        index: 3,
        message: 'Return on 31 August 2026',
        expected: { returnDate: '2026-08-31' },
      },
      { index: 4, message: '2 adults', expected: { adultCount: 2 } },
      { index: 5, message: '2 children', expected: { childCount: 2 } },
      { index: 6, message: '1 infant', expected: { infantCount: 1 } },
      { index: 7, message: 'book flights', expected: { flightsRequested: true } },
      {
        index: 8,
        message: 'book a hotel',
        expected: { accommodationRequested: true },
      },
      { index: 9, message: 'book car hire', expected: { carHireRequested: true } },
      {
        index: 10,
        message: 'book activities',
        expected: { activitiesRequested: true },
      },
      {
        index: 11,
        message: 'find restaurants',
        expected: { restaurantsRequested: true },
      },
      {
        index: 12,
        message: 'what is nearby',
        expected: { nearbyDiscoveryRequested: true },
      },
      {
        index: 13,
        message: 'show me beaches',
        expected: { beachesRequested: true },
      },
      { index: 14, message: 'add camping', expected: { campingRequested: true } },
      { index: 15, message: 'add kayaking', expected: { kayakingRequested: true } },
      {
        index: 16,
        message: 'add four-wheel driving',
        expected: { fourWheelDriveRequested: true },
      },
      {
        index: 17,
        message: 'add scenic drives',
        expected: { scenicDrivesRequested: true },
      },
      {
        index: 18,
        message: 'add attractions',
        expected: { attractionsRequested: true },
      },
      {
        index: 19,
        message: 'add snow activities',
        expected: { snowActivitiesRequested: true },
      },
      {
        index: 20,
        message: 'add hiking',
        expected: { hikingWalkingRequested: true },
      },
      { index: 21, message: 'add fishing', expected: { fishingRequested: true } },
      {
        index: 22,
        message: 'add diving',
        expected: { divingSnorkellingRequested: true },
      },
      {
        index: 23,
        message: 'add wineries',
        expected: { wineriesFoodTrailsRequested: true },
      },
      {
        index: 24,
        message: 'add events',
        expected: { eventsFestivalsRequested: true },
      },
      { index: 25, message: 'add wildlife', expected: { wildlifeRequested: true } },
      {
        index: 26,
        message: 'add national parks',
        expected: { nationalParksRequested: true },
      },
    ];

    expect(behaviouralProofs).toHaveLength(27);

    for (const proof of behaviouralProofs) {
      expect(
        extractors[proof.index]?.extract({
          message: proof.message,
          currentState,
        }),
        `behavioural extractor ${proof.index}`,
      ).toEqual({ stateUpdate: proof.expected });
    }

    expect(
      extractors[27]?.extract({
        message: 'add national parks. add wildlife. book flights',
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('leaves unsupported composite input unchanged and preserves prior state', () => {
    const currentState = createState({
      destination: 'Brisbane',
      origin: 'Melbourne',
      nationalParksRequested: true,
      wildlifeRequested: true,
      eventsFestivalsRequested: true,
      flightsRequested: true,
    });
    const unsupported = [
      'Hello',
      'parks',
      'playgrounds',
      'kangaroo',
      'concerts',
      'do not include national parks',
      'keep everything',
    ];

    for (const message of unsupported) {
      const extracted = createConversationStateExtractor().extract({
        message,
        currentState,
      });
      expect(extracted, message).toEqual({ stateUpdate: {} });

      const turned = processConversationTurn({
        message,
        state: currentState,
        userEntryId: `user-unsupported-${message}`,
        assistantEntryId: `assistant-unsupported-${message}`,
        userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
        assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      });
      expect(turned.state.destination, message).toBe('Brisbane');
      expect(turned.state.origin, message).toBe('Melbourne');
      expect(turned.state.nationalParksRequested, message).toBe(true);
      expect(turned.state.wildlifeRequested, message).toBe(true);
      expect(turned.state.eventsFestivalsRequested, message).toBe(true);
      expect(turned.state.flightsRequested, message).toBe(true);
      expect(turned.reply, message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    }
  });

  it('keeps trusted explicit stateUpdate precedence over extraction unchanged', () => {
    const currentState = createState({
      nationalParksRequested: false,
      wildlifeRequested: false,
      destination: 'Brisbane',
      origin: 'Melbourne',
    });

    const extracted = processConversationTurn({
      message: 'add national parks',
      state: currentState,
      userEntryId: 'user-7ab-a',
      assistantEntryId: 'assistant-7ab-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overriddenFalse = processConversationTurn({
      message: 'add national parks',
      state: currentState,
      userEntryId: 'user-7ab-b',
      assistantEntryId: 'assistant-7ab-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { nationalParksRequested: false },
    });
    const overriddenTrue = processConversationTurn({
      message: 'do not include national parks',
      state: currentState,
      userEntryId: 'user-7ab-c',
      assistantEntryId: 'assistant-7ab-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { nationalParksRequested: true },
    });
    const nullOverride = processConversationTurn({
      message: 'add national parks',
      state: currentState,
      userEntryId: 'user-7ab-d',
      assistantEntryId: 'assistant-7ab-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { nationalParksRequested: null },
    });
    const independentOverride = processConversationTurn({
      message: 'add national parks. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        nationalParksRequested: null,
      }),
      userEntryId: 'user-7ab-e',
      assistantEntryId: 'assistant-7ab-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        nationalParksRequested: false,
      },
    });

    expect(extracted.state.nationalParksRequested).toBe(true);
    expect(overriddenFalse.state.nationalParksRequested).toBe(false);
    expect(overriddenTrue.state.nationalParksRequested).toBe(true);
    expect(nullOverride.state.nationalParksRequested).toBeNull();
    expect(independentOverride.state.nationalParksRequested).toBe(false);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(extracted.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });

  it('keeps every extractor implementation off the public index', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const processTurn = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
          'function' && name !== 'createInitialConversationCoreState',
    );

    for (const name of PUBLIC_EXTRACTOR_NAMES) {
      expect(index).not.toMatch(new RegExp(name));
      expect(conversationCore).not.toHaveProperty(name);
      expect(processTurn).not.toMatch(new RegExp(name));
    }

    expect(runtimeExports).toEqual(['processConversationTurn']);
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);

    const allowedConstruct = new Set([
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      EMPTY_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );
    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new EmptyConversationStateExtractor'), file).toBe(false);
    }
  });
});
