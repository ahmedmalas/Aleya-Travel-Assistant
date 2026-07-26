import { describe, expect, it } from 'vitest';
import { getContextSummary } from './compress';
import { processTravelMessage } from './pipeline';
import { createEmptyConversationState } from './types';

const NOW = new Date('2026-07-26T10:00:00+10:00');

describe('Aleya Intelligence Layer — Phase 2', () => {
  it('changing destination updates only destination', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 28 August 2026, hotel at Docklands, car hire',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Actually make it Brisbane instead.',
      previousState: first.state,
      now: NOW,
    });

    expect(second.state.destination?.value).toBe('Brisbane');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    // Docklands is Melbourne-bound — clear stale area when destination city changes
    expect(second.state.accommodationArea).toBeUndefined();
    expect(second.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(second.state.lastUpdatedFields).toContain('destination');
    expect(second.searchPerformed).toBe(false);
  });

  it('changing dates replaces only the date field', () => {
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

  it('removing requirements drops only that service', () => {
    const first = processTravelMessage({
      message: 'Flights and car hire from Sydney to Melbourne on 30 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'No car hire needed',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).not.toContain('car_hire');
    expect(second.state.requestedServices).toContain('flights');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('detects conflicting origin and destination', () => {
    const result = processTravelMessage({
      message: 'Flights from Sydney to Sydney on 28 August 2026',
      now: NOW,
    });
    expect(result.stage).toBe('clarify');
    expect(result.reply).toMatch(/same/i);
    expect(result.state.conflicts.length).toBeGreaterThan(0);
    expect(result.searchPerformed).toBe(false);
  });

  it('detects impossible return-before-departure', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 30 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Return on 20 August 2026',
      previousState: first.state,
      now: NOW,
    });
    expect(second.stage).toBe('clarify');
    expect(second.reply).toMatch(/return date|dates/i);
  });

  it('multiple follow-up turns accumulate structured requirements without duplication', () => {
    let state = createEmptyConversationState();
    const t1 = processTravelMessage({
      message: 'I want flights from Sydney to Melbourne at the end of August',
      previousState: state,
      now: NOW,
    });
    state = t1.state;
    const t2 = processTravelMessage({
      message: 'Yes, Friday 28 August. Two adults and one child.',
      previousState: state,
      now: NOW,
    });
    state = t2.state;
    const t3 = processTravelMessage({
      message: 'Hotel at Docklands, prefer Qantas, vegetarian meals.',
      previousState: state,
      now: NOW,
    });
    state = t3.state;
    const t4 = processTravelMessage({
      message: 'Also add car hire and late checkout.',
      previousState: state,
      now: NOW,
    });

    expect(t4.state.destination?.value).toBe('Melbourne');
    expect(t4.state.origin?.value).toBe('Sydney');
    expect(t4.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(t4.state.travellers?.value).toMatchObject({ adults: 2, children: 1, infants: 0, total: 3 });
    expect(t4.state.accommodationArea?.value).toBe('Docklands');
    expect(t4.state.airlinePreferences?.value.airlines).toContain('Qantas');
    expect(t4.state.dietaryRequirements?.value).toContain('vegetarian');
    expect(t4.state.specialRequests?.value).toContain('late checkout');
    expect(t4.state.requestedServices.filter((s) => s === 'flights')).toHaveLength(1);
    expect(t4.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'accommodation', 'car_hire']));
    expect(t4.reply).not.toMatch(/confidence/i);
    expect(t4.searchPerformed).toBe(false);
  });

  it('resolves pronoun/reference phrases against presented options and preferences', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 28 August 2026 and a hotel at Docklands',
      now: NOW,
      presentedOptions: [
        { id: 'h1', kind: 'hotel', label: 'Docklands Waterfront Hotel' },
        { id: 'h2', kind: 'hotel', label: 'Southbank Suites' },
      ],
    });

    const second = processTravelMessage({
      message: 'I’ll take the first option, same flights, but cheaper please.',
      previousState: first.state,
      now: NOW,
      presentedOptions: first.state.lastPresentedOptions,
    });

    expect(second.state.selectedOptions[0]?.label).toBe('Docklands Waterfront Hotel');
    expect(second.state.budget?.value.relative).toBe('cheaper');
    expect(second.state.budget?.value.style).toBe('budget');
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.lastReference?.kind).toBeTruthy();
  });

  it('understands earlier/later time adjustments without dropping the trip', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 28 August 2026 after 5pm',
      now: NOW,
    });
    expect(first.state.departureTimePreference?.value).toBe('after_5pm');

    const second = processTravelMessage({
      message: 'Actually leave earlier.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureTimePreference?.value).toBe('afternoon');
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.origin?.value).toBe('Sydney');
  });

  it('stores internal confidence without exposing it in replies', () => {
    const result = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    expect(result.state.destination?.confidenceLevel).toBe('high');
    expect(result.state.origin?.confidence).toBeGreaterThan(0.5);
    expect(result.reply).not.toMatch(/confidence|0\.\d+/i);
  });

  it('asks before committing a low-confidence destination', () => {
    const result = processTravelMessage({
      message: 'Maybe thinking of going to Bali sometime',
      now: NOW,
    });
    expect(result.state.destination?.confidenceLevel).toBe('low');
    expect(result.stage).toBe('clarify');
    expect(result.reply).toMatch(/Bali/i);
    expect(result.reply).toMatch(/confirm/i);
  });

  it('compresses context over long conversations while preserving structured requirements', () => {
    let state = createEmptyConversationState();
    const turns = [
      'Flights from Sydney to Melbourne on 28 August 2026',
      'Add a hotel at Docklands',
      'Two adults and one infant',
      'Prefer Qantas and vegetarian meals',
      'Also car hire',
      'Wheelchair accessible please',
      'Late checkout if possible',
    ];

    for (const message of turns) {
      const result = processTravelMessage({ message, previousState: state, now: NOW });
      state = result.state;
    }

    expect(state.turnCount).toBeGreaterThanOrEqual(6);
    expect(state.contextCompression).toBeDefined();
    expect(getContextSummary(state)).toMatch(/Trip intent/i);
    expect(state.contextCompression!.keyFacts.join(' ')).toMatch(/Melbourne/);
    expect(state.destination?.value).toBe('Melbourne');
    expect(state.origin?.value).toBe('Sydney');
    expect(state.accommodationArea?.value).toBe('Docklands');
    expect(state.travellers?.value.infants).toBe(1);
    expect(state.requestedServices).toEqual(expect.arrayContaining(['flights', 'accommodation', 'car_hire']));
    expect(state.dietaryRequirements?.value).toContain('vegetarian');
    expect(state.accessibility?.value).toContain('wheelchair');
  });

  it('does not hallucinate searches, bookings, pricing, or itineraries', () => {
    const result = processTravelMessage({
      message: 'Book me the cheapest flight to Melbourne and invent a 5-day itinerary',
      now: NOW,
    });
    expect(result.searchPerformed).toBe(false);
    expect(result.reply).not.toMatch(/\$\d+|AUD\s*\d+|booking confirmed|I found \d+ flights/i);
    // itinerary intent may be detected, but generation is gated
    if (result.shouldGenerateItinerary) {
      expect(result.reply).toMatch(/when that step is available|won’t build an itinerary|itinerary/i);
    }
  });
});
