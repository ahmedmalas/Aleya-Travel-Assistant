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
import { BeachesRequestedConversationStateExtractor } from '../BeachesRequestedConversationStateExtractor';

const ROOT = process.cwd();
const BEACHES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/BeachesRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5x',
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

describe('phase 5X — BeachesRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<BeachesRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<BeachesRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<BeachesRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new BeachesRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me beaches',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear beachesRequested from beaches-like message text', () => {
    const extractor = new BeachesRequestedConversationStateExtractor();
    const withBeaches = createState({
      beachesRequested: true,
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutBeaches = createState({
      beachesRequested: false,
      nearbyDiscoveryRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });

    const messages = [
      'show me beaches',
      'find the best beach',
      'I want to visit the coast',
      'somewhere by the seaside',
      'find an ocean beach',
      'where can we swim',
      'show me surf beaches',
      'find somewhere to snorkel',
      'waterfront places',
      'find a quiet bay',
      'show me secluded coves',
      'find a lagoon',
      'beaches near the hotel',
      'family-friendly beaches',
      'quiet beaches away from crowds',
      'add beaches',
      'yes include beaches',
      'actually show me beaches',
      'do not include beaches',
      'no beaches',
      'remove the beaches',
      'forget beaches',
      'keep activities but remove beaches',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ beachesRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withBeaches,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutBeaches,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the beaches',
      currentState: withBeaches,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('beachesRequested');
    expect(result.stateUpdate).not.toHaveProperty('nearbyDiscoveryRequested');
    expect(result.stateUpdate).not.toHaveProperty('restaurantsRequested');
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withBeaches.beachesRequested).toBe(true);
    expect(withoutBeaches.beachesRequested).toBe(false);
    expect(withBeaches.nearbyDiscoveryRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new BeachesRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find the best beach',
        currentState: createState({ beachesRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          beachesRequested: false,
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
    const extractor = new BeachesRequestedConversationStateExtractor();
    const currentState = createState({
      beachesRequested: true,
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
      message: 'somewhere by the seaside',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.beachesRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new BeachesRequestedConversationStateExtractor() as BeachesRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as BeachesRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(BEACHES_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/beachesRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|seaside|coastline|snorkel|waterfront|lagoon|family-friendly|secluded|surf beach/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|weather|tide|provider|from ['"][^'"]*(?:search|discovery|map|weather|tide)/i,
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
      BEACHES_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/BeachesRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'BeachesRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/BeachesRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new BeachesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('BeachesRequestedConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('keeps processor beachesRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
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
      message: 'actually show me beaches',
      state: currentState,
      userEntryId: 'user-5x',
      assistantEntryId: 'assistant-5x',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { beachesRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no beaches',
      state: currentState,
      userEntryId: 'user-5x-b',
      assistantEntryId: 'assistant-5x-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { beachesRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove the beaches',
      state: currentState,
      userEntryId: 'user-5x-c',
      assistantEntryId: 'assistant-5x-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { beachesRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'show me beaches and the coast',
      state: currentState,
      userEntryId: 'user-5x-d',
      assistantEntryId: 'assistant-5x-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const nearbyInjected = processConversationTurn({
      message: 'add nearby discovery',
      state: currentState,
      userEntryId: 'user-5x-e',
      assistantEntryId: 'assistant-5x-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { nearbyDiscoveryRequested: false },
    });

    expect(injected.state.beachesRequested).toBe(true);
    expect(cleared.state.beachesRequested).toBe(false);
    expect(nullCleared.state.beachesRequested).toBeNull();
    expect(messageOnly.state.beachesRequested).toBe(true);
    expect(nearbyInjected.state.nearbyDiscoveryRequested).toBe(false);
    expect(nearbyInjected.state.beachesRequested).toBe(true);
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
