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
import { CampingRequestedConversationStateExtractor } from '../CampingRequestedConversationStateExtractor';

const ROOT = process.cwd();
const CAMPING_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/CampingRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5y',
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

describe('phase 5Y — CampingRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<CampingRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<CampingRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<CampingRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new CampingRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me camping options',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear campingRequested from camping-like message text', () => {
    const extractor = new CampingRequestedConversationStateExtractor();
    const withCamping = createState({
      campingRequested: true,
      beachesRequested: true,
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutCamping = createState({
      campingRequested: false,
      beachesRequested: true,
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });

    const messages = [
      'show me camping options',
      'find a campsite',
      'find a campground',
      'I want a caravan park',
      'show me places for a tent',
      'where can I use a swag',
      'find glamping',
      'show me camping cabins',
      'find bush camping',
      'camping in a national park',
      'find a holiday park',
      'show me free camping',
      'I need a powered site',
      'find an unpowered site',
      'somewhere we can have a campfire',
      'camping near the hotel',
      'family-friendly camping',
      'dog-friendly campsites',
      'remote camping away from crowds',
      'add camping',
      'yes include camping',
      'actually show me camping',
      'do not include camping',
      'no camping',
      'remove camping',
      'forget camping',
      'keep beaches but remove camping',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ campingRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withCamping,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutCamping,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the camping',
      currentState: withCamping,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('campingRequested');
    expect(result.stateUpdate).not.toHaveProperty('beachesRequested');
    expect(result.stateUpdate).not.toHaveProperty('nearbyDiscoveryRequested');
    expect(result.stateUpdate).not.toHaveProperty('restaurantsRequested');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withCamping.campingRequested).toBe(true);
    expect(withoutCamping.campingRequested).toBe(false);
    expect(withCamping.beachesRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new CampingRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find a campsite',
        currentState: createState({ campingRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          campingRequested: false,
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
    const extractor = new CampingRequestedConversationStateExtractor();
    const currentState = createState({
      campingRequested: true,
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
      message: 'I want a caravan park',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.campingRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new CampingRequestedConversationStateExtractor() as CampingRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as CampingRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(CAMPING_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/campingRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|campsite|campground|caravan|glamping|swag|bush|powered site|unpowered|campfire|holiday park|national park/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|weather|fire-danger|fireDanger|provider|from ['"][^'"]*(?:search|discovery|map|weather|fire|park)/i,
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
      CAMPING_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/CampingRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'CampingRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/CampingRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new CampingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('CampingRequestedConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('keeps processor campingRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
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
      message: 'actually show me camping',
      state: currentState,
      userEntryId: 'user-5y',
      assistantEntryId: 'assistant-5y',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { campingRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no camping',
      state: currentState,
      userEntryId: 'user-5y-b',
      assistantEntryId: 'assistant-5y-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { campingRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove camping',
      state: currentState,
      userEntryId: 'user-5y-c',
      assistantEntryId: 'assistant-5y-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { campingRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me camping and a caravan park',
      state: currentState,
      userEntryId: 'user-5y-d',
      assistantEntryId: 'assistant-5y-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const beachesInjected = processConversationTurn({
      message: 'add beaches',
      state: currentState,
      userEntryId: 'user-5y-e',
      assistantEntryId: 'assistant-5y-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { beachesRequested: false },
    });

    expect(injected.state.campingRequested).toBe(true);
    expect(cleared.state.campingRequested).toBe(false);
    expect(nullCleared.state.campingRequested).toBeNull();
    expect(messageOnly.state.campingRequested).toBe(true);
    expect(beachesInjected.state.beachesRequested).toBe(false);
    expect(beachesInjected.state.campingRequested).toBe(true);
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
