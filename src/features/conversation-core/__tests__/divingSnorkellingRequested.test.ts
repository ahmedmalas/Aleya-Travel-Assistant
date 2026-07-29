import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-diving-snorkelling-requested-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  fields: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    adultCount?: number;
    childCount?: number;
    infantCount?: number;
    flightsRequested?: boolean;
    accommodationRequested?: boolean;
    carHireRequested?: boolean;
    activitiesRequested?: boolean;
    restaurantsRequested?: boolean;
    nearbyDiscoveryRequested?: boolean;
    beachesRequested?: boolean;
    campingRequested?: boolean;
    kayakingRequested?: boolean;
    fourWheelDriveRequested?: boolean;
    scenicDrivesRequested?: boolean;
    attractionsRequested?: boolean;
    snowActivitiesRequested?: boolean;
    hikingWalkingRequested?: boolean;
    fishingRequested?: boolean;
    divingSnorkellingRequested?: boolean;
    wineriesFoodTrailsRequested?: boolean;
    eventsFestivalsRequested?: boolean;
    wildlifeRequested?: boolean;
    nationalParksRequested?: boolean;
  } = {},
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-${index}`,
    assistantEntryId: `assistant-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
    ...(Object.keys(fields).length > 0
      ? { stateUpdate: fields }
      : {}),
  });
}

describe('phase 3W/7W — explicit divingSnorkellingRequested with extraction activation', () => {
  it('initial divingSnorkellingRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.divingSnorkellingRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want diving', initial, 0, {
      divingSnorkellingRequested: true,
    });
    expect(result.state.divingSnorkellingRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need scuba', initial, 0, {
      divingSnorkellingRequested: true,
    });
    expect(withTrue.state.divingSnorkellingRequested).toBe(true);

    const withFalse = turn('no scuba', withTrue.state, 1, {
      divingSnorkellingRequested: false,
    });
    expect(withFalse.state.divingSnorkellingRequested).toBe(false);
    expect(withFalse.state.divingSnorkellingRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      divingSnorkellingRequested: true,
    });
    expect(first.state.divingSnorkellingRequested).toBe(true);

    const second = turn('scuba dive boats', first.state, 1);
    expect(second.state.divingSnorkellingRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      divingSnorkellingRequested: false,
    });
    expect(first.state.divingSnorkellingRequested).toBe(false);

    const second = turn('scuba diving reef diving', first.state, 1);
    expect(second.state.divingSnorkellingRequested).toBe(false);
  });

  it('user message text cannot set divingSnorkellingRequested from unsupported wording', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'dive',
      'snorkel',
      'scuba',
      'boats',
      'gear',
      'scuba diving',
      'reef diving',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.divingSnorkellingRequested).toBeNull();
      state = result.state;
    });
  });

  it('user message text cannot clear or change an existing value via unsupported wording', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      divingSnorkellingRequested: true,
    });
    expect(withTrue.state.divingSnorkellingRequested).toBe(true);

    const afterWords = turn('scuba diving gear', withTrue.state, 1);
    expect(afterWords.state.divingSnorkellingRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      divingSnorkellingRequested: false,
    });
    expect(withFalse.state.divingSnorkellingRequested).toBe(false);

    const afterMoreWords = turn(
      'scuba dive boats gear',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.divingSnorkellingRequested).toBe(false);
  });

  it('all previous request flags and canonical fields are preserved', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      origin: 'Sydney',
      destination: 'Gold Coast',
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
      nationalParksRequested: true,
    });
    expect(first.state.divingSnorkellingRequested).toBe(true);
    expect(first.state.fishingRequested).toBe(true);
    expect(first.state.hikingWalkingRequested).toBe(true);
    expect(first.state.snowActivitiesRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);

    const second = turn('no diving', first.state, 1, {
      divingSnorkellingRequested: false,
    });
    expect(second.state.divingSnorkellingRequested).toBe(false);
    expect(second.state.fishingRequested).toBe(true);
    expect(second.state.hikingWalkingRequested).toBe(true);
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.turnCount).toBe(2);
  });

  it('existing transcript behaviour remains unchanged', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, {
      divingSnorkellingRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('scuba dive boats', first.state, 1);
    expect(second.state.divingSnorkellingRequested).toBe(true);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
