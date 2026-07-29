import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasConversationStateUpdateChanged } from '../hasConversationStateUpdateChanged';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';

const CONVERSATION_ID = 'conversation-core-has-state-update-changed-001';
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
    infantCount: 0,
    flightsRequested: true,
    accommodationRequested: true,
    carHireRequested: false,
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
    toursRequested: true,
    eventsRequested: true,
    nightlifeRequested: true,
    shoppingRequested: true,
    wellnessRequested: true,
    familyActivitiesRequested: true,
    accessibleTravelRequested: null,
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

describe('phase 4C — pure hasConversationStateUpdateChanged only', () => {
  it('omitted stateUpdate returns false', () => {
    expect(hasConversationStateUpdateChanged(seededState())).toBe(false);
  });

  it('empty stateUpdate returns false', () => {
    expect(hasConversationStateUpdateChanged(seededState(), {})).toBe(false);
  });

  it('a supplied identical string returns false', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        destination: 'Gold Coast',
      }),
    ).toBe(false);
  });

  it('a supplied different string returns true', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        destination: 'Cairns',
      }),
    ).toBe(true);
  });

  it('explicit null matching the current value returns false', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        accessibleTravelRequested: null,
      }),
    ).toBe(false);
  });

  it('explicit null clearing an existing value returns true', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        destination: null,
      }),
    ).toBe(true);
  });

  it('explicit false matching the current value returns false', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        carHireRequested: false,
      }),
    ).toBe(false);
  });

  it('explicit false replacing true returns true', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        flightsRequested: false,
      }),
    ).toBe(true);
  });

  it('explicit true replacing false returns true', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        carHireRequested: true,
      }),
    ).toBe(true);
  });

  it('explicit 0 matching the current count returns false', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        infantCount: 0,
      }),
    ).toBe(false);
  });

  it('explicit 0 replacing another count returns true', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        adultCount: 0,
      }),
    ).toBe(true);
  });

  it('one changed property among unchanged neighbouring properties returns true', () => {
    expect(
      hasConversationStateUpdateChanged(seededState(), {
        origin: 'Sydney',
        destination: 'Gold Coast',
        adultCount: 2,
        flightsRequested: true,
        carHireRequested: false,
        shoppingRequested: false,
      }),
    ).toBe(true);
  });

  it('incoming canonical state is not mutated', () => {
    const current = seededState();
    const snapshot = structuredClone(current);
    hasConversationStateUpdateChanged(current, {
      destination: 'Melbourne',
      flightsRequested: false,
      adultCount: 0,
    });
    expect(current).toEqual(snapshot);
  });

  it('incoming update object is not mutated', () => {
    const current = seededState();
    const stateUpdate: ConversationStateUpdate = {
      destination: 'Melbourne',
      flightsRequested: false,
      adultCount: 0,
    };
    const snapshot = structuredClone(stateUpdate);
    hasConversationStateUpdateChanged(current, stateUpdate);
    expect(stateUpdate).toEqual(snapshot);
  });

  it('message text is not accepted by or available to the function', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/conversation-core/hasConversationStateUpdateChanged.ts',
      ),
      'utf8',
    );
    expect(source).toMatch(
      /export function hasConversationStateUpdateChanged\(\s*currentState: ConversationCoreState,\s*stateUpdate\?: ConversationStateUpdate,\s*\)/,
    );
    expect(source.includes('message')).toBe(false);
    expect(hasConversationStateUpdateChanged.length).toBeLessThanOrEqual(2);

    const current = seededState();
    expect(
      hasConversationStateUpdateChanged(current, {
        destination: 'flights hotels beaches nightlife',
      }),
    ).toBe(true);
    expect(
      hasConversationStateUpdateChanged(current, {
        destination: 'Gold Coast',
      }),
    ).toBe(false);
  });
});
