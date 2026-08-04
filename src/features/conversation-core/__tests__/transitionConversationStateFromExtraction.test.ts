import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as conversationCore from '../index';
import * as applyModule from '../applyConversationStateUpdate';
import type { AppliedConversationTravelState } from '../applyConversationStateUpdate';
import * as extractModule from '../extractConversationState';
import * as changeModule from '../hasConversationStateUpdateChanged';
import {
  transitionConversationStateFromExtraction,
  type TransitionConversationStateFromExtractionInput,
  type TransitionConversationStateFromExtractionResult,
} from '../transitionConversationStateFromExtraction';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateExtractionResult,
} from '../types';

const ROOT = process.cwd();
const TRANSITION_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/transitionConversationStateFromExtraction.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5h',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 5,
    updatedAt: '2026-07-29T00:00:10.000Z',
    ageMs: 10000,
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
    restaurantPreference: null,
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
    eventsFestivalsRequested: false,
    wildlifeRequested: false,
    nationalParksRequested: false,
    toursRequested: true,
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

function travelFrom(state: ConversationCoreState): AppliedConversationTravelState {
  return {
    destination: state.destination,
    origin: state.origin,
    tripStructure: state.tripStructure,
    destinationStops: state.destinationStops,
    tripLegs: state.tripLegs,
    departureDate: state.departureDate,
    returnDate: state.returnDate,
    adultCount: state.adultCount,
    childCount: state.childCount,
    infantCount: state.infantCount,
    flightsRequested: state.flightsRequested,
    accommodationRequested: state.accommodationRequested,
    carHireRequested: state.carHireRequested,
    activitiesRequested: state.activitiesRequested,
    restaurantsRequested: state.restaurantsRequested,
    restaurantPreference: state.restaurantPreference,
    nearbyDiscoveryRequested: state.nearbyDiscoveryRequested,
    beachesRequested: state.beachesRequested,
    campingRequested: state.campingRequested,
    kayakingRequested: state.kayakingRequested,
    fourWheelDriveRequested: state.fourWheelDriveRequested,
    scenicDrivesRequested: state.scenicDrivesRequested,
    attractionsRequested: state.attractionsRequested,
    snowActivitiesRequested: state.snowActivitiesRequested,
    hikingWalkingRequested: state.hikingWalkingRequested,
    fishingRequested: state.fishingRequested,
    divingSnorkellingRequested: state.divingSnorkellingRequested,
    wineriesFoodTrailsRequested: state.wineriesFoodTrailsRequested,
    eventsFestivalsRequested: state.eventsFestivalsRequested,
    wildlifeRequested: state.wildlifeRequested,
    nationalParksRequested: state.nationalParksRequested,
    toursRequested: state.toursRequested,

    nightlifeRequested: state.nightlifeRequested,
    shoppingRequested: state.shoppingRequested,
    wellnessRequested: state.wellnessRequested,
    familyActivitiesRequested: state.familyActivitiesRequested,
    accessibleTravelRequested: state.accessibleTravelRequested,
    conversationComplete: state.conversationComplete,
    searchExecutionRequested: state.searchExecutionRequested,
    amendmentResumeSearchReady: state.amendmentResumeSearchReady,
    openClarification: state.openClarification,
    destinationResolutionStatus: state.destinationResolutionStatus,
    originResolutionStatus: state.originResolutionStatus,
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

describe('phase 5H — transitionConversationStateFromExtraction only', () => {
  it('accepts exactly one argument with only message and currentState', () => {
    expectTypeOf(transitionConversationStateFromExtraction).parameters.toEqualTypeOf<
      [TransitionConversationStateFromExtractionInput]
    >();
    expectTypeOf<TransitionConversationStateFromExtractionInput>().toEqualTypeOf<{
      message: string;
      currentState: ConversationCoreState;
    }>();
    expectTypeOf<
      keyof TransitionConversationStateFromExtractionInput
    >().toEqualTypeOf<'message' | 'currentState'>();
  });

  it('returns only extractionResult, hasStateChanged, and nextState', () => {
    expectTypeOf(transitionConversationStateFromExtraction).returns.toEqualTypeOf<TransitionConversationStateFromExtractionResult>();
    expectTypeOf<
      keyof TransitionConversationStateFromExtractionResult
    >().toEqualTypeOf<
      'extractionResult' | 'hasStateChanged' | 'nextState'
    >();
    expectTypeOf<
      TransitionConversationStateFromExtractionResult['extractionResult']
    >().toEqualTypeOf<ConversationStateExtractionResult>();
    expectTypeOf<
      TransitionConversationStateFromExtractionResult['nextState']
    >().toEqualTypeOf<ConversationCoreState>();
  });

  it('returns empty extraction, false change, and preserved canonical state', () => {
    const currentState = createState();
    const result = transitionConversationStateFromExtraction({
      message: 'Plan something fun',
      currentState,
    });

    expect(result.extractionResult).toEqual({ stateUpdate: {} });
    expect(result.hasStateChanged).toBe(false);
    expect(result.nextState).toEqual(currentState);
    expect(Object.keys(result).sort()).toEqual([
      'extractionResult',
      'hasStateChanged',
      'nextState',
    ]);
  });

  it('applies explicit destination and adult-count cues while preserving origin, dates, and other traveller counts', () => {
    const currentState = createState();
    const { nextState, hasStateChanged, extractionResult } =
      transitionConversationStateFromExtraction({
        message: 'Change destination to Cairns for three adults',
        currentState,
      });

    expect(extractionResult).toEqual({
      stateUpdate: { destination: 'Cairns', adultCount: 3 },
    });
    expect(hasStateChanged).toBe(true);
    expect(nextState.destination).toBe('Cairns');
    expect(nextState.origin).toBe('Sydney');
    expect(nextState.departureDate).toBe('2026-08-15');
    expect(nextState.returnDate).toBe('2026-08-22');
    expect(nextState.adultCount).toBe(3);
    expect(nextState.childCount).toBe(1);
    expect(nextState.infantCount).toBe(0);
  });

  it('preserves service, discovery, and activity-request flags', () => {
    const currentState = createState();
    const { nextState } = transitionConversationStateFromExtraction({
      message: 'Book flights, beaches, camping and nightlife',
      currentState,
    });

    expect(nextState.flightsRequested).toBe(true);
    expect(nextState.accommodationRequested).toBe(true);
    expect(nextState.carHireRequested).toBe(false);
    expect(nextState.activitiesRequested).toBe(true);
    expect(nextState.restaurantsRequested).toBe(false);
    expect(nextState.nearbyDiscoveryRequested).toBe(true);
    expect(nextState.beachesRequested).toBe(true);
    expect(nextState.campingRequested).toBe(true);
    expect(nextState.kayakingRequested).toBe(true);
    expect(nextState.fourWheelDriveRequested).toBe(false);
    expect(nextState.scenicDrivesRequested).toBe(true);
    expect(nextState.attractionsRequested).toBe(false);
    expect(nextState.toursRequested).toBe(true);
        expect(nextState.nightlifeRequested).toBe(true);
    expect(nextState.shoppingRequested).toBe(false);
    expect(nextState.wellnessRequested).toBe(true);
    expect(nextState.familyActivitiesRequested).toBe(false);
    expect(nextState.accessibleTravelRequested).toBe(true);
  });

  it('preserves identity, lifecycle, and transcript fields', () => {
    const currentState = createState();
    const { nextState } = transitionConversationStateFromExtraction({
      message: 'anything',
      currentState,
    });

    expect(nextState.conversationId).toBe('conversation-5h');
    expect(nextState.status).toBe('active');
    expect(nextState.turnCount).toBe(5);
    expect(nextState.createdAt).toBe(currentState.createdAt);
    expect(nextState.updatedAt).toBe('2026-07-29T00:00:10.000Z');
    expect(nextState.ageMs).toBe(10000);
    expect(nextState.transcript).toEqual(currentState.transcript);
    expect(nextState.transcript).toBe(currentState.transcript);
  });

  it('explicit destination cues update state while unsupported messages do not', () => {
    const currentState = createState({ destination: 'Hobart', origin: 'Melbourne' });
    const created = transitionConversationStateFromExtraction({
      message: 'I want to visit Darwin',
      currentState: createState({ destination: null }),
    });
    const cleared = transitionConversationStateFromExtraction({
      message: 'Forget Hobart',
      currentState,
    });
    const replaced = transitionConversationStateFromExtraction({
      message: 'Actually go to Cairns instead of Hobart',
      currentState,
    });

    expect(created.nextState.destination).toBe('Darwin');
    expect(created.hasStateChanged).toBe(true);
    expect(created.extractionResult).toEqual({
      stateUpdate: { destination: 'Darwin' },
    });
    expect(cleared.nextState.destination).toBe('Hobart');
    expect(cleared.nextState.origin).toBe('Melbourne');
    expect(replaced.nextState.destination).toBe('Cairns');
  });

  it('does not mutate the input wrapper, canonical state, or transcript', () => {
    const currentState = createState();
    const input: TransitionConversationStateFromExtractionInput = {
      message: 'mutate nothing',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript[1]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    expect(() => transitionConversationStateFromExtraction(input)).not.toThrow();
    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
  });

  it('delegates extract → detect → apply once with exact references and order', () => {
    const currentState = createState();
    const input: TransitionConversationStateFromExtractionInput = {
      message: 'delegation probe',
      currentState,
    };
    const extractionResult: ConversationStateExtractionResult = {
      stateUpdate: {},
    };
    const travelResult = travelFrom(currentState);
    const order: string[] = [];

    const extractSpy = vi
      .spyOn(extractModule, 'extractConversationState')
      .mockImplementation((received) => {
        order.push('extract');
        expect(received.message).toBe('delegation probe');
        expect(received.currentState).toBe(currentState);
        return extractionResult;
      });
    const detectSpy = vi
      .spyOn(changeModule, 'hasConversationStateUpdateChanged')
      .mockImplementation((state, update) => {
        order.push('detect');
        expect(state).toBe(currentState);
        expect(update).toBe(extractionResult.stateUpdate);
        return false;
      });
    const applySpy = vi
      .spyOn(applyModule, 'applyConversationStateUpdate')
      .mockImplementation((state, update) => {
        order.push('apply');
        expect(state).toBe(currentState);
        expect(update).toBe(extractionResult.stateUpdate);
        return travelResult;
      });

    const result = transitionConversationStateFromExtraction(input);

    expect(extractSpy).toHaveBeenCalledTimes(1);
    expect(detectSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['extract', 'detect', 'apply']);
    expect(result.extractionResult).toBe(extractionResult);
    expect(result.hasStateChanged).toBe(false);
    expect(result.nextState).toEqual({ ...currentState, ...travelResult });
    expect(result.nextState.destination).toBe(travelResult.destination);
    expect(result.nextState.origin).toBe(travelResult.origin);
  });

  it('still applies when change detection returns false', () => {
    const currentState = createState();
    const extractionResult: ConversationStateExtractionResult = {
      stateUpdate: {},
    };
    const travelResult = travelFrom(currentState);

    vi.spyOn(extractModule, 'extractConversationState').mockReturnValue(
      extractionResult,
    );
    const detectSpy = vi
      .spyOn(changeModule, 'hasConversationStateUpdateChanged')
      .mockReturnValue(false);
    const applySpy = vi
      .spyOn(applyModule, 'applyConversationStateUpdate')
      .mockReturnValue(travelResult);

    const result = transitionConversationStateFromExtraction({
      message: 'no change',
      currentState,
    });

    expect(detectSpy).toHaveBeenCalledTimes(1);
    expect(detectSpy).toHaveReturnedWith(false);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(result.hasStateChanged).toBe(false);
    expect(result.nextState).toEqual({ ...currentState, ...travelResult });
  });

  it('does not call extract-and-apply, factory, or recreate helper logic', () => {
    const source = readFileSync(TRANSITION_SOURCE, 'utf8');

    expect(source).toMatch(/extractConversationState\(/);
    expect(source).toMatch(/hasConversationStateUpdateChanged\(/);
    expect(source).toMatch(/applyConversationStateUpdate\(/);
    expect(source).not.toMatch(/extractAndApplyConversationState/);
    expect(source).not.toMatch(/createConversationStateExtractor/);
    expect(source).not.toMatch(/EmptyConversationStateExtractor/);
    expect(source).not.toMatch(/stateUpdate:\s*\{\s*\}/);
    expect(source).not.toMatch(/JSON\.stringify/);
    expect(source).not.toMatch(/Object\.assign/);
    expect(source).not.toMatch(/destination:/);
    expect(source).not.toMatch(/flightsRequested:/);
  });

  it('retains no state and returns separate objects across calls', () => {
    const firstState = createState({ destination: 'Hobart' });
    const secondState = createState({
      conversationId: 'conversation-5h-b',
      destination: 'Cairns',
      origin: 'Brisbane',
    });

    const first = transitionConversationStateFromExtraction({
      message: 'Go to Perth',
      currentState: firstState,
    });
    expect(first.nextState.destination).toBe('Perth');
    expect(first.hasStateChanged).toBe(true);
    first.nextState.destination = 'mutated';
    first.extractionResult.stateUpdate.destination = 'mutated-update';

    const secondA = transitionConversationStateFromExtraction({
      message: 'message A',
      currentState: secondState,
    });
    const secondB = transitionConversationStateFromExtraction({
      message: 'message B completely different',
      currentState: secondState,
    });

    expect(secondA).not.toBe(secondB);
    expect(secondA.extractionResult).not.toBe(secondB.extractionResult);
    expect(secondA.extractionResult.stateUpdate).not.toBe(
      secondB.extractionResult.stateUpdate,
    );
    expect(secondA.extractionResult).toEqual({ stateUpdate: {} });
    expect(secondB.extractionResult).toEqual({ stateUpdate: {} });
    expect(secondA.hasStateChanged).toBe(false);
    expect(secondB.hasStateChanged).toBe(false);
    expect(secondA.nextState).toEqual(secondState);
    expect(secondB.nextState).toEqual(secondState);
    expect(firstState.destination).toBe('Hobart');
  });

  it('keeps transition and extraction runtime off the public index', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );

    expect(index).not.toMatch(/transitionConversationStateFromExtraction/);
    expect(index).not.toMatch(/TransitionConversationStateFromExtractionInput/);
    expect(index).not.toMatch(/TransitionConversationStateFromExtractionResult/);
    expect(index).not.toMatch(/extractAndApplyConversationState/);
    expect(index).not.toMatch(/extractConversationState/);
    expect(index).not.toMatch(/createConversationStateExtractor/);
    expect(index).not.toMatch(/EmptyConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'transitionConversationStateFromExtraction',
    );
    expect(runtimeExports.filter((name) => /extract|transition/i.test(name))).toEqual(
      [],
    );
    expect(index).not.toMatch(/export function extract/);
    expect(index).not.toMatch(/export function transition/);
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

    expect(processTurn).toMatch(/transitionConversationStateFromExtraction/);
    expect(processTurn).not.toMatch(/extractConversationState/);
    expect(processTurn).not.toMatch(/extractAndApplyConversationState/);
    expect(runtimeExports).toEqual(['processConversationTurn']);
    expect(typeof conversationCore.processConversationTurn).toBe('function');
  });

  it('is imported only by the turn processor outside its own module', () => {
    const allowed = new Set([
      TRANSITION_SOURCE,
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowed.has(path),
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('transitionConversationStateFromExtraction'),
        file,
      ).toBe(false);
    }
  });
});
