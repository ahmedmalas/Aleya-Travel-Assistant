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
import { HikingWalkingRequestedConversationStateExtractor } from '../extractors/HikingWalkingRequestedConversationStateExtractor';
import { FishingRequestedConversationStateExtractor } from '../extractors/FishingRequestedConversationStateExtractor';

const ROOT = process.cwd();
const FISHING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/FishingRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6f',
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

describe('phase 6F — FishingRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<FishingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      FishingRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      FishingRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new FishingRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'go fishing',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('reports that no canonical fishing request field exists', () => {
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6f-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });
    for (const field of [
      'fishingRequested',
      'anglingRequested',
      'fishingCharterRequested',
      'deepSeaFishingRequested',
      'freshwaterFishingRequested',
      'sportFishingRequested',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(initial, field)).toBe(false);
      expect(field in initial).toBe(false);
    }
  });

  it('cannot create state from fishing, angling, charter, or related wording', () => {
    const extractor = new FishingRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      scenicDrivesRequested: true,
      activitiesRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: true,
      kayakingRequested: true,
    });

    const messages = [
      'fishing',
      'go fishing',
      'fish',
      'angling',
      'fishing charter',
      'deep-sea fishing',
      'deep sea fishing',
      'reef fishing',
      'sport fishing',
      'freshwater fishing',
      'river fishing',
      'lake fishing',
      'shore fishing',
      'game fishing',
      'show me fishing charters',
      'find deep-sea fishing',
      'I want to go angling',
      'add reef fishing',
      'yes include fishing',
      'actually show me freshwater fishing',
      'do not include fishing',
      'no angling',
      'remove fishing',
      'forget fishing charters',
      'keep kayaking but remove fishing',
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
      message: 'keep kayaking but remove fishing',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('fishingRequested');
    expect(result.stateUpdate).not.toHaveProperty('anglingRequested');
    expect(result.stateUpdate).not.toHaveProperty('attractionsRequested');
    expect(result.stateUpdate).not.toHaveProperty('kayakingRequested');
    expect(withRelatedFlags.kayakingRequested).toBe(true);
  });

  it('does not mutate input or retain state across calls', () => {
    const extractor = new FishingRequestedConversationStateExtractor();
    const currentState = createState({
      attractionsRequested: true,
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
      message: 'go fishing',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.attractionsRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });
  });

  it('is included once in the production composite after hiking/walking', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(extractors).toHaveLength(27);
    const hikingIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof HikingWalkingRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const fishingIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof FishingRequestedConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);
    const emptyIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EmptyConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(hikingIndexes).toEqual([20]);
    expect(fishingIndexes).toEqual([21]);
    expect(emptyIndexes).toEqual([26]);
    expect(extractors[20]).toBeInstanceOf(
      HikingWalkingRequestedConversationStateExtractor,
    );
    expect(extractors[21]).toBeInstanceOf(FishingRequestedConversationStateExtractor);
    expect(extractors[26]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(FISHING_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(
      /fishingRequested\s*:|anglingRequested\s*:|fishingCharterRequested\s*:/,
    );
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|angling|charter|deep-?sea|reef|freshwater|game.?fishing|shore.?fishing/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|provider|from ['"][^'"]*(?:search|discovery|map|route|charter|marine)/i,
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
      FISHING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/FishingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'FishingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/FishingRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new FishingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('FishingRequestedConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('keeps every production extractor behaviourally empty with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      activitiesRequested: true,
      kayakingRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const messageOnly = processConversationTurn({
      message: 'show me fishing charters and deep-sea fishing',
      state: currentState,
      userEntryId: 'user-6f',
      assistantEntryId: 'assistant-6f',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const factoryResult = createConversationStateExtractor().extract({
      message: 'go fishing',
      currentState,
    });

    expect(factoryResult).toEqual({ stateUpdate: {} });
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(messageOnly.state.kayakingRequested).toBe(true);
    expect(messageOnly.state.destination).toBe('Brisbane');
    expect(
      Object.prototype.hasOwnProperty.call(messageOnly.state, 'fishingRequested'),
    ).toBe(false);
    expect(messageOnly.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(messageOnly).sort()).toEqual(['reply', 'state', 'trace']);
    expect(messageOnly.trace.messageInterpreted).toBe(false);
  });
});
