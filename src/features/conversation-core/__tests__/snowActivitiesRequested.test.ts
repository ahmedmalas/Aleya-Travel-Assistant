import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-snow-activities-requested-001';
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

describe('phase 3T/7T — explicit snowActivitiesRequested with extraction activation', () => {
  it('initial snowActivitiesRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.snowActivitiesRequested).toBeNull();
  });

  it('explicit true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want snow activities', initial, 0, {
      snowActivitiesRequested: true,
    });
    expect(result.state.snowActivitiesRequested).toBe(true);
  });

  it('explicit false is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need skiing', initial, 0, {
      snowActivitiesRequested: true,
    });
    expect(withTrue.state.snowActivitiesRequested).toBe(true);

    const withFalse = turn('no skiing', withTrue.state, 1, {
      snowActivitiesRequested: false,
    });
    expect(withFalse.state.snowActivitiesRequested).toBe(false);
    expect(withFalse.state.snowActivitiesRequested).not.toBeNull();
  });

  it('omission preserves a previous true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      snowActivitiesRequested: true,
    });
    expect(first.state.snowActivitiesRequested).toBe(true);

    const second = turn('skiing snowboarding sledding', first.state, 1);
    expect(second.state.snowActivitiesRequested).toBe(true);
  });

  it('omission preserves a previous false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, {
      snowActivitiesRequested: false,
    });
    expect(first.state.snowActivitiesRequested).toBe(false);

    const second = turn('snow winter alpine Thredbo', first.state, 1);
    expect(second.state.snowActivitiesRequested).toBe(false);
  });

  it('unsupported snow-adjacent wording cannot set snowActivitiesRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'snow',
      'winter',
      'alpine',
      'Thredbo',
      'ski hire',
      'snow forecast',
      'ski conditions',
      'lift pass prices',
      'what is skiing',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.snowActivitiesRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit snow-activity cue in the message sets snowActivitiesRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('skiing options', initial, 0);
    expect(result.state.snowActivitiesRequested).toBe(true);
  });

  it('phase 8W clear snow-activity-discovery cues set snowActivitiesRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const bare = turn('snow activities', initial, 0);
    expect(bare.state.snowActivitiesRequested).toBe(true);
    expect(bare.state.activitiesRequested).toBeNull();
    expect(bare.state.nearbyDiscoveryRequested).toBeNull();
    expect(bare.state.attractionsRequested).toBeNull();

    const skiing = turn('skiing', initial, 1);
    expect(skiing.state.snowActivitiesRequested).toBe(true);

    const resorts = turn('snow resorts', initial, 2);
    expect(resorts.state.snowActivitiesRequested).toBe(true);

    const question = turn('where can I go skiing?', initial, 3);
    expect(question.state.snowActivitiesRequested).toBe(true);

    const recommend = turn('can you recommend snow activities?', initial, 4);
    expect(recommend.state.snowActivitiesRequested).toBe(true);

    const inRequest = turn(
      'show me snow activities in Thredbo. Fly from Sydney to Canberra',
      initial,
      5,
    );
    expect(inRequest.state.snowActivitiesRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Canberra');

    const seeded = turn('Hello', initial, 6, {
      snowActivitiesRequested: false,
    });
    const negated = turn('no snow activities', seeded.state, 7);
    expect(negated.state.snowActivitiesRequested).toBe(false);
    const hire = turn('ski hire', seeded.state, 8);
    expect(hire.state.snowActivitiesRequested).toBe(false);
    const named = turn('Thredbo', seeded.state, 9);
    expect(named.state.snowActivitiesRequested).toBe(false);
    const conditions = turn('ski conditions', seeded.state, 10);
    expect(conditions.state.snowActivitiesRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.snowActivitiesRequested overrides an extracted snow-activity request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('skiing options', initial, 0, {
      snowActivitiesRequested: false,
    });
    expect(overriddenFalse.state.snowActivitiesRequested).toBe(false);

    const overriddenTrue = turn('no snow activities', initial, 1, {
      snowActivitiesRequested: true,
    });
    expect(overriddenTrue.state.snowActivitiesRequested).toBe(true);

    const nullOverride = turn('skiing options', initial, 2, {
      snowActivitiesRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.snowActivitiesRequested).toBeNull();
  });

  it('unsupported wording preserves an existing snowActivitiesRequested value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('Hello', initial, 0, {
      snowActivitiesRequested: true,
    });
    expect(withTrue.state.snowActivitiesRequested).toBe(true);

    const afterWords = turn('snow winter alpine Thredbo', withTrue.state, 1);
    expect(afterWords.state.snowActivitiesRequested).toBe(true);

    const withFalse = turn('change', afterWords.state, 2, {
      snowActivitiesRequested: false,
    });
    expect(withFalse.state.snowActivitiesRequested).toBe(false);

    const afterMoreWords = turn('ski hire snow forecast', withFalse.state, 3);
    expect(afterMoreWords.state.snowActivitiesRequested).toBe(false);
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
    });
    expect(first.state.snowActivitiesRequested).toBe(true);
    expect(first.state.attractionsRequested).toBe(true);
    expect(first.state.scenicDrivesRequested).toBe(true);
    expect(first.state.kayakingRequested).toBe(true);
    expect(first.state.flightsRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.status).toBe('active');
    expect(first.state.turnCount).toBe(1);

    const second = turn('no snow activities', first.state, 1, {
      snowActivitiesRequested: false,
    });
    expect(second.state.snowActivitiesRequested).toBe(false);
    expect(second.state.attractionsRequested).toBe(true);
    expect(second.state.scenicDrivesRequested).toBe(true);
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Gold Coast');
    expect(second.state.turnCount).toBe(2);
  });

  it('existing transcript behaviour remains unchanged', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Sydney to Gold Coast!!!!', initial, 0, {
      snowActivitiesRequested: true,
    });

    expect(first.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(first.state.transcript[0]?.message).toBe('Sydney to Gold Coast!!!!');
    expect(first.state.transcript[1]?.message).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(first.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);

    const second = turn('skiing snowboarding snow', first.state, 1);
    expect(second.state.snowActivitiesRequested).toBe(true);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
  });
});
