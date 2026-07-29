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
import { AccommodationRequestedConversationStateExtractor } from '../AccommodationRequestedConversationStateExtractor';

const ROOT = process.cwd();
const ACCOMMODATION_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/AccommodationRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5s',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    flightsRequested: true,
    accommodationRequested: true,
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

describe('phase 5S — AccommodationRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<AccommodationRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<AccommodationRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<AccommodationRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new AccommodationRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'I need accommodation',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear accommodationRequested from stay-like message text', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();
    const withAccommodation = createState({
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutAccommodation = createState({
      accommodationRequested: false,
      flightsRequested: true,
    });

    const messages = [
      'I need accommodation',
      'book me a hotel',
      'find somewhere to stay',
      'I want a resort',
      'a motel is fine',
      'find a hostel',
      'I need an apartment',
      'look for an Airbnb',
      'book one room',
      'staying in Surfers Paradise',
      'check in Friday and out Monday',
      'flights and accommodation',
      'yes add accommodation',
      'actually add a hotel',
      'do not book accommodation',
      'no hotel',
      'remove the accommodation',
      'forget the hotel',
      'I will stay with family instead',
      'keep flights but remove the hotel',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ accommodationRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withAccommodation,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutAccommodation,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the hotel',
      currentState: withAccommodation,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withAccommodation.accommodationRequested).toBe(true);
    expect(withoutAccommodation.accommodationRequested).toBe(false);
    expect(withAccommodation.flightsRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find somewhere to stay',
        currentState: createState({ accommodationRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          accommodationRequested: false,
          flightsRequested: true,
          carHireRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new AccommodationRequestedConversationStateExtractor();
    const currentState = createState({
      accommodationRequested: true,
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
      message: 'book me a hotel',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.accommodationRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new AccommodationRequestedConversationStateExtractor() as AccommodationRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as AccommodationRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(ACCOMMODATION_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/accommodationRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|hotel|motel|resort|hostel|Airbnb|lodging/i,
    );
    expect(source).not.toMatch(/provider|search|discovery|travel-location|booking\.com/i);
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
      ACCOMMODATION_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/AccommodationRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'AccommodationRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/AccommodationRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new AccommodationRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('AccommodationRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor accommodationRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      accommodationRequested: true,
      flightsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'actually add a hotel',
      state: currentState,
      userEntryId: 'user-5s',
      assistantEntryId: 'assistant-5s',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { accommodationRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no hotel',
      state: currentState,
      userEntryId: 'user-5s-b',
      assistantEntryId: 'assistant-5s-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { accommodationRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove the accommodation',
      state: currentState,
      userEntryId: 'user-5s-c',
      assistantEntryId: 'assistant-5s-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { accommodationRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'I need accommodation and a resort',
      state: currentState,
      userEntryId: 'user-5s-d',
      assistantEntryId: 'assistant-5s-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const flightsInjected = processConversationTurn({
      message: 'add flights',
      state: currentState,
      userEntryId: 'user-5s-e',
      assistantEntryId: 'assistant-5s-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { flightsRequested: false },
    });

    expect(injected.state.accommodationRequested).toBe(true);
    expect(cleared.state.accommodationRequested).toBe(false);
    expect(nullCleared.state.accommodationRequested).toBeNull();
    expect(messageOnly.state.accommodationRequested).toBe(true);
    expect(flightsInjected.state.flightsRequested).toBe(false);
    expect(flightsInjected.state.accommodationRequested).toBe(true);
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
