import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

describe('conversation-core architectural boundary', () => {
  it('visible chat → public index → processConversationTurn → canonical empty state', () => {
    const panel = readSrc('src/components/trip-platform/AiPlanningPanel.tsx');
    const index = readSrc('src/features/conversation-core/index.ts');
    const processTurn = readSrc('src/features/conversation-core/processTurn.ts');
    const types = readSrc('src/features/conversation-core/types.ts');

    expect(panel).toMatch(
      /from ['"]\.\.\/\.\.\/features\/conversation-core['"]/,
    );
    expect(panel).toMatch(/processConversationTurn/);
    expect(panel).toMatch(/createInitialConversationCoreState/);
    expect(panel.includes('processTurn')).toBe(false);
    expect(panel.includes("from '../../features/conversation-core/types'")).toBe(
      false,
    );

    expect(index).toMatch(/createInitialConversationCoreState/);
    expect(index).toMatch(/processConversationTurn/);
    expect(processTurn).toMatch(/export function processConversationTurn/);
    expect(types).toMatch(/export function createInitialConversationCoreState/);
    expect(types).toMatch(/status: 'empty'/);
    expect(types).toMatch(/ConversationCoreStatus = 'empty' \| 'active'/);
    expect(processTurn).toMatch(/status: 'active'/);
    expect(types).toMatch(/turnCount: number/);
    expect(types).toMatch(/turnCount: 0,/);
    expect(types).toMatch(/ageMs: number/);
    expect(types).toMatch(/ageMs: 0,/);
    expect(processTurn).toMatch(
      /assistantMessageAt\.getTime\(\) - new Date\(base\.createdAt\)\.getTime\(\)/,
    );
    expect(types).toMatch(/destination: string \| null/);
    expect(types).toMatch(/destination: null,/);
    expect(types).toMatch(/export type ConversationStateUpdate/);
    expect(types).toMatch(/destination\?: string \| null/);
    expect(types).toMatch(/origin\?: string \| null/);
    expect(types).toMatch(/departureDate\?: string \| null/);
    expect(types).toMatch(/returnDate\?: string \| null/);
    expect(types).toMatch(/adultCount\?: number \| null/);
    expect(types).toMatch(/childCount\?: number \| null/);
    expect(types).toMatch(/infantCount\?: number \| null/);
    expect(types).toMatch(/flightsRequested\?: boolean \| null/);
    expect(types).toMatch(/accommodationRequested\?: boolean \| null/);
    expect(types).toMatch(/carHireRequested\?: boolean \| null/);
    expect(types).toMatch(/activitiesRequested\?: boolean \| null/);
    expect(types).toMatch(/restaurantsRequested\?: boolean \| null/);
    expect(types).toMatch(/nearbyDiscoveryRequested\?: boolean \| null/);
    expect(types).toMatch(/beachesRequested\?: boolean \| null/);
    expect(types).toMatch(/campingRequested\?: boolean \| null/);
    expect(types).toMatch(/kayakingRequested\?: boolean \| null/);
    expect(types).toMatch(/fourWheelDriveRequested\?: boolean \| null/);
    expect(types).toMatch(/scenicDrivesRequested\?: boolean \| null/);
    expect(types).toMatch(/attractionsRequested\?: boolean \| null/);
    expect(types).toMatch(/toursRequested\?: boolean \| null/);
    expect(types).toMatch(/eventsRequested\?: boolean \| null/);
    expect(types).toMatch(/nightlifeRequested\?: boolean \| null/);
    expect(types).toMatch(/shoppingRequested\?: boolean \| null/);
    expect(types).toMatch(/wellnessRequested\?: boolean \| null/);
    expect(types).toMatch(/familyActivitiesRequested\?: boolean \| null/);
    expect(types).toMatch(/accessibleTravelRequested\?: boolean \| null/);
    expect(processTurn).toMatch(/stateUpdate\?: ConversationStateUpdate/);
    expect(processTurn).toMatch(
      /transitionConversationStateFromExtraction\(\{\s*message: input\.message,\s*currentState: base,\s*\}\)/,
    );
    expect(processTurn).toMatch(
      /hasConversationStateUpdateChanged\(\s*extractionTransition\.nextState,\s*input\.stateUpdate,\s*\)/,
    );
    expect(processTurn).toMatch(
      /applyConversationStateUpdate\(\s*extractionTransition\.nextState,\s*input\.stateUpdate,\s*\)/,
    );
    expect(index.includes('applyConversationStateUpdate')).toBe(false);
    expect(index.includes('hasConversationStateUpdateChanged')).toBe(false);
    expect(index.includes('createConversationStateExtractor')).toBe(false);
    expect(index.includes('EmptyConversationStateExtractor')).toBe(false);
    expect(index.includes('extractConversationState')).toBe(false);
    expect(index.includes('extractAndApplyConversationState')).toBe(false);
    expect(index.includes('transitionConversationStateFromExtraction')).toBe(false);
    expect(processTurn.includes('createConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('EmptyConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('extractConversationState')).toBe(false);
    expect(processTurn.includes('extractAndApplyConversationState')).toBe(false);
    expect(processTurn.includes('transitionConversationStateFromExtraction')).toBe(
      true,
    );
    const applyUpdate = readSrc(
      'src/features/conversation-core/applyConversationStateUpdate.ts',
    );
    const changeDetection = readSrc(
      'src/features/conversation-core/hasConversationStateUpdateChanged.ts',
    );
    expect(applyUpdate).toMatch(/export function applyConversationStateUpdate/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?: ConversationStateUpdate/,
    );
    expect(applyUpdate.includes('message')).toBe(false);
    expect(applyUpdate.includes('transcript')).toBe(false);
    expect(applyUpdate.includes('turnCount')).toBe(false);
    expect(applyUpdate.includes('updatedAt')).toBe(false);
    expect(applyUpdate.includes('status')).toBe(false);
    expect(applyUpdate.includes('ageMs')).toBe(false);
    expect(changeDetection).toMatch(
      /export function hasConversationStateUpdateChanged/,
    );
    expect(changeDetection).toMatch(
      /stateUpdate\?: ConversationStateUpdate/,
    );
    expect(changeDetection.includes('message')).toBe(false);
    expect(changeDetection.includes('transcript')).toBe(false);
    expect(changeDetection.includes('turnCount')).toBe(false);
    expect(changeDetection.includes('updatedAt')).toBe(false);
    expect(changeDetection.includes('status')).toBe(false);
    expect(changeDetection.includes('ageMs')).toBe(false);
    expect(types).toMatch(/origin: string \| null/);
    expect(types).toMatch(/origin: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.destination !== undefined[\s\S]*\? stateUpdate\.destination[\s\S]*: currentState\.destination/,
    );
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.origin !== undefined[\s\S]*\? stateUpdate\.origin[\s\S]*: currentState\.origin/,
    );
    expect(types).toMatch(/departureDate: string \| null/);
    expect(types).toMatch(/departureDate: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.departureDate !== undefined[\s\S]*\? stateUpdate\.departureDate[\s\S]*: currentState\.departureDate/,
    );
    expect(types).toMatch(/returnDate: string \| null/);
    expect(types).toMatch(/returnDate: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.returnDate !== undefined[\s\S]*\? stateUpdate\.returnDate[\s\S]*: currentState\.returnDate/,
    );
    expect(types).toMatch(/adultCount: number \| null/);
    expect(types).toMatch(/adultCount: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.adultCount !== undefined[\s\S]*\? stateUpdate\.adultCount[\s\S]*: currentState\.adultCount/,
    );
    expect(types).toMatch(/childCount: number \| null/);
    expect(types).toMatch(/childCount: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.childCount !== undefined[\s\S]*\? stateUpdate\.childCount[\s\S]*: currentState\.childCount/,
    );
    expect(types).toMatch(/infantCount: number \| null/);
    expect(types).toMatch(/infantCount: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.infantCount !== undefined[\s\S]*\? stateUpdate\.infantCount[\s\S]*: currentState\.infantCount/,
    );
    expect(types).toMatch(/flightsRequested: boolean \| null/);
    expect(types).toMatch(/flightsRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.flightsRequested !== undefined[\s\S]*\? stateUpdate\.flightsRequested[\s\S]*: currentState\.flightsRequested/,
    );
    expect(types).toMatch(/accommodationRequested: boolean \| null/);
    expect(types).toMatch(/accommodationRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.accommodationRequested !== undefined[\s\S]*\? stateUpdate\.accommodationRequested[\s\S]*: currentState\.accommodationRequested/,
    );
    expect(types).toMatch(/carHireRequested: boolean \| null/);
    expect(types).toMatch(/carHireRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.carHireRequested !== undefined[\s\S]*\? stateUpdate\.carHireRequested[\s\S]*: currentState\.carHireRequested/,
    );
    expect(types).toMatch(/activitiesRequested: boolean \| null/);
    expect(types).toMatch(/activitiesRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.activitiesRequested !== undefined[\s\S]*\? stateUpdate\.activitiesRequested[\s\S]*: currentState\.activitiesRequested/,
    );
    expect(types).toMatch(/restaurantsRequested: boolean \| null/);
    expect(types).toMatch(/restaurantsRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.restaurantsRequested !== undefined[\s\S]*\? stateUpdate\.restaurantsRequested[\s\S]*: currentState\.restaurantsRequested/,
    );
    expect(types).toMatch(/nearbyDiscoveryRequested: boolean \| null/);
    expect(types).toMatch(/nearbyDiscoveryRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.nearbyDiscoveryRequested !== undefined[\s\S]*\? stateUpdate\.nearbyDiscoveryRequested[\s\S]*: currentState\.nearbyDiscoveryRequested/,
    );
    expect(types).toMatch(/beachesRequested: boolean \| null/);
    expect(types).toMatch(/beachesRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.beachesRequested !== undefined[\s\S]*\? stateUpdate\.beachesRequested[\s\S]*: currentState\.beachesRequested/,
    );
    expect(types).toMatch(/campingRequested: boolean \| null/);
    expect(types).toMatch(/campingRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.campingRequested !== undefined[\s\S]*\? stateUpdate\.campingRequested[\s\S]*: currentState\.campingRequested/,
    );
    expect(types).toMatch(/kayakingRequested: boolean \| null/);
    expect(types).toMatch(/kayakingRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.kayakingRequested !== undefined[\s\S]*\? stateUpdate\.kayakingRequested[\s\S]*: currentState\.kayakingRequested/,
    );
    expect(types).toMatch(/fourWheelDriveRequested: boolean \| null/);
    expect(types).toMatch(/fourWheelDriveRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.fourWheelDriveRequested !== undefined[\s\S]*\? stateUpdate\.fourWheelDriveRequested[\s\S]*: currentState\.fourWheelDriveRequested/,
    );
    expect(types).toMatch(/scenicDrivesRequested: boolean \| null/);
    expect(types).toMatch(/scenicDrivesRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.scenicDrivesRequested !== undefined[\s\S]*\? stateUpdate\.scenicDrivesRequested[\s\S]*: currentState\.scenicDrivesRequested/,
    );
    expect(types).toMatch(/attractionsRequested: boolean \| null/);
    expect(types).toMatch(/attractionsRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.attractionsRequested !== undefined[\s\S]*\? stateUpdate\.attractionsRequested[\s\S]*: currentState\.attractionsRequested/,
    );
    expect(types).toMatch(/toursRequested: boolean \| null/);
    expect(types).toMatch(/toursRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.toursRequested !== undefined[\s\S]*\? stateUpdate\.toursRequested[\s\S]*: currentState\.toursRequested/,
    );
    expect(types).toMatch(/eventsRequested: boolean \| null/);
    expect(types).toMatch(/eventsRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.eventsRequested !== undefined[\s\S]*\? stateUpdate\.eventsRequested[\s\S]*: currentState\.eventsRequested/,
    );
    expect(types).toMatch(/nightlifeRequested: boolean \| null/);
    expect(types).toMatch(/nightlifeRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.nightlifeRequested !== undefined[\s\S]*\? stateUpdate\.nightlifeRequested[\s\S]*: currentState\.nightlifeRequested/,
    );
    expect(types).toMatch(/shoppingRequested: boolean \| null/);
    expect(types).toMatch(/shoppingRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.shoppingRequested !== undefined[\s\S]*\? stateUpdate\.shoppingRequested[\s\S]*: currentState\.shoppingRequested/,
    );
    expect(types).toMatch(/wellnessRequested: boolean \| null/);
    expect(types).toMatch(/wellnessRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.wellnessRequested !== undefined[\s\S]*\? stateUpdate\.wellnessRequested[\s\S]*: currentState\.wellnessRequested/,
    );
    expect(types).toMatch(/familyActivitiesRequested: boolean \| null/);
    expect(types).toMatch(/familyActivitiesRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.familyActivitiesRequested !== undefined[\s\S]*\? stateUpdate\.familyActivitiesRequested[\s\S]*: currentState\.familyActivitiesRequested/,
    );
    expect(types).toMatch(/accessibleTravelRequested: boolean \| null/);
    expect(types).toMatch(/accessibleTravelRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.accessibleTravelRequested !== undefined[\s\S]*\? stateUpdate\.accessibleTravelRequested[\s\S]*: currentState\.accessibleTravelRequested/,
    );
    expect(processTurn.includes('destination?:')).toBe(false);
    expect(processTurn.includes('flightsRequested?:')).toBe(false);
    expect(index).toMatch(/ConversationStateUpdate/);
    expect(index).toMatch(/ConversationStateExtractionResult/);
    expect(index).toMatch(/ConversationStateExtractionInput/);
    expect(index).toMatch(/ConversationStateExtractor/);
    expect(types).toMatch(/export type ConversationStateExtractionResult/);
    expect(types).toMatch(
      /export type ConversationStateExtractionResult = \{\s*stateUpdate: ConversationStateUpdate;\s*\}/,
    );
    expect(types).toMatch(/export type ConversationStateExtractionInput/);
    expect(types).toMatch(
      /export type ConversationStateExtractionInput = \{\s*message: string;\s*currentState: ConversationCoreState;\s*\}/,
    );
    expect(types).toMatch(/export interface ConversationStateExtractor/);
    expect(types).toMatch(
      /export interface ConversationStateExtractor \{\s*extract\(\s*input: ConversationStateExtractionInput,\s*\): ConversationStateExtractionResult;\s*\}/,
    );
    const extractorFactory = readSrc(
      'src/features/conversation-core/createConversationStateExtractor.ts',
    );
    const emptyExtractor = readSrc(
      'src/features/conversation-core/emptyConversationStateExtractor.ts',
    );
    const extractionExecution = readSrc(
      'src/features/conversation-core/extractConversationState.ts',
    );
    expect(extractorFactory).toMatch(
      /export function createConversationStateExtractor\(\): ConversationStateExtractor/,
    );
    expect(extractorFactory).toMatch(
      /return new EmptyConversationStateExtractor\(\);/,
    );
    expect(emptyExtractor).toMatch(/export class EmptyConversationStateExtractor/);
    expect(extractionExecution).toMatch(
      /export function extractConversationState\(\s*input: ConversationStateExtractionInput,\s*\): ConversationStateExtractionResult/,
    );
    expect(extractionExecution).toMatch(/createConversationStateExtractor\(\)/);
    expect(extractionExecution).toMatch(/extractor\.extract\(input\)/);
    expect(extractionExecution.includes('new EmptyConversationStateExtractor')).toBe(
      false,
    );
    expect(extractionExecution.includes('stateUpdate: {}')).toBe(false);
    const extractAndApply = readSrc(
      'src/features/conversation-core/extractAndApplyConversationState.ts',
    );
    expect(extractAndApply).toMatch(
      /export function extractAndApplyConversationState\(\s*input: ExtractAndApplyConversationStateInput,\s*\): ConversationCoreState/,
    );
    expect(extractAndApply).toMatch(/extractConversationState\(/);
    expect(extractAndApply).toMatch(/applyConversationStateUpdate\(/);
    expect(extractAndApply.includes('createConversationStateExtractor')).toBe(false);
    expect(extractAndApply.includes('EmptyConversationStateExtractor')).toBe(false);
    expect(extractAndApply.includes('hasConversationStateUpdateChanged')).toBe(false);
    const transition = readSrc(
      'src/features/conversation-core/transitionConversationStateFromExtraction.ts',
    );
    expect(transition).toMatch(
      /export function transitionConversationStateFromExtraction\(\s*input: TransitionConversationStateFromExtractionInput,\s*\): TransitionConversationStateFromExtractionResult/,
    );
    expect(transition).toMatch(/extractConversationState\(/);
    expect(transition).toMatch(/hasConversationStateUpdateChanged\(/);
    expect(transition).toMatch(/applyConversationStateUpdate\(/);
    expect(transition.includes('extractAndApplyConversationState')).toBe(false);
    expect(transition.includes('createConversationStateExtractor')).toBe(false);
    expect(transition.includes('EmptyConversationStateExtractor')).toBe(false);
    expect(types).toMatch(/transcript: ConversationTranscriptEntry\[\]/);
    expect(types).toMatch(/role: 'user'/);
    expect(types).toMatch(/role: 'assistant'/);
    expect(processTurn).toMatch(/userEntryId/);
    expect(processTurn).toMatch(/assistantEntryId/);
    expect(processTurn).toMatch(/userMessageAt/);
    expect(processTurn).toMatch(/assistantMessageAt/);
    expect(processTurn.includes('crypto.randomUUID')).toBe(false);
    expect(processTurn.includes('new Date()')).toBe(false);
  });

  it('has no old engine, persistence, travel-feature, or message-interpretation code', () => {
    const coreFiles = listFiles(resolve(ROOT, 'src/features/conversation-core')).filter(
      (path) => !path.includes(`${join('conversation-core', '__tests__')}`),
    );

    for (const file of coreFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('features/travel-' + 'conversation'), file).toBe(false);
      expect(src.includes('send' + 'TravelMessage'), file).toBe(false);
      expect(src.includes('run' + 'ConversationTurn'), file).toBe(false);
      expect(src.includes('localStorage'), file).toBe(false);
      expect(src.includes('sessionStorage'), file).toBe(false);
      expect(src.includes('indexedDB'), file).toBe(false);
      expect(src.includes('travel-location-intelligence'), file).toBe(false);
      expect(src.includes('destination-discovery'), file).toBe(false);
      expect(src.includes('schemaVersion'), file).toBe(false);
      expect(src.includes('.trim('), file).toBe(false);
      expect(src.includes('.toLowerCase('), file).toBe(false);
      expect(src.includes('.normalize('), file).toBe(false);
    }
  });

  it('exposes exactly one public initial-state factory', () => {
    const index = readSrc('src/features/conversation-core/index.ts');
    const types = readSrc('src/features/conversation-core/types.ts');
    const factoryDefs = types.match(/export function create\w+/g) ?? [];

    expect(factoryDefs).toEqual(['export function createInitialConversationCoreState']);
    expect(index).toMatch(
      /export \{\n[\s\S]*createInitialConversationCoreState[\s\S]*\} from '\.\/types'/,
    );
    expect((types.match(/export function create\w+/g) ?? []).length).toBe(1);
    expect(types.includes('crypto.randomUUID')).toBe(false);
    expect(types.includes('new Date()')).toBe(false);
  });

  it('rejected conversation package is absent under src/features', () => {
    const features = resolve(ROOT, 'src/features');
    const names = readdirSync(features);
    expect(names).toContain('conversation-core');
    expect(names.includes('travel-' + 'conversation')).toBe(false);
  });
});
