import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-wildlife-requested-001';
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

describe('phase 3Z/7Z — explicit wildlifeRequested with extraction activation', () => {
  it('initial wildlifeRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.wildlifeRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want wildlife', initial, 0, {
      wildlifeRequested: true,
    });
    expect(result.state.wildlifeRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need kangaroos', initial, 0, {
      wildlifeRequested: true,
    });
    expect(withTrue.state.wildlifeRequested).toBe(true);

    const withFalse = turn('no kangaroos', withTrue.state, 1, {
      wildlifeRequested: false,
    });
    expect(withFalse.state.wildlifeRequested).toBe(false);
    expect(withFalse.state.wildlifeRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      wildlifeRequested: true,
    });
    expect(first.state.wildlifeRequested).toBe(true);

    const second = turn('kangaroo koala zoo', first.state, 1);
    expect(second.state.wildlifeRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      wildlifeRequested: false,
    });
    expect(first.state.wildlifeRequested).toBe(false);

    const second = turn('wildlife parks marine wildlife', first.state, 1);
    expect(second.state.wildlifeRequested).toBe(false);
  });

  it('user message text cannot set wildlifeRequested from unsupported wording', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'kangaroo',
      'koala',
      'dolphin',
      'zoo',
      'aquarium',
      'sanctuary',
      'wildlife parks',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.wildlifeRequested).toBeNull();
      state = result.state;
    });
  });

  it('user message text cannot clear or change an existing value via unsupported wording', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      wildlifeRequested: true,
    });
    expect(withTrue.state.wildlifeRequested).toBe(true);

    const afterWords = turn('wildlife parks kangaroo', withTrue.state, 1);
    expect(afterWords.state.wildlifeRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      wildlifeRequested: false,
    });
    expect(withFalse.state.wildlifeRequested).toBe(false);

    const afterMoreWords = turn(
      'kangaroo koala zoo aquarium',
      withFalse.state,
      3,
    );
    expect(afterMoreWords.state.wildlifeRequested).toBe(false);
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
    expect(first.state.nationalParksRequested).toBe(true);
    expect(first.state.wildlifeRequested).toBe(true);
    expect(first.state.eventsFestivalsRequested).toBe(true);
    expect(first.state.wineriesFoodTrailsRequested).toBe(true);
    expect(first.state.divingSnorkellingRequested).toBe(true);
    expect(first.state.fishingRequested).toBe(true);
    expect(first.state.hikingWalkingRequested).toBe(true);
    expect(first.state.snowActivitiesRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);

    const second = turn('no wildlife', first.state, 1, {
      wildlifeRequested: false,
    });
    expect(second.state.wildlifeRequested).toBe(false);
    expect(second.state.nationalParksRequested).toBe(true);
    expect(second.state.eventsFestivalsRequested).toBe(true);
    expect(second.state.wineriesFoodTrailsRequested).toBe(true);
    expect(second.state.divingSnorkellingRequested).toBe(true);
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
      wildlifeRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('kangaroo koala zoo', first.state, 1);
    expect(second.state.wildlifeRequested).toBe(true);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
