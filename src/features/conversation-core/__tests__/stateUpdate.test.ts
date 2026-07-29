import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-state-update-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-${index}`,
    assistantEntryId: `assistant-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
}

describe('phase 4A — explicit ConversationStateUpdate boundary only', () => {
  it('omitted stateUpdate preserves existing behaviour and fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const seeded = turn('seed', initial, 0, {
      origin: 'Sydney',
      destination: 'Gold Coast',
      departureDate: '2026-08-15',
      returnDate: '2026-08-22',
      adultCount: 2,
      childCount: 1,
      infantCount: 1,
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
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      fishingRequested: true,
      divingSnorkellingRequested: true,
      toursRequested: false,
      eventsRequested: true,
      nightlifeRequested: false,
      shoppingRequested: true,
      wellnessRequested: false,
      familyActivitiesRequested: true,
      accessibleTravelRequested: false,
    });

    const omitted = turn('no update object', seeded.state, 1);
    expect(omitted.state.origin).toBe('Sydney');
    expect(omitted.state.destination).toBe('Gold Coast');
    expect(omitted.state.departureDate).toBe('2026-08-15');
    expect(omitted.state.returnDate).toBe('2026-08-22');
    expect(omitted.state.adultCount).toBe(2);
    expect(omitted.state.childCount).toBe(1);
    expect(omitted.state.infantCount).toBe(1);
    expect(omitted.state.flightsRequested).toBe(true);
    expect(omitted.state.accommodationRequested).toBe(true);
    expect(omitted.state.carHireRequested).toBe(false);
    expect(omitted.state.activitiesRequested).toBe(true);
    expect(omitted.state.restaurantsRequested).toBe(false);
    expect(omitted.state.nearbyDiscoveryRequested).toBe(true);
    expect(omitted.state.beachesRequested).toBe(true);
    expect(omitted.state.campingRequested).toBe(false);
    expect(omitted.state.kayakingRequested).toBe(true);
    expect(omitted.state.fourWheelDriveRequested).toBe(false);
    expect(omitted.state.scenicDrivesRequested).toBe(true);
    expect(omitted.state.attractionsRequested).toBe(true);
    expect(omitted.state.toursRequested).toBe(false);
    expect(omitted.state.eventsRequested).toBe(true);
    expect(omitted.state.nightlifeRequested).toBe(false);
    expect(omitted.state.shoppingRequested).toBe(true);
    expect(omitted.state.wellnessRequested).toBe(false);
    expect(omitted.state.familyActivitiesRequested).toBe(true);
    expect(omitted.state.accessibleTravelRequested).toBe(false);
    expect(omitted.state.status).toBe('active');
    expect(omitted.state.turnCount).toBe(2);
    expect(omitted.state.ageMs).toBe(3000);
    expect(omitted.state.updatedAt).toBe('2026-07-29T00:00:03.000Z');
    expect(omitted.state.createdAt).toBe(initial.createdAt);
    expect(omitted.state.conversationId).toBe(CONVERSATION_ID);
    expect(omitted.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(omitted.state.transcript).toHaveLength(4);
  });

  it('supplied stateUpdate updates explicit fields exactly as before', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('plan my trip', initial, 0, {
      origin: 'Brisbane',
      destination: 'Cairns',
      departureDate: '2026-09-01',
      returnDate: '2026-09-10',
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      flightsRequested: true,
      accommodationRequested: false,
      carHireRequested: true,
      activitiesRequested: false,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: false,
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
      toursRequested: true,
      eventsRequested: false,
      nightlifeRequested: true,
      shoppingRequested: false,
      wellnessRequested: true,
      familyActivitiesRequested: false,
      accessibleTravelRequested: true,
    });

    expect(result.state.origin).toBe('Brisbane');
    expect(result.state.destination).toBe('Cairns');
    expect(result.state.departureDate).toBe('2026-09-01');
    expect(result.state.returnDate).toBe('2026-09-10');
    expect(result.state.adultCount).toBe(2);
    expect(result.state.childCount).toBe(0);
    expect(result.state.infantCount).toBe(0);
    expect(result.state.flightsRequested).toBe(true);
    expect(result.state.accommodationRequested).toBe(false);
    expect(result.state.carHireRequested).toBe(true);
    expect(result.state.activitiesRequested).toBe(false);
    expect(result.state.restaurantsRequested).toBe(true);
    expect(result.state.nearbyDiscoveryRequested).toBe(false);
    expect(result.state.beachesRequested).toBe(true);
    expect(result.state.campingRequested).toBe(false);
    expect(result.state.kayakingRequested).toBe(true);
    expect(result.state.fourWheelDriveRequested).toBe(false);
    expect(result.state.scenicDrivesRequested).toBe(true);
    expect(result.state.attractionsRequested).toBe(false);
    expect(result.state.toursRequested).toBe(true);
    expect(result.state.eventsRequested).toBe(false);
    expect(result.state.nightlifeRequested).toBe(true);
    expect(result.state.shoppingRequested).toBe(false);
    expect(result.state.wellnessRequested).toBe(true);
    expect(result.state.familyActivitiesRequested).toBe(false);
    expect(result.state.accessibleTravelRequested).toBe(true);
  });

  it('omitted properties preserve previous values', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('seed', initial, 0, {
      destination: 'Melbourne',
      flightsRequested: true,
      accessibleTravelRequested: false,
    });
    expect(first.state.destination).toBe('Melbourne');
    expect(first.state.flightsRequested).toBe(true);
    expect(first.state.accessibleTravelRequested).toBe(false);
    expect(first.state.origin).toBeNull();

    const second = turn('only change origin', first.state, 1, {
      origin: 'Sydney',
    });
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Melbourne');
    expect(second.state.flightsRequested).toBe(true);
    expect(second.state.accessibleTravelRequested).toBe(false);
  });

  it('explicit false still survives through stateUpdate', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need flights', initial, 0, {
      flightsRequested: true,
      carHireRequested: true,
    });
    expect(withTrue.state.flightsRequested).toBe(true);
    expect(withTrue.state.carHireRequested).toBe(true);

    const withFalse = turn('no flights', withTrue.state, 1, {
      flightsRequested: false,
      carHireRequested: false,
    });
    expect(withFalse.state.flightsRequested).toBe(false);
    expect(withFalse.state.flightsRequested).not.toBeNull();
    expect(withFalse.state.carHireRequested).toBe(false);
    expect(withFalse.state.carHireRequested).not.toBeNull();

    const preserved = turn('still no', withFalse.state, 2);
    expect(preserved.state.flightsRequested).toBe(false);
    expect(preserved.state.carHireRequested).toBe(false);
  });

  it('user message text only activates currently live extractors through the update boundary', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn(
      'flights hotels car hire beaches nightlife shopping wellness',
      initial,
      0,
    );
    expect(result.state.flightsRequested).toBe(true);
    expect(result.state.accommodationRequested).toBe(true);
    expect(result.state.carHireRequested).toBe(true);
    expect(result.state.beachesRequested).toBe(true);
    expect(result.state.nightlifeRequested).toBeNull();
    expect(result.state.shoppingRequested).toBeNull();
    expect(result.state.wellnessRequested).toBeNull();
    expect(result.state.destination).toBeNull();
  });
});
