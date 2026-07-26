import { describe, expect, it } from 'vitest';
import { getContextSummary } from './compress';
import { processTravelMessage } from './pipeline';

const NOW = new Date('2026-07-26T10:00:00+10:00');

function flightsAndHotel() {
  return processTravelMessage({
    message: 'Flights and accommodation from Sydney to Adelaide for three nights',
    now: NOW,
  });
}

describe('Service removal (live validation blockers)', () => {
  it('Forget the hotel / stay with family removes accommodation only', () => {
    const first = flightsAndHotel();
    expect(first.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation']),
    );

    const second = processTravelMessage({
      message: 'Forget the hotel. We will stay with family.',
      previousState: first.state,
      now: NOW,
    });

    expect(second.state.requestedServices).toContain('flights');
    expect(second.state.requestedServices).not.toContain('accommodation');
    expect(second.state.excludedServices).toContain('accommodation');
    expect(second.state.destination?.value).toBe('Adelaide');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.reply).not.toMatch(/\b(?:hotel|accommodation)\b/i);
    expect(second.searchPerformed).toBe(false);
  });

  it('removed accommodation stays absent after later turns and Add car hire instead', () => {
    const first = flightsAndHotel();
    const removed = processTravelMessage({
      message: 'Forget the hotel. We will stay with family.',
      previousState: first.state,
      now: NOW,
    });
    const later = processTravelMessage({
      message: 'Add car hire instead.',
      previousState: removed.state,
      now: NOW,
    });

    expect(later.state.requestedServices).toContain('flights');
    expect(later.state.requestedServices).toContain('car_hire');
    expect(later.state.requestedServices).not.toContain('accommodation');
    expect(later.state.excludedServices).toContain('accommodation');
    expect(later.state.destination?.value).toBe('Adelaide');
  });

  it('Forget car hire removes only car hire', () => {
    const first = processTravelMessage({
      message:
        'Flights, accommodation and car hire from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Forget car hire.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation']),
    );
    expect(second.state.requestedServices).not.toContain('car_hire');
    expect(second.state.excludedServices).toContain('car_hire');
  });

  it('Do not include accommodation and No flights anymore', () => {
    const first = processTravelMessage({
      message: 'Flights and accommodation from Sydney to Brisbane on 30 August 2026',
      now: NOW,
    });
    const noHotel = processTravelMessage({
      message: 'Do not include accommodation',
      previousState: first.state,
      now: NOW,
    });
    expect(noHotel.state.requestedServices).not.toContain('accommodation');
    expect(noHotel.state.requestedServices).toContain('flights');

    const noFlights = processTravelMessage({
      message: 'No flights anymore',
      previousState: noHotel.state,
      now: NOW,
    });
    expect(noFlights.state.requestedServices).not.toContain('flights');
    expect(noFlights.state.excludedServices).toEqual(
      expect.arrayContaining(['accommodation', 'flights']),
    );
  });

  it('removed car hire remains absent after context compression and final summary', () => {
    let state = processTravelMessage({
      message:
        'Flights, accommodation and car hire from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    }).state;

    state = processTravelMessage({
      message: 'Forget car hire.',
      previousState: state,
      now: NOW,
    }).state;
    expect(state.requestedServices).not.toContain('car_hire');

    const filler = [
      'Prefer Virgin',
      'Two adults',
      'Morning flight please',
      'Stay in Docklands',
      'Budget mid-range',
      'Flexible on dates',
      'What have you saved so far?',
    ];
    for (const message of filler) {
      state = processTravelMessage({ message, previousState: state, now: NOW }).state;
    }

    expect(state.turnCount).toBeGreaterThanOrEqual(6);
    expect(getContextSummary(state)).toBeTruthy();
    expect(state.requestedServices).not.toContain('car_hire');
    expect(state.excludedServices).toContain('car_hire');
    // Compressed facts may record the exclusion, but active services must not include car hire
    expect(state.contextCompression?.keyFacts.find((f) => f.startsWith('services='))).not.toMatch(
      /car_hire/,
    );
    expect(state.contextCompression?.summary).toMatch(/excluded=.*car_hire/);

    const summary = processTravelMessage({
      message: 'Summarise the saved requirements please',
      previousState: state,
      now: NOW,
    });
    expect(summary.state.requestedServices).not.toContain('car_hire');
    expect(summary.reply).not.toMatch(/car hire/i);
  });
});

describe('Clarification-safe place assignment', () => {
  function adelaideDatePending() {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Adelaide for three nights',
      now: NOW,
    });
    expect(first.state.destination?.value).toBe('Adelaide');
    expect(first.state.departureDate?.value.isoDate).toBeUndefined();
    expect(first.stage).toBe('clarify');
    expect(first.state.missingRequiredFields).toContain('departureDate');
    return first;
  }

  it('Melbourne Airport while date pending does not overwrite Adelaide', () => {
    const first = adelaideDatePending();
    const second = processTravelMessage({
      message: 'Melbourne Airport',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Adelaide');
    expect(second.state.origin?.value).toMatch(/Melbourne/i);
    expect(second.state.departureDate?.value.isoDate).toBeUndefined();
    expect(second.state.missingRequiredFields).toContain('departureDate');

    const third = processTravelMessage({
      message: '18th of September',
      previousState: second.state,
      now: NOW,
    });
    expect(third.state.destination?.value).toBe('Adelaide');
    expect(third.state.origin?.value).toMatch(/Melbourne/i);
    expect(third.state.departureDate?.value.isoDate).toBe('2026-09-18');
  });

  it('From Melbourne / Leaving from Melbourne Airport while date pending', () => {
    const first = adelaideDatePending();
    const fromMel = processTravelMessage({
      message: 'From Melbourne',
      previousState: first.state,
      now: NOW,
    });
    expect(fromMel.state.destination?.value).toBe('Adelaide');
    expect(fromMel.state.origin?.value).toBe('Melbourne');

    const first2 = adelaideDatePending();
    const leaving = processTravelMessage({
      message: 'Leaving from Melbourne Airport',
      previousState: first2.state,
      now: NOW,
    });
    expect(leaving.state.destination?.value).toBe('Adelaide');
    expect(leaving.state.origin?.value).toMatch(/Melbourne/i);
  });

  it('Actually make it Melbourne instead still changes destination', () => {
    const first = adelaideDatePending();
    const changed = processTravelMessage({
      message: 'Actually make it Melbourne instead',
      previousState: first.state,
      now: NOW,
    });
    expect(changed.state.destination?.value).toBe('Melbourne');
  });
});

describe('Destination negation vs replacement', () => {
  function goldCoastTrip() {
    return processTravelMessage({
      message: 'Flights from Sydney to Gold Coast on 28 August 2026',
      now: NOW,
    });
  }

  it('Keep Gold Coast. Do not change it to Brisbane.', () => {
    const first = goldCoastTrip();
    const second = processTravelMessage({
      message: 'Keep Gold Coast. Do not change it to Brisbane.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Gold Coast');
  });

  it("Don't make it Brisbane.", () => {
    const first = goldCoastTrip();
    const second = processTravelMessage({
      message: "Don't make it Brisbane.",
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Gold Coast');
  });

  it('Not Brisbane, keep Gold Coast.', () => {
    const first = goldCoastTrip();
    const second = processTravelMessage({
      message: 'Not Brisbane, keep Gold Coast.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Gold Coast');
  });

  it('Not Gold Coast anymore — change it to Brisbane.', () => {
    const first = goldCoastTrip();
    const second = processTravelMessage({
      message: 'Not Gold Coast anymore — change it to Brisbane.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
  });

  it('Actually change it to Brisbane.', () => {
    const first = goldCoastTrip();
    const second = processTravelMessage({
      message: 'Actually change it to Brisbane.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
  });
});

describe('Accommodation area with destination change', () => {
  it('Brisbane instead + stay in South Bank captures both', () => {
    const first = processTravelMessage({
      message: 'Flights and hotel from Sydney to Cairns on 28 August 2026, stay near the marina',
      now: NOW,
    });
    expect(first.state.destination?.value).toBe('Cairns');
    expect(first.state.accommodationArea?.value.toLowerCase()).toMatch(/marina/);

    const second = processTravelMessage({
      message: 'Actually make it Brisbane instead and stay in South Bank.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
    expect(second.state.accommodationArea?.value).toBe('South Bank');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
  });

  it('hotel in South Bank / stay near South Bank variants', () => {
    const base = processTravelMessage({
      message: 'Flights from Sydney to Cairns on 28 August 2026',
      now: NOW,
    });
    const hotel = processTravelMessage({
      message: 'Make it Brisbane instead, hotel in South Bank',
      previousState: base.state,
      now: NOW,
    });
    expect(hotel.state.destination?.value).toBe('Brisbane');
    expect(hotel.state.accommodationArea?.value).toBe('South Bank');

    const base2 = processTravelMessage({
      message: 'Flights from Sydney to Cairns on 28 August 2026',
      now: NOW,
    });
    const near = processTravelMessage({
      message: 'Make it Brisbane instead and stay near South Bank',
      previousState: base2.state,
      now: NOW,
    });
    expect(near.state.destination?.value).toBe('Brisbane');
    expect(near.state.accommodationArea?.value).toBe('South Bank');
  });
});

describe('Multi-field update in one turn', () => {
  it('four nights + daughter + Virgin + morning all apply', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 30 August 2026 for one adult',
      now: NOW,
    });
    expect(first.state.departureDate?.value.isoDate).toBe('2026-08-30');
    expect(first.state.travellers?.value.adults).toBe(1);
    expect(first.state.travellers?.value.children ?? 0).toBe(0);

    const second = processTravelMessage({
      message:
        'Make it four nights, bring my daughter as well, fly Virgin, and leave in the morning.',
      previousState: first.state,
      now: NOW,
    });

    expect(second.state.durationNights?.value).toBe(4);
    expect(second.state.travellers?.value.children).toBeGreaterThanOrEqual(1);
    expect(second.state.airlinePreferences?.value.airlines).toEqual(
      expect.arrayContaining(['Virgin']),
    );
    expect(second.state.departureTimePreference?.value).toBe('morning');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-30');
    expect(second.state.requestedServices).toContain('flights');
  });
});

describe('Long conversation retention of removals and current values', () => {
  it('15+ turns: removals stick, superseded values do not return', () => {
    const turns: string[] = [
      'Flights from Sydney to Melbourne on 28 August 2026',
      'Add car hire',
      'Also need accommodation in Docklands',
      'Forget car hire.',
      'Add accommodation near the beach',
      'Forget the hotel. We will stay with family.',
      'Actually make it Brisbane instead',
      'Prefer Qantas',
      'Fly Virgin instead',
      'Bring my daughter as well',
      'Change the date to 18 September 2026',
      'Leave in the morning',
      'Two adults',
      'Add car hire',
      'What are the saved requirements?',
    ];

    let state = processTravelMessage({ message: turns[0]!, now: NOW }).state;
    for (let i = 1; i < turns.length; i++) {
      state = processTravelMessage({
        message: turns[i]!,
        previousState: state,
        now: NOW,
      }).state;
    }

    expect(state.turnCount).toBeGreaterThanOrEqual(15);
    expect(state.destination?.value).toBe('Brisbane');
    expect(state.destination?.value).not.toBe('Melbourne');
    expect(state.requestedServices).toContain('flights');
    expect(state.requestedServices).toContain('car_hire');
    expect(state.requestedServices).not.toContain('accommodation');
    expect(state.excludedServices).toContain('accommodation');
    // car hire was re-added explicitly after removal
    expect(state.excludedServices).not.toContain('car_hire');
    expect(state.airlinePreferences?.value.airlines).toEqual(expect.arrayContaining(['Virgin']));
    expect(state.airlinePreferences?.value.airlines).not.toContain('Qantas');
    expect(state.departureDate?.value.isoDate).toBe('2026-09-18');
    expect(state.departureTimePreference?.value).toBe('morning');
    expect(state.travellers?.value.children).toBeGreaterThanOrEqual(1);
    expect(new Set(state.requestedServices).size).toBe(state.requestedServices.length);
  });
});
