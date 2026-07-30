import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';

const CONVERSATION_ID = 'conversation-core-activities-requested-001';
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

describe('phase 3K — explicit activitiesRequested only', () => {
  it('initial activitiesRequested is null', () => {
    const state = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(state.activitiesRequested).toBeNull();
  });

  it('injected true is stored', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I want activities', initial, 0, {
      activitiesRequested: true,
    });
    expect(result.state.activitiesRequested).toBe(true);
  });

  it('injected false is stored and not treated as omitted', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const withTrue = turn('need tours', initial, 0, {
      activitiesRequested: true,
    });
    expect(withTrue.state.activitiesRequested).toBe(true);

    const withFalse = turn('no activities', withTrue.state, 1, {
      activitiesRequested: false,
    });
    expect(withFalse.state.activitiesRequested).toBe(false);
    expect(withFalse.state.activitiesRequested).not.toBeNull();
  });

  it('omitting activitiesRequested preserves the existing value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { activitiesRequested: true });
    expect(first.state.activitiesRequested).toBe(true);

    const second = turn('sightseeing entertainment', first.state, 1);
    expect(second.state.activitiesRequested).toBe(true);

    const third = turn('Hello', second.state, 2, {
      activitiesRequested: false,
    });
    expect(third.state.activitiesRequested).toBe(false);

    const fourth = turn('adventures tourism', third.state, 3);
    expect(fourth.state.activitiesRequested).toBe(false);
  });

  it('a later injected value replaces the earlier value', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const first = turn('Hello', initial, 0, { activitiesRequested: false });
    expect(first.state.activitiesRequested).toBe(false);

    const second = turn('change', first.state, 1, {
      activitiesRequested: true,
    });
    expect(second.state.activitiesRequested).toBe(true);
  });

  it('message text alone never changes activitiesRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const phrases = [
      'adventures',
      'sightseeing',
      'entertainment',
      'tourism',
      'physical activity',
      'restaurants',
    ];

    let state = initial;
    phrases.forEach((message, index) => {
      const result = turn(message, state, index);
      expect(result.state.activitiesRequested).toBeNull();
      state = result.state;
    });
  });

  it('explicit activity-request cue in the message sets activitiesRequested true', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const result = turn('I need activities', initial, 0);
    expect(result.state.activitiesRequested).toBe(true);
  });

  it('phase 8K clear activity cues set activitiesRequested true without unrelated fields', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const thingsToDo = turn('things to do', initial, 0);
    expect(thingsToDo.state.activitiesRequested).toBe(true);
    expect(thingsToDo.state.flightsRequested).toBeNull();
    expect(thingsToDo.state.restaurantsRequested).toBeNull();
    expect(thingsToDo.state.beachesRequested).toBeNull();

    const tours = turn('book a tour', initial, 1);
    expect(tours.state.activitiesRequested).toBe(true);

    const experiences = turn('local experiences', initial, 2);
    expect(experiences.state.activitiesRequested).toBe(true);

    const inRequest = turn(
      'I need activities. Fly from Sydney to Brisbane',
      initial,
      3,
    );
    expect(inRequest.state.activitiesRequested).toBe(true);
    expect(inRequest.state.origin).toBe('Sydney');
    expect(inRequest.state.destination).toBe('Brisbane');

    const seeded = turn('Hello', initial, 4, {
      activitiesRequested: false,
    });
    const negated = turn('no activities', seeded.state, 5);
    expect(negated.state.activitiesRequested).toBe(false);
    const physical = turn('physical activity', seeded.state, 6);
    expect(physical.state.activitiesRequested).toBe(false);
    const specialised = turn('beaches', seeded.state, 7);
    expect(specialised.state.activitiesRequested).toBe(false);
  });

  it('trusted explicit stateUpdate.activitiesRequested overrides an extracted activity request', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    const overriddenFalse = turn('book activities', initial, 0, {
      activitiesRequested: false,
    });
    expect(overriddenFalse.state.activitiesRequested).toBe(false);

    const overriddenTrue = turn('no activities', initial, 1, {
      activitiesRequested: true,
    });
    expect(overriddenTrue.state.activitiesRequested).toBe(true);

    const nullOverride = turn('book activities', initial, 2, {
      activitiesRequested: null as unknown as boolean,
    });
    expect(nullOverride.state.activitiesRequested).toBeNull();
  });

  it('all existing request flags and earlier fields remain preserved', () => {
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
    });
    expect(first.state.activitiesRequested).toBe(true);
    expect(first.state.flightsRequested).toBe(true);
    expect(first.state.accommodationRequested).toBe(true);
    expect(first.state.carHireRequested).toBe(true);
    expect(first.state.origin).toBe('Sydney');
    expect(first.state.destination).toBe('Gold Coast');
    expect(first.state.departureDate).toBe('2026-08-15');
    expect(first.state.returnDate).toBe('2026-08-22');
    expect(first.state.adultCount).toBe(2);
    expect(first.state.childCount).toBe(1);
    expect(first.state.infantCount).toBe(1);

    const second = turn('no activities', first.state, 1, {
      activitiesRequested: false,
    });
    expect(second.state.activitiesRequested).toBe(false);
    expect(second.state.flightsRequested).toBe(true);
    expect(second.state.accommodationRequested).toBe(true);
    expect(second.state.carHireRequested).toBe(true);
    expect(second.state.origin).toBe('Sydney');
    expect(second.state.destination).toBe('Gold Coast');
    expect(second.state.departureDate).toBe('2026-08-15');
    expect(second.state.returnDate).toBe('2026-08-22');
    expect(second.state.adultCount).toBe(2);
    expect(second.state.childCount).toBe(1);
    expect(second.state.infantCount).toBe(1);

    expect(second.state.status).toBe('active');
    expect(second.state.turnCount).toBe(2);
    expect(second.state.ageMs).toBe(3000);
    expect(second.state.updatedAt).toBe('2026-07-29T00:00:03.000Z');
    expect(second.state.createdAt).toBe(initial.createdAt);
    expect(second.state.transcript).toHaveLength(4);
    expect(second.state.transcript.map((entry) => entry.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(second.reply).toBe(second.state.transcript.at(-1)?.message);
    expect(second.reply).not.toMatch(/assembled|unavailable/i);
  });
});
