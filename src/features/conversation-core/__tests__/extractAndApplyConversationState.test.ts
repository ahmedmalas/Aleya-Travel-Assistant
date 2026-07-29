import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as conversationCore from '../index';
import * as applyModule from '../applyConversationStateUpdate';
import type { AppliedConversationTravelState } from '../applyConversationStateUpdate';
import * as extractModule from '../extractConversationState';
import {
  extractAndApplyConversationState,
  type ExtractAndApplyConversationStateInput,
} from '../extractAndApplyConversationState';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateExtractionResult,
} from '../types';

const ROOT = process.cwd();
const ORCHESTRATION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractAndApplyConversationState.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5g',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 4,
    updatedAt: '2026-07-29T00:00:08.000Z',
    ageMs: 8000,
    destination: 'Gold Coast',
    origin: 'Sydney',
    departureDate: '2026-08-15',
    returnDate: '2026-08-22',
    adultCount: 2,
    childCount: 1,
    infantCount: 0,
    flightsRequested: true,
    accommodationRequested: true,
    carHireRequested: false,
    activitiesRequested: true,
    restaurantsRequested: false,
    nearbyDiscoveryRequested: true,
    beachesRequested: true,
    campingRequested: false,
    kayakingRequested: true,
    fourWheelDriveRequested: false,
    scenicDrivesRequested: true,
    attractionsRequested: false,
    snowActivitiesRequested: false,
    hikingWalkingRequested: false,
    fishingRequested: false,
    divingSnorkellingRequested: false,
    wineriesFoodTrailsRequested: false,
    toursRequested: true,
    eventsRequested: false,
    nightlifeRequested: true,
    shoppingRequested: false,
    wellnessRequested: true,
    familyActivitiesRequested: false,
    accessibleTravelRequested: true,
    transcript: [
      {
        id: 'user-1',
        role: 'user',
        message: 'seeded',
        timestamp: '2026-07-29T00:00:01.000Z',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        message: 'placeholder',
        timestamp: '2026-07-29T00:00:02.000Z',
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('phase 5G — extractAndApplyConversationState orchestration only', () => {
  it('accepts exactly one argument with only message and currentState', () => {
    expectTypeOf(extractAndApplyConversationState).parameters.toEqualTypeOf<
      [ExtractAndApplyConversationStateInput]
    >();
    expectTypeOf<ExtractAndApplyConversationStateInput>().toEqualTypeOf<{
      message: string;
      currentState: ConversationCoreState;
    }>();
    expectTypeOf<keyof ExtractAndApplyConversationStateInput>().toEqualTypeOf<
      'message' | 'currentState'
    >();
    expectTypeOf(extractAndApplyConversationState).returns.toEqualTypeOf<ConversationCoreState>();
  });

  it('returns semantically equivalent canonical state when extraction is empty', () => {
    const currentState = createState();
    const result = extractAndApplyConversationState({
      message: 'Plan something fun',
      currentState,
    });

    expect(result).toEqual(currentState);
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('confidence');
    expect(result).not.toHaveProperty('stateUpdate');
  });

  it('applies explicit destination and adult-count cues while preserving origin and dates', () => {
    const currentState = createState();
    const result = extractAndApplyConversationState({
      message: 'Change destination to Cairns for three adults',
      currentState,
    });

    expect(result.destination).toBe('Cairns');
    expect(result.origin).toBe('Sydney');
    expect(result.departureDate).toBe('2026-08-15');
    expect(result.returnDate).toBe('2026-08-22');
    expect(result.adultCount).toBe(3);
  });

  it('applies explicit adult count while preserving other traveller counts and service-request flags', () => {
    const currentState = createState();
    const result = extractAndApplyConversationState({
      message: 'We need three adults and flights only',
      currentState,
    });

    expect(result.adultCount).toBe(3);
    expect(result.childCount).toBe(1);
    expect(result.infantCount).toBe(0);
    expect(result.flightsRequested).toBe(true);
    expect(result.accommodationRequested).toBe(true);
    expect(result.carHireRequested).toBe(false);
    expect(result.activitiesRequested).toBe(true);
    expect(result.restaurantsRequested).toBe(false);
  });

  it('preserves discovery and activity-request flags', () => {
    const currentState = createState();
    const result = extractAndApplyConversationState({
      message: 'Find beaches, camping, kayaking and nightlife',
      currentState,
    });

    expect(result.nearbyDiscoveryRequested).toBe(true);
    expect(result.beachesRequested).toBe(true);
    expect(result.campingRequested).toBe(true);
    expect(result.kayakingRequested).toBe(true);
    expect(result.fourWheelDriveRequested).toBe(false);
    expect(result.scenicDrivesRequested).toBe(true);
    expect(result.attractionsRequested).toBe(false);
    expect(result.toursRequested).toBe(true);
    expect(result.eventsRequested).toBe(false);
    expect(result.nightlifeRequested).toBe(true);
    expect(result.shoppingRequested).toBe(false);
    expect(result.wellnessRequested).toBe(true);
    expect(result.familyActivitiesRequested).toBe(false);
    expect(result.accessibleTravelRequested).toBe(true);
  });

  it('preserves identity, lifecycle, and transcript fields', () => {
    const currentState = createState();
    const result = extractAndApplyConversationState({
      message: 'anything',
      currentState,
    });

    expect(result.conversationId).toBe('conversation-5g');
    expect(result.status).toBe('active');
    expect(result.turnCount).toBe(4);
    expect(result.createdAt).toBe(currentState.createdAt);
    expect(result.updatedAt).toBe('2026-07-29T00:00:08.000Z');
    expect(result.ageMs).toBe(8000);
    expect(result.transcript).toEqual(currentState.transcript);
    expect(result.transcript).toBe(currentState.transcript);
  });

  it('explicit destination cues update state while unsupported messages do not', () => {
    const currentState = createState({ destination: 'Hobart', origin: 'Melbourne' });
    const created = extractAndApplyConversationState({
      message: 'I want to visit Darwin',
      currentState: createState({ destination: null }),
    });
    const cleared = extractAndApplyConversationState({
      message: 'Forget Hobart',
      currentState,
    });
    const replaced = extractAndApplyConversationState({
      message: 'Actually go to Cairns instead of Hobart',
      currentState,
    });

    expect(created.destination).toBe('Darwin');
    expect(cleared.destination).toBe('Hobart');
    expect(cleared.origin).toBe('Melbourne');
    expect(replaced.destination).toBe('Cairns');
  });

  it('does not mutate the input wrapper, canonical state, or transcript', () => {
    const currentState = createState();
    const input: ExtractAndApplyConversationStateInput = {
      message: 'mutate nothing',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript[1]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    expect(() => extractAndApplyConversationState(input)).not.toThrow();
    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
  });

  it('delegates once through extractConversationState and applyConversationStateUpdate', () => {
    const currentState = createState();
    const input: ExtractAndApplyConversationStateInput = {
      message: 'delegation probe',
      currentState,
    };
    const extractionResult: ConversationStateExtractionResult = {
      stateUpdate: {},
    };
    const travelResult: AppliedConversationTravelState = {
      destination: currentState.destination,
      origin: currentState.origin,
      departureDate: currentState.departureDate,
      returnDate: currentState.returnDate,
      adultCount: currentState.adultCount,
      childCount: currentState.childCount,
      infantCount: currentState.infantCount,
      flightsRequested: currentState.flightsRequested,
      accommodationRequested: currentState.accommodationRequested,
      carHireRequested: currentState.carHireRequested,
      activitiesRequested: currentState.activitiesRequested,
      restaurantsRequested: currentState.restaurantsRequested,
      nearbyDiscoveryRequested: currentState.nearbyDiscoveryRequested,
      beachesRequested: currentState.beachesRequested,
      campingRequested: currentState.campingRequested,
      kayakingRequested: currentState.kayakingRequested,
      fourWheelDriveRequested: currentState.fourWheelDriveRequested,
      scenicDrivesRequested: currentState.scenicDrivesRequested,
      attractionsRequested: currentState.attractionsRequested,
      snowActivitiesRequested: currentState.snowActivitiesRequested,
      hikingWalkingRequested: currentState.hikingWalkingRequested,
      fishingRequested: currentState.fishingRequested,
      divingSnorkellingRequested: currentState.divingSnorkellingRequested,
      wineriesFoodTrailsRequested: currentState.wineriesFoodTrailsRequested,
      toursRequested: currentState.toursRequested,
      eventsRequested: currentState.eventsRequested,
      nightlifeRequested: currentState.nightlifeRequested,
      shoppingRequested: currentState.shoppingRequested,
      wellnessRequested: currentState.wellnessRequested,
      familyActivitiesRequested: currentState.familyActivitiesRequested,
      accessibleTravelRequested: currentState.accessibleTravelRequested,
    };

    const extractSpy = vi
      .spyOn(extractModule, 'extractConversationState')
      .mockReturnValue(extractionResult);
    const applySpy = vi
      .spyOn(applyModule, 'applyConversationStateUpdate')
      .mockReturnValue(travelResult);

    const result = extractAndApplyConversationState(input);

    expect(extractSpy).toHaveBeenCalledTimes(1);
    expect(extractSpy).toHaveBeenCalledWith({
      message: 'delegation probe',
      currentState,
    });
    expect(extractSpy.mock.calls[0]?.[0]?.message).toBe(input.message);
    expect(extractSpy.mock.calls[0]?.[0]?.currentState).toBe(currentState);

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(applySpy.mock.calls[0]?.[0]).toBe(currentState);
    expect(applySpy.mock.calls[0]?.[1]).toBe(extractionResult.stateUpdate);

    expect(result).toEqual({ ...currentState, ...travelResult });
    expect(result.destination).toBe(travelResult.destination);
    expect(result.origin).toBe(travelResult.origin);
  });

  it('does not call factory/extractor directly or recreate merge/change-detection logic', () => {
    const source = readFileSync(ORCHESTRATION_SOURCE, 'utf8');

    expect(source).toMatch(/extractConversationState\(/);
    expect(source).toMatch(/applyConversationStateUpdate\(/);
    expect(source).not.toMatch(/createConversationStateExtractor/);
    expect(source).not.toMatch(/EmptyConversationStateExtractor/);
    expect(source).not.toMatch(/hasConversationStateUpdateChanged/);
    expect(source).not.toMatch(/stateUpdate:\s*\{\s*\}/);
    expect(source).not.toMatch(/destination:/);
    expect(source).not.toMatch(/Object\.assign/);
    expect(source).not.toMatch(/flightsRequested:/);
  });

  it('retains no state across separate calls and preserves independent canonical states', () => {
    const firstState = createState({ destination: 'Hobart' });
    const secondState = createState({
      conversationId: 'conversation-5g-b',
      destination: 'Cairns',
      origin: 'Brisbane',
    });

    const first = extractAndApplyConversationState({
      message: 'Go to Perth',
      currentState: firstState,
    });
    expect(first.destination).toBe('Perth');
    first.destination = 'mutated';

    const secondA = extractAndApplyConversationState({
      message: 'message A',
      currentState: secondState,
    });
    const secondB = extractAndApplyConversationState({
      message: 'message B completely different',
      currentState: secondState,
    });

    expect(secondA).toEqual(secondState);
    expect(secondB).toEqual(secondState);
    expect(secondA).toEqual(secondB);
    expect(firstState.destination).toBe('Hobart');
  });

  it('keeps orchestration and extraction runtime off the public index', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );

    expect(index).not.toMatch(/extractAndApplyConversationState/);
    expect(index).not.toMatch(/ExtractAndApplyConversationStateInput/);
    expect(index).not.toMatch(/extractConversationState/);
    expect(index).not.toMatch(/createConversationStateExtractor/);
    expect(index).not.toMatch(/EmptyConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty('extractAndApplyConversationState');
    expect(conversationCore).not.toHaveProperty('ExtractAndApplyConversationStateInput');
    expect(conversationCore).not.toHaveProperty('extractConversationState');
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);
    expect(index).not.toMatch(/export function extract/);
  });

  it('keeps processConversationTurn unchanged as the only public runtime processor', () => {
    const processTurn = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
          'function' && name !== 'createInitialConversationCoreState',
    );

    expect(processTurn).not.toMatch(/extractAndApplyConversationState/);
    expect(processTurn).not.toMatch(/extractConversationState/);
    expect(runtimeExports).toEqual(['processConversationTurn']);
    expect(typeof conversationCore.processConversationTurn).toBe('function');
  });

  it('is not imported by processor or application files', () => {
    const allowed = new Set([ORCHESTRATION_SOURCE]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowed.has(path),
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('extractAndApplyConversationState'), file).toBe(false);
    }
  });
});
