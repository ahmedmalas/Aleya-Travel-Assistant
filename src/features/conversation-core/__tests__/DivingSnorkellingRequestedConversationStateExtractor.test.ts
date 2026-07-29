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
import { FishingRequestedConversationStateExtractor } from '../extractors/FishingRequestedConversationStateExtractor';
import { DivingSnorkellingRequestedConversationStateExtractor } from '../extractors/DivingSnorkellingRequestedConversationStateExtractor';

const ROOT = process.cwd();
const DIVING_SNORKELLING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/DivingSnorkellingRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6g',
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

describe('phase 6G — DivingSnorkellingRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<DivingSnorkellingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      DivingSnorkellingRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      DivingSnorkellingRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new DivingSnorkellingRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'go diving',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('reports that no canonical diving or snorkelling request field exists', () => {
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6g-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });
    for (const field of [
      'divingRequested',
      'snorkellingRequested',
      'divingSnorkellingRequested',
      'scubaDivingRequested',
      'freedivingRequested',
      'reefDivingRequested',
      'underwaterActivitiesRequested',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(initial, field)).toBe(false);
      expect(field in initial).toBe(false);
    }
  });

  it('cannot create state from diving, scuba, snorkelling, or related wording', () => {
    const extractor = new DivingSnorkellingRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      beachesRequested: true,
      activitiesRequested: true,
      nearbyDiscoveryRequested: true,
      kayakingRequested: true,
    });

    const messages = [
      'diving',
      'go diving',
      'scuba diving',
      'snorkelling',
      'go snorkelling',
      'snorkeling',
      'reef diving',
      'reef snorkelling',
      'freediving',
      'free diving',
      'wreck diving',
      'cave diving',
      'shore diving',
      'boat diving',
      'night diving',
      'underwater tour',
      'underwater experience',
      'show me scuba diving',
      'find snorkelling spots',
      'I want to go freediving',
      'add reef diving',
      'yes include snorkeling',
      'actually show me night diving',
      'do not include diving',
      'no snorkelling',
      'remove scuba diving',
      'forget underwater tours',
      'keep beaches but remove diving',
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
      message: 'keep beaches but remove diving',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('divingRequested');
    expect(result.stateUpdate).not.toHaveProperty('snorkellingRequested');
    expect(result.stateUpdate).not.toHaveProperty('divingSnorkellingRequested');
    expect(result.stateUpdate).not.toHaveProperty('beachesRequested');
    expect(result.stateUpdate).not.toHaveProperty('kayakingRequested');
    expect(withRelatedFlags.beachesRequested).toBe(true);
  });

  it('does not mutate input or retain state across calls', () => {
    const extractor = new DivingSnorkellingRequestedConversationStateExtractor();
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
      message: 'go snorkelling',
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

  it('is included once in the production composite after fishing and before empty', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(extractors).toHaveLength(28);
    const fishingIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof FishingRequestedConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);
    const divingIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof DivingSnorkellingRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const emptyIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EmptyConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(fishingIndexes).toEqual([21]);
    expect(divingIndexes).toEqual([22]);
    expect(emptyIndexes).toEqual([27]);
    expect(extractors[21]).toBeInstanceOf(FishingRequestedConversationStateExtractor);
    expect(extractors[22]).toBeInstanceOf(
      DivingSnorkellingRequestedConversationStateExtractor,
    );
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(DIVING_SNORKELLING_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(
      /divingRequested\s*:|snorkellingRequested\s*:|divingSnorkellingRequested\s*:/,
    );
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|scuba|snorkeling|freediving|free diving|wreck|cave diving|underwater|shore diving|boat diving|night diving|reef diving/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|provider|from ['"][^'"]*(?:search|discovery|map|route|marine|dive)/i,
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
      DIVING_SNORKELLING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/DivingSnorkellingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'DivingSnorkellingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /DivingSnorkellingRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new DivingSnorkellingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('DivingSnorkellingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps every production extractor behaviourally empty with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      activitiesRequested: true,
      beachesRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const messageOnly = processConversationTurn({
      message: 'show me scuba diving and snorkelling reefs',
      state: currentState,
      userEntryId: 'user-6g',
      assistantEntryId: 'assistant-6g',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const factoryResult = createConversationStateExtractor().extract({
      message: 'go diving',
      currentState,
    });

    expect(factoryResult).toEqual({ stateUpdate: {} });
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(messageOnly.state.beachesRequested).toBe(true);
    expect(messageOnly.state.destination).toBe('Brisbane');
    expect(
      Object.prototype.hasOwnProperty.call(messageOnly.state, 'divingSnorkellingRequested'),
    ).toBe(false);
    expect(messageOnly.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(messageOnly).sort()).toEqual(['reply', 'state', 'trace']);
    expect(messageOnly.trace.messageInterpreted).toBe(false);
  });
});
