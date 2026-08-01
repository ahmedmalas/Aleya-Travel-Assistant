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
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { MultiPassengerCountConversationStateExtractor } from '../MultiPassengerCountConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
const CHILD_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ChildCountConversationStateExtractor.ts',
);
const ADULT_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/AdultCountConversationStateExtractor.ts',
);
const DESTINATION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/DestinationConversationStateExtractor.ts',
);
const ORIGIN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/OriginConversationStateExtractor.ts',
);
const DEPARTURE_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/DepartureDateConversationStateExtractor.ts',
);
const RETURN_DATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ReturnDateConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-8f',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    departureDate: '2026-09-01',
    returnDate: '2026-09-08',
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

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

describe('phase 8F — ChildCountConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit childCount result contract', () => {
    expectTypeOf<ChildCountConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<ChildCountConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<ChildCountConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new ChildCountConversationStateExtractor();
    expect(
      extractor.extract({
        message: '2 children',
        currentState: createState({ childCount: null }),
      }),
    ).toEqual({ stateUpdate: { childCount: 2 } });
  });

  it('extracts supported explicit child-count forms', () => {
    const extractor = new ChildCountConversationStateExtractor();
    const cases: Array<[string, number]> = [
      ['2 children', 2],
      ['two children', 2],
      ['1 child', 1],
      ['one child', 1],
      ['for 3 children', 3],
      ['travelling with 2 children', 2],
      ['traveling with 2 children', 2],
      ['we have 2 children', 2],
      ['book for one child', 1],
      ['for three children', 3],
      ['child count is 2', 2],
      ['child count is ten', 10],
      ['flights for 1 child', 1],
      ['Sydney to Brisbane for two children', 2],
      // Phase 17G passenger repair families
      ['Actually 2 children', 2],
      ['Actually, 1 child', 1],
      ['Not 1 child, 2 children', 2],
      ['Change the child count to 2', 2],
      ['Change the children count to 3', 3],
    ];

    for (const [message, childCount] of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ childCount: null }),
      });
      expect(result, message).toEqual({ stateUpdate: { childCount } });
      expect(result.stateUpdate, message).not.toHaveProperty('adultCount');
      expect(result.stateUpdate, message).not.toHaveProperty('infantCount');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('defers mixed adult-and-child wording to multi-passenger ownership (Phase 19K)', () => {
    const extractor = new ChildCountConversationStateExtractor();
    expect(
      extractor.extract({
        message: '2 adults and 2 children',
        currentState: createState({ childCount: null, adultCount: null }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('replaces an existing childCount when a new explicit count is stated', () => {
    const extractor = new ChildCountConversationStateExtractor();
    expect(
      extractor.extract({
        message: '3 children',
        currentState: createState({ childCount: 1 }),
      }),
    ).toEqual({ stateUpdate: { childCount: 3 } });
  });

  it('phase 19L accepts explicit zero child answers', () => {
    const extractor = new ChildCountConversationStateExtractor();
    const currentState = createState();
    for (const message of [
      '0 children',
      '0 child',
      'no children',
      'There are no children',
      'We have no children',
      'no children.',
    ]) {
      expect(
        extractor.extract({ message, currentState }),
        message,
      ).toEqual({ stateUpdate: { childCount: 0 } });
    }
  });

  it('returns empty for adult-only, infant-only, family, fare, negative, decimal, and vague wording', () => {
    const extractor = new ChildCountConversationStateExtractor();
    const unsupported = [
      'family',
      'kids club',
      'child fare',
      'child ticket',
      'child seat',
      'under 18',
      'my son',
      'my daughter',
      '2 adults',
      '1 infant',
      '3 travellers',
      '2 passengers',
      '-1 child',
      '2.5 children',
      'how many children',
      'children?',
      'parents',
      'kids',
      'children',
      'our family',
      'travelling together',
      'two adults and one infant',
      'four travellers',
      'party of 4',
      '3 passengers',
      'our two kids',
      'travelling with the children',
      'one teenager',
      'a 12-year-old',
      'two toddlers',
      'remove the children',
      'Do not change the child count',
      'Keep my child count',
      'Forget the children',
      '2 children instead',
      'kids: 3',
      'child travellers',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ childCount: 1 }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits childCount null from extraction', () => {
    const extractor = new ChildCountConversationStateExtractor();
    const result = extractor.extract({
      message: 'Forget the children',
      currentState: createState({ childCount: 1 }),
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('childCount');

    const update = extractor.extract({
      message: '2 children',
      currentState: createState({ childCount: null }),
    }).stateUpdate;
    expect(update.childCount).toBe(2);
    expect(update.childCount).not.toBeNull();
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new ChildCountConversationStateExtractor();
    const currentState = createState({
      childCount: 1,
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
      message: '3 children',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.childCount = 99;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { childCount: 3 } });

    const other =
      new ChildCountConversationStateExtractor() as ChildCountConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as ChildCountConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: '2 children',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { childCount: 2 } });
  });

  it('contains no trim/toLowerCase, Number/parseInt, currentState inspection, or provider imports', () => {
    const source = readFileSync(CHILD_COUNT_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/childCount\s*:/);
    expect(source).not.toMatch(/adultCount\s*:/);
    expect(source).not.toMatch(/infantCount\s*:/);
    expect(source).not.toMatch(/\.trim\(/);
    expect(source).not.toMatch(/\.toLowerCase\(/);
    expect(source).not.toMatch(/\bNumber\s*\(|parseInt\s*\(|parseFloat\s*\(/);
    expect(source).not.toMatch(/Math\./);
    expect(source).not.toMatch(/provider|travel-location/i);
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
      CHILD_COUNT_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/ChildCountConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'ChildCountConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/ChildCountConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new ChildCountConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('ChildCountConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('proves existing active extractors remain unchanged', () => {
    expect(readFileSync(DESTINATION_SOURCE, 'utf8')).toContain('Phase 7A');
    expect(readFileSync(ORIGIN_SOURCE, 'utf8')).toContain('Phase 7B');
    expect(readFileSync(ORIGIN_SOURCE, 'utf8')).toContain('Phase 8B');
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 7C');
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 8C');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 7D');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 8D');
    expect(readFileSync(ADULT_COUNT_SOURCE, 'utf8')).toContain('Phase 7E');
    expect(readFileSync(ADULT_COUNT_SOURCE, 'utf8')).toContain('Phase 8E');

    expect(
      new DestinationConversationStateExtractor().extract({
        message: 'go to Cairns',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(
      new OriginConversationStateExtractor().extract({
        message: 'from Sydney',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      new DepartureDateConversationStateExtractor().extract({
        message: 'Depart on 28 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
    expect(
      new ReturnDateConversationStateExtractor().extract({
        message: 'Return on 31 August 2026',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { returnDate: '2026-08-31' } });
    expect(
      new AdultCountConversationStateExtractor().extract({
        message: '2 adults',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { adultCount: 2 } });
    expect(
      new AdultCountConversationStateExtractor().extract({
        message: '2 adults and 2 children',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('applies extracted childCount through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      origin: 'Melbourne',
      destination: 'Brisbane',
      flightsRequested: true,
    });
    const extracted = processConversationTurn({
      message: '2 children',
      state: currentState,
      userEntryId: 'user-8f-a',
      assistantEntryId: 'assistant-8f-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const replaced = processConversationTurn({
      message: 'for three children',
      state: currentState,
      userEntryId: 'user-8f-b',
      assistantEntryId: 'assistant-8f-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
    });
    const overridden = processConversationTurn({
      message: '2 children',
      state: currentState,
      userEntryId: 'user-8f-c',
      assistantEntryId: 'assistant-8f-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { childCount: 5 },
    });
    const nullOverride = processConversationTurn({
      message: '2 children',
      state: currentState,
      userEntryId: 'user-8f-d',
      assistantEntryId: 'assistant-8f-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { childCount: null },
    });
    const preserved = processConversationTurn({
      message: 'two adults and one infant',
      state: currentState,
      userEntryId: 'user-8f-e',
      assistantEntryId: 'assistant-8f-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: '2 children. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        childCount: null,
      }),
      userEntryId: 'user-8f-f',
      assistantEntryId: 'assistant-8f-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: '2 children. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        childCount: null,
      }),
      userEntryId: 'user-8f-g',
      assistantEntryId: 'assistant-8f-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        childCount: 4,
      },
    });
    const mixed = processConversationTurn({
      message: '2 adults and 2 children',
      state: createState({
        adultCount: null,
        childCount: null,
        flightsRequested: true,
      }),
      userEntryId: 'user-8f-h',
      assistantEntryId: 'assistant-8f-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const adultOnlyPreserved = processConversationTurn({
      message: '2 adults',
      state: currentState,
      userEntryId: 'user-8f-i',
      assistantEntryId: 'assistant-8f-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });
    const familyPreserved = processConversationTurn({
      message: 'our family',
      state: currentState,
      userEntryId: 'user-8f-j',
      assistantEntryId: 'assistant-8f-j',
      userMessageAt: new Date('2026-07-29T00:00:28.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:29.000Z'),
    });

    expect(extracted.state.childCount).toBe(2);
    expect(extracted.state.adultCount).toBe(2);
    expect(extracted.state.infantCount).toBe(0);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(extracted.state.flightsRequested).toBe(true);
    expect(replaced.state.childCount).toBe(3);
    expect(overridden.state.childCount).toBe(5);
    expect(nullOverride.state.childCount).toBeNull();
    expect(preserved.state.childCount).toBe(1);
    expect(composed.state.childCount).toBe(2);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.childCount).toBe(4);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    // Phase 19K — combined sentence updates both counts under flights context.
    expect(mixed.state.childCount).toBe(2);
    expect(mixed.state.adultCount).toBe(2);
    expect(adultOnlyPreserved.state.childCount).toBe(1);
    expect(adultOnlyPreserved.state.adultCount).toBe(2);
    expect(familyPreserved.state.childCount).toBe(1);
    expect(extracted.reply).toBe(extracted.state.transcript.at(-1)?.message);
    expect(extracted.reply).not.toMatch(/assembled|unavailable/i);
    expect(Object.keys(extracted).sort()).toEqual(['reply', 'state', 'trace']);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });

  it('keeps Destination, Origin, DepartureDate, ReturnDate, AdultCount, and ChildCount as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(38);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[4]).toBeInstanceOf(
      MultiPassengerCountConversationStateExtractor,
    );
    expect(extractors[5]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(extractors[6]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(extractors[37]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      adultCount: 1,
      childCount: 1,
    });

    const childActiveMessage =
      '2 children. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        childCount: 2,
      },
    });

    // Later than ChildCount (index 6) must stay inactive for the child cue.
    for (let index = 7; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: childActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[0]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(
      extractors[1]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      extractors[2]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
    expect(
      extractors[3]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[4]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[5]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[6]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { childCount: 2 } });

    const adultActiveMessage = '2 adults';
    expect(
      extractors[5]?.extract({
        message: adultActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { adultCount: 2 } });
    expect(
      extractors[6]?.extract({
        message: adultActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    // Later than ChildCount must stay inactive for an adult-only cue.
    for (let index = 7; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: adultActiveMessage,
          currentState,
        }),
        `extractor ${index} on adult message`,
      ).toEqual({ stateUpdate: {} });
    }

    const mixedMessage = '2 adults and 2 children';
    expect(
      extractors[5]?.extract({
        message: mixedMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[6]?.extract({
        message: mixedMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[4]?.extract({
        message: mixedMessage,
        currentState: createState({
          ...currentState,
          flightsRequested: true,
          adultCount: null,
          childCount: null,
        }),
      }),
    ).toEqual({ stateUpdate: { adultCount: 2, childCount: 2 } });
  });
});
