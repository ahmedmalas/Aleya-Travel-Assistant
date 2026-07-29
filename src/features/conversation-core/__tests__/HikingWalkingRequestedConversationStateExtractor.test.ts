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
import { SnowActivitiesRequestedConversationStateExtractor } from '../SnowActivitiesRequestedConversationStateExtractor';
import { HikingWalkingRequestedConversationStateExtractor } from '../extractors/HikingWalkingRequestedConversationStateExtractor';

const ROOT = process.cwd();
const HIKING_WALKING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/HikingWalkingRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6e',
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

describe('phase 6E — HikingWalkingRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<HikingWalkingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      HikingWalkingRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      HikingWalkingRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'go hiking',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('reports that no canonical hiking or walking request field exists', () => {
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6e-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });
    for (const field of [
      'hikingRequested',
      'walkingRequested',
      'hikingWalkingRequested',
      'trekkingRequested',
      'trailsRequested',
      'bushwalkingRequested',
      'natureWalksRequested',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(initial, field)).toBe(false);
      expect(field in initial).toBe(false);
    }
  });

  it('cannot create state from hiking, walking, bushwalking, trekking, trail, or nature-walk wording', () => {
    const extractor = new HikingWalkingRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      scenicDrivesRequested: true,
      activitiesRequested: true,
      nearbyDiscoveryRequested: true,
      campingRequested: true,
    });

    const messages = [
      'hiking',
      'walking',
      'go hiking',
      'go for a walk',
      'bushwalking',
      'trekking',
      'walking trails',
      'hiking trails',
      'nature walks',
      'guided walks',
      'mountain walks',
      'coastal walks',
      'forest walks',
      'show me hiking trails',
      'find bushwalking near the hotel',
      'I want to go trekking',
      'add nature walks',
      'yes include hiking',
      'actually show me walking trails',
      'do not include hiking',
      'no walking',
      'remove hiking',
      'forget bushwalking',
      'keep attractions but remove hiking',
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
      message: 'keep attractions but remove hiking',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('hikingRequested');
    expect(result.stateUpdate).not.toHaveProperty('walkingRequested');
    expect(result.stateUpdate).not.toHaveProperty('hikingWalkingRequested');
    expect(result.stateUpdate).not.toHaveProperty('attractionsRequested');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(withRelatedFlags.attractionsRequested).toBe(true);
  });

  it('does not mutate input or retain state across calls', () => {
    const extractor = new HikingWalkingRequestedConversationStateExtractor();
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
      message: 'go for a walk',
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

  it('is included once in the production composite after snow activities', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(extractors).toHaveLength(26);
    const snowIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof SnowActivitiesRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const hikingIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof HikingWalkingRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const emptyIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EmptyConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(snowIndexes).toEqual([19]);
    expect(hikingIndexes).toEqual([20]);
    expect(emptyIndexes).toEqual([25]);
    expect(extractors[19]).toBeInstanceOf(
      SnowActivitiesRequestedConversationStateExtractor,
    );
    expect(extractors[20]).toBeInstanceOf(
      HikingWalkingRequestedConversationStateExtractor,
    );
    expect(extractors[25]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(HIKING_WALKING_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(
      /hikingRequested\s*:|walkingRequested\s*:|hikingWalkingRequested\s*:/,
    );
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|bushwalk|trek(?:king)?|trail|nature.?walk|coastal.?walk|forest.?walk|mountain.?walk|guided.?walk/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|provider|from ['"][^'"]*(?:search|discovery|map|route|trail|park)/i,
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
      HIKING_WALKING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/HikingWalkingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'HikingWalkingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /HikingWalkingRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new HikingWalkingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('HikingWalkingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps every production extractor behaviourally empty with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      activitiesRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const messageOnly = processConversationTurn({
      message: 'show me hiking trails and nature walks',
      state: currentState,
      userEntryId: 'user-6e',
      assistantEntryId: 'assistant-6e',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const factoryResult = createConversationStateExtractor().extract({
      message: 'go hiking',
      currentState,
    });

    expect(factoryResult).toEqual({ stateUpdate: {} });
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(messageOnly.state.destination).toBe('Brisbane');
    expect(
      Object.prototype.hasOwnProperty.call(messageOnly.state, 'hikingWalkingRequested'),
    ).toBe(false);
    expect(messageOnly.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(messageOnly).sort()).toEqual(['reply', 'state', 'trace']);
    expect(messageOnly.trace.messageInterpreted).toBe(false);
  });
});
