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
    expect(types).toMatch(/snowActivitiesRequested\?: boolean \| null/);
    expect(types).toMatch(/hikingWalkingRequested\?: boolean \| null/);
    expect(types).toMatch(/fishingRequested\?: boolean \| null/);
    expect(types).toMatch(/divingSnorkellingRequested\?: boolean \| null/);
    expect(types).toMatch(/wineriesFoodTrailsRequested\?: boolean \| null/);
    expect(types).toMatch(/eventsFestivalsRequested\?: boolean \| null/);
    expect(types).toMatch(/wildlifeRequested\?: boolean \| null/);
    expect(types).toMatch(/nationalParksRequested\?: boolean \| null/);
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
    expect(index.includes('CompositeConversationStateExtractor')).toBe(false);
    expect(index.includes('DestinationConversationStateExtractor')).toBe(false);
    expect(index.includes('OriginConversationStateExtractor')).toBe(false);
    expect(index.includes('DepartureDateConversationStateExtractor')).toBe(false);
    expect(index.includes('ReturnDateConversationStateExtractor')).toBe(false);
    expect(index.includes('AdultCountConversationStateExtractor')).toBe(false);
    expect(index.includes('ChildCountConversationStateExtractor')).toBe(false);
    expect(index.includes('InfantCountConversationStateExtractor')).toBe(false);
    expect(index.includes('FlightsRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('AccommodationRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('CarHireRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('ActivitiesRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('RestaurantsRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('NearbyDiscoveryRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('BeachesRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('CampingRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('KayakingRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('FourWheelDrivingRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('ScenicDrivesRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('AttractionsRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('SnowActivitiesRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('HikingWalkingRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('FishingRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('DivingSnorkellingRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('WineriesFoodTrailsRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('EventsFestivalsRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('WildlifeRequestedConversationStateExtractor')).toBe(false);
    expect(index.includes('NationalParksRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(index.includes('extractConversationState')).toBe(false);
    expect(index.includes('extractAndApplyConversationState')).toBe(false);
    expect(index.includes('transitionConversationStateFromExtraction')).toBe(false);
    expect(processTurn.includes('createConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('EmptyConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('CompositeConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('DestinationConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('OriginConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('DepartureDateConversationStateExtractor')).toBe(
      false,
    );
    expect(processTurn.includes('ReturnDateConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('AdultCountConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('ChildCountConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('InfantCountConversationStateExtractor')).toBe(false);
    expect(processTurn.includes('FlightsRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(
      processTurn.includes('AccommodationRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(processTurn.includes('CarHireRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(processTurn.includes('ActivitiesRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(processTurn.includes('RestaurantsRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(
      processTurn.includes('NearbyDiscoveryRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(processTurn.includes('BeachesRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(processTurn.includes('CampingRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(processTurn.includes('KayakingRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(
      processTurn.includes('FourWheelDrivingRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(processTurn.includes('ScenicDrivesRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(processTurn.includes('AttractionsRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(
      processTurn.includes('SnowActivitiesRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(
      processTurn.includes('HikingWalkingRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(processTurn.includes('FishingRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(
      processTurn.includes('DivingSnorkellingRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(
      processTurn.includes('WineriesFoodTrailsRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(
      processTurn.includes('EventsFestivalsRequestedConversationStateExtractor'),
    ).toBe(false);
    expect(processTurn.includes('WildlifeRequestedConversationStateExtractor')).toBe(
      false,
    );
    expect(
      processTurn.includes('NationalParksRequestedConversationStateExtractor'),
    ).toBe(false);
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
    expect(types).toMatch(/snowActivitiesRequested: boolean \| null/);
    expect(types).toMatch(/snowActivitiesRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.snowActivitiesRequested !== undefined[\s\S]*\? stateUpdate\.snowActivitiesRequested[\s\S]*: currentState\.snowActivitiesRequested/,
    );
    expect(types).toMatch(/hikingWalkingRequested: boolean \| null/);
    expect(types).toMatch(/hikingWalkingRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.hikingWalkingRequested !== undefined[\s\S]*\? stateUpdate\.hikingWalkingRequested[\s\S]*: currentState\.hikingWalkingRequested/,
    );
    expect(types).toMatch(/fishingRequested: boolean \| null/);
    expect(types).toMatch(/fishingRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.fishingRequested !== undefined[\s\S]*\? stateUpdate\.fishingRequested[\s\S]*: currentState\.fishingRequested/,
    );
    expect(types).toMatch(/divingSnorkellingRequested: boolean \| null/);
    expect(types).toMatch(/divingSnorkellingRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.divingSnorkellingRequested !== undefined[\s\S]*\? stateUpdate\.divingSnorkellingRequested[\s\S]*: currentState\.divingSnorkellingRequested/,
    );
    expect(types).toMatch(/wineriesFoodTrailsRequested: boolean \| null/);
    expect(types).toMatch(/wineriesFoodTrailsRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.wineriesFoodTrailsRequested !== undefined[\s\S]*\? stateUpdate\.wineriesFoodTrailsRequested[\s\S]*: currentState\.wineriesFoodTrailsRequested/,
    );
    expect(types).toMatch(/eventsFestivalsRequested: boolean \| null/);
    expect(types).toMatch(/eventsFestivalsRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.eventsFestivalsRequested !== undefined[\s\S]*\? stateUpdate\.eventsFestivalsRequested[\s\S]*: currentState\.eventsFestivalsRequested/,
    );
    expect(types).toMatch(/wildlifeRequested: boolean \| null/);
    expect(types).toMatch(/wildlifeRequested: null,/);
    expect(types).toMatch(/nationalParksRequested: boolean \| null/);
    expect(types).toMatch(/nationalParksRequested: null,/);
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.wildlifeRequested !== undefined[\s\S]*\? stateUpdate\.wildlifeRequested[\s\S]*: currentState\.wildlifeRequested/,
    );
    expect(applyUpdate).toMatch(
      /stateUpdate\?\.nationalParksRequested !== undefined[\s\S]*\? stateUpdate\.nationalParksRequested[\s\S]*: currentState\.nationalParksRequested/,
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
    const compositeExtractor = readSrc(
      'src/features/conversation-core/CompositeConversationStateExtractor.ts',
    );
    const extractionExecution = readSrc(
      'src/features/conversation-core/extractConversationState.ts',
    );
    expect(extractorFactory).toMatch(
      /export function createConversationStateExtractor\(\): ConversationStateExtractor/,
    );
    expect(extractorFactory).toMatch(
      /return new CompositeConversationStateExtractor\(\[\s*new DestinationConversationStateExtractor\(\),\s*new OriginConversationStateExtractor\(\),\s*new DepartureDateConversationStateExtractor\(\),\s*new ReturnDateConversationStateExtractor\(\),\s*new AdultCountConversationStateExtractor\(\),\s*new ChildCountConversationStateExtractor\(\),\s*new InfantCountConversationStateExtractor\(\),\s*new FlightsRequestedConversationStateExtractor\(\),\s*new AccommodationRequestedConversationStateExtractor\(\),\s*new CarHireRequestedConversationStateExtractor\(\),\s*new ActivitiesRequestedConversationStateExtractor\(\),\s*new RestaurantsRequestedConversationStateExtractor\(\),\s*new NearbyDiscoveryRequestedConversationStateExtractor\(\),\s*new BeachesRequestedConversationStateExtractor\(\),\s*new CampingRequestedConversationStateExtractor\(\),\s*new KayakingRequestedConversationStateExtractor\(\),\s*new FourWheelDrivingRequestedConversationStateExtractor\(\),\s*new ScenicDrivesRequestedConversationStateExtractor\(\),\s*new AttractionsRequestedConversationStateExtractor\(\),\s*new SnowActivitiesRequestedConversationStateExtractor\(\),\s*new HikingWalkingRequestedConversationStateExtractor\(\),\s*new FishingRequestedConversationStateExtractor\(\),\s*new DivingSnorkellingRequestedConversationStateExtractor\(\),\s*new WineriesFoodTrailsRequestedConversationStateExtractor\(\),\s*new EventsFestivalsRequestedConversationStateExtractor\(\),\s*new WildlifeRequestedConversationStateExtractor\(\),\s*new NationalParksRequestedConversationStateExtractor\(\),\s*new EmptyConversationStateExtractor\(\),\s*\]\);/,
    );
    expect(emptyExtractor).toMatch(/export class EmptyConversationStateExtractor/);
    expect(emptyExtractor).toContain('Phase 7AB');
    expect(emptyExtractor).toMatch(/_input: ConversationStateExtractionInput/);
    expect(emptyExtractor).toMatch(/stateUpdate:\s*\{\s*\}/);
    expect(emptyExtractor.includes('input.message')).toBe(false);
    expect(emptyExtractor.includes('input.currentState')).toBe(false);
    expect(emptyExtractor.includes('.trim(')).toBe(false);
    expect(emptyExtractor.includes('toLowerCase')).toBe(false);
    expect(emptyExtractor.includes('includes(')).toBe(false);
    expect(emptyExtractor).not.toMatch(/:\s*true/);
    expect(emptyExtractor).not.toMatch(/:\s*false/);
    expect(emptyExtractor).not.toMatch(/:\s*null/);
    const destinationExtractor = readSrc(
      'src/features/conversation-core/DestinationConversationStateExtractor.ts',
    );
    expect(destinationExtractor).toMatch(
      /export class DestinationConversationStateExtractor/,
    );
    expect(destinationExtractor).toMatch(/input: ConversationStateExtractionInput/);
    expect(destinationExtractor).toMatch(/input\.message/);
    expect(destinationExtractor.includes('input.currentState')).toBe(false);
    expect(destinationExtractor.includes('.trim(')).toBe(false);
    expect(destinationExtractor.includes('.toLowerCase(')).toBe(false);
    const originExtractor = readSrc(
      'src/features/conversation-core/OriginConversationStateExtractor.ts',
    );
    expect(originExtractor).toMatch(/export class OriginConversationStateExtractor/);
    expect(originExtractor).toContain('Phase 7B');
    expect(originExtractor).toContain('Phase 8B');
    expect(originExtractor).toMatch(/input: ConversationStateExtractionInput/);
    expect(originExtractor).toMatch(/input\.message/);
    expect(originExtractor.includes('input.currentState')).toBe(false);
    expect(originExtractor.includes('.trim(')).toBe(false);
    expect(originExtractor.includes('.toLowerCase(')).toBe(false);
    expect(originExtractor.includes('input.currentState')).toBe(false);
    expect(originExtractor).toMatch(/origin:\s*origin/);
    expect(originExtractor.includes('origin: null')).toBe(false);
    expect(originExtractor.includes('origin: ""')).toBe(false);
    const departureDateExtractor = readSrc(
      'src/features/conversation-core/DepartureDateConversationStateExtractor.ts',
    );
    expect(departureDateExtractor).toMatch(
      /export class DepartureDateConversationStateExtractor/,
    );
    expect(departureDateExtractor).toContain('Phase 7C');
    expect(departureDateExtractor).toContain('Phase 8C');
    expect(departureDateExtractor).toMatch(/input: ConversationStateExtractionInput/);
    expect(departureDateExtractor).toMatch(/input\.message/);
    expect(departureDateExtractor.includes('input.currentState')).toBe(false);
    expect(departureDateExtractor.includes('.trim(')).toBe(false);
    expect(departureDateExtractor.includes('.toLowerCase(')).toBe(false);
    expect(departureDateExtractor.includes('new Date')).toBe(false);
    expect(departureDateExtractor.includes('Date.now')).toBe(false);
    expect(departureDateExtractor.includes('Date.parse')).toBe(false);
    expect(departureDateExtractor).toMatch(/departureDate:\s*departureDate/);
    expect(departureDateExtractor.includes('departureDate: null')).toBe(false);
    expect(departureDateExtractor.includes('returnDate:')).toBe(false);
    const returnDateExtractor = readSrc(
      'src/features/conversation-core/ReturnDateConversationStateExtractor.ts',
    );
    expect(returnDateExtractor).toMatch(
      /export class ReturnDateConversationStateExtractor/,
    );
    expect(returnDateExtractor).toContain('Phase 7D');
    expect(returnDateExtractor).toContain('Phase 8D');
    expect(returnDateExtractor).toMatch(/input: ConversationStateExtractionInput/);
    expect(returnDateExtractor).toMatch(/input\.message/);
    expect(returnDateExtractor.includes('input.currentState')).toBe(false);
    expect(returnDateExtractor.includes('.trim(')).toBe(false);
    expect(returnDateExtractor.includes('.toLowerCase(')).toBe(false);
    expect(returnDateExtractor.includes('new Date')).toBe(false);
    expect(returnDateExtractor.includes('Date.now')).toBe(false);
    expect(returnDateExtractor.includes('Date.parse')).toBe(false);
    expect(returnDateExtractor).toMatch(/returnDate:\s*returnDate/);
    expect(returnDateExtractor.includes('returnDate: null')).toBe(false);
    expect(returnDateExtractor.includes('departureDate:')).toBe(false);
    const adultCountExtractor = readSrc(
      'src/features/conversation-core/AdultCountConversationStateExtractor.ts',
    );
    expect(adultCountExtractor).toMatch(
      /export class AdultCountConversationStateExtractor/,
    );
    expect(adultCountExtractor).toContain('Phase 7E');
    expect(adultCountExtractor).toContain('Phase 8E');
    expect(adultCountExtractor).toMatch(/input: ConversationStateExtractionInput/);
    expect(adultCountExtractor).toMatch(/input\.message/);
    expect(adultCountExtractor.includes('input.currentState')).toBe(false);
    expect(adultCountExtractor.includes('.trim(')).toBe(false);
    expect(adultCountExtractor.includes('.toLowerCase(')).toBe(false);
    expect(adultCountExtractor.includes('Number(')).toBe(false);
    expect(adultCountExtractor.includes('parseInt')).toBe(false);
    expect(adultCountExtractor).toMatch(/adultCount:\s*adultCount/);
    expect(adultCountExtractor.includes('adultCount: null')).toBe(false);
    expect(adultCountExtractor.includes('childCount:')).toBe(false);
    expect(adultCountExtractor.includes('infantCount:')).toBe(false);
    const childCountExtractor = readSrc(
      'src/features/conversation-core/ChildCountConversationStateExtractor.ts',
    );
    expect(childCountExtractor).toMatch(
      /export class ChildCountConversationStateExtractor/,
    );
    expect(childCountExtractor).toContain('Phase 7F');
    expect(childCountExtractor).toContain('Phase 8F');
    expect(childCountExtractor).toMatch(/input: ConversationStateExtractionInput/);
    expect(childCountExtractor).toMatch(/input\.message/);
    expect(childCountExtractor.includes('input.currentState')).toBe(false);
    expect(childCountExtractor.includes('.trim(')).toBe(false);
    expect(childCountExtractor.includes('.toLowerCase(')).toBe(false);
    expect(childCountExtractor.includes('Number(')).toBe(false);
    expect(childCountExtractor.includes('parseInt')).toBe(false);
    expect(childCountExtractor).toMatch(/childCount:\s*childCount/);
    expect(childCountExtractor.includes('childCount: null')).toBe(false);
    expect(childCountExtractor.includes('adultCount:')).toBe(false);
    expect(childCountExtractor.includes('infantCount:')).toBe(false);
    const infantCountExtractor = readSrc(
      'src/features/conversation-core/InfantCountConversationStateExtractor.ts',
    );
    expect(infantCountExtractor).toMatch(
      /export class InfantCountConversationStateExtractor/,
    );
    expect(infantCountExtractor).toContain('Phase 7G');
    expect(infantCountExtractor).toContain('Phase 8G');
    expect(infantCountExtractor).toMatch(/input: ConversationStateExtractionInput/);
    expect(infantCountExtractor).toMatch(/input\.message/);
    expect(infantCountExtractor.includes('input.currentState')).toBe(false);
    expect(infantCountExtractor.includes('.trim(')).toBe(false);
    expect(infantCountExtractor.includes('.toLowerCase(')).toBe(false);
    expect(infantCountExtractor.includes('Number(')).toBe(false);
    expect(infantCountExtractor.includes('parseInt')).toBe(false);
    expect(infantCountExtractor).toMatch(/infantCount:\s*infantCount/);
    expect(infantCountExtractor.includes('infantCount: null')).toBe(false);
    expect(infantCountExtractor.includes('adultCount:')).toBe(false);
    expect(infantCountExtractor.includes('childCount:')).toBe(false);
    const flightsRequestedExtractor = readSrc(
      'src/features/conversation-core/FlightsRequestedConversationStateExtractor.ts',
    );
    expect(flightsRequestedExtractor).toMatch(
      /export class FlightsRequestedConversationStateExtractor/,
    );
    expect(flightsRequestedExtractor).toContain('Phase 7H');
    expect(flightsRequestedExtractor).toContain('Phase 8H');
    expect(flightsRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(flightsRequestedExtractor).toMatch(/input\.message/);
    expect(flightsRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(flightsRequestedExtractor.includes('.trim(')).toBe(false);
    expect(flightsRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(flightsRequestedExtractor.includes('includes(')).toBe(false);
    expect(flightsRequestedExtractor).toMatch(/flightsRequested:\s*true/);
    expect(flightsRequestedExtractor.includes('flightsRequested: false')).toBe(
      false,
    );
    expect(flightsRequestedExtractor.includes('flightsRequested: null')).toBe(
      false,
    );
    const accommodationRequestedExtractor = readSrc(
      'src/features/conversation-core/AccommodationRequestedConversationStateExtractor.ts',
    );
    expect(accommodationRequestedExtractor).toMatch(
      /export class AccommodationRequestedConversationStateExtractor/,
    );
    expect(accommodationRequestedExtractor).toContain('Phase 7I');
    expect(accommodationRequestedExtractor).toContain('Phase 8I');
    expect(accommodationRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(accommodationRequestedExtractor).toMatch(/input\.message/);
    expect(accommodationRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(accommodationRequestedExtractor.includes('.trim(')).toBe(false);
    expect(accommodationRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(accommodationRequestedExtractor.includes('includes(')).toBe(false);
    expect(accommodationRequestedExtractor).toMatch(
      /accommodationRequested:\s*true/,
    );
    expect(
      accommodationRequestedExtractor.includes('accommodationRequested: false'),
    ).toBe(false);
    expect(
      accommodationRequestedExtractor.includes('accommodationRequested: null'),
    ).toBe(false);
    const carHireRequestedExtractor = readSrc(
      'src/features/conversation-core/CarHireRequestedConversationStateExtractor.ts',
    );
    expect(carHireRequestedExtractor).toMatch(
      /export class CarHireRequestedConversationStateExtractor/,
    );
    expect(carHireRequestedExtractor).toContain('Phase 7J');
    expect(carHireRequestedExtractor).toContain('Phase 8J');
    expect(carHireRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(carHireRequestedExtractor).toMatch(/input\.message/);
    expect(carHireRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(carHireRequestedExtractor.includes('.trim(')).toBe(false);
    expect(carHireRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(carHireRequestedExtractor.includes('includes(')).toBe(false);
    expect(carHireRequestedExtractor).toMatch(/carHireRequested:\s*true/);
    expect(carHireRequestedExtractor.includes('carHireRequested: false')).toBe(
      false,
    );
    expect(carHireRequestedExtractor.includes('carHireRequested: null')).toBe(
      false,
    );
    const activitiesRequestedExtractor = readSrc(
      'src/features/conversation-core/ActivitiesRequestedConversationStateExtractor.ts',
    );
    expect(activitiesRequestedExtractor).toMatch(
      /export class ActivitiesRequestedConversationStateExtractor/,
    );
    expect(activitiesRequestedExtractor).toContain('Phase 7K');
    expect(activitiesRequestedExtractor).toContain('Phase 8K');
    expect(activitiesRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(activitiesRequestedExtractor).toMatch(/input\.message/);
    expect(activitiesRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(activitiesRequestedExtractor.includes('.trim(')).toBe(false);
    expect(activitiesRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(activitiesRequestedExtractor.includes('includes(')).toBe(false);
    expect(activitiesRequestedExtractor).toMatch(/activitiesRequested:\s*true/);
    expect(
      activitiesRequestedExtractor.includes('activitiesRequested: false'),
    ).toBe(false);
    expect(
      activitiesRequestedExtractor.includes('activitiesRequested: null'),
    ).toBe(false);
    const restaurantsRequestedExtractor = readSrc(
      'src/features/conversation-core/RestaurantsRequestedConversationStateExtractor.ts',
    );
    expect(restaurantsRequestedExtractor).toMatch(
      /export class RestaurantsRequestedConversationStateExtractor/,
    );
    expect(restaurantsRequestedExtractor).toContain('Phase 7L');
    expect(restaurantsRequestedExtractor).toContain('Phase 8L');
    expect(restaurantsRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(restaurantsRequestedExtractor).toMatch(/input\.message/);
    expect(restaurantsRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(restaurantsRequestedExtractor.includes('.trim(')).toBe(false);
    expect(restaurantsRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(restaurantsRequestedExtractor.includes('includes(')).toBe(false);
    expect(restaurantsRequestedExtractor).toMatch(
      /restaurantsRequested:\s*true/,
    );
    expect(
      restaurantsRequestedExtractor.includes('restaurantsRequested: false'),
    ).toBe(false);
    expect(
      restaurantsRequestedExtractor.includes('restaurantsRequested: null'),
    ).toBe(false);
    const nearbyDiscoveryRequestedExtractor = readSrc(
      'src/features/conversation-core/NearbyDiscoveryRequestedConversationStateExtractor.ts',
    );
    expect(nearbyDiscoveryRequestedExtractor).toMatch(
      /export class NearbyDiscoveryRequestedConversationStateExtractor/,
    );
    expect(nearbyDiscoveryRequestedExtractor).toContain('Phase 7M');
    expect(nearbyDiscoveryRequestedExtractor).toContain('Phase 8M');
    expect(nearbyDiscoveryRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(nearbyDiscoveryRequestedExtractor).toMatch(/input\.message/);
    expect(nearbyDiscoveryRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(nearbyDiscoveryRequestedExtractor.includes('.trim(')).toBe(false);
    expect(nearbyDiscoveryRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(nearbyDiscoveryRequestedExtractor.includes('includes(')).toBe(false);
    expect(nearbyDiscoveryRequestedExtractor).toMatch(
      /nearbyDiscoveryRequested:\s*true/,
    );
    expect(
      nearbyDiscoveryRequestedExtractor.includes(
        'nearbyDiscoveryRequested: false',
      ),
    ).toBe(false);
    expect(
      nearbyDiscoveryRequestedExtractor.includes(
        'nearbyDiscoveryRequested: null',
      ),
    ).toBe(false);
    const beachesRequestedExtractor = readSrc(
      'src/features/conversation-core/BeachesRequestedConversationStateExtractor.ts',
    );
    expect(beachesRequestedExtractor).toMatch(
      /export class BeachesRequestedConversationStateExtractor/,
    );
    expect(beachesRequestedExtractor).toContain('Phase 7N');
    expect(beachesRequestedExtractor).toContain('Phase 8N');
    expect(beachesRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(beachesRequestedExtractor).toMatch(/input\.message/);
    expect(beachesRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(beachesRequestedExtractor.includes('.trim(')).toBe(false);
    expect(beachesRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(beachesRequestedExtractor.includes('includes(')).toBe(false);
    expect(beachesRequestedExtractor).toMatch(/beachesRequested:\s*true/);
    expect(beachesRequestedExtractor.includes('beachesRequested: false')).toBe(
      false,
    );
    expect(beachesRequestedExtractor.includes('beachesRequested: null')).toBe(
      false,
    );
    const campingRequestedExtractor = readSrc(
      'src/features/conversation-core/CampingRequestedConversationStateExtractor.ts',
    );
    expect(campingRequestedExtractor).toMatch(
      /export class CampingRequestedConversationStateExtractor/,
    );
    expect(campingRequestedExtractor).toContain('Phase 7O');
    expect(campingRequestedExtractor).toContain('Phase 8P');
    expect(campingRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(campingRequestedExtractor).toMatch(/input\.message/);
    expect(campingRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(campingRequestedExtractor.includes('.trim(')).toBe(false);
    expect(campingRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(campingRequestedExtractor.includes('includes(')).toBe(false);
    expect(campingRequestedExtractor).toMatch(/campingRequested:\s*true/);
    expect(campingRequestedExtractor.includes('campingRequested: false')).toBe(
      false,
    );
    expect(campingRequestedExtractor.includes('campingRequested: null')).toBe(
      false,
    );
    const kayakingRequestedExtractor = readSrc(
      'src/features/conversation-core/KayakingRequestedConversationStateExtractor.ts',
    );
    expect(kayakingRequestedExtractor).toMatch(
      /export class KayakingRequestedConversationStateExtractor/,
    );
    expect(kayakingRequestedExtractor).toContain('Phase 7P');
    expect(kayakingRequestedExtractor).toContain('Phase 8S');
    expect(kayakingRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(kayakingRequestedExtractor).toMatch(/input\.message/);
    expect(kayakingRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(kayakingRequestedExtractor.includes('.trim(')).toBe(false);
    expect(kayakingRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(kayakingRequestedExtractor.includes('includes(')).toBe(false);
    expect(kayakingRequestedExtractor).toMatch(/kayakingRequested:\s*true/);
    expect(kayakingRequestedExtractor.includes('kayakingRequested: false')).toBe(
      false,
    );
    expect(kayakingRequestedExtractor.includes('kayakingRequested: null')).toBe(
      false,
    );
    const fourWheelDrivingRequestedExtractor = readSrc(
      'src/features/conversation-core/FourWheelDrivingRequestedConversationStateExtractor.ts',
    );
    expect(fourWheelDrivingRequestedExtractor).toMatch(
      /export class FourWheelDrivingRequestedConversationStateExtractor/,
    );
    expect(fourWheelDrivingRequestedExtractor).toContain('Phase 7Q');
    expect(fourWheelDrivingRequestedExtractor).toContain('Phase 8T');
    expect(fourWheelDrivingRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(fourWheelDrivingRequestedExtractor).toMatch(/input\.message/);
    expect(fourWheelDrivingRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(fourWheelDrivingRequestedExtractor.includes('.trim(')).toBe(false);
    expect(fourWheelDrivingRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(fourWheelDrivingRequestedExtractor.includes('includes(')).toBe(false);
    expect(fourWheelDrivingRequestedExtractor).toMatch(
      /fourWheelDriveRequested:\s*true/,
    );
    expect(
      fourWheelDrivingRequestedExtractor.includes('fourWheelDriveRequested: false'),
    ).toBe(false);
    expect(
      fourWheelDrivingRequestedExtractor.includes('fourWheelDriveRequested: null'),
    ).toBe(false);
    const scenicDrivesRequestedExtractor = readSrc(
      'src/features/conversation-core/ScenicDrivesRequestedConversationStateExtractor.ts',
    );
    expect(scenicDrivesRequestedExtractor).toMatch(
      /export class ScenicDrivesRequestedConversationStateExtractor/,
    );
    expect(scenicDrivesRequestedExtractor).toContain('Phase 7R');
    expect(scenicDrivesRequestedExtractor).toContain('Phase 8U');
    expect(scenicDrivesRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(scenicDrivesRequestedExtractor).toMatch(/input\.message/);
    expect(scenicDrivesRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(scenicDrivesRequestedExtractor.includes('.trim(')).toBe(false);
    expect(scenicDrivesRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(scenicDrivesRequestedExtractor.includes('includes(')).toBe(false);
    expect(scenicDrivesRequestedExtractor).toMatch(/scenicDrivesRequested:\s*true/);
    expect(scenicDrivesRequestedExtractor.includes('scenicDrivesRequested: false')).toBe(
      false,
    );
    expect(scenicDrivesRequestedExtractor.includes('scenicDrivesRequested: null')).toBe(
      false,
    );
    const attractionsRequestedExtractor = readSrc(
      'src/features/conversation-core/AttractionsRequestedConversationStateExtractor.ts',
    );
    expect(attractionsRequestedExtractor).toMatch(
      /export class AttractionsRequestedConversationStateExtractor/,
    );
    expect(attractionsRequestedExtractor).toContain('Phase 7S');
    expect(attractionsRequestedExtractor).toContain('Phase 8V');
    expect(attractionsRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(attractionsRequestedExtractor).toMatch(/input\.message/);
    expect(attractionsRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(attractionsRequestedExtractor.includes('.trim(')).toBe(false);
    expect(attractionsRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(attractionsRequestedExtractor.includes('includes(')).toBe(false);
    expect(attractionsRequestedExtractor).toMatch(/attractionsRequested:\s*true/);
    expect(attractionsRequestedExtractor.includes('attractionsRequested: false')).toBe(
      false,
    );
    expect(attractionsRequestedExtractor.includes('attractionsRequested: null')).toBe(
      false,
    );
    const snowActivitiesRequestedExtractor = readSrc(
      'src/features/conversation-core/SnowActivitiesRequestedConversationStateExtractor.ts',
    );
    expect(snowActivitiesRequestedExtractor).toMatch(
      /export class SnowActivitiesRequestedConversationStateExtractor/,
    );
    expect(snowActivitiesRequestedExtractor).toContain('Phase 7T');
    expect(snowActivitiesRequestedExtractor).toContain('Phase 8W');
    expect(snowActivitiesRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(snowActivitiesRequestedExtractor).toMatch(/input\.message/);
    expect(snowActivitiesRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(snowActivitiesRequestedExtractor.includes('.trim(')).toBe(false);
    expect(snowActivitiesRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(snowActivitiesRequestedExtractor.includes('includes(')).toBe(false);
    expect(snowActivitiesRequestedExtractor).toMatch(/snowActivitiesRequested:\s*true/);
    expect(
      snowActivitiesRequestedExtractor.includes('snowActivitiesRequested: false'),
    ).toBe(false);
    expect(
      snowActivitiesRequestedExtractor.includes('snowActivitiesRequested: null'),
    ).toBe(false);
    const hikingWalkingRequestedExtractor = readSrc(
      'src/features/conversation-core/extractors/HikingWalkingRequestedConversationStateExtractor.ts',
    );
    expect(hikingWalkingRequestedExtractor).toMatch(
      /export class HikingWalkingRequestedConversationStateExtractor/,
    );
    expect(hikingWalkingRequestedExtractor).toContain('Phase 7U');
    expect(hikingWalkingRequestedExtractor).toContain('Phase 8R');
    expect(hikingWalkingRequestedExtractor).toContain('Phase 8X');
    expect(hikingWalkingRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(hikingWalkingRequestedExtractor).toMatch(/input\.message/);
    expect(hikingWalkingRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(hikingWalkingRequestedExtractor.includes('.trim(')).toBe(false);
    expect(hikingWalkingRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(hikingWalkingRequestedExtractor.includes('includes(')).toBe(false);
    expect(hikingWalkingRequestedExtractor).toMatch(/hikingWalkingRequested:\s*true/);
    expect(
      hikingWalkingRequestedExtractor.includes('hikingWalkingRequested: false'),
    ).toBe(false);
    expect(
      hikingWalkingRequestedExtractor.includes('hikingWalkingRequested: null'),
    ).toBe(false);
    const fishingRequestedExtractor = readSrc(
      'src/features/conversation-core/extractors/FishingRequestedConversationStateExtractor.ts',
    );
    expect(fishingRequestedExtractor).toMatch(
      /export class FishingRequestedConversationStateExtractor/,
    );
    expect(fishingRequestedExtractor).toContain('Phase 7V');
    expect(fishingRequestedExtractor).toContain('Phase 8Y');
    expect(fishingRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(fishingRequestedExtractor).toMatch(/input\.message/);
    expect(fishingRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(fishingRequestedExtractor.includes('.trim(')).toBe(false);
    expect(fishingRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(fishingRequestedExtractor.includes('includes(')).toBe(false);
    expect(fishingRequestedExtractor).toMatch(/fishingRequested:\s*true/);
    expect(fishingRequestedExtractor.includes('fishingRequested: false')).toBe(false);
    expect(fishingRequestedExtractor.includes('fishingRequested: null')).toBe(false);
    const divingSnorkellingRequestedExtractor = readSrc(
      'src/features/conversation-core/extractors/DivingSnorkellingRequestedConversationStateExtractor.ts',
    );
    expect(divingSnorkellingRequestedExtractor).toMatch(
      /export class DivingSnorkellingRequestedConversationStateExtractor/,
    );
    expect(divingSnorkellingRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(divingSnorkellingRequestedExtractor).toMatch(/input\.message/);
    expect(divingSnorkellingRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(divingSnorkellingRequestedExtractor.includes('.trim(')).toBe(false);
    expect(divingSnorkellingRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(divingSnorkellingRequestedExtractor.includes('includes(')).toBe(false);
    expect(divingSnorkellingRequestedExtractor).toMatch(
      /divingSnorkellingRequested:\s*true/,
    );
    expect(
      divingSnorkellingRequestedExtractor.includes('divingSnorkellingRequested: false'),
    ).toBe(false);
    expect(
      divingSnorkellingRequestedExtractor.includes('divingSnorkellingRequested: null'),
    ).toBe(false);
    const wineriesFoodTrailsRequestedExtractor = readSrc(
      'src/features/conversation-core/extractors/WineriesFoodTrailsRequestedConversationStateExtractor.ts',
    );
    expect(wineriesFoodTrailsRequestedExtractor).toMatch(
      /export class WineriesFoodTrailsRequestedConversationStateExtractor/,
    );
    expect(wineriesFoodTrailsRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(wineriesFoodTrailsRequestedExtractor).toMatch(/input\.message/);
    expect(wineriesFoodTrailsRequestedExtractor.includes('input.currentState')).toBe(
      false,
    );
    expect(wineriesFoodTrailsRequestedExtractor.includes('.trim(')).toBe(false);
    expect(wineriesFoodTrailsRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(wineriesFoodTrailsRequestedExtractor.includes('includes(')).toBe(false);
    expect(wineriesFoodTrailsRequestedExtractor).toMatch(
      /wineriesFoodTrailsRequested:\s*true/,
    );
    expect(
      wineriesFoodTrailsRequestedExtractor.includes('wineriesFoodTrailsRequested: false'),
    ).toBe(false);
    expect(
      wineriesFoodTrailsRequestedExtractor.includes('wineriesFoodTrailsRequested: null'),
    ).toBe(false);
    const eventsFestivalsRequestedExtractor = readSrc(
      'src/features/conversation-core/extractors/EventsFestivalsRequestedConversationStateExtractor.ts',
    );
    expect(eventsFestivalsRequestedExtractor).toMatch(
      /export class EventsFestivalsRequestedConversationStateExtractor/,
    );
    expect(eventsFestivalsRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(eventsFestivalsRequestedExtractor).toMatch(/input\.message/);
    expect(eventsFestivalsRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(eventsFestivalsRequestedExtractor.includes('.trim(')).toBe(false);
    expect(eventsFestivalsRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(eventsFestivalsRequestedExtractor.includes('includes(')).toBe(false);
    expect(eventsFestivalsRequestedExtractor).toMatch(
      /eventsFestivalsRequested:\s*true/,
    );
    expect(
      eventsFestivalsRequestedExtractor.includes('eventsFestivalsRequested: false'),
    ).toBe(false);
    expect(
      eventsFestivalsRequestedExtractor.includes('eventsFestivalsRequested: null'),
    ).toBe(false);
    const wildlifeRequestedExtractor = readSrc(
      'src/features/conversation-core/extractors/WildlifeRequestedConversationStateExtractor.ts',
    );
    expect(wildlifeRequestedExtractor).toMatch(
      /export class WildlifeRequestedConversationStateExtractor/,
    );
    expect(wildlifeRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(wildlifeRequestedExtractor).toMatch(/input\.message/);
    expect(wildlifeRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(wildlifeRequestedExtractor.includes('.trim(')).toBe(false);
    expect(wildlifeRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(wildlifeRequestedExtractor.includes('includes(')).toBe(false);
    expect(wildlifeRequestedExtractor).toMatch(/wildlifeRequested:\s*true/);
    expect(wildlifeRequestedExtractor.includes('wildlifeRequested: false')).toBe(
      false,
    );
    expect(wildlifeRequestedExtractor.includes('wildlifeRequested: null')).toBe(
      false,
    );
    const nationalParksRequestedExtractor = readSrc(
      'src/features/conversation-core/extractors/NationalParksRequestedConversationStateExtractor.ts',
    );
    expect(nationalParksRequestedExtractor).toMatch(
      /export class NationalParksRequestedConversationStateExtractor/,
    );
    expect(nationalParksRequestedExtractor).toContain('Phase 7AA');
    expect(nationalParksRequestedExtractor).toContain('Phase 8Q');
    expect(nationalParksRequestedExtractor).toMatch(
      /input: ConversationStateExtractionInput/,
    );
    expect(nationalParksRequestedExtractor).toMatch(/input\.message/);
    expect(nationalParksRequestedExtractor.includes('input.currentState')).toBe(false);
    expect(nationalParksRequestedExtractor.includes('.trim(')).toBe(false);
    expect(nationalParksRequestedExtractor.includes('toLowerCase')).toBe(false);
    expect(nationalParksRequestedExtractor.includes('includes(')).toBe(false);
    expect(nationalParksRequestedExtractor).toMatch(/nationalParksRequested:\s*true/);
    expect(
      nationalParksRequestedExtractor.includes('nationalParksRequested: false'),
    ).toBe(false);
    expect(
      nationalParksRequestedExtractor.includes('nationalParksRequested: null'),
    ).toBe(false);
    expect(compositeExtractor).toMatch(
      /export class CompositeConversationStateExtractor/,
    );
    expect(compositeExtractor).toMatch(
      /constructor\(\s*private readonly extractors: readonly ConversationStateExtractor\[\],\s*\)/,
    );
    expect(compositeExtractor.includes('applyConversationStateUpdate')).toBe(false);
    expect(compositeExtractor.includes('hasConversationStateUpdateChanged')).toBe(
      false,
    );
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
