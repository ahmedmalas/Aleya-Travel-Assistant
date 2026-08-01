import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as conversationCore from '../index';
import * as applyModule from '../applyConversationStateUpdate';
import * as extractModule from '../extractConversationState';
import * as factoryModule from '../createConversationStateExtractor';
import * as hasChangedModule from '../hasConversationStateUpdateChanged';
import * as transitionModule from '../transitionConversationStateFromExtraction';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';
import { MultiPassengerCountConversationStateExtractor } from '../MultiPassengerCountConversationStateExtractor';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { BareNumberPassengerCountConversationStateExtractor } from '../BareNumberPassengerCountConversationStateExtractor';
import { ExplicitGuestCountConversationStateExtractor } from '../ExplicitGuestCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';
import { AccommodationRequestedConversationStateExtractor } from '../AccommodationRequestedConversationStateExtractor';
import { CarHireRequestedConversationStateExtractor } from '../CarHireRequestedConversationStateExtractor';
import { ActivitiesRequestedConversationStateExtractor } from '../ActivitiesRequestedConversationStateExtractor';
import { RestaurantsRequestedConversationStateExtractor } from '../RestaurantsRequestedConversationStateExtractor';
import { RestaurantPreferenceConversationStateExtractor } from '../RestaurantPreferenceConversationStateExtractor';
import { NearbyDiscoveryRequestedConversationStateExtractor } from '../NearbyDiscoveryRequestedConversationStateExtractor';
import { BeachesRequestedConversationStateExtractor } from '../BeachesRequestedConversationStateExtractor';
import { CampingRequestedConversationStateExtractor } from '../CampingRequestedConversationStateExtractor';
import { KayakingRequestedConversationStateExtractor } from '../KayakingRequestedConversationStateExtractor';
import { FourWheelDrivingRequestedConversationStateExtractor } from '../FourWheelDrivingRequestedConversationStateExtractor';
import { ScenicDrivesRequestedConversationStateExtractor } from '../ScenicDrivesRequestedConversationStateExtractor';
import { AttractionsRequestedConversationStateExtractor } from '../AttractionsRequestedConversationStateExtractor';
import { SnowActivitiesRequestedConversationStateExtractor } from '../SnowActivitiesRequestedConversationStateExtractor';
import { HikingWalkingRequestedConversationStateExtractor } from '../extractors/HikingWalkingRequestedConversationStateExtractor';
import { FishingRequestedConversationStateExtractor } from '../extractors/FishingRequestedConversationStateExtractor';
import { DivingSnorkellingRequestedConversationStateExtractor } from '../extractors/DivingSnorkellingRequestedConversationStateExtractor';
import { WineriesFoodTrailsRequestedConversationStateExtractor } from '../extractors/WineriesFoodTrailsRequestedConversationStateExtractor';
import { EventsFestivalsRequestedConversationStateExtractor } from '../extractors/EventsFestivalsRequestedConversationStateExtractor';
import { WildlifeRequestedConversationStateExtractor } from '../extractors/WildlifeRequestedConversationStateExtractor';
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';
import { NightlifeRequestedConversationStateExtractor } from '../extractors/NightlifeRequestedConversationStateExtractor';
import { ShoppingRequestedConversationStateExtractor } from '../extractors/ShoppingRequestedConversationStateExtractor';
import { WellnessRequestedConversationStateExtractor } from '../extractors/WellnessRequestedConversationStateExtractor';
import { ToursRequestedConversationStateExtractor } from '../extractors/ToursRequestedConversationStateExtractor';
import { FamilyActivitiesRequestedConversationStateExtractor } from '../extractors/FamilyActivitiesRequestedConversationStateExtractor';
import { AccessibleTravelRequestedConversationStateExtractor } from '../extractors/AccessibleTravelRequestedConversationStateExtractor';
import type { ConversationStateExtractor } from '../types';

const ROOT = process.cwd();

const PRODUCTION_EXTRACTOR_ORDER = [
  DestinationConversationStateExtractor,
  OriginConversationStateExtractor,
  DepartureDateConversationStateExtractor,
  ReturnDateConversationStateExtractor,
  MultiPassengerCountConversationStateExtractor,
  AdultCountConversationStateExtractor,
  ChildCountConversationStateExtractor,
  InfantCountConversationStateExtractor,
  FlightsRequestedConversationStateExtractor,
  AccommodationRequestedConversationStateExtractor,
  CarHireRequestedConversationStateExtractor,
  ActivitiesRequestedConversationStateExtractor,
  RestaurantsRequestedConversationStateExtractor,
  RestaurantPreferenceConversationStateExtractor,
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
  NightlifeRequestedConversationStateExtractor,
  ShoppingRequestedConversationStateExtractor,
  WellnessRequestedConversationStateExtractor,
  ToursRequestedConversationStateExtractor,
  FamilyActivitiesRequestedConversationStateExtractor,
  AccessibleTravelRequestedConversationStateExtractor,
  BareNumberPassengerCountConversationStateExtractor,
  ExplicitGuestCountConversationStateExtractor,
  EmptyConversationStateExtractor,
] as const;

const PUBLIC_EXTRACTOR_NAMES = [
  'DestinationConversationStateExtractor',
  'OriginConversationStateExtractor',
  'DepartureDateConversationStateExtractor',
  'ReturnDateConversationStateExtractor',
  'MultiPassengerCountConversationStateExtractor',
  'AdultCountConversationStateExtractor',
  'ChildCountConversationStateExtractor',
  'InfantCountConversationStateExtractor',
  'FlightsRequestedConversationStateExtractor',
  'AccommodationRequestedConversationStateExtractor',
  'CarHireRequestedConversationStateExtractor',
  'ActivitiesRequestedConversationStateExtractor',
  'RestaurantsRequestedConversationStateExtractor',
  'RestaurantPreferenceConversationStateExtractor',
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
  'NightlifeRequestedConversationStateExtractor',
  'ShoppingRequestedConversationStateExtractor',
  'WellnessRequestedConversationStateExtractor',
  'ToursRequestedConversationStateExtractor',
  'FamilyActivitiesRequestedConversationStateExtractor',
  'AccessibleTravelRequestedConversationStateExtractor',
  'BareNumberPassengerCountConversationStateExtractor',
  'ExplicitGuestCountConversationStateExtractor',
  'EmptyConversationStateExtractor',
  'CompositeConversationStateExtractor',
  'createConversationStateExtractor',
  'extractConversationState',
  'transitionConversationStateFromExtraction',
  'applyConversationStateUpdate',
  'hasConversationStateUpdateChanged',
] as const;

const TRAVEL_FIELDS = [
  'destination',
  'origin',
  'departureDate',
  'returnDate',
  'adultCount',
  'childCount',
  'infantCount',
  'flightsRequested',
  'accommodationRequested',
  'carHireRequested',
  'activitiesRequested',
  'restaurantsRequested',
  'restaurantPreference',
  'nearbyDiscoveryRequested',
  'beachesRequested',
  'campingRequested',
  'kayakingRequested',
  'fourWheelDriveRequested',
  'scenicDrivesRequested',
  'attractionsRequested',
  'snowActivitiesRequested',
  'hikingWalkingRequested',
  'fishingRequested',
  'divingSnorkellingRequested',
  'wineriesFoodTrailsRequested',
  'eventsFestivalsRequested',
  'wildlifeRequested',
  'nationalParksRequested',
  'nightlifeRequested',
  'shoppingRequested',
  'wellnessRequested',
  'toursRequested',
  'familyActivitiesRequested',
  'accessibleTravelRequested',
] as const satisfies ReadonlyArray<keyof ConversationCoreState>;

type TravelField = (typeof TRAVEL_FIELDS)[number];

type BehaviouralRuntimeCue = {
  message: string;
  field: TravelField;
  expected: string | number | boolean;
};

/** One supported cue per behavioural extractor — production runtime only. */
const BEHAVIOURAL_RUNTIME_CUES: readonly BehaviouralRuntimeCue[] = [
  { message: 'go to Cairns', field: 'destination', expected: 'Cairns' },
  { message: 'from Sydney', field: 'origin', expected: 'Sydney' },
  {
    message: 'Depart on 28 August 2026',
    field: 'departureDate',
    expected: '2026-08-28',
  },
  {
    message: 'Return on 31 August 2026',
    field: 'returnDate',
    expected: '2026-08-31',
  },
  { message: '2 adults', field: 'adultCount', expected: 2 },
  { message: '2 children', field: 'childCount', expected: 2 },
  { message: '1 infant', field: 'infantCount', expected: 1 },
  { message: 'book flights', field: 'flightsRequested', expected: true },
  { message: 'book a hotel', field: 'accommodationRequested', expected: true },
  { message: 'book car hire', field: 'carHireRequested', expected: true },
  { message: 'book activities', field: 'activitiesRequested', expected: true },
  { message: 'find restaurants', field: 'restaurantsRequested', expected: true },
  {
    message: 'Italian',
    field: 'restaurantPreference',
    expected: 'Italian',
  },
  {
    message: 'what is nearby',
    field: 'nearbyDiscoveryRequested',
    expected: true,
  },
  { message: 'show me beaches', field: 'beachesRequested', expected: true },
  { message: 'add camping', field: 'campingRequested', expected: true },
  { message: 'add kayaking', field: 'kayakingRequested', expected: true },
  {
    message: 'add four-wheel driving',
    field: 'fourWheelDriveRequested',
    expected: true,
  },
  {
    message: 'add scenic drives',
    field: 'scenicDrivesRequested',
    expected: true,
  },
  { message: 'add attractions', field: 'attractionsRequested', expected: true },
  {
    message: 'add snow activities',
    field: 'snowActivitiesRequested',
    expected: true,
  },
  { message: 'add hiking', field: 'hikingWalkingRequested', expected: true },
  { message: 'add fishing', field: 'fishingRequested', expected: true },
  {
    message: 'add diving',
    field: 'divingSnorkellingRequested',
    expected: true,
  },
  {
    message: 'add wineries',
    field: 'wineriesFoodTrailsRequested',
    expected: true,
  },
  {
    message: 'add festivals',
    field: 'eventsFestivalsRequested',
    expected: true,
  },
  { message: 'add wildlife', field: 'wildlifeRequested', expected: true },
  {
    message: 'add national parks',
    field: 'nationalParksRequested',
    expected: true,
  },
  {
    message: 'I want nightlife',
    field: 'nightlifeRequested',
    expected: true,
  },
  {
    message: 'Include shopping',
    field: 'shoppingRequested',
    expected: true,
  },
  {
    message: 'Add wellness activities',
    field: 'wellnessRequested',
    expected: true,
  },
  {
    message: 'Include tours',
    field: 'toursRequested',
    expected: true,
  },
  {
    message: 'Add family activities',
    field: 'familyActivitiesRequested',
    expected: true,
  },
  {
    message: 'We need accessible travel options',
    field: 'accessibleTravelRequested',
    expected: true,
  },
];

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

function baselineState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-8a',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Hobart',
    origin: 'Perth',
    departureDate: '2026-10-01',
    returnDate: '2026-10-08',
    adultCount: 4,
    childCount: 3,
    infantCount: 2,
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

function runTurn(
  message: string,
  state: ConversationCoreState,
  stateUpdate?: ConversationStateUpdate,
  index = 0,
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-8a-${index}`,
    assistantEntryId: `assistant-8a-${index}`,
    userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
}

function travelSnapshot(state: ConversationCoreState) {
  return Object.fromEntries(
    TRAVEL_FIELDS.map((field) => [field, state[field]]),
  ) as Record<(typeof TRAVEL_FIELDS)[number], ConversationCoreState[(typeof TRAVEL_FIELDS)[number]]>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('phase 8A — complete extraction pipeline verification', () => {
  it('wires processConversationTurn through transition → extract → factory → composite → hasChanged → apply → explicit stateUpdate', () => {
    const processTurn = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
      'utf8',
    );
    const transition = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/transitionConversationStateFromExtraction.ts',
      ),
      'utf8',
    );
    const extract = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/extractConversationState.ts'),
      'utf8',
    );
    const factory = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/createConversationStateExtractor.ts',
      ),
      'utf8',
    );

    expect(processTurn).toMatch(/transitionConversationStateFromExtraction\(/);
    expect(processTurn).toMatch(/hasConversationStateUpdateChanged\(/);
    expect(processTurn).toMatch(/applyConversationStateUpdate\(/);
    expect(processTurn).toMatch(/input\.stateUpdate/);
    expect(transition).toMatch(/extractConversationState\(/);
    expect(transition).toMatch(/hasConversationStateUpdateChanged\(/);
    expect(transition).toMatch(/applyConversationStateUpdate\(/);
    expect(extract).toMatch(/createConversationStateExtractor\(\)/);
    expect(extract).toMatch(/extractor\.extract\(input\)/);
    expect(factory).toMatch(/new CompositeConversationStateExtractor\(\[/);
    expect(factory).toMatch(
      /new NationalParksRequestedConversationStateExtractor\(\),\s*new NightlifeRequestedConversationStateExtractor\(\),\s*new ShoppingRequestedConversationStateExtractor\(\),\s*new WellnessRequestedConversationStateExtractor\(\),\s*new ToursRequestedConversationStateExtractor\(\),\s*new FamilyActivitiesRequestedConversationStateExtractor\(\),\s*new AccessibleTravelRequestedConversationStateExtractor\(\),\s*new BareNumberPassengerCountConversationStateExtractor\(\),\s*new ExplicitGuestCountConversationStateExtractor\(\),\s*new EmptyConversationStateExtractor\(\),\s*\]\);/,
    );

    const order: string[] = [];
    const realTransition = transitionModule.transitionConversationStateFromExtraction;
    const realExtract = extractModule.extractConversationState;
    const realFactory = factoryModule.createConversationStateExtractor;
    const realHasChanged = hasChangedModule.hasConversationStateUpdateChanged;
    const realApply = applyModule.applyConversationStateUpdate;

    vi.spyOn(
      transitionModule,
      'transitionConversationStateFromExtraction',
    ).mockImplementation((input) => {
      order.push('transition');
      return realTransition(input);
    });
    vi.spyOn(extractModule, 'extractConversationState').mockImplementation(
      (input) => {
        order.push('extract');
        return realExtract(input);
      },
    );
    vi.spyOn(factoryModule, 'createConversationStateExtractor').mockImplementation(
      () => {
        order.push('factory');
        return realFactory();
      },
    );
    vi.spyOn(
      hasChangedModule,
      'hasConversationStateUpdateChanged',
    ).mockImplementation((state, update) => {
      order.push('hasChanged');
      return realHasChanged(state, update);
    });
    vi.spyOn(applyModule, 'applyConversationStateUpdate').mockImplementation(
      (state, update) => {
        order.push('apply');
        return realApply(state, update);
      },
    );

    const result = runTurn('add national parks', baselineState(), {
      nationalParksRequested: false,
    });

    expect(order[0]).toBe('transition');
    expect(order).toContain('extract');
    expect(order).toContain('factory');
    expect(order).toContain('hasChanged');
    expect(order).toContain('apply');
    expect(order.indexOf('extract')).toBeGreaterThan(order.indexOf('transition'));
    expect(order.indexOf('factory')).toBeGreaterThan(order.indexOf('extract'));
    // explicit apply follows extraction transition apply
    expect(order.filter((step) => step === 'apply').length).toBeGreaterThanOrEqual(2);
    expect(result.state.nationalParksRequested).toBe(false);
    expect(result.reply).toBe(result.state.transcript.at(-1)?.message);
    expect(result.reply).not.toMatch(/assembled|unavailable/i);
  });

  it('reaches all 34 behavioural extractors through processConversationTurn with single-field activation', () => {
    expect(BEHAVIOURAL_RUNTIME_CUES).toHaveLength(34);

    // Phase 8K: general activities cues overlap attraction wording, so
    // "add attractions" may also set activitiesRequested.
    // Phase 19B: tours cues also activate activitiesRequested; wellness
    // activities may re-assert activitiesRequested.
    const allowedCrossField: Readonly<Record<string, readonly string[]>> = {
      'add attractions': ['activitiesRequested'],
      'Include tours': ['activitiesRequested'],
      'Add wellness activities': ['activitiesRequested'],
    };

    const crossFieldActivations: string[] = [];

    BEHAVIOURAL_RUNTIME_CUES.forEach((cue, index) => {
      const state = baselineState(
        cue.field === 'restaurantPreference'
          ? { restaurantsRequested: true }
          : {},
      );
      const before = travelSnapshot(state);
      const result = runTurn(cue.message, state, undefined, index);
      const after = travelSnapshot(result.state);

      expect(after[cue.field], cue.message).toBe(cue.expected);

      for (const field of TRAVEL_FIELDS) {
        if (field === cue.field) {
          continue;
        }
        if (after[field] !== before[field]) {
          const allowed = allowedCrossField[cue.message] ?? [];
          if (allowed.includes(field)) {
            continue;
          }
          crossFieldActivations.push(
            `${cue.message} changed ${field}: ${String(before[field])} → ${String(after[field])}`,
          );
        }
      }
    });

    expect(crossFieldActivations).toEqual([]);
  });

  it('preserves prior state for unsupported wording through the production runtime', () => {
    const state = baselineState({
      destination: 'Brisbane',
      origin: 'Melbourne',
      nationalParksRequested: true,
      wildlifeRequested: true,
      eventsFestivalsRequested: true,
      flightsRequested: true,
    });
    const before = travelSnapshot(state);
    const unsupported = [
      'Hello',
      'parks',
      'playgrounds',
      'kangaroo',
      'concerts',
      'do not include national parks',
      'keep everything',
    ];

    unsupported.forEach((message, index) => {
      const result = runTurn(message, state, undefined, index);
      expect(travelSnapshot(result.state), message).toEqual(before);
      expect(result.reply, message).toBe(result.state.transcript.at(-1)?.message);
      expect(result.reply, message).not.toMatch(/assembled|unavailable/i);
    });
  });

  it('keeps trusted explicit true, false, and null precedence over extraction', () => {
    const state = baselineState({ nationalParksRequested: false });

    const extracted = runTurn('add national parks', state, undefined, 0);
    const overrideFalse = runTurn(
      'add national parks',
      state,
      { nationalParksRequested: false },
      1,
    );
    const overrideTrue = runTurn(
      'do not include national parks',
      state,
      { nationalParksRequested: true },
      2,
    );
    const overrideNull = runTurn(
      'add national parks',
      state,
      { nationalParksRequested: null },
      3,
    );
    const independent = runTurn(
      'add national parks. Fly from Sydney to Cairns',
      baselineState({ destination: null, origin: null, nationalParksRequested: null }),
      {
        origin: 'Perth',
        destination: 'Hobart',
        nationalParksRequested: false,
      },
      4,
    );

    expect(extracted.state.nationalParksRequested).toBe(true);
    expect(overrideFalse.state.nationalParksRequested).toBe(false);
    expect(overrideTrue.state.nationalParksRequested).toBe(true);
    expect(overrideNull.state.nationalParksRequested).toBeNull();
    expect(independent.state.nationalParksRequested).toBe(false);
    expect(independent.state.origin).toBe('Perth');
    expect(independent.state.destination).toBe('Hobart');
  });

  it('keeps EmptyConversationStateExtractor last among 38 production extractors in accepted order', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(PRODUCTION_EXTRACTOR_ORDER).toHaveLength(38);
    expect(extractors).toHaveLength(38);
    expect(extractors[37]).toBeInstanceOf(EmptyConversationStateExtractor);

    for (let index = 0; index < PRODUCTION_EXTRACTOR_ORDER.length; index += 1) {
      expect(extractors[index], `extractor ${index}`).toBeInstanceOf(
        PRODUCTION_EXTRACTOR_ORDER[index]!,
      );
    }

    expect(
      extractors[37]?.extract({
        message: 'add national parks. add wildlife. book flights',
        currentState: baselineState(),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('keeps every extractor and pipeline helper off the public index', () => {
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
      expect(index, name).not.toMatch(new RegExp(name));
      expect(conversationCore, name).not.toHaveProperty(name);
    }

    expect(processTurn).toMatch(/transitionConversationStateFromExtraction/);
    expect(processTurn).toMatch(/hasConversationStateUpdateChanged/);
    expect(processTurn).toMatch(/applyConversationStateUpdate/);
    expect(processTurn).not.toMatch(/extractConversationState/);
    expect(processTurn).not.toMatch(/createConversationStateExtractor/);
    expect(processTurn).not.toMatch(/EmptyConversationStateExtractor/);
    expect(runtimeExports).toEqual(['processConversationTurn']);
  });
});
