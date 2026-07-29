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
import { EventsFestivalsRequestedConversationStateExtractor } from '../extractors/EventsFestivalsRequestedConversationStateExtractor';
import { WildlifeRequestedConversationStateExtractor } from '../extractors/WildlifeRequestedConversationStateExtractor';

const ROOT = process.cwd();
const WILDLIFE_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/WildlifeRequestedConversationStateExtractor.ts',
);
const TYPES_SOURCE = resolve(ROOT, 'src/features/conversation-core/types.ts');

const WILDLIFE_RELATED_FIELDS = [
  'wildlifeRequested',
  'animalsRequested',
  'wildlifeExperiencesRequested',
  'safariRequested',
  'birdwatchingRequested',
  'whaleWatchingRequested',
  'marineWildlifeRequested',
  'animalEncountersRequested',
  'zoosRequested',
  'sanctuariesRequested',
] as const;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6j',
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

describe('phase 6J — WildlifeRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<WildlifeRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      WildlifeRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      WildlifeRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new WildlifeRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me wildlife',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('proves no wildlife-related canonical field exists and none was added', () => {
    const typesSource = readFileSync(TYPES_SOURCE, 'utf8');
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6j-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });

    for (const field of WILDLIFE_RELATED_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(initial, field)).toBe(false);
      expect(field in initial).toBe(false);
      expect(typesSource.includes(field)).toBe(false);
      expect(typesSource).not.toMatch(new RegExp(`${field}\\s*[?:]`));
    }

    expect(typesSource).not.toMatch(/\bwildlife\w*Requested\b/i);
    expect(typesSource).not.toMatch(/\banimalsRequested\b/);
    expect(typesSource).not.toMatch(/\bsafariRequested\b/);
  });

  it('cannot create state from wildlife, safari, birdwatching, marine, or zoo wording', () => {
    const extractor = new WildlifeRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      eventsRequested: true,
      nearbyDiscoveryRequested: true,
    });

    const messages = [
      'wildlife',
      'wildlife experiences',
      'see wildlife',
      'animal encounters',
      'safari',
      'wildlife safari',
      'birdwatching',
      'bird watching',
      'whale watching',
      'whale-watching',
      'dolphin watching',
      'seal watching',
      'marine life',
      'marine wildlife',
      'penguins',
      'koalas',
      'kangaroos',
      'zoos',
      'wildlife parks',
      'animal parks',
      'sanctuaries',
      'wildlife sanctuaries',
      'conservation centres',
      'nature reserves',
      'show me wildlife',
      'find a safari nearby',
      'I want bird watching',
      'add whale-watching',
      'yes include marine life',
      'actually show me zoos',
      'do not include wildlife',
      'no safari',
      'remove wildlife parks',
      'forget sanctuaries',
      'keep attractions but remove wildlife',
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
      message: 'keep attractions but remove wildlife',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    for (const field of WILDLIFE_RELATED_FIELDS) {
      expect(result.stateUpdate).not.toHaveProperty(field);
    }
    expect(result.stateUpdate).not.toHaveProperty('attractionsRequested');
    expect(result.stateUpdate).not.toHaveProperty('eventsRequested');
    expect(withRelatedFlags.attractionsRequested).toBe(true);
    expect(withRelatedFlags.eventsRequested).toBe(true);
  });

  it('does not mutate input or retain state across calls', () => {
    const extractor = new WildlifeRequestedConversationStateExtractor();
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
      message: 'wildlife safari',
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

  it('is included once in the production composite after events/festivals and before empty', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(extractors).toHaveLength(28);
    const eventsIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EventsFestivalsRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const wildlifeIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof WildlifeRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const emptyIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EmptyConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(eventsIndexes).toEqual([24]);
    expect(wildlifeIndexes).toEqual([25]);
    expect(emptyIndexes).toEqual([27]);
    expect(extractors[24]).toBeInstanceOf(
      EventsFestivalsRequestedConversationStateExtractor,
    );
    expect(extractors[25]).toBeInstanceOf(
      WildlifeRequestedConversationStateExtractor,
    );
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(WILDLIFE_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(
      /wildlifeRequested\s*:|animalsRequested\s*:|safariRequested\s*:/,
    );
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|safari|birdwatching|bird watching|whale.?watching|dolphin|seal watching|marine life|penguin|koala|kangaroo|zoo|sanctuar|conservation|nature reserve/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|provider|from ['"][^'"]*(?:search|discovery|map|route|ticket|wildlife|animal)/i,
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
      WILDLIFE_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/WildlifeRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'WildlifeRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/WildlifeRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new WildlifeRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('WildlifeRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps every production extractor behaviourally empty with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      activitiesRequested: true,
      eventsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const messageOnly = processConversationTurn({
      message: 'show me wildlife safari and whale watching',
      state: currentState,
      userEntryId: 'user-6j',
      assistantEntryId: 'assistant-6j',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const factoryResult = createConversationStateExtractor().extract({
      message: 'bird watching near nature reserves',
      currentState,
    });

    expect(factoryResult).toEqual({ stateUpdate: {} });
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(messageOnly.state.eventsRequested).toBe(true);
    expect(messageOnly.state.destination).toBe('Brisbane');
    for (const field of WILDLIFE_RELATED_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(messageOnly.state, field)).toBe(
        false,
      );
    }
    expect(messageOnly.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(messageOnly).sort()).toEqual(['reply', 'state', 'trace']);
    expect(messageOnly.trace.messageInterpreted).toBe(false);
  });
});
