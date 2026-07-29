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
import { RestaurantsRequestedConversationStateExtractor } from '../RestaurantsRequestedConversationStateExtractor';

const ROOT = process.cwd();
const RESTAURANTS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/RestaurantsRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5v',
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

describe('phase 5V — RestaurantsRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<RestaurantsRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<RestaurantsRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<RestaurantsRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new RestaurantsRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'I need restaurants',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear restaurantsRequested from restaurants-like message text', () => {
    const extractor = new RestaurantsRequestedConversationStateExtractor();
    const withRestaurants = createState({
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutRestaurants = createState({
      restaurantsRequested: false,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });

    const messages = [
      'I need restaurants',
      'find somewhere to eat',
      'show me dining options',
      'find good food',
      'book dinner',
      'find breakfast nearby',
      'somewhere for lunch',
      'find a cafe',
      'show me bars',
      'I want Italian cuisine',
      'make a restaurant reservation',
      'restaurants near the hotel',
      'include hotel dining',
      'find halal restaurants',
      'flights accommodation activities and restaurants',
      'yes add restaurants',
      'actually include dining',
      'do not add restaurants',
      'no restaurants',
      'remove the dining',
      'forget restaurants',
      'we will organise our own meals',
      'keep activities but remove restaurants',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ restaurantsRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withRestaurants,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutRestaurants,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the restaurants',
      currentState: withRestaurants,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('restaurantsRequested');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withRestaurants.restaurantsRequested).toBe(true);
    expect(withoutRestaurants.restaurantsRequested).toBe(false);
    expect(withRestaurants.activitiesRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new RestaurantsRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'show me dining options',
        currentState: createState({ restaurantsRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          restaurantsRequested: false,
          activitiesRequested: true,
          carHireRequested: true,
          accommodationRequested: true,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new RestaurantsRequestedConversationStateExtractor();
    const currentState = createState({
      restaurantsRequested: true,
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
      message: 'book dinner',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.restaurantsRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new RestaurantsRequestedConversationStateExtractor() as RestaurantsRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as RestaurantsRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(RESTAURANTS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/restaurantsRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|dining|cuisine|breakfast|lunch|dinner|cafe|reservation|halal/i,
    );
    expect(source).not.toMatch(
      /provider|search|discovery|travel-location|opentable|resy/i,
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
      RESTAURANTS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/RestaurantsRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'RestaurantsRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/RestaurantsRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new RestaurantsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('RestaurantsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor restaurantsRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'actually include dining',
      state: currentState,
      userEntryId: 'user-5v',
      assistantEntryId: 'assistant-5v',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { restaurantsRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no restaurants',
      state: currentState,
      userEntryId: 'user-5v-b',
      assistantEntryId: 'assistant-5v-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { restaurantsRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove the dining',
      state: currentState,
      userEntryId: 'user-5v-c',
      assistantEntryId: 'assistant-5v-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { restaurantsRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'I need restaurants and Italian cuisine',
      state: currentState,
      userEntryId: 'user-5v-d',
      assistantEntryId: 'assistant-5v-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const activitiesInjected = processConversationTurn({
      message: 'add activities',
      state: currentState,
      userEntryId: 'user-5v-e',
      assistantEntryId: 'assistant-5v-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { activitiesRequested: false },
    });

    expect(injected.state.restaurantsRequested).toBe(true);
    expect(cleared.state.restaurantsRequested).toBe(false);
    expect(nullCleared.state.restaurantsRequested).toBeNull();
    expect(messageOnly.state.restaurantsRequested).toBe(true);
    expect(activitiesInjected.state.activitiesRequested).toBe(false);
    expect(activitiesInjected.state.restaurantsRequested).toBe(true);
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
