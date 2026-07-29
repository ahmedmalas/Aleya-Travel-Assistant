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
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
const INFANT_COUNT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/InfantCountConversationStateExtractor.ts',
);
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
      conversationId: 'conversation-7g',
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

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

describe('phase 7G — InfantCountConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit infantCount result contract', () => {
    expectTypeOf<InfantCountConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<InfantCountConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<InfantCountConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new InfantCountConversationStateExtractor();
    expect(
      extractor.extract({
        message: '1 infant',
        currentState: createState({ infantCount: null }),
      }),
    ).toEqual({ stateUpdate: { infantCount: 1 } });
  });

  it('extracts supported explicit infant-count forms', () => {
    const extractor = new InfantCountConversationStateExtractor();
    const cases: Array<[string, number]> = [
      ['1 infant', 1],
      ['2 infants', 2],
      ['one infant', 1],
      ['two infants', 2],
      ['travelling with 2 infants', 2],
      ['traveling with 2 infants', 2],
      ['for three infants', 3],
      ['infant count is 2', 2],
      ['infant count is ten', 10],
    ];

    for (const [message, infantCount] of cases) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ infantCount: null }),
        }),
        message,
      ).toEqual({ stateUpdate: { infantCount } });
    }
  });

  it('replaces an existing infantCount when a new explicit count is stated', () => {
    const extractor = new InfantCountConversationStateExtractor();
    expect(
      extractor.extract({
        message: '2 infants',
        currentState: createState({ infantCount: 1 }),
      }),
    ).toEqual({ stateUpdate: { infantCount: 2 } });
  });

  it('returns empty for adult/child, total, vague, negation, and keep wording', () => {
    const extractor = new InfantCountConversationStateExtractor();
    const unsupported = [
      '2 adults',
      '2 children',
      'two adults and one child',
      '1 infant and 1 child',
      'four travellers',
      'party of 4',
      '3 passengers',
      'travelling with a baby',
      'our newborn is coming',
      'one lap infant',
      'a six-month-old baby',
      'an 18-month-old',
      'a one-year-old',
      'my wife and our baby',
      'remove the infant',
      'no infants',
      'Do not change the infant count',
      'Keep my infant count',
      'Forget the infants',
      '2 infants instead',
      'Actually 2 infants',
      'babies: 3',
      'infant travellers',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ infantCount: 1 }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits infantCount null from extraction', () => {
    const extractor = new InfantCountConversationStateExtractor();
    const result = extractor.extract({
      message: 'Forget the infants',
      currentState: createState({ infantCount: 1 }),
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('infantCount');

    const update = extractor.extract({
      message: '1 infant',
      currentState: createState({ infantCount: null }),
    }).stateUpdate;
    expect(update.infantCount).toBe(1);
    expect(update.infantCount).not.toBeNull();
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
      message: '2 infants',
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
    expect(second).toEqual({ stateUpdate: { infantCount: 2 } });

    const other =
      new InfantCountConversationStateExtractor() as InfantCountConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as InfantCountConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: '1 infant',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { infantCount: 1 } });
  });

  it('contains no trim/toLowerCase, Number/parseInt, currentState inspection, or provider imports', () => {
    const source = readFileSync(INFANT_COUNT_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/infantCount\s*:/);
    expect(source).not.toMatch(/adultCount\s*:/);
    expect(source).not.toMatch(/childCount\s*:/);
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
      INFANT_COUNT_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/InfantCountConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'InfantCountConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/InfantCountConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new InfantCountConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('InfantCountConversationStateExtractor'), file).toBe(
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
    expect(readFileSync(CHILD_COUNT_SOURCE, 'utf8')).toContain('Phase 7F');

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
      new ChildCountConversationStateExtractor().extract({
        message: '2 children',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { childCount: 2 } });
  });

  it('applies extracted infantCount through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const extracted = processConversationTurn({
      message: '1 infant',
      state: currentState,
      userEntryId: 'user-7g-a',
      assistantEntryId: 'assistant-7g-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const replaced = processConversationTurn({
      message: 'for two infants',
      state: currentState,
      userEntryId: 'user-7g-b',
      assistantEntryId: 'assistant-7g-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
    });
    const overridden = processConversationTurn({
      message: '1 infant',
      state: currentState,
      userEntryId: 'user-7g-c',
      assistantEntryId: 'assistant-7g-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { infantCount: 3 },
    });
    const nullOverride = processConversationTurn({
      message: '1 infant',
      state: currentState,
      userEntryId: 'user-7g-d',
      assistantEntryId: 'assistant-7g-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { infantCount: null },
    });
    const preserved = processConversationTurn({
      message: 'two adults and one child',
      state: currentState,
      userEntryId: 'user-7g-e',
      assistantEntryId: 'assistant-7g-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: '1 infant. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        infantCount: null,
      }),
      userEntryId: 'user-7g-f',
      assistantEntryId: 'assistant-7g-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: '1 infant. Fly from Sydney to Cairns',
      state: createState({
        origin: null,
        destination: null,
        infantCount: null,
      }),
      userEntryId: 'user-7g-g',
      assistantEntryId: 'assistant-7g-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        infantCount: 2,
      },
    });

    expect(extracted.state.infantCount).toBe(1);
    expect(extracted.state.adultCount).toBe(2);
    expect(extracted.state.childCount).toBe(1);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(replaced.state.infantCount).toBe(2);
    expect(overridden.state.infantCount).toBe(3);
    expect(nullOverride.state.infantCount).toBeNull();
    expect(preserved.state.infantCount).toBe(1);
    expect(composed.state.infantCount).toBe(1);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.infantCount).toBe(2);
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

  it('keeps Destination through InfantCount as the only behaviourally active production extractors', () => {
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
    expect(extractors[6]).toBeInstanceOf(InfantCountConversationStateExtractor);
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      adultCount: 1,
      childCount: 1,
      infantCount: 1,
    });

    const infantActiveMessage =
      '1 infant. Depart on 28 August 2026. Fly from Sydney to Cairns';
    expect(
      createConversationStateExtractor().extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        infantCount: 1,
      },
    });

    for (let index = 7; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: infantActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[0]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(
      extractors[1]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      extractors[2]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
    expect(
      extractors[3]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[4]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[5]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[6]?.extract({
        message: infantActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { infantCount: 1 } });

    const childActiveMessage = '2 children';
    expect(
      extractors[5]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { childCount: 2 } });
    expect(
      extractors[6]?.extract({
        message: childActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 7; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: childActiveMessage,
          currentState,
        }),
        `extractor ${index} on child message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
