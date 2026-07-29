import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as conversationCore from '../index';
import { AccommodationRequestedConversationStateExtractor } from '../AccommodationRequestedConversationStateExtractor';
import { ActivitiesRequestedConversationStateExtractor } from '../ActivitiesRequestedConversationStateExtractor';
import { NearbyDiscoveryRequestedConversationStateExtractor } from '../NearbyDiscoveryRequestedConversationStateExtractor';
import { RestaurantsRequestedConversationStateExtractor } from '../RestaurantsRequestedConversationStateExtractor';
import { AdultCountConversationStateExtractor } from '../AdultCountConversationStateExtractor';
import { BeachesRequestedConversationStateExtractor } from '../BeachesRequestedConversationStateExtractor';
import { CampingRequestedConversationStateExtractor } from '../CampingRequestedConversationStateExtractor';
import { ChildCountConversationStateExtractor } from '../ChildCountConversationStateExtractor';
import { CarHireRequestedConversationStateExtractor } from '../CarHireRequestedConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from '../DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from '../DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { FlightsRequestedConversationStateExtractor } from '../FlightsRequestedConversationStateExtractor';
import { FourWheelDrivingRequestedConversationStateExtractor } from '../FourWheelDrivingRequestedConversationStateExtractor';
import { InfantCountConversationStateExtractor } from '../InfantCountConversationStateExtractor';
import { KayakingRequestedConversationStateExtractor } from '../KayakingRequestedConversationStateExtractor';
import { OriginConversationStateExtractor } from '../OriginConversationStateExtractor';
import { ReturnDateConversationStateExtractor } from '../ReturnDateConversationStateExtractor';
import { ScenicDrivesRequestedConversationStateExtractor } from '../ScenicDrivesRequestedConversationStateExtractor';
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

  it('separate factory calls return separate composites with destination, origin, departure-date, return-date, adult-count, child-count, infant-count, flights-requested, accommodation-requested, car-hire-requested, activities-requested, restaurants-requested, nearby-discovery-requested, beaches-requested, camping-requested, kayaking-requested, four-wheel-driving-requested, scenic-drives-requested, then empty extractors', () => {
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
    expect(firstExtractors).toHaveLength(19);
    expect(secondExtractors).toHaveLength(19);
    expect(firstExtractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(firstExtractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(firstExtractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(firstExtractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(firstExtractors[4]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(firstExtractors[5]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(firstExtractors[6]).toBeInstanceOf(InfantCountConversationStateExtractor);
    expect(firstExtractors[7]).toBeInstanceOf(FlightsRequestedConversationStateExtractor);
    expect(firstExtractors[8]).toBeInstanceOf(
      AccommodationRequestedConversationStateExtractor,
    );
    expect(firstExtractors[9]).toBeInstanceOf(CarHireRequestedConversationStateExtractor);
    expect(firstExtractors[10]).toBeInstanceOf(
      ActivitiesRequestedConversationStateExtractor,
    );
    expect(firstExtractors[11]).toBeInstanceOf(
      RestaurantsRequestedConversationStateExtractor,
    );
    expect(firstExtractors[12]).toBeInstanceOf(
      NearbyDiscoveryRequestedConversationStateExtractor,
    );
    expect(firstExtractors[13]).toBeInstanceOf(
      BeachesRequestedConversationStateExtractor,
    );
    expect(firstExtractors[14]).toBeInstanceOf(
      CampingRequestedConversationStateExtractor,
    );
    expect(firstExtractors[15]).toBeInstanceOf(
      KayakingRequestedConversationStateExtractor,
    );
    expect(firstExtractors[16]).toBeInstanceOf(
      FourWheelDrivingRequestedConversationStateExtractor,
    );
    expect(firstExtractors[17]).toBeInstanceOf(
      ScenicDrivesRequestedConversationStateExtractor,
    );
    expect(firstExtractors[18]).toBeInstanceOf(EmptyConversationStateExtractor);
    expect(secondExtractors[0]).toBeInstanceOf(DestinationConversationStateExtractor);
    expect(secondExtractors[1]).toBeInstanceOf(OriginConversationStateExtractor);
    expect(secondExtractors[2]).toBeInstanceOf(DepartureDateConversationStateExtractor);
    expect(secondExtractors[3]).toBeInstanceOf(ReturnDateConversationStateExtractor);
    expect(secondExtractors[4]).toBeInstanceOf(AdultCountConversationStateExtractor);
    expect(secondExtractors[5]).toBeInstanceOf(ChildCountConversationStateExtractor);
    expect(secondExtractors[6]).toBeInstanceOf(InfantCountConversationStateExtractor);
    expect(secondExtractors[7]).toBeInstanceOf(FlightsRequestedConversationStateExtractor);
    expect(secondExtractors[8]).toBeInstanceOf(
      AccommodationRequestedConversationStateExtractor,
    );
    expect(secondExtractors[9]).toBeInstanceOf(CarHireRequestedConversationStateExtractor);
    expect(secondExtractors[10]).toBeInstanceOf(
      ActivitiesRequestedConversationStateExtractor,
    );
    expect(secondExtractors[11]).toBeInstanceOf(
      RestaurantsRequestedConversationStateExtractor,
    );
    expect(secondExtractors[12]).toBeInstanceOf(
      NearbyDiscoveryRequestedConversationStateExtractor,
    );
    expect(secondExtractors[13]).toBeInstanceOf(
      BeachesRequestedConversationStateExtractor,
    );
    expect(secondExtractors[14]).toBeInstanceOf(
      CampingRequestedConversationStateExtractor,
    );
    expect(secondExtractors[15]).toBeInstanceOf(
      KayakingRequestedConversationStateExtractor,
    );
    expect(secondExtractors[16]).toBeInstanceOf(
      FourWheelDrivingRequestedConversationStateExtractor,
    );
    expect(secondExtractors[17]).toBeInstanceOf(
      ScenicDrivesRequestedConversationStateExtractor,
    );
    expect(secondExtractors[18]).toBeInstanceOf(EmptyConversationStateExtractor);
    expect(firstExtractors[0]).not.toBe(secondExtractors[0]);
    expect(firstExtractors[1]).not.toBe(secondExtractors[1]);
    expect(firstExtractors[2]).not.toBe(secondExtractors[2]);
    expect(firstExtractors[3]).not.toBe(secondExtractors[3]);
    expect(firstExtractors[4]).not.toBe(secondExtractors[4]);
    expect(firstExtractors[5]).not.toBe(secondExtractors[5]);
    expect(firstExtractors[6]).not.toBe(secondExtractors[6]);
    expect(firstExtractors[7]).not.toBe(secondExtractors[7]);
    expect(firstExtractors[8]).not.toBe(secondExtractors[8]);
    expect(firstExtractors[9]).not.toBe(secondExtractors[9]);
    expect(firstExtractors[10]).not.toBe(secondExtractors[10]);
    expect(firstExtractors[11]).not.toBe(secondExtractors[11]);
    expect(firstExtractors[12]).not.toBe(secondExtractors[12]);
    expect(firstExtractors[13]).not.toBe(secondExtractors[13]);
    expect(firstExtractors[14]).not.toBe(secondExtractors[14]);
    expect(firstExtractors[15]).not.toBe(secondExtractors[15]);
    expect(firstExtractors[16]).not.toBe(secondExtractors[16]);
    expect(firstExtractors[17]).not.toBe(secondExtractors[17]);
    expect(firstExtractors[18]).not.toBe(secondExtractors[18]);
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
      /return new CompositeConversationStateExtractor\(\[\s*new DestinationConversationStateExtractor\(\),\s*new OriginConversationStateExtractor\(\),\s*new DepartureDateConversationStateExtractor\(\),\s*new ReturnDateConversationStateExtractor\(\),\s*new AdultCountConversationStateExtractor\(\),\s*new ChildCountConversationStateExtractor\(\),\s*new InfantCountConversationStateExtractor\(\),\s*new FlightsRequestedConversationStateExtractor\(\),\s*new AccommodationRequestedConversationStateExtractor\(\),\s*new CarHireRequestedConversationStateExtractor\(\),\s*new ActivitiesRequestedConversationStateExtractor\(\),\s*new RestaurantsRequestedConversationStateExtractor\(\),\s*new NearbyDiscoveryRequestedConversationStateExtractor\(\),\s*new BeachesRequestedConversationStateExtractor\(\),\s*new CampingRequestedConversationStateExtractor\(\),\s*new KayakingRequestedConversationStateExtractor\(\),\s*new FourWheelDrivingRequestedConversationStateExtractor\(\),\s*new ScenicDrivesRequestedConversationStateExtractor\(\),\s*new EmptyConversationStateExtractor\(\),\s*\]\);/,
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
    expect(index).not.toMatch(/DepartureDateConversationStateExtractor/);
    expect(index).not.toMatch(/ReturnDateConversationStateExtractor/);
    expect(index).not.toMatch(/AdultCountConversationStateExtractor/);
    expect(index).not.toMatch(/ChildCountConversationStateExtractor/);
    expect(index).not.toMatch(/InfantCountConversationStateExtractor/);
    expect(index).not.toMatch(/FlightsRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/AccommodationRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/CarHireRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/ActivitiesRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/RestaurantsRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/NearbyDiscoveryRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/BeachesRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/CampingRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/KayakingRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/FourWheelDrivingRequestedConversationStateExtractor/);
    expect(index).not.toMatch(/ScenicDrivesRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('createConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('EmptyConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('CompositeConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('DestinationConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('OriginConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty(
      'DepartureDateConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty('ReturnDateConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('AdultCountConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('ChildCountConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty('InfantCountConversationStateExtractor');
    expect(conversationCore).not.toHaveProperty(
      'FlightsRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'AccommodationRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'CarHireRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'ActivitiesRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'RestaurantsRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'NearbyDiscoveryRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'BeachesRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'CampingRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'KayakingRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'FourWheelDrivingRequestedConversationStateExtractor',
    );
    expect(conversationCore).not.toHaveProperty(
      'ScenicDrivesRequestedConversationStateExtractor',
    );
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
    expect(processTurn).not.toMatch(/DepartureDateConversationStateExtractor/);
    expect(processTurn).not.toMatch(/ReturnDateConversationStateExtractor/);
    expect(processTurn).not.toMatch(/AdultCountConversationStateExtractor/);
    expect(processTurn).not.toMatch(/ChildCountConversationStateExtractor/);
    expect(processTurn).not.toMatch(/InfantCountConversationStateExtractor/);
    expect(processTurn).not.toMatch(/FlightsRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/AccommodationRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/CarHireRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/ActivitiesRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/RestaurantsRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/NearbyDiscoveryRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/BeachesRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/CampingRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/KayakingRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/FourWheelDrivingRequestedConversationStateExtractor/);
    expect(processTurn).not.toMatch(/ScenicDrivesRequestedConversationStateExtractor/);
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
      resolve(
        ROOT,
        'src/features/conversation-core/DepartureDateConversationStateExtractor.ts',
      ),
      resolve(ROOT, 'src/features/conversation-core/ReturnDateConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/AdultCountConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/ChildCountConversationStateExtractor.ts'),
      resolve(ROOT, 'src/features/conversation-core/InfantCountConversationStateExtractor.ts'),
      resolve(
        ROOT,
        'src/features/conversation-core/FlightsRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/AccommodationRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/CarHireRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/ActivitiesRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/RestaurantsRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/NearbyDiscoveryRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/BeachesRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/CampingRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/KayakingRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/FourWheelDrivingRequestedConversationStateExtractor.ts',
      ),
      resolve(
        ROOT,
        'src/features/conversation-core/ScenicDrivesRequestedConversationStateExtractor.ts',
      ),
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
      expect(src.includes('DepartureDateConversationStateExtractor'), file).toBe(false);
      expect(src.includes('ReturnDateConversationStateExtractor'), file).toBe(false);
      expect(src.includes('AdultCountConversationStateExtractor'), file).toBe(false);
      expect(src.includes('ChildCountConversationStateExtractor'), file).toBe(false);
      expect(src.includes('InfantCountConversationStateExtractor'), file).toBe(false);
      expect(src.includes('FlightsRequestedConversationStateExtractor'), file).toBe(false);
      expect(
        src.includes('AccommodationRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('CarHireRequestedConversationStateExtractor'), file).toBe(
        false,
      );
      expect(
        src.includes('ActivitiesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('RestaurantsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('NearbyDiscoveryRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(src.includes('BeachesRequestedConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('CampingRequestedConversationStateExtractor'), file).toBe(
        false,
      );
      expect(src.includes('KayakingRequestedConversationStateExtractor'), file).toBe(
        false,
      );
      expect(
        src.includes('FourWheelDrivingRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('ScenicDrivesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
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

  it('factory-created extraction remains empty and deterministic for date-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ departureDate: '2026-09-01' });

    expect(
      extractor.extract({ message: 'Leave on 2026-10-15', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'Leave on 2026-10-15', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'Flying next Friday', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for return-date-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ returnDate: '2026-09-08' });

    expect(
      extractor.extract({ message: 'Return on 2026-10-22', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'Return on 2026-10-22', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'Back after 7 nights', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for adult-count-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ adultCount: 2 });

    expect(
      extractor.extract({ message: '2 adults', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: '2 adults', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'my wife and I', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for child-count-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ childCount: 1 });

    expect(
      extractor.extract({ message: '2 children', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: '2 children', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'a 12-year-old', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for infant-count-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ infantCount: 1 });

    expect(
      extractor.extract({ message: '1 infant', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: '1 infant', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'a six-month-old baby', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for flights-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ flightsRequested: true });

    expect(
      extractor.extract({ message: 'I need flights', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'I need flights', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no flights', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for accommodation-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ accommodationRequested: true });

    expect(
      extractor.extract({ message: 'I need accommodation', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'I need accommodation', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no hotel', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for car-hire-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ carHireRequested: true });

    expect(
      extractor.extract({ message: 'I need car hire', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'I need car hire', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no car hire', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for activities-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ activitiesRequested: true });

    expect(
      extractor.extract({ message: 'I need activities', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'I need activities', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no activities', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for restaurants-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ restaurantsRequested: true });

    expect(
      extractor.extract({ message: 'I need restaurants', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'I need restaurants', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no restaurants', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for nearby-discovery-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ nearbyDiscoveryRequested: true });

    expect(
      extractor.extract({ message: 'show me what is nearby', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'show me what is nearby', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no nearby discovery', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for beaches-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ beachesRequested: true });

    expect(
      extractor.extract({ message: 'show me beaches', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'show me beaches', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no beaches', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for camping-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ campingRequested: true });

    expect(
      extractor.extract({ message: 'show me camping options', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'show me camping options', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no camping', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for kayaking-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ kayakingRequested: true });

    expect(
      extractor.extract({ message: 'show me kayaking', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'show me kayaking', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no kayaking', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for four-wheel-driving-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ fourWheelDriveRequested: true });

    expect(
      extractor.extract({ message: 'show me 4WD tracks', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'show me 4WD tracks', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no 4WD', currentState }),
    ).toEqual({ stateUpdate: {} });
  });

  it('factory-created extraction remains empty and deterministic for scenic-drives-requested-like text', () => {
    const extractor = createConversationStateExtractor();
    const currentState = createState({ scenicDrivesRequested: true });

    expect(
      extractor.extract({ message: 'show me scenic drives', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'show me scenic drives', currentState }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({ message: 'no scenic drives', currentState }),
    ).toEqual({ stateUpdate: {} });
  });
});
