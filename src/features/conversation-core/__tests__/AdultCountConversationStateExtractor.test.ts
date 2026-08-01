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
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
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
      conversationId: 'conversation-8e',
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

describe('phase 8E — AdultCountConversationStateExtractor activation', () => {
  it('implements ConversationStateExtractor with explicit adultCount result contract', () => {
    expectTypeOf<AdultCountConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<AdultCountConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<AdultCountConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new AdultCountConversationStateExtractor();
    expect(
      extractor.extract({
        message: '2 adults',
        currentState: createState({ adultCount: null }),
      }),
    ).toEqual({ stateUpdate: { adultCount: 2 } });
  });

  it('extracts supported explicit adult-count forms', () => {
    const extractor = new AdultCountConversationStateExtractor();
    const cases: Array<[string, number]> = [
      ['2 adults', 2],
      ['two adults', 2],
      ['for 2 adults', 2],
      ['there are 3 adults', 3],
      ['we are 4 adults', 4],
      ['1 adult', 1],
      ['one adult', 1],
      ['2 grown adults', 2],
      ['two adult travellers', 2],
      ['travelling with 2 adults', 2],
      ['traveling with 2 adults', 2],
      ['adult count is 2', 2],
      ['for three adults', 3],
      ['adult count is ten', 10],
      ['2 adults flying from Sydney to Brisbane', 2],
      ['book flights for 3 adults', 3],
      ['we need accommodation for two adults', 2],
      // Phase 17G passenger repair families
      ['Actually 2 adults', 2],
      ['Actually, 3 adults', 3],
      ['Not 2 adults, 4 adults', 4],
      ['Change the adult count to 3', 3],
    ];

    for (const [message, adultCount] of cases) {
      const result = extractor.extract({
        message,
        currentState: createState({ adultCount: null }),
      });
      expect(result, message).toEqual({ stateUpdate: { adultCount } });
      expect(result.stateUpdate, message).not.toHaveProperty('childCount');
      expect(result.stateUpdate, message).not.toHaveProperty('infantCount');
      expect(result.stateUpdate, message).not.toHaveProperty('origin');
      expect(result.stateUpdate, message).not.toHaveProperty('destination');
    }
  });

  it('replaces an existing adultCount when a new explicit count is stated', () => {
    const extractor = new AdultCountConversationStateExtractor();
    expect(
      extractor.extract({
        message: '4 adults',
        currentState: createState({ adultCount: 2 }),
      }),
    ).toEqual({ stateUpdate: { adultCount: 4 } });
  });

  it('returns empty for child/infant, people, relationships, zero, negative, decimal, and vague wording', () => {
    const extractor = new AdultCountConversationStateExtractor();
    const unsupported = [
      'me and my wife',
      'my partner and I',
      'our family',
      'a couple',
      'two people',
      '3 travellers',
      '2 passengers',
      'adult only hotel',
      'adults only',
      'adult ticket',
      'adult price',
      'under 18',
      '18 years old',
      '2 children',
      '1 infant',
      '0 adults',
      '-2 adults',
      '2.5 adults',
      'how many adults',
      'adults?',
      'two adults and one infant',
      '2 adults and 1 child',
      'four travellers',
      'party of 4',
      '3 passengers',
      'just me',
      'my wife and I',
      'me and my husband',
      'three grown-ups',
      'remove the adults',
      'no adults',
      'Do not change the adult count',
      'Keep my adult count',
      'Forget the adults',
      '2 adults instead',
      'adults: 5',
      'me',
      'I',
      'we',
      'us',
      'couple',
      'family',
      'parents',
      'friends',
      'Hello',
      '',
    ];

    for (const message of unsupported) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ adultCount: 2 }),
        }),
        message,
      ).toEqual({ stateUpdate: {} });
    }
  });

  it('never emits adultCount null from extraction', () => {
    const extractor = new AdultCountConversationStateExtractor();
    const result = extractor.extract({
      message: 'Forget the adults',
      currentState: createState({ adultCount: 2 }),
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('adultCount');

    const update = extractor.extract({
      message: '2 adults',
      currentState: createState({ adultCount: null }),
    }).stateUpdate;
    expect(update.adultCount).toBe(2);
    expect(update.adultCount).not.toBeNull();
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
      message: '3 adults',
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
    expect(second).toEqual({ stateUpdate: { adultCount: 3 } });

    const other =
      new AdultCountConversationStateExtractor() as AdultCountConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as AdultCountConversationStateExtractor & { retained?: string }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({
        message: '2 adults',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: { adultCount: 2 } });
  });

  it('contains no trim/toLowerCase, Number/parseInt, currentState inspection, or provider imports', () => {
    const source = readFileSync(ADULT_COUNT_SOURCE, 'utf8');

    expect(source).toMatch(/input: ConversationStateExtractionInput/);
    expect(source).toMatch(/input\.message/);
    expect(source).not.toMatch(/input\.currentState/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).toMatch(/adultCount\s*:/);
    expect(source).not.toMatch(/childCount\s*:/);
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
      ADULT_COUNT_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/AdultCountConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'AdultCountConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/AdultCountConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new AdultCountConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('AdultCountConversationStateExtractor'), file).toBe(
        false,
      );
    }
  });

  it('proves Destination, Origin, DepartureDate, and ReturnDate remain unchanged', () => {
    expect(readFileSync(DESTINATION_SOURCE, 'utf8')).toContain('Phase 7A');
    expect(readFileSync(ORIGIN_SOURCE, 'utf8')).toContain('Phase 7B');
    expect(readFileSync(ORIGIN_SOURCE, 'utf8')).toContain('Phase 8B');
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 7C');
    expect(readFileSync(DEPARTURE_DATE_SOURCE, 'utf8')).toContain('Phase 8C');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 7D');
    expect(readFileSync(RETURN_DATE_SOURCE, 'utf8')).toContain('Phase 8D');

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
  });

  it('applies extracted adultCount through the live processor with trusted explicit precedence', () => {
    const currentState = createState({
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      origin: 'Melbourne',
      destination: 'Brisbane',
      flightsRequested: true,
    });
    const extracted = processConversationTurn({
      message: '2 adults',
      state: currentState,
      userEntryId: 'user-8e-a',
      assistantEntryId: 'assistant-8e-a',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const replaced = processConversationTurn({
      message: 'for three adults',
      state: currentState,
      userEntryId: 'user-8e-b',
      assistantEntryId: 'assistant-8e-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
    });
    const overridden = processConversationTurn({
      message: '2 adults',
      state: currentState,
      userEntryId: 'user-8e-c',
      assistantEntryId: 'assistant-8e-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { adultCount: 5 },
    });
    const nullOverride = processConversationTurn({
      message: '2 adults',
      state: currentState,
      userEntryId: 'user-8e-d',
      assistantEntryId: 'assistant-8e-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
      stateUpdate: { adultCount: null },
    });
    const preserved = processConversationTurn({
      message: 'two adults and one infant',
      state: currentState,
      userEntryId: 'user-8e-e',
      assistantEntryId: 'assistant-8e-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
    });
    const composed = processConversationTurn({
      message: 'Fly from Sydney to Cairns for 2 adults',
      state: createState({
        origin: null,
        destination: null,
        adultCount: null,
      }),
      userEntryId: 'user-8e-f',
      assistantEntryId: 'assistant-8e-f',
      userMessageAt: new Date('2026-07-29T00:00:20.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:21.000Z'),
    });
    const independentOverride = processConversationTurn({
      message: 'Fly from Sydney to Cairns for 2 adults',
      state: createState({
        origin: null,
        destination: null,
        adultCount: null,
      }),
      userEntryId: 'user-8e-g',
      assistantEntryId: 'assistant-8e-g',
      userMessageAt: new Date('2026-07-29T00:00:22.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:23.000Z'),
      stateUpdate: {
        origin: 'Perth',
        destination: 'Hobart',
        adultCount: 4,
      },
    });
    const relationshipPreserved = processConversationTurn({
      message: 'me and my wife',
      state: currentState,
      userEntryId: 'user-8e-h',
      assistantEntryId: 'assistant-8e-h',
      userMessageAt: new Date('2026-07-29T00:00:24.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:25.000Z'),
    });
    const writtenInRequest = processConversationTurn({
      message: 'we need accommodation for two adults',
      state: currentState,
      userEntryId: 'user-8e-i',
      assistantEntryId: 'assistant-8e-i',
      userMessageAt: new Date('2026-07-29T00:00:26.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:27.000Z'),
    });

    expect(extracted.state.adultCount).toBe(2);
    expect(extracted.state.childCount).toBe(1);
    expect(extracted.state.infantCount).toBe(0);
    expect(extracted.state.origin).toBe('Melbourne');
    expect(extracted.state.destination).toBe('Brisbane');
    expect(extracted.state.flightsRequested).toBe(true);
    expect(replaced.state.adultCount).toBe(3);
    expect(overridden.state.adultCount).toBe(5);
    expect(nullOverride.state.adultCount).toBeNull();
    expect(preserved.state.adultCount).toBe(2);
    expect(composed.state.adultCount).toBe(2);
    expect(composed.state.origin).toBe('Sydney');
    expect(composed.state.destination).toBe('Cairns');
    expect(independentOverride.state.adultCount).toBe(4);
    expect(independentOverride.state.origin).toBe('Perth');
    expect(independentOverride.state.destination).toBe('Hobart');
    expect(relationshipPreserved.state.adultCount).toBe(2);
    expect(writtenInRequest.state.adultCount).toBe(2);
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

  it('keeps Destination, Origin, DepartureDate, ReturnDate, and AdultCount as the only behaviourally active production extractors', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );
    expect(extractors).toHaveLength(29);
    expect(extractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(extractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(extractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(extractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(extractors[4]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(extractors[28]).toBeInstanceOf(EmptyConversationStateExtractor);

    const currentState = createState({
      origin: 'Hobart',
      destination: 'Hobart',
      adultCount: 1,
    });

    const fiveActiveMessage =
      'Depart on 28 August 2026. Fly from Sydney to Cairns for 2 adults';
    expect(
      createConversationStateExtractor().extract({
        message: fiveActiveMessage,
        currentState,
      }),
    ).toEqual({
      stateUpdate: {
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        adultCount: 2,
      },
    });

    for (let index = 5; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: fiveActiveMessage,
          currentState,
        }),
        `extractor ${index}`,
      ).toEqual({ stateUpdate: {} });
    }

    expect(
      extractors[0]?.extract({
        message: fiveActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(
      extractors[1]?.extract({
        message: fiveActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { origin: 'Sydney' } });
    expect(
      extractors[2]?.extract({
        message: fiveActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { departureDate: '2026-08-28' } });
    expect(
      extractors[3]?.extract({
        message: fiveActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractors[4]?.extract({
        message: fiveActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { adultCount: 2 } });

    const returnActiveMessage = 'Return on 31 August 2026';
    expect(
      extractors[3]?.extract({
        message: returnActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: { returnDate: '2026-08-31' } });
    expect(
      extractors[4]?.extract({
        message: returnActiveMessage,
        currentState,
      }),
    ).toEqual({ stateUpdate: {} });

    for (let index = 5; index < extractors.length; index += 1) {
      expect(
        extractors[index]?.extract({
          message: returnActiveMessage,
          currentState,
        }),
        `extractor ${index} on return message`,
      ).toEqual({ stateUpdate: {} });
    }
  });
});
