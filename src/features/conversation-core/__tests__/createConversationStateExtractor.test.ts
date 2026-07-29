import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as conversationCore from '../index';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
  type ConversationStateExtractor,
} from '../types';

const ROOT = process.cwd();

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5e',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    ...overrides,
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

describe('phase 5E/5J — createConversationStateExtractor factory', () => {
  it('accepts no arguments', () => {
    expectTypeOf(createConversationStateExtractor).parameters.toEqualTypeOf<[]>([]);
    expectTypeOf(createConversationStateExtractor).returns.toEqualTypeOf<ConversationStateExtractor>();
  });

  it('returns a CompositeConversationStateExtractor implementing the contract', () => {
    const extractor = createConversationStateExtractor();
    expectTypeOf(extractor).toMatchTypeOf<ConversationStateExtractor>();
    expect(extractor).toBeInstanceOf(CompositeConversationStateExtractor);
    expect(typeof extractor.extract).toBe('function');
  });

  it('returned extractor accepts ConversationStateExtractionInput and returns empty update', () => {
    const extractor = createConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'Plan a trip to Tasmania',
      currentState: createState(),
    };

    expectTypeOf(extractor.extract).parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('different message text still produces the same empty result', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState();

    expect(
      extractor.extract({ message: 'Sydney to Melbourne', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'Cancel everything', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('different canonical state still produces the same empty result', () => {
    const extractor = createConversationStateExtractor();

    expect(
      extractor.extract({ message: 'hello', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'hello',
        currentState: createState({
          destination: 'Hobart',
          origin: 'Melbourne',
          adultCount: 3,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('separate factory calls return separate composites with destination, origin, then empty extractors', () => {
    const first = createConversationStateExtractor();
    const second = createConversationStateExtractor();

    expect(first).not.toBe(second);
    expect(first).toBeInstanceOf(CompositeConversationStateExtractor);
    expect(second).toBeInstanceOf(CompositeConversationStateExtractor);

    const firstExtractors = readExtractors(
      first as CompositeConversationStateExtractor,
    );
    const secondExtractors = readExtractors(
      second as CompositeConversationStateExtractor,
    );

    expect(firstExtractors).not.toBe(secondExtractors);
    expect(firstExtractors).toHaveLength(3);
    expect(secondExtractors).toHaveLength(3);
    expect(firstExtractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(firstExtractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(firstExtractors[2]).toBeInstanceOf(EmptyConversationStateExtractor);
    expect(secondExtractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(secondExtractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(secondExtractors[2]).toBeInstanceOf(EmptyConversationStateExtractor);
    expect(firstExtractors[0]).not.toBe(secondExtractors[0]);
    expect(firstExtractors[1]).not.toBe(secondExtractors[1]);
    expect(firstExtractors[2]).not.toBe(secondExtractors[2]);
  });

  it('extractor instances do not share state', () => {
    const first = createConversationStateExtractor() as CompositeConversationStateExtractor & {
      retained?: string;
    };
    const second = createConversationStateExtractor() as CompositeConversationStateExtractor & {
      retained?: string;
    };

    first.retained = 'first-only';
    expect(second.retained).toBeUndefined();

    const firstResult = first.extract({
      message: 'Go to Brisbane',
      currentState: createState({ destination: 'Sydney' }),
    });
    firstResult.stateUpdate.destination = 'mutated';

    const secondResult = second.extract({
      message: 'Go to Cairns',
      currentState: createState({ destination: 'Melbourne' }),
    });

    expect(secondResult).toEqual({ stateUpdate: {} });
    expect(secondResult.stateUpdate).not.toHaveProperty('destination');
  });

  it('results and stateUpdate objects from separate extractors are separate', () => {
    const first = createConversationStateExtractor();
    const second = createConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'anything',
      currentState: createState(),
    };

    const firstResult = first.extract(input);
    const secondResult = second.extract(input);

    expect(firstResult).not.toBe(secondResult);
    expect(firstResult.stateUpdate).not.toBe(secondResult.stateUpdate);
    expect(firstResult).toEqual({ stateUpdate: {} });
    expect(secondResult).toEqual({ stateUpdate: {} });
  });

  it('retains no input or extraction result and uses fixed composite construction', () => {
    const factorySource = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      'utf8',
    );

    expect(factorySource).toMatch(
      /export function createConversationStateExtractor\(\): ConversationStateExtractor/,
    );
    expect(factorySource).toMatch(
      /return new CompositeConversationStateExtractor\(\[\s*new DestinationConversationStateExtractor\(\),\s*new OriginConversationStateExtractor\(\),\s*new EmptyConversationStateExtractor\(\),\s*\]\);/,
    );
    expect(factorySource).not.toMatch(/let |var |cache|singleton|Map\(|WeakMap|registry/);
    expect(factorySource).not.toMatch(/process\.env|import\.meta\.env|featureFlag/);
    expect(factorySource).not.toMatch(/=\s*createConversationStateExtractor\(/);

    const extractor = createConversationStateExtractor();
    const result = extractor.extract({
      message: 'remember this',
      currentState: createState({ destination: 'Perth' }),
    });
    result.stateUpdate.origin = 'should not leak';

    expect(
      createConversationStateExtractor().extract({
        message: 'fresh call',
        currentState: createState(),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('keeps factory and extractor implementation off the public index', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );

    expect(index).not.toMatch(/createConversationStateExtractor/);
    expect(index).not.toMatch(/EmptyConversationStateExtractor/);
    expect(index).not.toMatch(/CompositeConversationStateExtractor/);
    expect(index).not.toMatch(/DestinationConversationStateExtractor/);
    expect(index).not.toMatch(/OriginConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('createConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('EmptyConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('CompositeConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('DestinationConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('OriginConversationStateExtractor');
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);
    expect(index).not.toMatch(/export function extract/);
    expect(conversationCore).not.toHaveProperty('defaultExtractor');
    expect(conversationCore).not.toHaveProperty('conversationStateExtractor');
  });

  it('keeps processConversationTurn as the only public runtime processor', () => {
    const processTurn = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
          'function' && name !== 'createInitialConversationCoreState',
    );

    expect(processTurn).not.toMatch(/createConversationStateExtractor/);
    expect(processTurn).not.toMatch(/EmptyConversationStateExtractor/);
    expect(processTurn).not.toMatch(/CompositeConversationStateExtractor/);
    expect(processTurn).not.toMatch(/DestinationConversationStateExtractor/);
    expect(processTurn).not.toMatch(/OriginConversationStateExtractor/);
    expect(runtimeExports).toEqual(['processConversationTurn']);
    expect(typeof conversationCore.processConversationTurn).toBe('function');
  });

  it('is not imported by application or processor files', () => {
    const allowed = new Set([
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/emptyConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/CompositeConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/DestinationConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/OriginConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/extractConversationState.ts'),
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowed.has(path),
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('createConversationStateExtractor'), file).toBe(false);
      expect(src.includes('EmptyConversationStateExtractor'), file).toBe(false);
      expect(src.includes('emptyConversationStateExtractor'), file).toBe(false);
      expect(src.includes('CompositeConversationStateExtractor'), file).toBe(false);
      expect(src.includes('DestinationConversationStateExtractor'), file).toBe(false);
      expect(src.includes('OriginConversationStateExtractor'), file).toBe(false);
    }
  });

  it('factory-created extraction remains empty and deterministic for origin-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ origin: 'Melbourne' });

    expect(
      extractor.extract({ message: 'I am flying from Sydney', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'I am flying from Sydney', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'Leaving from Cairns', currentState }),
    ).toEqual({ stateUpdate: {} });
  });
});
