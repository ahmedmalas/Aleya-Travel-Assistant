import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as conversationCore from '../index';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
  type ConversationStateExtractionResult,
  type ConversationStateExtractor,
} from '../index';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';

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
      conversationId: 'conversation-7a',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    adultCount: 2,
    flightsRequested: true,
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

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

describe('phase 7A — DestinationConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit destination result contract', () => {
    expectTypeOf<DestinationConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<DestinationConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<DestinationConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new DestinationConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'go to Brisbane',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Brisbane' } });
  });

  it('extracts supported direct destination verb forms', () => {
    const extractor = new DestinationConversationStateExtractor();
    const cases: Array<{ message: string; destination: string }> = [
      { message: 'go to Brisbane', destination: 'Brisbane' },
      { message: 'going to Brisbane', destination: 'Brisbane' },
      { message: 'travel to Brisbane', destination: 'Brisbane' },
      { message: 'travelling to Brisbane', destination: 'Brisbane' },
      { message: 'fly to Brisbane', destination: 'Brisbane' },
      { message: 'flying to Brisbane', destination: 'Brisbane' },
      { message: 'visit Brisbane', destination: 'Brisbane' },
      { message: 'visiting Brisbane', destination: 'Brisbane' },
      { message: 'head to Brisbane', destination: 'Brisbane' },
      { message: 'heading to Brisbane', destination: 'Brisbane' },
      { message: 'take me to Brisbane', destination: 'Brisbane' },
      { message: 'I want to go to Melbourne', destination: 'Melbourne' },
      { message: 'we are going to Adelaide', destination: 'Adelaide' },
    ];

    for (const { message, destination } of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ destination: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { destination } });
    }
  });

  it('extracts explicit destination replacement wording', () => {
    const extractor = new DestinationConversationStateExtractor();
    const cases: Array<{ message: string; destination: string }> = [
      { message: 'change it to Hamilton Island', destination: 'Hamilton Island' },
      {
        message: 'change destination to Hamilton Island',
        destination: 'Hamilton Island',
      },
      {
        message: 'change my destination to Hamilton Island',
        destination: 'Hamilton Island',
      },
      {
        message: 'make it Hamilton Island instead',
        destination: 'Hamilton Island',
      },
      {
        message: 'actually make it Hamilton Island',
        destination: 'Hamilton Island',
      },
      {
        message: 'switch it to Hamilton Island',
        destination: 'Hamilton Island',
      },
      {
        message: 'destination is Hamilton Island',
        destination: 'Hamilton Island',
      },
      {
        message: 'Actually go to Cairns instead of Hobart',
        destination: 'Cairns',
      },
    ];

    for (const { message, destination } of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ destination: 'Hobart' }),
        }),
        message,
      ).toEqual({ stateUpdate: { destination } });
    }
  });

  it('trims harmless whitespace and punctuation and preserves multi-word destinations', () => {
    const extractor = new DestinationConversationStateExtractor();

    expect(
      extractor.extract({
        message: '  go to Brisbane!  ',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Brisbane' } });
    expect(
      extractor.extract({
        message: 'go to Hamilton Island.',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Hamilton Island' } });
    expect(
      extractor.extract({
        message: 'visit Gold Coast',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Gold Coast' } });
    expect(
      extractor.extract({
        message: 'fly to New York',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'New York' } });
    expect(
      extractor.extract({
        message: 'travel to Kuala Lumpur',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Kuala Lumpur' } });
  });

  it('extracts destination from explicit origin+destination route forms', () => {
    const extractor = new DestinationConversationStateExtractor();
    const cases: Array<{ message: string; destination: string }> = [
      { message: 'from Sydney, go to Brisbane', destination: 'Brisbane' },
      {
        message: 'travelling from Melbourne and flying to Gold Coast',
        destination: 'Gold Coast',
      },
      { message: 'fly from Sydney to Brisbane', destination: 'Brisbane' },
      { message: 'travel from Sydney to Brisbane', destination: 'Brisbane' },
      {
        message: 'fly from Melbourne to Gold Coast',
        destination: 'Gold Coast',
      },
    ];

    for (const { message, destination } of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ destination: null }),
      });
      expect(result, message).toEqual({ stateUpdate: { destination } });
      expect(result.stateUpdate).not.toHaveProperty('origin');
      expect(result.stateUpdate.destination).not.toBe('Sydney');
      expect(result.stateUpdate.destination).not.toBe('Melbourne');
    }
  });

  it('does not capture the origin portion as destination for route wording', () => {
    const extractor = new DestinationConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'fly from Sydney to Brisbane',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Brisbane' } });
    expect(
      extractor.extract({
        message: 'from Sydney, go to Brisbane',
        currentState: createState({ destination: null }),
      }),
    ).toEqual({ stateUpdate: { destination: 'Brisbane' } });
    expect(
      extractor.extract({
        message: 'from Brisbane',
        currentState: createState({ destination: 'Hobart' }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'from Sydney to Brisbane',
        currentState: createState({ destination: 'Hobart' }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('returns an empty update for unsupported, ambiguous, origin, and negated wording', () => {
    const extractor = new DestinationConversationStateExtractor();
    const unsupported = [
      'somewhere tropical',
      'somewhere warm',
      'recommend a destination',
      'where should I go',
      'what do you recommend',
      'I like Brisbane',
      'Brisbane sounds nice',
      'not Brisbane',
      'keep Brisbane',
      'do not change Brisbane',
      'flights to compare',
      'hotel in Brisbane',
      'activities near Brisbane',
      'from Brisbane',
      'leaving Brisbane',
      'Brisbane airport pickup',
      'maybe Brisbane',
      'perhaps Brisbane',
      'thinking about Brisbane',
      'not Brisbane, keep Gold Coast',
      'do not go to Brisbane',
      "don't go to Brisbane",
      'not going to Brisbane',
      'keep Gold Coast',
      'keep the destination as Gold Coast',
      'do not change it to Brisbane',
      "don't make it Brisbane",
      'Brisbane',
      'Sydney please',
      'from Sydney to Brisbane',
      'Forget Hobart',
      'I need a holiday',
      'surprise me',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ destination: 'Hobart' }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('does not inspect, copy, preserve, or clear destination from currentState', () => {
    const extractor = new DestinationConversationStateExtractor();
    const withDestination = createState({ destination: 'Hobart' });

    expect(
      extractor.extract({
        message: 'hello',
        currentState: withDestination,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'keep Hobart',
        currentState: withDestination,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(withDestination.destination).toBe('Hobart');
  });

  it('does not mutate input and retains no destination across calls', () => {
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
    expect(second).toEqual({ stateUpdate: { destination: 'Cairns' } });

    const unsupportedAfter = extractor.extract({
      message: 'Brisbane',
      currentState: createState({ destination: 'Perth' }),
    });
    expect(unsupportedAfter).toEqual({ stateUpdate: {} });
    expect(unsupportedAfter.stateUpdate).not.toHaveProperty('destination');
  });

  it('contains no trim/toLowerCase, currentState inspection, or provider imports', () => {
    const source = readFileSync(DESTINATION_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/destination\s*:/);
    expect(source).not.toMatch(/\.trim\(/);
    expect(source).not.toMatch(/\.toLowerCase\(/);
    expect(source).not.toMatch(/lexicon|alias|airport|country|cityNames/i);
    expect(source).not.toMatch(/provider|travel-location|destination-discovery/i);
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

  it('applies extracted destination through the live processor with trusted explicit precedence', () => {
    const currentState = createState({ destination: 'Brisbane', origin: 'Melbourne' });
    const extracted = processConversationTurn({
      message: 'go to Cairns',
      state: currentState,
      userEntryId: 'user-7a-a',
      assistantEntryId: 'assistant-7a-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const overridden = processConversationTurn({
      message: 'go to Cairns',
      state: currentState,
      userEntryId: 'user-7a-b',
      assistantEntryId: 'assistant-7a-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { destination: 'Sydney' },
    });
    const nullOverride = processConversationTurn({
      message: 'go to Cairns',
      state: currentState,
      userEntryId: 'user-7a-c',
      assistantEntryId: 'assistant-7a-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { destination: null },
    });
    const unrelatedExplicit = processConversationTurn({
      message: 'go to Darwin',
      state: currentState,
      userEntryId: 'user-7a-d',
      assistantEntryId: 'assistant-7a-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { flightsRequested: false },
    });
    const preserved = processConversationTurn({
      message: 'hello there',
      state: currentState,
      userEntryId: 'user-7a-e',
      assistantEntryId: 'assistant-7a-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });

    expect(extracted.state.destination).toBe('Cairns');
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.adultCount).toBe(2);
    expect(extracted.state.flightsRequested).toBe(true);
    expect(overridden.state.destination).toBe('Sydney');
    expect(nullOverride.state.destination).toBeNull();
    expect(unrelatedExplicit.state.destination).toBe('Darwin');
    expect(unrelatedExplicit.state.flightsRequested).toBe(false);
    expect(preserved.state.destination).toBe('Brisbane');
    expect(extracted.reply).toBe(extracted.state.transcript.at(-1)?.message);
    expect(extracted.reply).not.toMatch(/assembled|unavailable/i);
    expect(extracted.trace.messageInterpreted).toBe(true);
    expect(Object.keys(extracted).sort()).toEqual(['reply', 'state', 'trace']);
    expect(extracted.state.transcript).toHaveLength(3);
    expect(extracted.state.transcript[1]?.role).toBe('user');
    expect(extracted.state.transcript[1]?.message).toBe('go to Cairns');
    expect(extracted.state.transcript[2]?.message).toBe(extracted.reply);
  });

  it('keeps destination as the only behaviourally active production extractor', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(29);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[28]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({ destination: 'Hobart' });
    for (let index = 1; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: 'go to Brisbane',
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[0]?.extract({
        message: 'go to Brisbane',
        currentState,
      }),
    ).toEqual({ stateUpdate: { destination: 'Brisbane' } });
  });
});
