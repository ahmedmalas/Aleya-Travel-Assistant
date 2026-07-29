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
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';

const ROOT = process.cwd();
const ORIGIN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/OriginConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5l',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
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

describe('phase 5L — OriginConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<OriginConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<OriginConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<OriginConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new OriginConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'I am flying from Melbourne',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear origin from message-like text', () => {
    const extractor = new OriginConversationStateExtractor();
    const withOrigin = createState({ origin: 'Hobart' });

    expect(
      extractor.extract({
        message: 'Leaving from Cairns',
        currentState: createState({ origin: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Actually from Sydney instead of Hobart',
        currentState: withOrigin,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Forget Hobart / not from Hobart',
        currentState: withOrigin,
      }),
    ).toEqual({ stateUpdate: {} });

    const result = extractor.extract({
      message: 'keep Hobart',
      currentState: withOrigin,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('origin');
    expect(withOrigin.origin).toBe('Hobart');
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new OriginConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'Sydney to Brisbane',
        currentState: createState({ origin: 'Perth' }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          adultCount: 4,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Take me to Cairns',
        currentState: createState({ origin: null }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new OriginConversationStateExtractor();
    const currentState = createState({
      origin: 'Melbourne',
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
      message: 'Leaving from Cairns',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.origin = 'mutated';

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other = new OriginConversationStateExtractor() as OriginConversationStateExtractor & {
      retained?: string;
    };
    (extractor as OriginConversationStateExtractor & { retained?: string }).retained =
      'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, regex, lexicon, or provider imports', () => {
    const source = readFileSync(ORIGIN_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/origin\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(/lexicon|alias|airport|country|cityNames/i);
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
      ORIGIN_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/OriginConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('OriginConversationStateExtractor');
    expect(processTurn).not.toMatch(/OriginConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new OriginConversationStateExtractor'), file).toBe(false);
      expect(src.includes('OriginConversationStateExtractor'), file).toBe(false);
    }
  });

  it('keeps processor origin behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({ origin: 'Melbourne', destination: 'Brisbane' });
    const injected = processConversationTurn({
      message: 'I am flying from Cairns',
      state: currentState,
      userEntryId: 'user-5l',
      assistantEntryId: 'assistant-5l',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { origin: 'Sydney' },
    });
    const cleared = processConversationTurn({
      message: 'Forget Melbourne',
      state: currentState,
      userEntryId: 'user-5l-b',
      assistantEntryId: 'assistant-5l-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { origin: null },
    });
    const messageOnly = processConversationTurn({
      message: 'Leaving from Darwin',
      state: currentState,
      userEntryId: 'user-5l-c',
      assistantEntryId: 'assistant-5l-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
    });
    const destinationInjected = processConversationTurn({
      message: 'Take me to Perth',
      state: currentState,
      userEntryId: 'user-5l-d',
      assistantEntryId: 'assistant-5l-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { destination: 'Perth' },
    });

    expect(injected.state.origin).toBe('Sydney');
    expect(injected.state.destination).toBe('Brisbane');
    expect(cleared.state.origin).toBeNull();
    expect(messageOnly.state.origin).toBe('Melbourne');
    expect(destinationInjected.state.destination).toBe('Perth');
    expect(destinationInjected.state.origin).toBe('Melbourne');
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
