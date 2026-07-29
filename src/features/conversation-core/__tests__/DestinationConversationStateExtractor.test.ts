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
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';

const ROOT = process.cwd();
const DESTINATION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/DestinationConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5k',
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

describe('phase 5K — DestinationConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<DestinationConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<DestinationConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<DestinationConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new DestinationConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'I want to visit the Gold Coast',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear destination from message-like text', () => {
    const extractor = new DestinationConversationStateExtractor();
    const withDestination = createState({ destination: 'Hobart' });

    expect(
      extractor.extract({
        message: 'Take me to Cairns',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Actually go to Sydney instead of Hobart',
        currentState: withDestination,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Forget Hobart / not Hobart',
        currentState: withDestination,
      }),
    ).toEqual({ stateUpdate: {} });

    const result = extractor.extract({
      message: 'keep Hobart',
      currentState: withDestination,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('destination');
    expect(withDestination.destination).toBe('Hobart');
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new DestinationConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'Sydney to Brisbane',
        currentState: createState({ destination: 'Perth' }),
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
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new DestinationConversationStateExtractor();
    const currentState = createState({
      destination: 'Brisbane',
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
      message: 'Go to Cairns',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.destination = 'mutated';

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other = new DestinationConversationStateExtractor() as DestinationConversationStateExtractor & {
      retained?: string;
    };
    (extractor as DestinationConversationStateExtractor & { retained?: string }).retained =
      'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, regex, lexicon, or provider imports', () => {
    const source = readFileSync(DESTINATION_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/destination\s*:/);
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
      DESTINATION_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/DestinationConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('DestinationConversationStateExtractor');
    expect(processTurn).not.toMatch(/DestinationConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new DestinationConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('DestinationConversationStateExtractor'), file).toBe(false);
    }
  });

  it('keeps processor destination behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({ destination: 'Brisbane' });
    const injected = processConversationTurn({
      message: 'I want to visit Cairns',
      state: currentState,
      userEntryId: 'user-5k',
      assistantEntryId: 'assistant-5k',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { destination: 'Sydney' },
    });
    const cleared = processConversationTurn({
      message: 'Forget Brisbane',
      state: currentState,
      userEntryId: 'user-5k-b',
      assistantEntryId: 'assistant-5k-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { destination: null },
    });
    const messageOnly = processConversationTurn({
      message: 'Take me to Darwin',
      state: currentState,
      userEntryId: 'user-5k-c',
      assistantEntryId: 'assistant-5k-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
    });

    expect(injected.state.destination).toBe('Sydney');
    expect(injected.state.origin).toBe('Melbourne');
    expect(cleared.state.destination).toBeNull();
    expect(messageOnly.state.destination).toBe('Brisbane');
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
