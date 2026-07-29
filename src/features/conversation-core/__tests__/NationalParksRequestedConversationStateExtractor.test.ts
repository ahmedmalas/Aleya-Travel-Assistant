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
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { WildlifeRequestedConversationStateExtractor } from '../extractors/WildlifeRequestedConversationStateExtractor';
import { NationalParksRequestedConversationStateExtractor } from '../extractors/NationalParksRequestedConversationStateExtractor';

const ROOT = process.cwd();
const NATIONAL_PARKS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/NationalParksRequestedConversationStateExtractor.ts',
);
const TYPES_SOURCE = resolve(ROOT, 'src/features/conversation-core/types.ts');

const NATIONAL_PARKS_RELATED_FIELDS = [
  'nationalParksRequested',
  'nationalParkRequested',
  'parksRequested',
  'natureParksRequested',
  'protectedAreasRequested',
  'reservesRequested',
  'conservationAreasRequested',
  'stateParksRequested',
  'wildernessRequested',
] as const;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6k',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
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
    eventsRequested: true,
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

describe('phase 6K — NationalParksRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<NationalParksRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      NationalParksRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      NationalParksRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new NationalParksRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me national parks',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('proves no national-parks-related canonical field exists and none was added', () => {
    const typesSource = readFileSync(TYPES_SOURCE, 'utf8');
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6k-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });

    for (const field of NATIONAL_PARKS_RELATED_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(initial, field)).toBe(false);
      expect(field in initial).toBe(false);
      expect(typesSource.includes(field)).toBe(false);
      expect(typesSource).not.toMatch(new RegExp(`${field}\\s*[?:]`));
    }

    expect(typesSource).not.toMatch(/\bnationalParks?Requested\b/i);
    expect(typesSource).not.toMatch(/\bparksRequested\b/);
    expect(typesSource).not.toMatch(/\bwildernessRequested\b/);
  });

  it('cannot create state from national park, protected-area, or reserve wording', () => {
    const extractor = new NationalParksRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: true,
      eventsFestivalsRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      eventsRequested: true,
      nearbyDiscoveryRequested: true,
      campingRequested: true,
    });

    const messages = [
      'national parks',
      'national park',
      'a national park',
      'visit national parks',
      'show me national parks',
      'protected areas',
      'nature reserves',
      'state parks',
      'wilderness areas',
      'conservation areas',
      'find a national park nearby',
      'I want protected areas',
      'add nature reserves',
      'yes include state parks',
      'actually show me wilderness',
      'do not include national parks',
      'no national park',
      'remove protected areas',
      'forget nature reserves',
      'keep camping but remove national parks',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState(),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withRelatedFlags,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep camping but remove national parks',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    for (const field of NATIONAL_PARKS_RELATED_FIELDS) {
      expect(result.stateUpdate).not.toHaveProperty(field);
    }
    expect(result.stateUpdate).not.toHaveProperty('campingRequested');
    expect(result.stateUpdate).not.toHaveProperty('attractionsRequested');
    expect(withRelatedFlags.campingRequested).toBe(true);
    expect(withRelatedFlags.attractionsRequested).toBe(true);
  });

  it('does not mutate input or retain state across calls', () => {
    const extractor = new NationalParksRequestedConversationStateExtractor();
    const currentState = createState({
      eventsRequested: true,
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
      message: 'national parks',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.eventsRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });
  });

  it('is included once in the production composite after wildlife and before empty', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(extractors).toHaveLength(28);
    const wildlifeIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof WildlifeRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const nationalParksIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof NationalParksRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const emptyIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EmptyConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(wildlifeIndexes).toEqual([25]);
    expect(nationalParksIndexes).toEqual([26]);
    expect(emptyIndexes).toEqual([27]);
    expect(extractors[25]).toBeInstanceOf(
      WildlifeRequestedConversationStateExtractor,
    );
    expect(extractors[26]).toBeInstanceOf(
      NationalParksRequestedConversationStateExtractor,
    );
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(NATIONAL_PARKS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(
      /nationalParksRequested\s*:|nationalParkRequested\s*:|parksRequested\s*:/,
    );
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|national park|protected area|nature reserve|state park|wilderness|conservation area/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|provider|from ['"][^'"]*(?:search|discovery|map|route|ticket|park|reserve)/i,
    );
    expect(source).not.toMatch(/metadata|confidence|warnings/);
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
      NATIONAL_PARKS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/NationalParksRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'NationalParksRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /NationalParksRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new NationalParksRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('NationalParksRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps every production extractor behaviourally empty with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: true,
      eventsFestivalsRequested: true,
      activitiesRequested: true,
      eventsRequested: true,
      campingRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const messageOnly = processConversationTurn({
      message: 'show me national parks and nature reserves',
      state: currentState,
      userEntryId: 'user-6k',
      assistantEntryId: 'assistant-6k',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const factoryResult = createConversationStateExtractor().extract({
      message: 'protected areas near wilderness',
      currentState,
    });

    expect(factoryResult).toEqual({ stateUpdate: {} });
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(messageOnly.state.eventsRequested).toBe(true);
    expect(messageOnly.state.campingRequested).toBe(true);
    expect(messageOnly.state.destination).toBe('Brisbane');
    for (const field of NATIONAL_PARKS_RELATED_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(messageOnly.state, field)).toBe(
        false,
      );
    }
    expect(messageOnly.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(messageOnly).sort()).toEqual(['reply', 'state', 'trace']);
    expect(messageOnly.trace.messageInterpreted).toBe(false);
  });
});
