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
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';

const ROOT = process.cwd();
const ADULT_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/AdultCountConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5o',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    adultCount: 2,
    childCount: 1,
    infantCount: 0,
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

describe('phase 5O — AdultCountConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<AdultCountConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<AdultCountConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<AdultCountConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new AdultCountConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: '2 adults',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear adultCount from traveller-like message text', () => {
    const extractor = new AdultCountConversationStateExtractor();
    const withAdults = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
    });

    const messages = [
      '2 adults',
      'two adults',
      'one adult',
      'just me',
      'my wife and I',
      'me and my husband',
      'three grown-ups',
      'four travellers',
      'change it to 3 adults',
      'actually only 2 adults',
      'no adults',
      'remove the adults',
      'two children and one infant',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ adultCount: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withAdults,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep 2 adults',
      currentState: withAdults,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('adultCount');
    expect(result.stateUpdate).not.toHaveProperty('childCount');
    expect(result.stateUpdate).not.toHaveProperty('infantCount');
    expect(withAdults.adultCount).toBe(2);
    expect(withAdults.childCount).toBe(1);
    expect(withAdults.infantCount).toBe(1);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new AdultCountConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'just me',
        currentState: createState({ adultCount: 4 }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          adultCount: 3,
          childCount: 2,
          infantCount: 1,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new AdultCountConversationStateExtractor();
    const currentState = createState({
      adultCount: 2,
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
      message: 'three grown-ups',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.adultCount = 99;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new AdultCountConversationStateExtractor() as AdultCountConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as AdultCountConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, number parsing, arithmetic, regex, or provider imports', () => {
    const source = readFileSync(ADULT_COUNT_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/adultCount\s*:/);
    expect(source).not.toMatch(/childCount\s*:/);
    expect(source).not.toMatch(/infantCount\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(/\bNumber\s*\(|parseInt\s*\(|parseFloat\s*\(/);
    expect(source).not.toMatch(/Math\.|partySize|travellerCount|adultCount\s*[+\-*/]/i);
    expect(source).not.toMatch(/provider|search|discovery|travel-location/i);
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
      ADULT_COUNT_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/AdultCountConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('AdultCountConversationStateExtractor');
    expect(processTurn).not.toMatch(/AdultCountConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new AdultCountConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('AdultCountConversationStateExtractor'), file).toBe(false);
    }
  });

  it('keeps processor adultCount behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'change it to 3 adults',
      state: currentState,
      userEntryId: 'user-5o',
      assistantEntryId: 'assistant-5o',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { adultCount: 3 },
    });
    const cleared = processConversationTurn({
      message: 'no adults',
      state: currentState,
      userEntryId: 'user-5o-b',
      assistantEntryId: 'assistant-5o-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { adultCount: null },
    });
    const messageOnly = processConversationTurn({
      message: 'two adults and one infant',
      state: currentState,
      userEntryId: 'user-5o-c',
      assistantEntryId: 'assistant-5o-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
    });
    const childInjected = processConversationTurn({
      message: 'two children',
      state: currentState,
      userEntryId: 'user-5o-d',
      assistantEntryId: 'assistant-5o-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { childCount: 2 },
    });

    expect(injected.state.adultCount).toBe(3);
    expect(injected.state.childCount).toBe(1);
    expect(cleared.state.adultCount).toBeNull();
    expect(messageOnly.state.adultCount).toBe(2);
    expect(childInjected.state.childCount).toBe(2);
    expect(childInjected.state.adultCount).toBe(2);
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
