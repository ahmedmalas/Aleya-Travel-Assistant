import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyConversationStateUpdate } from '../applyConversationStateUpdate';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-apply-state-update-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function seededState(): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    }),
    status: 'active',
    turnCount: 3,
    updatedAt: '2026-07-29T00:00:05.000Z',
    ageMs: 5000,
    destination: 'Gold Coast',
    origin: 'Sydney',
    departureDate: '2026-08-15',
    returnDate: '2026-08-22',
    adultCount: 2,
    childCount: 1,
    infantCount: 1,
    flightsRequested: true,
    accommodationRequested: true,
    carHireRequested: true,
    activitiesRequested: true,
    restaurantsRequested: true,
    nearbyDiscoveryRequested: true,
    beachesRequested: true,
    campingRequested: true,
    kayakingRequested: true,
    fourWheelDriveRequested: true,
    scenicDrivesRequested: true,
    attractionsRequested: true,
    snowActivitiesRequested: true,
    hikingWalkingRequested: true,
    fishingRequested: true,
    divingSnorkellingRequested: true,
    wineriesFoodTrailsRequested: true,
    eventsFestivalsRequested: true,
    wildlifeRequested: true,
    toursRequested: true,
    eventsRequested: true,
    nightlifeRequested: true,
    shoppingRequested: true,
    wellnessRequested: true,
    familyActivitiesRequested: true,
    accessibleTravelRequested: true,
    transcript: [
      {
        id: 'user-0',
        role: 'user',
        message: 'seed',
        timestamp: '2026-07-29T00:00:00.000Z',
      },
    ],
  };
}

describe('phase 4B — pure applyConversationStateUpdate only', () => {
  it('omitted stateUpdate preserves all existing travel fields', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current);
    expect(applied).toEqual({
      destination: 'Gold Coast',
      origin: 'Sydney',
      departureDate: '2026-08-15',
      returnDate: '2026-08-22',
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: true,
      campingRequested: true,
      kayakingRequested: true,
      fourWheelDriveRequested: true,
      scenicDrivesRequested: true,
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: true,
      eventsFestivalsRequested: true,
      wildlifeRequested: true,
      toursRequested: true,
      eventsRequested: true,
      nightlifeRequested: true,
      shoppingRequested: true,
      wellnessRequested: true,
      familyActivitiesRequested: true,
      accessibleTravelRequested: true,
    });
  });

  it('empty stateUpdate preserves all existing travel fields', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current, {});
    expect(applied).toEqual({
      destination: 'Gold Coast',
      origin: 'Sydney',
      departureDate: '2026-08-15',
      returnDate: '2026-08-22',
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
      flightsRequested: true,
      accommodationRequested: true,
      carHireRequested: true,
      activitiesRequested: true,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: true,
      beachesRequested: true,
      campingRequested: true,
      kayakingRequested: true,
      fourWheelDriveRequested: true,
      scenicDrivesRequested: true,
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      wineriesFoodTrailsRequested: true,
      eventsFestivalsRequested: true,
      wildlifeRequested: true,
      toursRequested: true,
      eventsRequested: true,
      nightlifeRequested: true,
      shoppingRequested: true,
      wellnessRequested: true,
      familyActivitiesRequested: true,
      accessibleTravelRequested: true,
    });
  });

  it('a supplied string replaces the existing string', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current, {
      destination: 'Cairns',
    });
    expect(applied.destination).toBe('Cairns');
    expect(applied.origin).toBe('Sydney');
  });

  it('explicit null clears an existing string', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current, {
      destination: null,
      origin: null,
    });
    expect(applied.destination).toBeNull();
    expect(applied.origin).toBeNull();
    expect(applied.departureDate).toBe('2026-08-15');
  });

  it('a supplied count replaces the existing count', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current, {
      adultCount: 4,
      childCount: 2,
    });
    expect(applied.adultCount).toBe(4);
    expect(applied.childCount).toBe(2);
    expect(applied.infantCount).toBe(1);
  });

  it('explicit null clears an existing count', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current, {
      adultCount: null,
      infantCount: null,
    });
    expect(applied.adultCount).toBeNull();
    expect(applied.infantCount).toBeNull();
    expect(applied.childCount).toBe(1);
  });

  it('explicit boolean true replaces the existing value', () => {
    const current = {
      ...seededState(),
      flightsRequested: false,
    };
    const applied = applyConversationStateUpdate(current, {
      flightsRequested: true,
    });
    expect(applied.flightsRequested).toBe(true);
  });

  it('explicit boolean false replaces and survives', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current, {
      flightsRequested: false,
      accessibleTravelRequested: false,
    });
    expect(applied.flightsRequested).toBe(false);
    expect(applied.flightsRequested).not.toBeNull();
    expect(applied.accessibleTravelRequested).toBe(false);
    expect(applied.accessibleTravelRequested).not.toBeNull();
    expect(applied.accommodationRequested).toBe(true);
  });

  it('omitted properties preserve neighbouring values', () => {
    const current = seededState();
    const applied = applyConversationStateUpdate(current, {
      shoppingRequested: false,
    });
    expect(applied.shoppingRequested).toBe(false);
    expect(applied.nightlifeRequested).toBe(true);
    expect(applied.wellnessRequested).toBe(true);
    expect(applied.destination).toBe('Gold Coast');
    expect(applied.adultCount).toBe(2);
  });

  it('incoming canonical state is not mutated', () => {
    const current = seededState();
    const snapshot = structuredClone(current);
    applyConversationStateUpdate(current, {
      destination: 'Melbourne',
      flightsRequested: false,
      adultCount: null,
    });
    expect(current).toEqual(snapshot);
  });

  it('message text is not accepted by or available to the function', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/conversation-core/applyConversationStateUpdate.ts',
      ),
      'utf8',
    );
    expect(source).toMatch(
      /export function applyConversationStateUpdate\(\s*currentState: ConversationCoreState,\s*stateUpdate\?: ConversationStateUpdate,\s*\)/,
    );
    expect(source.includes('message')).toBe(false);
    expect(applyConversationStateUpdate.length).toBeLessThanOrEqual(2);

    const current = seededState();
    const applied = applyConversationStateUpdate(current, {
      destination: 'flights hotels beaches nightlife',
    });
    expect(applied.destination).toBe('flights hotels beaches nightlife');
    expect(applied.flightsRequested).toBe(true);
    expect(applied.accommodationRequested).toBe(true);
    expect(applied.beachesRequested).toBe(true);
    expect(applied.nightlifeRequested).toBe(true);
  });
});
