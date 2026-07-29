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
import { NearbyDiscoveryRequestedConversationStateExtractor } from '../NearbyDiscoveryRequestedConversationStateExtractor';

const ROOT = process.cwd();
const NEARBY_DISCOVERY_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/NearbyDiscoveryRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5w',
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

describe('phase 5W — NearbyDiscoveryRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<NearbyDiscoveryRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<NearbyDiscoveryRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<NearbyDiscoveryRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new NearbyDiscoveryRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me what is nearby',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear nearbyDiscoveryRequested from nearby-discovery-like message text', () => {
    const extractor = new NearbyDiscoveryRequestedConversationStateExtractor();
    const withNearby = createState({
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutNearby = createState({
      nearbyDiscoveryRequested: false,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });

    const messages = [
      'show me what is nearby',
      'find places near me',
      'what is around me',
      'anything close by',
      'show me local places',
      'explore the surrounding area',
      'what is within walking distance',
      'find things within 5 kilometres',
      'what is near my current location',
      'what is near the hotel',
      'show me places near Surfers Paradise',
      'open the map',
      'help me discover nearby places',
      'I want to explore the area',
      'restaurants nearby',
      'activities near me',
      'attractions close to the hotel',
      'add nearby discovery',
      'yes show me nearby places',
      'actually include local discovery',
      'do not search nearby',
      'no nearby discovery',
      'remove nearby places',
      'forget local discovery',
      'keep restaurants but remove nearby discovery',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ nearbyDiscoveryRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withNearby,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutNearby,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep nearby discovery',
      currentState: withNearby,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('nearbyDiscoveryRequested');
    expect(result.stateUpdate).not.toHaveProperty('restaurantsRequested');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withNearby.nearbyDiscoveryRequested).toBe(true);
    expect(withoutNearby.nearbyDiscoveryRequested).toBe(false);
    expect(withNearby.restaurantsRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new NearbyDiscoveryRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find places near me',
        currentState: createState({ nearbyDiscoveryRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          nearbyDiscoveryRequested: false,
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
    const extractor = new NearbyDiscoveryRequestedConversationStateExtractor();
    const currentState = createState({
      nearbyDiscoveryRequested: true,
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
      message: 'open the map',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.nearbyDiscoveryRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new NearbyDiscoveryRequestedConversationStateExtractor() as NearbyDiscoveryRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as NearbyDiscoveryRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(NEARBY_DISCOVERY_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/nearbyDiscoveryRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|near me|around me|close by|walking distance|surrounding area|current location|kilometres|Surfers/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|haversine|latLng|coordinates|provider|from ['"][^'"]*(?:search|discovery|map|location)/i,
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
      NEARBY_DISCOVERY_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/NearbyDiscoveryRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'NearbyDiscoveryRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /NearbyDiscoveryRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new NearbyDiscoveryRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('NearbyDiscoveryRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor nearbyDiscoveryRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
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
      message: 'actually include local discovery',
      state: currentState,
      userEntryId: 'user-5w',
      assistantEntryId: 'assistant-5w',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { nearbyDiscoveryRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no nearby discovery',
      state: currentState,
      userEntryId: 'user-5w-b',
      assistantEntryId: 'assistant-5w-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { nearbyDiscoveryRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove nearby places',
      state: currentState,
      userEntryId: 'user-5w-c',
      assistantEntryId: 'assistant-5w-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { nearbyDiscoveryRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me what is nearby and open the map',
      state: currentState,
      userEntryId: 'user-5w-d',
      assistantEntryId: 'assistant-5w-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const restaurantsInjected = processConversationTurn({
      message: 'add restaurants',
      state: currentState,
      userEntryId: 'user-5w-e',
      assistantEntryId: 'assistant-5w-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { restaurantsRequested: false },
    });

    expect(injected.state.nearbyDiscoveryRequested).toBe(true);
    expect(cleared.state.nearbyDiscoveryRequested).toBe(false);
    expect(nullCleared.state.nearbyDiscoveryRequested).toBeNull();
    expect(messageOnly.state.nearbyDiscoveryRequested).toBe(true);
    expect(restaurantsInjected.state.restaurantsRequested).toBe(false);
    expect(restaurantsInjected.state.nearbyDiscoveryRequested).toBe(true);
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
