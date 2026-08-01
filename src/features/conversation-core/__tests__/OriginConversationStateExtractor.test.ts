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
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
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
      conversationId: 'conversation-7b',
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

describe('phase 8B — OriginConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit origin result contract', () => {
    expectTypeOf<OriginConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<OriginConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<OriginConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new OriginConversationStateExtractor();
    expect(
      extractor.extract({
        message: 'from Sydney',
        currentState: createState({ origin: null }),
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
  });

  it('extracts supported explicit origin forms', () => {
    const extractor = new OriginConversationStateExtractor();
    const cases: Array<{ message: string; origin: string }> = [
      { message: 'from Sydney', origin: 'Sydney' },
      { message: 'I am from Sydney', origin: 'Sydney' },
      { message: "I'm from Sydney", origin: 'Sydney' },
      { message: 'I am coming from Canberra', origin: 'Canberra' },
      { message: 'we are leaving from Hobart', origin: 'Hobart' },
      { message: 'travelling from Perth', origin: 'Perth' },
      { message: 'traveling from Perth', origin: 'Perth' },
      { message: 'travelling from Sydney', origin: 'Sydney' },
      { message: 'traveling from Sydney', origin: 'Sydney' },
      { message: 'travel from Sydney', origin: 'Sydney' },
      { message: 'departing from Brisbane', origin: 'Brisbane' },
      { message: 'departing from Sydney', origin: 'Sydney' },
      { message: 'depart from Sydney', origin: 'Sydney' },
      { message: 'leaving from Melbourne', origin: 'Melbourne' },
      { message: 'leaving from Sydney', origin: 'Sydney' },
      { message: 'leave from Sydney', origin: 'Sydney' },
      { message: 'flying from Adelaide', origin: 'Adelaide' },
      { message: 'flying from Sydney', origin: 'Sydney' },
      { message: 'fly from Sydney', origin: 'Sydney' },
      { message: 'starting from Sydney', origin: 'Sydney' },
      { message: 'start from Sydney', origin: 'Sydney' },
      { message: 'origin is Sydney', origin: 'Sydney' },
      { message: 'my origin is Sydney', origin: 'Sydney' },
      { message: '  from Melbourne Airport.  ', origin: 'Melbourne Airport' },
      { message: 'from Gold Coast', origin: 'Gold Coast' },
      { message: 'from New York', origin: 'New York' },
      { message: 'from Kuala Lumpur', origin: 'Kuala Lumpur' },
    ];

    for (const { message, origin } of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ origin: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { origin } });
    }
  });

  it('extracts only the origin from clear from-X-to-Y travel requests', () => {
    const extractor = new OriginConversationStateExtractor();
    const cases: Array<{ message: string; origin: string }> = [
      { message: 'I want to travel from Sydney to Brisbane', origin: 'Sydney' },
      { message: 'fly from Melbourne to Perth', origin: 'Melbourne' },
      { message: 'from Adelaide I want to go to Darwin', origin: 'Adelaide' },
    ];

    for (const { message, origin } of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ origin: null, destination: 'Hobart' }),
      });
      expect(result, message).toEqual({ stateUpdate: { origin } });
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('returns an empty update for unsupported, destination, price, and negated wording', () => {
    const extractor = new OriginConversationStateExtractor();
    const unsupported = [
      'Sydney',
      'Melbourne',
      'go to Brisbane',
      'going to Brisbane',
      'travel to Brisbane',
      'fly to Brisbane',
      'visit Brisbane',
      'take me to Brisbane',
      'go to Sydney',
      'travel to Melbourne',
      'Brisbane please',
      'I want Perth',
      'destination is Brisbane',
      'change it to Brisbane',
      'make it Brisbane instead',
      'hotel in Brisbane',
      'activities in Brisbane',
      'car hire in Brisbane',
      'somewhere near Brisbane',
      'Brisbane sounds nice',
      'maybe Brisbane',
      'perhaps Brisbane',
      'thinking about Brisbane',
      'hotel from A$200',
      'flights from A$300',
      'flights from $200',
      'prices from Sydney',
      'available from Monday',
      'open from 9am',
      'two hours from Brisbane',
      'two hours from now',
      '20 kilometres from Sydney',
      'recommendations from friends',
      'message from Qantas',
      'a message from Qantas',
      'booking confirmation from the hotel',
      'return from Brisbane on Monday',
      'where should I travel from',
      'far from home',
      'from memory',
      'from experience',
      'not from Sydney',
      "I'm not from Sydney",
      'do not depart from Sydney',
      "don't depart from Sydney",
      'not leaving from Sydney',
      'keep Melbourne as the origin',
      'keep the origin as Melbourne',
      'do not change the origin to Sydney',
      "don't make the origin Sydney",
      'not Sydney, keep Melbourne',
      'Forget Melbourne',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ origin: 'Hobart' }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('does not inspect, copy, preserve, or clear origin from currentState', () => {
    const extractor = new OriginConversationStateExtractor();
    const withOrigin = createState({ origin: 'Hobart', destination: 'Brisbane' });

    expect(
      extractor.extract({
        message: 'hello',
        currentState: withOrigin,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'keep Hobart',
        currentState: withOrigin,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(withOrigin.origin).toBe('Hobart');
    expect(withOrigin.destination).toBe('Brisbane');
  });

  it('does not mutate input, state, or transcript and retains no origin across calls', () => {
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
    expect(second).toEqual({ stateUpdate: { origin: 'Cairns' } });
  });

  it('contains no trim/toLowerCase, currentState inspection, or provider imports', () => {
    const source = readFileSync(ORIGIN_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/origin\s*:/);
    expect(source).not.toMatch(/\.trim\(/);
    expect(source).not.toMatch(/\.toLowerCase\(/);
    expect(source).not.toMatch(/lexicon|alias|country|cityNames/i);
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

  it('applies extracted origin through the live processor with trusted explicit precedence', () => {
    const currentState = createState({ origin: 'Melbourne', destination: 'Brisbane' });
    const extracted = processConversationTurn({
      message: 'from Sydney',
      state: currentState,
      userEntryId: 'user-8b-a',
      assistantEntryId: 'assistant-8b-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const replaced = processConversationTurn({
      message: 'flying from Cairns',
      state: currentState,
      userEntryId: 'user-8b-b',
      assistantEntryId: 'assistant-8b-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
    });
    const overridden = processConversationTurn({
      message: 'from Sydney',
      state: currentState,
      userEntryId: 'user-8b-c',
      assistantEntryId: 'assistant-8b-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { origin: 'Perth' },
    });
    const nullOverride = processConversationTurn({
      message: 'from Sydney',
      state: currentState,
      userEntryId: 'user-8b-d',
      assistantEntryId: 'assistant-8b-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { origin: null },
    });
    const preserved = processConversationTurn({
      message: 'prices from Sydney',
      state: currentState,
      userEntryId: 'user-8b-e',
      assistantEntryId: 'assistant-8b-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'fly from Sydney to Brisbane',
      state: createState({ origin: null, destination: null }),
      userEntryId: 'user-8b-f',
      assistantEntryId: 'assistant-8b-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'fly from Sydney to Brisbane',
      state: createState({ origin: null, destination: null }),
      userEntryId: 'user-8b-g',
      assistantEntryId: 'assistant-8b-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: { origin: 'Perth', destination: 'Cairns' },
    });
    const fromToOnlyOriginField = processConversationTurn({
      message: 'from Adelaide I want to go to Darwin',
      state: createState({
        origin: 'Melbourne',
        destination: 'Hobart',
        flightsRequested: true,
        adultCount: 2,
      }),
      userEntryId: 'user-8b-h',
      assistantEntryId: 'assistant-8b-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });

    expect(extracted.state.origin).toBe('Sydney');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(replaced.state.origin).toBe('Cairns');
    expect(replaced.state.destination).toBe('Brisbane');
    expect(overridden.state.origin).toBe('Perth');
    expect(nullOverride.state.origin).toBeNull();
    expect(preserved.state.origin).toBe('Melbourne');
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Brisbane');
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Cairns');
    expect(fromToOnlyOriginField.state.origin).toBe('Adelaide');
    expect(fromToOnlyOriginField.state.flightsRequested).toBe(true);
    expect(fromToOnlyOriginField.state.adultCount).toBe(2);
    expect(extracted.reply).toBe(extracted.state.transcript.at(-1)?.message);
    expect(extracted.reply).not.toMatch(/assembled|unavailable/i);
    expect(extracted.trace.messageInterpreted).toBe(true);
    expect(extracted.state.transcript).toHaveLength(3);
  });

  it('keeps Destination and Origin as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(29);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[28]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({ origin: 'Hobart', destination: 'Hobart' });
    expect(
      createConversationStateExtractor().extract({
        message: 'fly from Sydney to Brisbane',
        currentState,
      }),
    ).toEqual({
      stateUpdate: { destination: 'Brisbane', origin: 'Sydney' },
    });

    for (let index = 2; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: 'fly from Sydney to Brisbane',
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[0]?.extract({
        message: 'fly from Sydney to Brisbane',
        currentState,
      }),
    ).toEqual({ stateUpdate: { destination: 'Brisbane' } });
    expect(
      extractors[1]?.extract({
        message: 'fly from Sydney to Brisbane',
        currentState,
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
  });
});
