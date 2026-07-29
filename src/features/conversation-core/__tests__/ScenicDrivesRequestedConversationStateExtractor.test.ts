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
import { ScenicDrivesRequestedConversationStateExtractor } from '../ScenicDrivesRequestedConversationStateExtractor';

const ROOT = process.cwd();
const SCENIC_DRIVES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ScenicDrivesRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6b',
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

describe('phase 6B — ScenicDrivesRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<ScenicDrivesRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<ScenicDrivesRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<ScenicDrivesRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new ScenicDrivesRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me scenic drives',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear scenicDrivesRequested from scenic-drive-like message text', () => {
    const extractor = new ScenicDrivesRequestedConversationStateExtractor();
    const withScenic = createState({
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
    const withoutScenic = createState({
      scenicDrivesRequested: false,
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
      'show me scenic drives',
      'find scenic routes',
      'plan a road trip',
      'show me driving routes',
      'find coastal drives',
      'show me mountain drives',
      'drive through the countryside',
      'find hinterland drives',
      'show me forest roads',
      'drive through the valley',
      'find drives with lookouts',
      'show me viewpoint routes',
      'find panoramic drives',
      'find a sunset drive',
      'show me sunrise driving routes',
      'plan a scenic day trip',
      'find a loop drive',
      'show me self-drive routes',
      'find touring routes',
      'show me heritage drives',
      'drive through a wine region',
      'scenic drives in national parks',
      'find waterfall driving routes',
      'show me beach driving routes',
      'find an island drive',
      'show me remote scenic drives',
      'find scenic sealed roads',
      'show me scenic unsealed roads',
      'family-friendly scenic drives',
      'scenic drives near the hotel',
      'find a short scenic drive',
      'show me a long scenic drive',
      'add scenic drives',
      'yes include scenic drives',
      'actually show me scenic drives',
      'do not include scenic drives',
      'no scenic drives',
      'remove scenic drives',
      'forget scenic drives',
      'keep four-wheel driving but remove scenic drives',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ scenicDrivesRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withScenic,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutScenic,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the scenic drives',
      currentState: withScenic,
    });
    expect(result.stateUpdate).toEqual({});
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
    expect(withScenic.scenicDrivesRequested).toBe(true);
    expect(withoutScenic.scenicDrivesRequested).toBe(false);
    expect(withScenic.fourWheelDriveRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new ScenicDrivesRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find scenic routes',
        currentState: createState({ scenicDrivesRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          scenicDrivesRequested: false,
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
    const extractor = new ScenicDrivesRequestedConversationStateExtractor();
    const currentState = createState({
      scenicDrivesRequested: true,
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
      message: 'plan a road trip',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.scenicDrivesRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new ScenicDrivesRequestedConversationStateExtractor() as ScenicDrivesRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as ScenicDrivesRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(SCENIC_DRIVES_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/scenicDrivesRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|road trip|coastal|hinterland|lookout|viewpoint|panoramic|sunset|sunrise|self-drive|heritage|wine region|waterfall|unsealed|sealed-road/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|weather|traffic|road-condition|tourism|provider|from ['"][^'"]*(?:search|discovery|map|route|traffic|weather|park|tourism)/i,
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
      SCENIC_DRIVES_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/ScenicDrivesRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'ScenicDrivesRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/ScenicDrivesRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new ScenicDrivesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('ScenicDrivesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor scenicDrivesRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
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
      message: 'actually show me scenic drives',
      state: currentState,
      userEntryId: 'user-6b',
      assistantEntryId: 'assistant-6b',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { scenicDrivesRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no scenic drives',
      state: currentState,
      userEntryId: 'user-6b-b',
      assistantEntryId: 'assistant-6b-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { scenicDrivesRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove scenic drives',
      state: currentState,
      userEntryId: 'user-6b-c',
      assistantEntryId: 'assistant-6b-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { scenicDrivesRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me scenic drives and coastal routes',
      state: currentState,
      userEntryId: 'user-6b-d',
      assistantEntryId: 'assistant-6b-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const fourWheelInjected = processConversationTurn({
      message: 'add 4WD',
      state: currentState,
      userEntryId: 'user-6b-e',
      assistantEntryId: 'assistant-6b-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { fourWheelDriveRequested: false },
    });

    expect(injected.state.scenicDrivesRequested).toBe(true);
    expect(cleared.state.scenicDrivesRequested).toBe(false);
    expect(nullCleared.state.scenicDrivesRequested).toBeNull();
    expect(messageOnly.state.scenicDrivesRequested).toBe(true);
    expect(fourWheelInjected.state.fourWheelDriveRequested).toBe(false);
    expect(fourWheelInjected.state.scenicDrivesRequested).toBe(true);
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
