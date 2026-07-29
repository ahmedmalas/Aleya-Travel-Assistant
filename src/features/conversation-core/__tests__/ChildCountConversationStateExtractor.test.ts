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
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
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
      conversationId: 'conversation-7f',
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

describe('phase 7F — ChildCountConversationStateExtractor activation', () => {
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
      ['travelling with 2 children', 2],
      ['traveling with 2 children', 2],
      ['for three children', 3],
      ['child count is 2', 2],
      ['child count is ten', 10],
    ];

    for (const [message, childCount] of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ childCount: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { childCount } });
    }
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

  it('returns empty for adult/infant, total, vague, negation, and keep wording', () => {
    const extractor = new ChildCountConversationStateExtractor();
    const unsupported = [
      '2 adults',
      '1 infant',
      'two adults and one infant',
      '2 adults and 1 child',
      'four travellers',
      'party of 4',
      '3 passengers',
      'my son',
      'my daughter',
      'our two kids',
      'travelling with the children',
      'one teenager',
      'a 12-year-old',
      'two toddlers',
      'remove the children',
      'no children',
      'Do not change the child count',
      'Keep my child count',
      'Forget the children',
      '2 children instead',
      'Actually 2 children',
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
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 7C');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 7D');
    expect(readFileSync(ADULT_COUNT_SOURCE, 'utf8')).toContain('Phase 7E');

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
  });

  it('applies extracted childCount through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: '2 children',
      state: currentState,
      userEntryId: 'user-7f-a',
      assistantEntryId: 'assistant-7f-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const replaced = processConversationTurn({
      message: 'for three children',
      state: currentState,
      userEntryId: 'user-7f-b',
      assistantEntryId: 'assistant-7f-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
    });
    const overridden = processConversationTurn({
      message: '2 children',
      state: currentState,
      userEntryId: 'user-7f-c',
      assistantEntryId: 'assistant-7f-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { childCount: 5 },
    });
    const nullOverride = processConversationTurn({
      message: '2 children',
      state: currentState,
      userEntryId: 'user-7f-d',
      assistantEntryId: 'assistant-7f-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { childCount: null },
    });
    const preserved = processConversationTurn({
      message: 'two adults and one infant',
      state: currentState,
      userEntryId: 'user-7f-e',
      assistantEntryId: 'assistant-7f-e',
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
      userEntryId: 'user-7f-f',
      assistantEntryId: 'assistant-7f-f',
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
      userEntryId: 'user-7f-g',
      assistantEntryId: 'assistant-7f-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        childCount: 4,
      },
    });

    expect(extracted.state.childCount).toBe(2);
    expect(extracted.state.adultCount).toBe(2);
    expect(extracted.state.origin).toBe('Melbourne');
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
    expect(extracted.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
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
    expect(extractors).toHaveLength(28);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[4]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(extractors[5]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);

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

    for (let index = 6; index < extractors.length; index += 1) {
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
    ).toEqual({ stateUpdate: { childCount: 2 } });

    const adultActiveMessage = '2 adults';
    expect(
      extractors[4]?.extract({
        message: adultActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { adultCount: 2 } });
    expect(
      extractors[5]?.extract({
        message: adultActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 6; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: adultActiveMessage,
          currentState,
        }),
        `extractor ${index} on adult message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
