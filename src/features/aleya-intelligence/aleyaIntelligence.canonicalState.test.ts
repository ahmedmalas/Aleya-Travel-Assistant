import { afterEach, describe, expect, it } from 'vitest';
import {
  getCanonicalTravelState,
  handleTravelChatMessage,
  projectRequirementsSummary,
  projectSearchForm,
  resetCanonicalTravelState,
} from './index';
import { processTravelMessage } from './pipeline';
import { createEmptyConversationState } from './types';

const NOW = new Date('2026-07-27T10:00:00+10:00');
const CANONICAL =
  'I want to go to Gold Coast on 28 August departing from Melbourne, staying in Surfers Paradise for three nights, returning Monday. I need flights, hotel and car hire.';

afterEach(() => {
  resetCanonicalTravelState();
});

describe('Canonical travel state — single source of truth', () => {
  it('handleTravelChatMessage commits merged state to the store for UI + search', () => {
    const result = handleTravelChatMessage({ message: CANONICAL, now: NOW });
    const stored = getCanonicalTravelState();
    expect(stored).toEqual(result.state);
    expect(stored.origin?.value).toBe('Melbourne');
    expect(stored.destination?.value).toBe('Gold Coast');
    expect(stored.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(stored.returnDate?.value.isoDate).toBe('2026-08-31');

    const summary = projectRequirementsSummary(stored);
    expect(summary).toMatchObject({
      origin: 'Melbourne',
      destination: 'Gold Coast',
      departing: '28/08/2026',
      returning: '31/08/2026',
      accommodation: 'Surfers Paradise',
      duration: '3 nights',
    });
    expect(summary.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );

    const search = projectSearchForm(stored);
    expect(search.originCode).toBe('MEL');
    expect(search.destinationCode).toBe('OOL');
    expect(search.departDate).toBe('2026-08-28');
    expect(search.returnDate).toBe('2026-08-31');

    expect(result.stage).toBe('continue');
    expect(result.reply).not.toMatch(/Which date would you like to travel/i);
    expect(result.reply).toMatch(/Gold Coast/i);
    expect(result.reply).not.toMatch(/destination Melbourne/i);
  });

  it('follow-up turns read the same canonical store (no panel-local stale copy)', () => {
    handleTravelChatMessage({ message: CANONICAL, now: NOW });
    const second = handleTravelChatMessage({ message: '28-08-26', now: NOW });
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.stage).toBe('continue');
    expect(second.reply).not.toMatch(/Which date would you like to travel/i);
    expect(second.clarifications).toEqual([]);
    expect(getCanonicalTravelState().destination?.value).toBe('Gold Coast');
  });

  it('go to X replaces a previously confirmed destination (no vault-seed stickiness)', () => {
    const seeded = {
      ...createEmptyConversationState(),
      destination: {
        value: 'Melbourne',
        source: 'confirmed' as const,
        confidence: 0.9,
        confidenceLevel: 'high' as const,
      },
    };
    const result = processTravelMessage({
      message: CANONICAL,
      previousState: seeded,
      now: NOW,
    });
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(result.state.returnDate?.value.isoDate).toBe('2026-08-31');
    expect(result.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(result.stage).toBe('continue');
    expect(result.reply).toMatch(/destination Gold Coast/i);
    expect(result.reply).not.toMatch(/destination Melbourne/i);
    expect(result.reply).not.toMatch(/Which date would you like to travel/i);
  });

  it('numeric AU date replies settle clarification instead of looping', () => {
    const first = processTravelMessage({
      message: 'Flights from Melbourne to Gold Coast. I need a hotel too.',
      now: NOW,
    });
    expect(first.reply).toMatch(/Which date would you like to travel/i);

    const second = processTravelMessage({
      message: '28-08-26',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.reply).not.toMatch(/Which date would you like to travel/i);
    expect(second.stage).toBe('continue');
  });

  it('UI summary projector and clarify lead share the same destination/date facts', () => {
    const result = processTravelMessage({ message: CANONICAL, now: NOW });
    const summary = projectRequirementsSummary(result.state);
    expect(summary.destination).toBe('Gold Coast');
    expect(summary.departing).toBe('28/08/2026');
    expect(result.reply).toContain('Gold Coast');
    expect(result.reply).toMatch(/28\/08\/2026|28 august/i);
  });
});
