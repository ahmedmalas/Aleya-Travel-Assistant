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
import { FourWheelDrivingRequestedConversationStateExtractor } from '../FourWheelDrivingRequestedConversationStateExtractor';

const ROOT = process.cwd();
const FOUR_WHEEL_DRIVING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/FourWheelDrivingRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6a',
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

describe('phase 6A — FourWheelDrivingRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<FourWheelDrivingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<FourWheelDrivingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<FourWheelDrivingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me 4WD tracks',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear fourWheelDriveRequested from four-wheel-driving-like message text', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const withFourWheel = createState({
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
    const withoutFourWheel = createState({
      fourWheelDriveRequested: false,
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
      'show me 4WD tracks',
      'find four-wheel-drive routes',
      'I want to go four-wheel driving',
      'find off-road adventures',
      'show me off-roading',
      'find AWD tracks',
      'where can I take an SUV',
      'find tracks for my ute',
      'show me 4WD tracks',
      'find off-road trails',
      'find dirt roads',
      'show me gravel roads',
      'find sand-driving routes',
      'where can we drive on the beach',
      'show me dune driving',
      'find muddy tracks',
      'find river crossings',
      'show me creek crossings',
      'find mountain 4WD tracks',
      'forest off-road routes',
      'bush tracks',
      '4WD tracks in national parks',
      'remote-area four-wheel driving',
      'scenic 4WD routes',
      'beginner-friendly 4WD tracks',
      'difficult off-road tracks',
      'guided 4WD tours',
      'hire a 4WD',
      '4WD tracks near the hotel',
      'family-friendly 4WD adventures',
      'add four-wheel driving',
      'yes include 4WD',
      'actually show me 4WD tracks',
      'do not include four-wheel driving',
      'no 4WD',
      'remove four-wheel driving',
      'forget 4WD',
      'keep kayaking but remove four-wheel driving',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ fourWheelDriveRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withFourWheel,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutFourWheel,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the 4WD',
      currentState: withFourWheel,
    });
    expect(result.stateUpdate).toEqual({});
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
    expect(withFourWheel.fourWheelDriveRequested).toBe(true);
    expect(withoutFourWheel.fourWheelDriveRequested).toBe(false);
    expect(withFourWheel.kayakingRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find four-wheel-drive routes',
        currentState: createState({ fourWheelDriveRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          fourWheelDriveRequested: false,
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
    const extractor = new FourWheelDrivingRequestedConversationStateExtractor();
    const currentState = createState({
      fourWheelDriveRequested: true,
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
      message: 'find off-road adventures',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.fourWheelDriveRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new FourWheelDrivingRequestedConversationStateExtractor() as FourWheelDrivingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as FourWheelDrivingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(FOUR_WHEEL_DRIVING_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/fourWheelDriveRequested\s*:/);
    expect(source).not.toMatch(/fourWheelDrivingRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|4WD|off-road|AWD|\bSUV\b|\bute\b|dirt-road|gravel|sand-driving|beach-driving|dune|river-crossing|creek-crossing|scenic-route/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|weather|road-condition|permit|provider|from ['"][^'"]*(?:search|discovery|map|route|weather|road|park|permit)/i,
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
      FOUR_WHEEL_DRIVING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/FourWheelDrivingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'FourWheelDrivingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /FourWheelDrivingRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new FourWheelDrivingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('FourWheelDrivingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor fourWheelDriveRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
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
      message: 'actually show me 4WD tracks',
      state: currentState,
      userEntryId: 'user-6a',
      assistantEntryId: 'assistant-6a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { fourWheelDriveRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no 4WD',
      state: currentState,
      userEntryId: 'user-6a-b',
      assistantEntryId: 'assistant-6a-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { fourWheelDriveRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove four-wheel driving',
      state: currentState,
      userEntryId: 'user-6a-c',
      assistantEntryId: 'assistant-6a-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { fourWheelDriveRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me 4WD tracks and off-roading',
      state: currentState,
      userEntryId: 'user-6a-d',
      assistantEntryId: 'assistant-6a-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const kayakingInjected = processConversationTurn({
      message: 'add kayaking',
      state: currentState,
      userEntryId: 'user-6a-e',
      assistantEntryId: 'assistant-6a-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { kayakingRequested: false },
    });

    expect(injected.state.fourWheelDriveRequested).toBe(true);
    expect(cleared.state.fourWheelDriveRequested).toBe(false);
    expect(nullCleared.state.fourWheelDriveRequested).toBeNull();
    expect(messageOnly.state.fourWheelDriveRequested).toBe(true);
    expect(kayakingInjected.state.kayakingRequested).toBe(false);
    expect(kayakingInjected.state.fourWheelDriveRequested).toBe(true);
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
