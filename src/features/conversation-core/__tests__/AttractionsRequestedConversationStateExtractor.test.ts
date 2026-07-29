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
import { AttractionsRequestedConversationStateExtractor } from '../AttractionsRequestedConversationStateExtractor';

const ROOT = process.cwd();
const ATTRACTIONS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/AttractionsRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6c',
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

describe('phase 6C — AttractionsRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<AttractionsRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<AttractionsRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<AttractionsRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new AttractionsRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me attractions',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear attractionsRequested from attractions-like message text', () => {
    const extractor = new AttractionsRequestedConversationStateExtractor();
    const withAttractions = createState({
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
    const withoutAttractions = createState({
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
      'show me attractions',
      'find tourist attractions',
      'I want to go sightseeing',
      'show me things to see',
      'find things to do',
      'show me landmarks',
      'find monuments',
      'show me museums',
      'find art galleries',
      'take us to a zoo',
      'find an aquarium',
      'show me theme parks',
      'find amusement parks',
      'show me water parks',
      'find lookouts',
      'show me viewpoints',
      'find an observatory',
      'show me gardens',
      'find botanical gardens',
      'show me historic sites',
      'find heritage sites',
      'show me cultural attractions',
      'find religious sites',
      'show me castles',
      'find palaces',
      'show me forts',
      'find towers',
      'show me famous bridges',
      'find local markets',
      'show me entertainment precincts',
      'find a visitor centre',
      'family-friendly attractions',
      'child-friendly attractions',
      'show me indoor attractions',
      'find outdoor attractions',
      'show me free attractions',
      'find paid attractions',
      'find attractions with tickets',
      'show me attraction opening hours',
      'attractions near the hotel',
      'show me popular attractions',
      'find hidden gems',
      'show me must-see attractions',
      'add attractions',
      'yes include attractions',
      'actually show me attractions',
      'do not include attractions',
      'no attractions',
      'remove attractions',
      'forget attractions',
      'keep scenic drives but remove attractions',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ attractionsRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withAttractions,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutAttractions,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the attractions',
      currentState: withAttractions,
    });
    expect(result.stateUpdate).toEqual({});
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
    expect(withAttractions.attractionsRequested).toBe(true);
    expect(withoutAttractions.attractionsRequested).toBe(false);
    expect(withAttractions.scenicDrivesRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new AttractionsRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find tourist attractions',
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
    const extractor = new AttractionsRequestedConversationStateExtractor();
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
      message: 'I want to go sightseeing',
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
      new AttractionsRequestedConversationStateExtractor() as AttractionsRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as AttractionsRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(ATTRACTIONS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/attractionsRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|sightseeing|landmark|monument|museum|gallery|aquarium|theme-park|amusement|lookout|viewpoint|observatory|botanical|heritage|must-see|hidden gem|opening.?hours|ticket/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|tourism|review|provider|from ['"][^'"]*(?:search|discovery|map|route|tourism|ticket|review)/i,
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
      ATTRACTIONS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/AttractionsRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'AttractionsRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/AttractionsRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new AttractionsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('AttractionsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor attractionsRequested behaviour unchanged with the skeleton in the path', () => {
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
      message: 'actually show me attractions',
      state: currentState,
      userEntryId: 'user-6c',
      assistantEntryId: 'assistant-6c',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { attractionsRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no attractions',
      state: currentState,
      userEntryId: 'user-6c-b',
      assistantEntryId: 'assistant-6c-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { attractionsRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove attractions',
      state: currentState,
      userEntryId: 'user-6c-c',
      assistantEntryId: 'assistant-6c-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { attractionsRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me attractions and museums',
      state: currentState,
      userEntryId: 'user-6c-d',
      assistantEntryId: 'assistant-6c-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const scenicInjected = processConversationTurn({
      message: 'add scenic drives',
      state: currentState,
      userEntryId: 'user-6c-e',
      assistantEntryId: 'assistant-6c-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { scenicDrivesRequested: false },
    });

    expect(injected.state.attractionsRequested).toBe(true);
    expect(cleared.state.attractionsRequested).toBe(false);
    expect(nullCleared.state.attractionsRequested).toBeNull();
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(scenicInjected.state.scenicDrivesRequested).toBe(false);
    expect(scenicInjected.state.attractionsRequested).toBe(true);
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
