import { describe, expect, it } from 'vitest';
import { findLastWeekdayOfMonth } from './clarify';
import { processTravelMessage } from './pipeline';
import { createEmptyConversationState } from './types';

const NOW = new Date('2026-07-26T10:00:00+10:00');

const MELBOURNE_REQUEST =
  'I want to travel to Melbourne at the end of August from Friday afternoon after 5pm and come back to Sydney around afternoon. I’ll need flights around the times I mentioned, car hire that matches the flights schedule and hotel at Docklands.';

describe('Aleya Intelligence Core — Phase 1', () => {
  it('suggests the last Friday of August 2026 as 28 August 2026', () => {
    const friday = findLastWeekdayOfMonth(2026, 8, 5);
    expect(friday.getFullYear()).toBe(2026);
    expect(friday.getMonth()).toBe(7);
    expect(friday.getDate()).toBe(28);
    expect(friday.getDay()).toBe(5);
  });

  it('Melbourne regression: extracts requirements and asks only which Friday', () => {
    const result = processTravelMessage({
      message: MELBOURNE_REQUEST,
      previousState: createEmptyConversationState(),
      now: NOW,
    });

    expect(result.state.origin?.value).toBe('Sydney');
    expect(result.state.destination?.value).toBe('Melbourne');
    expect(result.state.departureDate?.value.kind).toBe('month_end');
    expect(result.state.departureDate?.value.label).toMatch(/end of august/i);
    expect(result.state.departureTimePreference?.value).toBe('after_5pm');
    expect(result.state.returnTimePreference?.value).toBe('afternoon');
    expect(result.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(result.state.accommodationArea?.value).toBe('Docklands');
    expect(result.state.explicitItineraryIntent).toBe(false);
    expect(result.shouldGenerateItinerary).toBe(false);
    expect(result.searchPerformed).toBe(false);
    expect(result.stage).toBe('clarify');
    expect(result.reply).toMatch(/28 August 2026/i);
    expect(result.reply).toMatch(/Friday/i);
    expect(result.reply).not.toMatch(/Tell me a little more about what you need/i);
    expect(result.reply).not.toMatch(/Which city or destination/i);
    expect(result.reply).not.toMatch(/[Ss]earching/);
  });

  it('multi-turn memory merges later details without restarting', () => {
    const t1 = processTravelMessage({
      message: 'I want to go to Melbourne at the end of August, leaving Friday after work.',
      now: NOW,
    });
    expect(t1.state.destination?.value).toBe('Melbourne');
    expect(t1.state.departureTimePreference?.value).toBe('after_5pm');
    expect(t1.stage).toBe('clarify');

    const t2 = processTravelMessage({
      message: 'Yes, Friday 28 August. Return Sunday afternoon.',
      previousState: t1.state,
      now: NOW,
    });
    expect(t2.state.destination?.value).toBe('Melbourne');
    expect(t2.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(t2.state.departureTimePreference?.value).toBe('after_5pm');
    expect(t2.state.returnTimePreference?.value).toBe('afternoon');
    expect(t2.reply).not.toMatch(/Which city or destination/i);
    expect(t2.reply).not.toMatch(/Which Friday/i);
    expect(t2.searchPerformed).toBe(false);

    const t3 = processTravelMessage({
      message: 'I need a Docklands hotel and a rental car.',
      previousState: t2.state,
      now: NOW,
    });
    expect(t3.state.destination?.value).toBe('Melbourne');
    expect(t3.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(t3.state.departureTimePreference?.value).toBe('after_5pm');
    expect(t3.state.accommodationArea?.value).toBe('Docklands');
    expect(t3.state.requestedServices).toEqual(expect.arrayContaining(['accommodation', 'car_hire']));
    expect(t3.reply).not.toMatch(/Which city or destination/i);
    expect(t3.reply).not.toMatch(/Which Friday|28 August 2026 work/i);
    expect(t3.reply).not.toMatch(/[Ss]earching/);
  });

  it('confirming an inferred/suggested date marks it confirmed', () => {
    const first = processTravelMessage({ message: MELBOURNE_REQUEST, now: NOW });
    expect(first.state.departureDate?.source).toBe('confirmed');
    expect(first.state.awaitingDateConfirmation).toBe(true);

    const second = processTravelMessage({
      message: 'Yes, Friday 28 August.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.departureDate?.source).toBe('confirmed');
    expect(second.state.departureDate?.value.kind).toBe('absolute');
    expect(second.state.awaitingDateConfirmation).toBe(false);
  });

  it('updating a date replaces the previous date', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Change the date to 30 August 2026',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-30');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('changing a destination replaces the previous destination', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 30 August 2026',
      now: NOW,
    });
    expect(first.state.departureDate?.value.isoDate).toBe('2026-08-30');
    const second = processTravelMessage({
      message: 'Actually change destination to Brisbane',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-30');
  });

  it('adding a service later merges into existing state', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Also add a hotel',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'accommodation']));
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('removing car hire drops that service without clearing the trip', () => {
    const first = processTravelMessage({
      message: 'Flights and car hire from Sydney to Melbourne on 30 August 2026',
      now: NOW,
    });
    expect(first.state.requestedServices).toContain('car_hire');
    const second = processTravelMessage({
      message: 'No car hire needed',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).not.toContain('car_hire');
    expect(second.state.requestedServices).toContain('flights');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('never uses the generic fallback when travel intent exists', () => {
    const result = processTravelMessage({
      message: 'I need flights to Melbourne and a hotel in Docklands at the end of August',
      now: NOW,
    });
    expect(result.reply).not.toMatch(/Tell me a little more about what you need/i);
    expect(result.state.destination?.value).toBe('Melbourne');
  });

  it('does not automatically request an itinerary', () => {
    const result = processTravelMessage({
      message: 'Flights and hotel Melbourne from Sydney on 28 August 2026',
      now: NOW,
    });
    expect(result.state.explicitItineraryIntent).toBe(false);
    expect(result.shouldGenerateItinerary).toBe(false);
    expect(result.reply).not.toMatch(/itinerary requested/i);
  });

  it('detects explicit itinerary intent', () => {
    const result = processTravelMessage({
      message: 'Build an itinerary for Tokyo from Sydney on 10 April 2027',
      now: NOW,
    });
    expect(result.state.explicitItineraryIntent).toBe(true);
    expect(result.shouldGenerateItinerary).toBe(true);
    expect(result.searchPerformed).toBe(false);
  });

  it('distinguishes confirmed versus inferred values', () => {
    const result = processTravelMessage({
      message: 'Hotel at Docklands for Friday 28 August 2026',
      now: NOW,
    });
    expect(result.state.accommodationArea?.value).toBe('Docklands');
    expect(result.state.accommodationArea?.source).toBe('confirmed');
    expect(result.state.destination?.value).toBe('Melbourne');
    expect(result.state.destination?.source).toBe('inferred');
    expect(result.state.travellers?.source).toBe('inferred');
  });

  it('keeps conversation state isolated between conversations', () => {
    const a = processTravelMessage({
      message: MELBOURNE_REQUEST,
      previousState: createEmptyConversationState('conv-a'),
      now: NOW,
    });
    const b = processTravelMessage({
      message: 'Flights from Perth to Bali on 1 September 2026',
      previousState: createEmptyConversationState('conv-b'),
      now: NOW,
    });
    expect(a.state.conversationId).toBe('conv-a');
    expect(b.state.conversationId).toBe('conv-b');
    expect(a.state.destination?.value).toBe('Melbourne');
    expect(b.state.destination?.value).toBe('Bali');
    expect(b.state.origin?.value).toBe('Perth');
    expect(b.state.accommodationArea).toBeUndefined();
  });

  it('never claims a search occurred in Phase 1', () => {
    const first = processTravelMessage({ message: MELBOURNE_REQUEST, now: NOW });
    const second = processTravelMessage({
      message: 'Yes, Friday 28 August.',
      previousState: first.state,
      now: NOW,
    });
    expect(first.searchPerformed).toBe(false);
    expect(second.searchPerformed).toBe(false);
    expect(second.reply).not.toMatch(/[Ss]earching with your saved details/);
    expect(second.reply).not.toMatch(/planning package|mock offers|live inventory/i);
  });
});
