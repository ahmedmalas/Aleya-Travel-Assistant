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
import { DivingSnorkellingRequestedConversationStateExtractor } from '../extractors/DivingSnorkellingRequestedConversationStateExtractor';
import { WineriesFoodTrailsRequestedConversationStateExtractor } from '../extractors/WineriesFoodTrailsRequestedConversationStateExtractor';

const ROOT = process.cwd();
const WINERIES_FOOD_TRAILS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/WineriesFoodTrailsRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6h',
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

describe('phase 6H — WineriesFoodTrailsRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<WineriesFoodTrailsRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      WineriesFoodTrailsRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      WineriesFoodTrailsRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me wineries',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('reports that no canonical wineries or food-trails request field exists', () => {
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6h-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });
    for (const field of [
      'wineriesRequested',
      'wineToursRequested',
      'vineyardsRequested',
      'foodTrailsRequested',
      'wineriesFoodTrailsRequested',
      'culinaryToursRequested',
      'gourmetExperiencesRequested',
      'tastingsRequested',
      'cellarDoorsRequested',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(initial, field)).toBe(false);
      expect(field in initial).toBe(false);
    }
  });

  it('cannot create state from winery, wine-tour, food-trail, or related wording', () => {
    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      scenicDrivesRequested: true,
      nearbyDiscoveryRequested: true,
    });

    const messages = [
      'wineries',
      'winery',
      'vineyards',
      'vineyard',
      'wine tour',
      'wine tasting',
      'cellar door',
      'wine region',
      'food trail',
      'food trails',
      'culinary tour',
      'gourmet tour',
      'local food tour',
      'restaurant trail',
      'cheese trail',
      'chocolate trail',
      'brewery trail',
      'distillery trail',
      'farm-gate trail',
      'food and wine experience',
      'show me cellar doors',
      'find wine regions',
      'I want a culinary tour',
      'add gourmet tours',
      'yes include food trails',
      'actually show me vineyards',
      'do not include wineries',
      'no wine tasting',
      'remove food trails',
      'forget brewery trails',
      'keep restaurants but remove wineries',
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
      message: 'keep restaurants but remove wineries',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('wineriesRequested');
    expect(result.stateUpdate).not.toHaveProperty('foodTrailsRequested');
    expect(result.stateUpdate).not.toHaveProperty('wineriesFoodTrailsRequested');
    expect(result.stateUpdate).not.toHaveProperty('restaurantsRequested');
    expect(result.stateUpdate).not.toHaveProperty('attractionsRequested');
    expect(withRelatedFlags.restaurantsRequested).toBe(true);
  });

  it('does not mutate input or retain state across calls', () => {
    const extractor = new WineriesFoodTrailsRequestedConversationStateExtractor();
    const currentState = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
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
      message: 'wine tasting',
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

  it('is included once in the production composite after diving/snorkelling and before empty', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(extractors).toHaveLength(28);
    const divingIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof DivingSnorkellingRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const wineriesIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof WineriesFoodTrailsRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const emptyIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EmptyConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(divingIndexes).toEqual([22]);
    expect(wineriesIndexes).toEqual([23]);
    expect(emptyIndexes).toEqual([27]);
    expect(extractors[22]).toBeInstanceOf(
      DivingSnorkellingRequestedConversationStateExtractor,
    );
    expect(extractors[23]).toBeInstanceOf(
      WineriesFoodTrailsRequestedConversationStateExtractor,
    );
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(WINERIES_FOOD_TRAILS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(
      /wineriesRequested\s*:|foodTrailsRequested\s*:|wineriesFoodTrailsRequested\s*:/,
    );
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|vineyard|cellar|wine.?tour|wine.?tasting|culinary|gourmet|cheese.?trail|chocolate.?trail|brewery|distillery|farm-?gate/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|provider|from ['"][^'"]*(?:search|discovery|map|route|tourism|wine|culinary)/i,
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
      WINERIES_FOOD_TRAILS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/WineriesFoodTrailsRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'WineriesFoodTrailsRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /WineriesFoodTrailsRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new WineriesFoodTrailsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('WineriesFoodTrailsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps every production extractor behaviourally empty with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const messageOnly = processConversationTurn({
      message: 'show me wineries and food trails',
      state: currentState,
      userEntryId: 'user-6h',
      assistantEntryId: 'assistant-6h',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const factoryResult = createConversationStateExtractor().extract({
      message: 'wine tasting',
      currentState,
    });

    expect(factoryResult).toEqual({ stateUpdate: {} });
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(messageOnly.state.restaurantsRequested).toBe(true);
    expect(messageOnly.state.destination).toBe('Brisbane');
    expect(
      Object.prototype.hasOwnProperty.call(
        messageOnly.state,
        'wineriesFoodTrailsRequested',
      ),
    ).toBe(false);
    expect(messageOnly.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(messageOnly).sort()).toEqual(['reply', 'state', 'trace']);
    expect(messageOnly.trace.messageInterpreted).toBe(false);
  });
});
