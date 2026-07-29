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
import { SnowActivitiesRequestedConversationStateExtractor } from '../SnowActivitiesRequestedConversationStateExtractor';

const ROOT = process.cwd();
const SNOW_ACTIVITIES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/SnowActivitiesRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6d',
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

describe('phase 6D — SnowActivitiesRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<SnowActivitiesRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      SnowActivitiesRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      SnowActivitiesRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me snow activities',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('reports that no canonical snowActivitiesRequested field exists yet', () => {
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6d-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });
    expect(Object.prototype.hasOwnProperty.call(initial, 'snowActivitiesRequested')).toBe(
      false,
    );
    expect('snowActivitiesRequested' in initial).toBe(false);
  });

  it('cannot create, replace, or clear snow-activities intent from snow-like message text', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      scenicDrivesRequested: true,
      fourWheelDriveRequested: true,
      kayakingRequested: true,
      campingRequested: true,
      beachesRequested: true,
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutRelatedFlags = createState({
      attractionsRequested: false,
      scenicDrivesRequested: true,
      fourWheelDriveRequested: true,
      kayakingRequested: true,
      campingRequested: true,
      beachesRequested: true,
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });

    const messages = [
      'show me snow activities',
      'find somewhere with snow',
      'I want to see snowfall',
      'find alpine activities',
      'I want to ski',
      'show me skiing',
      'find snowboarding',
      'I want to snowboard',
      'show me tobogganing',
      'find somewhere to go sledding',
      'show me snow play',
      'find snowshoeing',
      'show me cross-country skiing',
      'find Nordic skiing',
      'show me downhill skiing',
      'find a terrain park',
      'show me ski resorts',
      'find a snow resort',
      'show me alpine resorts',
      'find ski lifts',
      'I need lift passes',
      'find ski passes',
      'show me snow tubing',
      'find snowmobile tours',
      'show me guided snow tours',
      'find snowfields',
      'where is snow season now',
      'plan a winter holiday',
      'find fresh powder',
      'beginner-friendly skiing',
      'advanced snowboarding',
      'family-friendly snow activities',
      'snow play for children',
      'snow activities near the hotel',
      'add snow activities',
      'yes include skiing',
      'actually show me snow activities',
      'do not include snow activities',
      'no skiing',
      'remove snow activities',
      'forget snowboarding',
      'keep attractions but remove snow activities',
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
      expect(
        extractor.extract({
          message,
          currentState: withoutRelatedFlags,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep attractions but remove snow activities',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('snowActivitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('attractionsRequested');
    expect(result.stateUpdate).not.toHaveProperty('scenicDrivesRequested');
    expect(result.stateUpdate).not.toHaveProperty('fourWheelDriveRequested');
    expect(result.stateUpdate).not.toHaveProperty('kayakingRequested');
    expect(result.stateUpdate).not.toHaveProperty('campingRequested');
    expect(result.stateUpdate).not.toHaveProperty('beachesRequested');
    expect(result.stateUpdate).not.toHaveProperty('nearbyDiscoveryRequested');
    expect(result.stateUpdate).not.toHaveProperty('restaurantsRequested');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withRelatedFlags.attractionsRequested).toBe(true);
    expect(withoutRelatedFlags.attractionsRequested).toBe(false);
    expect(withRelatedFlags.scenicDrivesRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'show me ski resorts',
        currentState: createState({ attractionsRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          attractionsRequested: false,
          scenicDrivesRequested: true,
          fourWheelDriveRequested: true,
          kayakingRequested: true,
          campingRequested: true,
          beachesRequested: true,
          nearbyDiscoveryRequested: true,
          restaurantsRequested: true,
          activitiesRequested: true,
          carHireRequested: true,
          accommodationRequested: true,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new SnowActivitiesRequestedConversationStateExtractor();
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
      message: 'I want to ski',
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

    const other =
      new SnowActivitiesRequestedConversationStateExtractor() as SnowActivitiesRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as SnowActivitiesRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(SNOW_ACTIVITIES_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/snowActivitiesRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|snowfall|alpine|ski(?:ing)?|snowboard(?:ing)?|toboggan|sled(?:ding)?|snow-?play|snowshoe|cross-country|nordic|downhill|terrain.?park|ski.?resort|snow.?resort|lift.?pass|ski.?pass|tubing|snowmobile|snow.?tour|snowfield|powder|avalanche|snow.?chain/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|weather|snowfall|avalanche|provider|from ['"][^'"]*(?:search|discovery|map|route|weather|snow|ski|resort)/i,
    );
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
    const allowedConstruct = new Set([
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      SNOW_ACTIVITIES_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/SnowActivitiesRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'SnowActivitiesRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /SnowActivitiesRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new SnowActivitiesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('SnowActivitiesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      scenicDrivesRequested: true,
      fourWheelDriveRequested: true,
      kayakingRequested: true,
      campingRequested: true,
      beachesRequested: true,
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'actually show me snow activities',
      state: currentState,
      userEntryId: 'user-6d',
      assistantEntryId: 'assistant-6d',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { attractionsRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no skiing',
      state: currentState,
      userEntryId: 'user-6d-b',
      assistantEntryId: 'assistant-6d-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { attractionsRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove snow activities',
      state: currentState,
      userEntryId: 'user-6d-c',
      assistantEntryId: 'assistant-6d-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { attractionsRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me snow activities and ski resorts',
      state: currentState,
      userEntryId: 'user-6d-d',
      assistantEntryId: 'assistant-6d-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const attractionsInjected = processConversationTurn({
      message: 'add attractions',
      state: currentState,
      userEntryId: 'user-6d-e',
      assistantEntryId: 'assistant-6d-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { attractionsRequested: false },
    });

    expect(injected.state.attractionsRequested).toBe(true);
    expect(cleared.state.attractionsRequested).toBe(false);
    expect(nullCleared.state.attractionsRequested).toBeNull();
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(attractionsInjected.state.attractionsRequested).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(messageOnly.state, 'snowActivitiesRequested')).toBe(
      false,
    );
    expect(injected.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(injected).sort()).toEqual(['reply', 'state', 'trace']);
    expect(Object.keys(injected.trace).sort()).toEqual([
      'assistantMessageRecorded',
      'entryPoint',
      'messageInterpreted',
      'persistenceUsed',
      'stateChanged',
      'stateStatus',
      'turnCount',
      'userMessageRecorded',
    ]);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });
});
