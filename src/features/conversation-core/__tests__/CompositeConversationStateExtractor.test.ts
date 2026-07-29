import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as conversationCore from '../index';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
  type ConversationStateExtractionResult,
  type ConversationStateExtractor,
  type ConversationStateUpdate,
} from '../index';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';

const ROOT = process.cwd();
const COMPOSITE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/CompositeConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5j',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 1,
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

function stubExtractor(
  stateUpdate: ConversationStateUpdate,
  onExtract?: (input: ConversationStateExtractionInput) => void,
): ConversationStateExtractor {
  return {
    extract(input) {
      onExtract?.(input);
      return { stateUpdate: { ...stateUpdate } };
    },
  };
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

describe('phase 5J — CompositeConversationStateExtractor boundary', () => {
  it('implements ConversationStateExtractor and accepts a readonly sequence', () => {
    expectTypeOf<CompositeConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<CompositeConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<CompositeConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractors: readonly ConversationStateExtractor[] = [
      new EmptyConversationStateExtractor(),
    ];
    const composite = new CompositeConversationStateExtractor(extractors);
    expect(composite).toBeInstanceOf(CompositeConversationStateExtractor);
    expect(readExtractors(composite)).toBe(extractors);
  });

  it('returns empty update for empty sequence and for a single empty extractor', () => {
    const input: ConversationStateExtractionInput = {
      message: 'Plan a trip',
      currentState: createState(),
    };

    expect(new CompositeConversationStateExtractor([]).extract(input)).toEqual({
      stateUpdate: {},
    });
    expect(
      new CompositeConversationStateExtractor([
        new EmptyConversationStateExtractor(),
      ]).extract(input),
    ).toEqual({ stateUpdate: {} });
  });

  it('calls every configured extractor once in order with the original input', () => {
    const input: ConversationStateExtractionInput = {
      message: 'order probe',
      currentState: createState(),
    };
    const order: string[] = [];
    const first = stubExtractor({ destination: 'Brisbane' }, (received) => {
      order.push('first');
      expect(received).toBe(input);
    });
    const second = stubExtractor({ origin: 'Sydney' }, (received) => {
      order.push('second');
      expect(received).toBe(input);
    });
    const firstExtract = vi.spyOn(first, 'extract');
    const secondExtract = vi.spyOn(second, 'extract');

    const result = new CompositeConversationStateExtractor([
      first,
      second,
    ]).extract(input);

    expect(order).toEqual(['first', 'second']);
    expect(firstExtract).toHaveBeenCalledTimes(1);
    expect(secondExtract).toHaveBeenCalledTimes(1);
    expect(firstExtract).toHaveBeenCalledWith(input);
    expect(secondExtract).toHaveBeenCalledWith(input);
    expect(result).toEqual({
      stateUpdate: {
        destination: 'Brisbane',
        origin: 'Sydney',
      },
    });
  });

  it('merges updates with later-extractor precedence including null and false', () => {
    const input: ConversationStateExtractionInput = {
      message: 'merge probe',
      currentState: createState(),
    };

    const merged = new CompositeConversationStateExtractor([
      stubExtractor({
        destination: 'Brisbane',
        origin: 'Melbourne',
        departureDate: '2026-09-01',
        returnDate: '2026-09-08',
        adultCount: 2,
        childCount: 1,
        flightsRequested: true,
        accommodationRequested: false,
        nearbyDiscoveryRequested: true,
        beachesRequested: true,
      }),
      stubExtractor({
        destination: 'Sydney',
        origin: 'Hobart',
        departureDate: '2026-10-01',
        returnDate: '2026-10-10',
        adultCount: 3,
        childCount: 0,
        flightsRequested: false,
        accommodationRequested: true,
        nearbyDiscoveryRequested: false,
        beachesRequested: false,
        carHireRequested: true,
      }),
    ]).extract(input);

    expect(merged.stateUpdate).toEqual({
      destination: 'Sydney',
      origin: 'Hobart',
      departureDate: '2026-10-01',
      returnDate: '2026-10-10',
      adultCount: 3,
      childCount: 0,
      flightsRequested: false,
      accommodationRequested: true,
      nearbyDiscoveryRequested: false,
      beachesRequested: false,
      carHireRequested: true,
    });

    const nullAndFalse = new CompositeConversationStateExtractor([
      stubExtractor({
        destination: 'Brisbane',
        flightsRequested: true,
      }),
      stubExtractor({
        destination: null,
        flightsRequested: false,
      }),
    ]).extract(input);

    expect(nullAndFalse.stateUpdate).toEqual({
      destination: null,
      flightsRequested: false,
    });

    const omittedPreservesEarlier = new CompositeConversationStateExtractor([
      stubExtractor({
        destination: 'Brisbane',
        flightsRequested: true,
        accommodationRequested: true,
      }),
      stubExtractor({
        destination: 'Sydney',
      }),
    ]).extract(input);

    expect(omittedPreservesEarlier.stateUpdate).toEqual({
      destination: 'Sydney',
      flightsRequested: true,
      accommodationRequested: true,
    });
  });

  it('does not apply updates to canonical state or call apply/change-detection helpers', () => {
    const source = readFileSync(COMPOSITE_SOURCE, 'utf8');
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
      message: 'Do not mutate',
      currentState,
    };
    const before = structuredClone(input);
    const childUpdate: ConversationStateUpdate = { destination: 'Cairns' };
    const childResult: ConversationStateExtractionResult = {
      stateUpdate: childUpdate,
    };
    const child: ConversationStateExtractor = {
      extract: () => childResult,
    };

    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);
    Object.freeze(childUpdate);
    Object.freeze(childResult);

    const result = new CompositeConversationStateExtractor([child]).extract(input);

    expect(result.stateUpdate).toEqual({ destination: 'Cairns' });
    expect(result.stateUpdate).not.toBe(childUpdate);
    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(childResult).toEqual({ stateUpdate: { destination: 'Cairns' } });
    expect(childUpdate).toEqual({ destination: 'Cairns' });
    expect(currentState.destination).toBe('Brisbane');

    expect(source).not.toMatch(/applyConversationStateUpdate/);
    expect(source).not.toMatch(/hasConversationStateUpdateChanged/);
    expect(source).not.toMatch(/metadata|confidence|warnings/);
  });

  it('returns separate result objects and retains no shared extraction state', () => {
    const composite = new CompositeConversationStateExtractor([
      stubExtractor({ destination: 'Brisbane' }),
    ]);
    const input: ConversationStateExtractionInput = {
      message: 'separate',
      currentState: createState(),
    };

    const first = composite.extract(input);
    const second = composite.extract(input);
    first.stateUpdate.destination = 'mutated';

    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: { destination: 'Brisbane' } });

    const other = new CompositeConversationStateExtractor([
      stubExtractor({ destination: 'Sydney' }),
    ]);
    expect(other.extract(input)).toEqual({
      stateUpdate: { destination: 'Sydney' },
    });
    expect(composite.extract(input)).toEqual({
      stateUpdate: { destination: 'Brisbane' },
    });
  });

  it('is not exported from the public index and is only constructed by the factory', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const factorySource = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      'utf8',
    );
    const allowedConstruct = new Set([
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      COMPOSITE_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/CompositeConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('CompositeConversationStateExtractor');
    expect(factorySource).toMatch(
      /return new CompositeConversationStateExtractor\(\[\s*new DestinationConversationStateExtractor\(\),\s*new OriginConversationStateExtractor\(\),\s*new DepartureDateConversationStateExtractor\(\),\s*new ReturnDateConversationStateExtractor\(\),\s*new AdultCountConversationStateExtractor\(\),\s*new ChildCountConversationStateExtractor\(\),\s*new InfantCountConversationStateExtractor\(\),\s*new FlightsRequestedConversationStateExtractor\(\),\s*new EmptyConversationStateExtractor\(\),\s*\]\);/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('new CompositeConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('CompositeConversationStateExtractor'), file).toBe(false);
    }
  });

  it('production destination-origin-departure-return-adult-child-infant-flights-empty sequence stays empty without altering merge behaviour', () => {
    const input: ConversationStateExtractionInput = {
      message:
        'Flying from Melbourne to Cairns next Friday, back Sunday, 2 adults, 1 child, 1 infant, need flights',
      currentState: createState(),
    };
    const received: ConversationStateExtractionInput[] = [];
    const destination = new DestinationConversationStateExtractor();
    const origin = new OriginConversationStateExtractor();
    const departureDate = new DepartureDateConversationStateExtractor();
    const returnDate = new ReturnDateConversationStateExtractor();
    const adultCount = new AdultCountConversationStateExtractor();
    const childCount = new ChildCountConversationStateExtractor();
    const infantCount = new InfantCountConversationStateExtractor();
    const flightsRequested = new FlightsRequestedConversationStateExtractor();
    const empty = new EmptyConversationStateExtractor();
    const destinationExtract = vi
      .spyOn(destination, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const originExtract = vi
      .spyOn(origin, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const departureDateExtract = vi
      .spyOn(departureDate, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const returnDateExtract = vi
      .spyOn(returnDate, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const adultCountExtract = vi
      .spyOn(adultCount, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const childCountExtract = vi
      .spyOn(childCount, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const infantCountExtract = vi
      .spyOn(infantCount, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const flightsRequestedExtract = vi
      .spyOn(flightsRequested, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });
    const emptyExtract = vi
      .spyOn(empty, 'extract')
      .mockImplementation((receivedInput) => {
        received.push(receivedInput);
        return { stateUpdate: {} };
      });

    const production = new CompositeConversationStateExtractor([
      destination,
      origin,
      departureDate,
      returnDate,
      adultCount,
      childCount,
      infantCount,
      flightsRequested,
      empty,
    ]);
    const first = production.extract(input);
    const second = production.extract(input);

    expect(first).toEqual({ stateUpdate: {} });
    expect(second).toEqual({ stateUpdate: {} });
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(destinationExtract).toHaveBeenCalledTimes(2);
    expect(originExtract).toHaveBeenCalledTimes(2);
    expect(departureDateExtract).toHaveBeenCalledTimes(2);
    expect(returnDateExtract).toHaveBeenCalledTimes(2);
    expect(adultCountExtract).toHaveBeenCalledTimes(2);
    expect(childCountExtract).toHaveBeenCalledTimes(2);
    expect(infantCountExtract).toHaveBeenCalledTimes(2);
    expect(flightsRequestedExtract).toHaveBeenCalledTimes(2);
    expect(emptyExtract).toHaveBeenCalledTimes(2);
    expect(received).toHaveLength(18);
    expect(received.every((value) => value === input)).toBe(true);

    const mergeStillWorks = new CompositeConversationStateExtractor([
      stubExtractor({ destination: 'Brisbane', origin: 'Melbourne' }),
      stubExtractor({ origin: 'Sydney' }),
      stubExtractor({ departureDate: '2026-10-15' }),
      stubExtractor({ returnDate: '2026-10-22' }),
      stubExtractor({ adultCount: 3 }),
      stubExtractor({ childCount: 2 }),
      stubExtractor({ infantCount: 1 }),
      stubExtractor({ flightsRequested: true }),
      stubExtractor({}),
    ]).extract(input);
    expect(mergeStillWorks.stateUpdate).toEqual({
      destination: 'Brisbane',
      origin: 'Sydney',
      departureDate: '2026-10-15',
      returnDate: '2026-10-22',
      adultCount: 3,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
  });

  it('keeps live processor behaviour unchanged under the composite factory', () => {
    const currentState = createState({
      destination: 'Brisbane',
      flightsRequested: true,
    });
    const result = processConversationTurn({
      message: 'Go to Cairns with no flights',
      state: currentState,
      userEntryId: 'user-5j',
      assistantEntryId: 'assistant-5j',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { destination: 'Sydney', flightsRequested: false },
    });

    expect(createConversationStateExtractor().extract({
      message: 'Go to Cairns',
      currentState,
    })).toEqual({ stateUpdate: {} });
    expect(result.state.destination).toBe('Sydney');
    expect(result.state.flightsRequested).toBe(false);
    expect(result.state.origin).toBe('Melbourne');
    expect(result.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(result).sort()).toEqual(['reply', 'state', 'trace']);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });
});
