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
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';

const ROOT = process.cwd();
const INFANT_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/InfantCountConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5q',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    adultCount: 2,
    childCount: 1,
    infantCount: 1,
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

describe('phase 5Q — InfantCountConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<InfantCountConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<InfantCountConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<InfantCountConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new InfantCountConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: '1 infant',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear infantCount from infant-like message text', () => {
    const extractor = new InfantCountConversationStateExtractor();
    const withInfants = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
    });

    const messages = [
      '1 infant',
      'one infant',
      'two infants',
      'travelling with a baby',
      'our newborn is coming',
      'one lap infant',
      'a six-month-old baby',
      'an 18-month-old',
      'a one-year-old',
      'my wife and our baby',
      'change it to 2 infants',
      'actually only 1 infant',
      'no infants',
      'remove the infant',
      'two adults and one child',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ infantCount: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withInfants,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep 1 infant',
      currentState: withInfants,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('infantCount');
    expect(result.stateUpdate).not.toHaveProperty('adultCount');
    expect(result.stateUpdate).not.toHaveProperty('childCount');
    expect(withInfants.infantCount).toBe(1);
    expect(withInfants.adultCount).toBe(2);
    expect(withInfants.childCount).toBe(1);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new InfantCountConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'travelling with a baby',
        currentState: createState({ infantCount: 2 }),
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
    const extractor = new InfantCountConversationStateExtractor();
    const currentState = createState({
      infantCount: 1,
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
      message: 'one lap infant',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.infantCount = 99;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new InfantCountConversationStateExtractor() as InfantCountConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as InfantCountConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, number parsing, age, arithmetic, regex, or provider imports', () => {
    const source = readFileSync(INFANT_COUNT_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/infantCount\s*:/);
    expect(source).not.toMatch(/adultCount\s*:/);
    expect(source).not.toMatch(/childCount\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(/\bNumber\s*\(|parseInt\s*\(|parseFloat\s*\(/);
    expect(source).not.toMatch(
      /Math\.|partySize|travellerCount|infantCount\s*[+\-*/]|month-old|year-old|newborn|lap.?infant|ageMs/i,
    );
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
      INFANT_COUNT_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/InfantCountConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('InfantCountConversationStateExtractor');
    expect(processTurn).not.toMatch(/InfantCountConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new InfantCountConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('InfantCountConversationStateExtractor'), file).toBe(false);
    }
  });

  it('keeps processor infantCount behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'change it to 2 infants',
      state: currentState,
      userEntryId: 'user-5q',
      assistantEntryId: 'assistant-5q',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { infantCount: 2 },
    });
    const cleared = processConversationTurn({
      message: 'no infants',
      state: currentState,
      userEntryId: 'user-5q-b',
      assistantEntryId: 'assistant-5q-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { infantCount: null },
    });
    const messageOnly = processConversationTurn({
      message: 'travelling with a baby and newborn',
      state: currentState,
      userEntryId: 'user-5q-c',
      assistantEntryId: 'assistant-5q-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
    });
    const childInjected = processConversationTurn({
      message: 'two children',
      state: currentState,
      userEntryId: 'user-5q-d',
      assistantEntryId: 'assistant-5q-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { childCount: 2 },
    });

    expect(injected.state.infantCount).toBe(2);
    expect(injected.state.adultCount).toBe(2);
    expect(cleared.state.infantCount).toBeNull();
    expect(messageOnly.state.infantCount).toBe(1);
    expect(childInjected.state.childCount).toBe(2);
    expect(childInjected.state.infantCount).toBe(1);
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
