import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateExtractor,
  type ConversationStateUpdate,
} from '../index';
import { AccommodationRequestedConversationStateExtractor } from '../AccommodationRequestedConversationStateExtractor';
import { ActivitiesRequestedConversationStateExtractor } from '../ActivitiesRequestedConversationStateExtractor';
import { AttractionsRequestedConversationStateExtractor } from '../AttractionsRequestedConversationStateExtractor';
import { BeachesRequestedConversationStateExtractor } from '../BeachesRequestedConversationStateExtractor';
import { CampingRequestedConversationStateExtractor } from '../CampingRequestedConversationStateExtractor';
import { CarHireRequestedConversationStateExtractor } from '../CarHireRequestedConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';
import { FourWheelDrivingRequestedConversationStateExtractor } from '../FourWheelDrivingRequestedConversationStateExtractor';
import { KayakingRequestedConversationStateExtractor } from '../KayakingRequestedConversationStateExtractor';
import { NearbyDiscoveryRequestedConversationStateExtractor } from '../NearbyDiscoveryRequestedConversationStateExtractor';
import { RestaurantsRequestedConversationStateExtractor } from '../RestaurantsRequestedConversationStateExtractor';
import { RestaurantPreferenceConversationStateExtractor } from '../RestaurantPreferenceConversationStateExtractor';
import { ScenicDrivesRequestedConversationStateExtractor } from '../ScenicDrivesRequestedConversationStateExtractor';
import { SnowActivitiesRequestedConversationStateExtractor } from '../SnowActivitiesRequestedConversationStateExtractor';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';
import { DivingSnorkellingRequestedConversationStateExtractor } from '../extractors/DivingSnorkellingRequestedConversationStateExtractor';
import { EventsFestivalsRequestedConversationStateExtractor } from '../extractors/EventsFestivalsRequestedConversationStateExtractor';
import { FishingRequestedConversationStateExtractor } from '../extractors/FishingRequestedConversationStateExtractor';
import { HikingWalkingRequestedConversationStateExtractor } from '../extractors/HikingWalkingRequestedConversationStateExtractor';
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';
import { NightlifeRequestedConversationStateExtractor } from '../extractors/NightlifeRequestedConversationStateExtractor';
import { ShoppingRequestedConversationStateExtractor } from '../extractors/ShoppingRequestedConversationStateExtractor';
import { WellnessRequestedConversationStateExtractor } from '../extractors/WellnessRequestedConversationStateExtractor';
import { ToursRequestedConversationStateExtractor } from '../extractors/ToursRequestedConversationStateExtractor';
import { FamilyActivitiesRequestedConversationStateExtractor } from '../extractors/FamilyActivitiesRequestedConversationStateExtractor';
import { AccessibleTravelRequestedConversationStateExtractor } from '../extractors/AccessibleTravelRequestedConversationStateExtractor';
import { WildlifeRequestedConversationStateExtractor } from '../extractors/WildlifeRequestedConversationStateExtractor';
import { WineriesFoodTrailsRequestedConversationStateExtractor } from '../extractors/WineriesFoodTrailsRequestedConversationStateExtractor';

/** Activated behavioural request fields covered by this collision audit. */
const BEHAVIOURAL_FIELDS = [
  'flightsRequested',
  'accommodationRequested',
  'carHireRequested',
  'activitiesRequested',
  'restaurantsRequested',
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
  'accessibleTravelRequested',
] as const;

type BehaviouralField = (typeof BEHAVIOURAL_FIELDS)[number];

type IsolatedCase = {
  label: string;
  message: string;
  field: BehaviouralField;
  extractor: ConversationStateExtractor;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-9e',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
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

function behaviouralKeys(update: ConversationStateUpdate): BehaviouralField[] {
  return BEHAVIOURAL_FIELDS.filter((field) => update[field] !== undefined);
}

const ISOLATED_CASES: readonly IsolatedCase[] = [
  {
    label: 'Flights',
    message: 'book flights',
    field: 'flightsRequested',
    extractor: new FlightsRequestedConversationStateExtractor(),
  },
  {
    label: 'Accommodation',
    message: 'book a hotel',
    field: 'accommodationRequested',
    extractor: new AccommodationRequestedConversationStateExtractor(),
  },
  {
    label: 'Car Hire',
    message: 'book car hire',
    field: 'carHireRequested',
    extractor: new CarHireRequestedConversationStateExtractor(),
  },
  {
    label: 'Activities',
    message: 'book activities',
    field: 'activitiesRequested',
    extractor: new ActivitiesRequestedConversationStateExtractor(),
  },
  {
    label: 'Restaurants',
    message: 'find restaurants',
    field: 'restaurantsRequested',
    extractor: new RestaurantsRequestedConversationStateExtractor(),
  },
  {
    label: 'Nearby Discovery',
    message: 'what is nearby',
    field: 'nearbyDiscoveryRequested',
    extractor: new NearbyDiscoveryRequestedConversationStateExtractor(),
  },
  {
    label: 'Beaches',
    message: 'show me beaches',
    field: 'beachesRequested',
    extractor: new BeachesRequestedConversationStateExtractor(),
  },
  {
    label: 'Camping',
    message: 'show me camping',
    field: 'campingRequested',
    extractor: new CampingRequestedConversationStateExtractor(),
  },
  {
    label: 'Kayaking',
    message: 'show me kayaking',
    field: 'kayakingRequested',
    extractor: new KayakingRequestedConversationStateExtractor(),
  },
  {
    label: 'Four Wheel Driving',
    message: 'add four-wheel driving',
    field: 'fourWheelDriveRequested',
    extractor: new FourWheelDrivingRequestedConversationStateExtractor(),
  },
  {
    label: 'Scenic Drives',
    message: 'add scenic drives',
    field: 'scenicDrivesRequested',
    extractor: new ScenicDrivesRequestedConversationStateExtractor(),
  },
  {
    label: 'Attractions',
    message: 'attraction options',
    field: 'attractionsRequested',
    extractor: new AttractionsRequestedConversationStateExtractor(),
  },
  {
    label: 'Snow Activities',
    message: 'add snow activities',
    field: 'snowActivitiesRequested',
    extractor: new SnowActivitiesRequestedConversationStateExtractor(),
  },
  {
    label: 'Hiking / Walking',
    message: 'add hiking',
    field: 'hikingWalkingRequested',
    extractor: new HikingWalkingRequestedConversationStateExtractor(),
  },
  {
    label: 'Fishing',
    message: 'fishing options',
    field: 'fishingRequested',
    extractor: new FishingRequestedConversationStateExtractor(),
  },
  {
    label: 'Diving / Snorkelling',
    message: 'diving options',
    field: 'divingSnorkellingRequested',
    extractor: new DivingSnorkellingRequestedConversationStateExtractor(),
  },
  {
    label: 'Wineries / Food Trails',
    message: 'winery options',
    field: 'wineriesFoodTrailsRequested',
    extractor: new WineriesFoodTrailsRequestedConversationStateExtractor(),
  },
  {
    label: 'Events / Festivals',
    message: 'festival options',
    field: 'eventsFestivalsRequested',
    extractor: new EventsFestivalsRequestedConversationStateExtractor(),
  },
  {
    label: 'Wildlife',
    message: 'wildlife options',
    field: 'wildlifeRequested',
    extractor: new WildlifeRequestedConversationStateExtractor(),
  },
  {
    label: 'National Parks',
    message: 'park options',
    field: 'nationalParksRequested',
    extractor: new NationalParksRequestedConversationStateExtractor(),
  },
];

const COMBINED_CASES: readonly {
  label: string;
  message: string;
  fields: readonly BehaviouralField[];
}[] = [
  {
    label: 'beaches + kayaking',
    message: 'show me beaches. show me kayaking',
    fields: ['beachesRequested', 'kayakingRequested'],
  },
  {
    label: 'camping + hiking',
    message: 'show me camping. add hiking',
    fields: ['campingRequested', 'hikingWalkingRequested'],
  },
  {
    label: 'wildlife + national parks',
    message: 'wildlife options. park options',
    fields: ['wildlifeRequested', 'nationalParksRequested'],
  },
  {
    label: 'wineries/food trails + events/festivals',
    message: 'winery options. festival options',
    fields: ['wineriesFoodTrailsRequested', 'eventsFestivalsRequested'],
  },
  {
    label: 'diving/snorkelling + fishing',
    message: 'diving options. fishing options',
    fields: ['divingSnorkellingRequested', 'fishingRequested'],
  },
  {
    label: 'four-wheel driving + scenic drives',
    message: 'add four-wheel driving. add scenic drives',
    fields: ['fourWheelDriveRequested', 'scenicDrivesRequested'],
  },
  {
    label: 'flights + accommodation + car hire',
    message: 'book flights. book a hotel. book car hire',
    fields: [
      'flightsRequested',
      'accommodationRequested',
      'carHireRequested',
    ],
  },
];

const COLLISION_PROTECTIONS: readonly {
  label: string;
  message: string;
  expected: readonly BehaviouralField[];
  forbidden: readonly BehaviouralField[];
}[] = [
  {
    label: 'restaurants do not imply food trails',
    message: 'find restaurants',
    expected: ['restaurantsRequested'],
    forbidden: ['wineriesFoodTrailsRequested'],
  },
  {
    label: 'fishing does not imply wildlife',
    message: 'fishing options',
    expected: ['fishingRequested'],
    forbidden: ['wildlifeRequested'],
  },
  {
    label: 'beaches do not imply diving or kayaking',
    message: 'show me beaches',
    expected: ['beachesRequested'],
    forbidden: ['divingSnorkellingRequested', 'kayakingRequested'],
  },
  {
    label: 'national parks do not imply hiking, camping or wildlife',
    message: 'national parks',
    expected: ['nationalParksRequested'],
    forbidden: [
      'hikingWalkingRequested',
      'campingRequested',
      'wildlifeRequested',
    ],
  },
  {
    label: 'events do not imply activities unless activities are explicit',
    message: 'festival options',
    expected: ['eventsFestivalsRequested'],
    forbidden: ['activitiesRequested'],
  },
  {
    label: 'nearby wording does not activate unrelated discovery fields',
    message: 'what is nearby',
    expected: ['nearbyDiscoveryRequested'],
    forbidden: [
      'beachesRequested',
      'campingRequested',
      'kayakingRequested',
      'attractionsRequested',
      'wildlifeRequested',
      'nationalParksRequested',
      'hikingWalkingRequested',
      'eventsFestivalsRequested',
      'wineriesFoodTrailsRequested',
    ],
  },
];

describe('phase 9E — behavioural extractor collision matrix', () => {
  it('covers every activated behavioural capability with an isolated cue', () => {
    expect(ISOLATED_CASES).toHaveLength(20);
    expect(COMBINED_CASES).toHaveLength(7);
    expect(COLLISION_PROTECTIONS).toHaveLength(6);
    expect(ISOLATED_CASES.map((entry) => entry.label)).toEqual([
      'Flights',
      'Accommodation',
      'Car Hire',
      'Activities',
      'Restaurants',
      'Nearby Discovery',
      'Beaches',
      'Camping',
      'Kayaking',
      'Four Wheel Driving',
      'Scenic Drives',
      'Attractions',
      'Snow Activities',
      'Hiking / Walking',
      'Fishing',
      'Diving / Snorkelling',
      'Wineries / Food Trails',
      'Events / Festivals',
      'Wildlife',
      'National Parks',
    ]);
  });

  it('isolated clear cues emit only their own behavioural field for extractor and composite', () => {
    const composite = createConversationStateExtractor();
    const currentState = createState();

    for (const entry of ISOLATED_CASES) {
      const isolated = entry.extractor.extract({
        message: entry.message,
        currentState,
      });
      const composed = composite.extract({
        message: entry.message,
        currentState,
      });

      expect(isolated.stateUpdate, `${entry.label} isolated`).toEqual({
        [entry.field]: true,
      });
      expect(
        behaviouralKeys(isolated.stateUpdate),
        `${entry.label} isolated behavioural keys`,
      ).toEqual([entry.field]);
      expect(composed.stateUpdate, `${entry.label} composite`).toEqual({
        [entry.field]: true,
      });
      expect(
        behaviouralKeys(composed.stateUpdate),
        `${entry.label} composite behavioural keys`,
      ).toEqual([entry.field]);

      for (const field of BEHAVIOURAL_FIELDS) {
        if (field === entry.field) {
          continue;
        }
        expect(
          isolated.stateUpdate,
          `${entry.label} isolated must not emit ${field}`,
        ).not.toHaveProperty(field);
        expect(
          composed.stateUpdate,
          `${entry.label} composite must not emit ${field}`,
        ).not.toHaveProperty(field);
      }
    }
  });

  it('Accessible Travel extracts from clear requests (Phase 19B)', () => {
    const composite = createConversationStateExtractor();
    const currentState = createState();
    const messages = [
      'accessible travel',
      'wheelchair accessible travel',
      'mobility access',
      'disability access',
      'step-free access',
    ];

    for (const message of messages) {
      const composed = composite.extract({ message, currentState });
      expect(composed.stateUpdate, message).toEqual({
        accessibleTravelRequested: true,
      });
    }

    const overridden = processConversationTurn({
      message: 'Hello',
      state: currentState,
      userEntryId: 'user-9e-access-a',
      assistantEntryId: 'assistant-9e-access-a',
      userMessageAt: new Date('2026-07-29T00:01:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:01:01.000Z'),
      stateUpdate: { accessibleTravelRequested: true },
    });
    expect(overridden.state.accessibleTravelRequested).toBe(true);

    const preserved = processConversationTurn({
      message: 'Hello',
      state: createState({ accessibleTravelRequested: false }),
      userEntryId: 'user-9e-access-b',
      assistantEntryId: 'assistant-9e-access-b',
      userMessageAt: new Date('2026-07-29T00:01:02.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:01:03.000Z'),
    });
    expect(preserved.state.accessibleTravelRequested).toBe(false);
  });

  it('combined capability requests emit all and only the requested behavioural fields', () => {
    const composite = createConversationStateExtractor();
    const currentState = createState();

    for (const entry of COMBINED_CASES) {
      const composed = composite.extract({
        message: entry.message,
        currentState,
      });
      const expectedUpdate = Object.fromEntries(
        entry.fields.map((field) => [field, true]),
      );
      expect(composed.stateUpdate, entry.label).toEqual(expectedUpdate);
      expect(
        behaviouralKeys(composed.stateUpdate).sort(),
        `${entry.label} behavioural keys`,
      ).toEqual([...entry.fields].sort());
    }
  });

  it('representative collision protections keep unrelated behavioural fields empty', () => {
    const composite = createConversationStateExtractor();
    const currentState = createState();

    for (const entry of COLLISION_PROTECTIONS) {
      const composed = composite.extract({
        message: entry.message,
        currentState,
      });
      expect(
        behaviouralKeys(composed.stateUpdate).sort(),
        entry.label,
      ).toEqual([...entry.expected].sort());
      for (const field of entry.expected) {
        expect(composed.stateUpdate[field], `${entry.label} ${field}`).toBe(
          true,
        );
      }
      for (const field of entry.forbidden) {
        expect(
          composed.stateUpdate,
          `${entry.label} must not emit ${field}`,
        ).not.toHaveProperty(field);
      }
    }

    const eventsPlusActivities = composite.extract({
      message: 'book activities. festival options',
      currentState,
    });
    expect(behaviouralKeys(eventsPlusActivities.stateUpdate).sort()).toEqual([
      'activitiesRequested',
      'eventsFestivalsRequested',
    ]);
  });

  it('factory and composite extractor order remain unchanged', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(35);
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
      RestaurantPreferenceConversationStateExtractor,
    );
    expect(extractors[13]).toBeInstanceOf(
      NearbyDiscoveryRequestedConversationStateExtractor,
    );
    expect(extractors[14]).toBeInstanceOf(BeachesRequestedConversationStateExtractor);
    expect(extractors[15]).toBeInstanceOf(CampingRequestedConversationStateExtractor);
    expect(extractors[16]).toBeInstanceOf(KayakingRequestedConversationStateExtractor);
    expect(extractors[17]).toBeInstanceOf(
      FourWheelDrivingRequestedConversationStateExtractor,
    );
    expect(extractors[18]).toBeInstanceOf(
      ScenicDrivesRequestedConversationStateExtractor,
    );
    expect(extractors[19]).toBeInstanceOf(
      AttractionsRequestedConversationStateExtractor,
    );
    expect(extractors[20]).toBeInstanceOf(
      SnowActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[21]).toBeInstanceOf(
      HikingWalkingRequestedConversationStateExtractor,
    );
    expect(extractors[22]).toBeInstanceOf(FishingRequestedConversationStateExtractor);
    expect(extractors[23]).toBeInstanceOf(
      DivingSnorkellingRequestedConversationStateExtractor,
    );
    expect(extractors[24]).toBeInstanceOf(
      WineriesFoodTrailsRequestedConversationStateExtractor,
    );
    expect(extractors[25]).toBeInstanceOf(
      EventsFestivalsRequestedConversationStateExtractor,
    );
    expect(extractors[26]).toBeInstanceOf(WildlifeRequestedConversationStateExtractor);
    expect(extractors[27]).toBeInstanceOf(
      NationalParksRequestedConversationStateExtractor,
    );
    expect(extractors[28]).toBeInstanceOf(
      NightlifeRequestedConversationStateExtractor,
    );
    expect(extractors[29]).toBeInstanceOf(
      ShoppingRequestedConversationStateExtractor,
    );
    expect(extractors[30]).toBeInstanceOf(
      WellnessRequestedConversationStateExtractor,
    );
    expect(extractors[31]).toBeInstanceOf(
      ToursRequestedConversationStateExtractor,
    );
    expect(extractors[32]).toBeInstanceOf(
      FamilyActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[33]).toBeInstanceOf(
      AccessibleTravelRequestedConversationStateExtractor,
    );
    expect(extractors[34]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('explicit stateUpdate precedence remains intact over extracted behavioural fields', () => {
    const currentState = createState({
      flightsRequested: null,
      accommodationRequested: null,
      nationalParksRequested: null,
      wildlifeRequested: null,
      accessibleTravelRequested: null,
    });

    const extracted = processConversationTurn({
      message: 'book flights. wildlife options. park options',
      state: currentState,
      userEntryId: 'user-9e-prec-a',
      assistantEntryId: 'assistant-9e-prec-a',
      userMessageAt: new Date('2026-07-29T00:02:00.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:02:01.000Z'),
    });
    expect(extracted.state.flightsRequested).toBe(true);
    expect(extracted.state.wildlifeRequested).toBe(true);
    expect(extracted.state.nationalParksRequested).toBe(true);

    const overriddenFalse = processConversationTurn({
      message: 'book flights. wildlife options. park options',
      state: currentState,
      userEntryId: 'user-9e-prec-b',
      assistantEntryId: 'assistant-9e-prec-b',
      userMessageAt: new Date('2026-07-29T00:02:02.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:02:03.000Z'),
      stateUpdate: {
        flightsRequested: false,
        wildlifeRequested: false,
        nationalParksRequested: false,
      },
    });
    expect(overriddenFalse.state.flightsRequested).toBe(false);
    expect(overriddenFalse.state.wildlifeRequested).toBe(false);
    expect(overriddenFalse.state.nationalParksRequested).toBe(false);

    const overriddenTrue = processConversationTurn({
      message: 'no national parks',
      state: currentState,
      userEntryId: 'user-9e-prec-c',
      assistantEntryId: 'assistant-9e-prec-c',
      userMessageAt: new Date('2026-07-29T00:02:04.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:02:05.000Z'),
      stateUpdate: { nationalParksRequested: true },
    });
    expect(overriddenTrue.state.nationalParksRequested).toBe(true);

    const nullOverride = processConversationTurn({
      message: 'book a hotel',
      state: currentState,
      userEntryId: 'user-9e-prec-d',
      assistantEntryId: 'assistant-9e-prec-d',
      userMessageAt: new Date('2026-07-29T00:02:06.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:02:07.000Z'),
      stateUpdate: { accommodationRequested: null },
    });
    expect(nullOverride.state.accommodationRequested).toBeNull();
  });
});
