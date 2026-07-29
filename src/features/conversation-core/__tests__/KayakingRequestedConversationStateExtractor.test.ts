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
import { KayakingRequestedConversationStateExtractor } from '../KayakingRequestedConversationStateExtractor';

const ROOT = process.cwd();
const KAYAKING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/KayakingRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5z',
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

describe('phase 5Z — KayakingRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<KayakingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<KayakingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<KayakingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new KayakingRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me kayaking',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear kayakingRequested from kayaking-like message text', () => {
    const extractor = new KayakingRequestedConversationStateExtractor();
    const withKayaking = createState({
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
    const withoutKayaking = createState({
      kayakingRequested: false,
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
      'show me kayaking',
      'find kayak tours',
      'where can we canoe',
      'I want to go canoeing',
      'find somewhere to paddle',
      'show me paddling activities',
      'find paddleboard hire',
      'stand-up paddleboarding',
      'show me SUP activities',
      'find rafting trips',
      'kayaking on a river',
      'kayaking on a lake',
      'paddle in a lagoon',
      'kayaking in the bay',
      'harbour kayaking',
      'ocean kayaking',
      'paddle along a creek',
      'kayak through an estuary',
      'mangrove kayaking',
      'white-water kayaking',
      'guided kayak tours',
      'hire a kayak',
      'beginner-friendly kayaking',
      'family-friendly kayaking',
      'kayaking near the hotel',
      'calm-water kayaking',
      'add kayaking',
      'yes include kayaking',
      'actually show me kayaking',
      'do not include kayaking',
      'no kayaking',
      'remove kayaking',
      'forget kayaking',
      'keep camping but remove kayaking',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ kayakingRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withKayaking,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutKayaking,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the kayaking',
      currentState: withKayaking,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('kayakingRequested');
    expect(result.stateUpdate).not.toHaveProperty('campingRequested');
    expect(result.stateUpdate).not.toHaveProperty('beachesRequested');
    expect(result.stateUpdate).not.toHaveProperty('nearbyDiscoveryRequested');
    expect(result.stateUpdate).not.toHaveProperty('restaurantsRequested');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withKayaking.kayakingRequested).toBe(true);
    expect(withoutKayaking.kayakingRequested).toBe(false);
    expect(withKayaking.campingRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new KayakingRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find kayak tours',
        currentState: createState({ kayakingRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          kayakingRequested: false,
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
    const extractor = new KayakingRequestedConversationStateExtractor();
    const currentState = createState({
      kayakingRequested: true,
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
      message: 'where can we canoe',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.kayakingRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new KayakingRequestedConversationStateExtractor() as KayakingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as KayakingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(KAYAKING_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/kayakingRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|canoe|paddleboard|rafting|white-water|mangrove|estuary|harbour|calm-water|stand-up|guided tour|\bSUP\b/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|weather|marine|tide|river-condition|provider|from ['"][^'"]*(?:search|discovery|map|weather|marine|tide|river)/i,
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
      KAYAKING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/KayakingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'KayakingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/KayakingRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new KayakingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('KayakingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor kayakingRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
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
      message: 'actually show me kayaking',
      state: currentState,
      userEntryId: 'user-5z',
      assistantEntryId: 'assistant-5z',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { kayakingRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no kayaking',
      state: currentState,
      userEntryId: 'user-5z-b',
      assistantEntryId: 'assistant-5z-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { kayakingRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove kayaking',
      state: currentState,
      userEntryId: 'user-5z-c',
      assistantEntryId: 'assistant-5z-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { kayakingRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me kayaking and canoeing',
      state: currentState,
      userEntryId: 'user-5z-d',
      assistantEntryId: 'assistant-5z-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const campingInjected = processConversationTurn({
      message: 'add camping',
      state: currentState,
      userEntryId: 'user-5z-e',
      assistantEntryId: 'assistant-5z-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { campingRequested: false },
    });

    expect(injected.state.kayakingRequested).toBe(true);
    expect(cleared.state.kayakingRequested).toBe(false);
    expect(nullCleared.state.kayakingRequested).toBeNull();
    expect(messageOnly.state.kayakingRequested).toBe(true);
    expect(campingInjected.state.campingRequested).toBe(false);
    expect(campingInjected.state.kayakingRequested).toBe(true);
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
