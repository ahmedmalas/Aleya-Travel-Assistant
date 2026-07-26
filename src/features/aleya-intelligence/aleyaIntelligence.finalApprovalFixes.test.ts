import { describe, expect, it } from 'vitest';
import { processTravelMessage } from './pipeline';

const NOW = new Date('2026-07-26T10:00:00+10:00');

describe('Final approval fixes — clause-scoped service ops', () => {
  it('Forget the hotel and add car hire', () => {
    const first = processTravelMessage({
      message: 'Flights and accommodation from Sydney to Adelaide for three nights',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Forget the hotel and add car hire.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'car_hire']));
    expect(second.state.requestedServices).not.toContain('accommodation');
    expect(second.state.excludedServices).toContain('accommodation');
    expect(second.state.excludedServices).not.toContain('car_hire');
    expect(second.reply).toMatch(/car hire/i);
    expect(second.reply).not.toMatch(/services:[^.]*accommodation/i);
  });

  it('Remove accommodation but keep car hire', () => {
    const first = processTravelMessage({
      message:
        'Flights, accommodation and car hire from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Remove accommodation but keep car hire.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'car_hire']));
    expect(second.state.requestedServices).not.toContain('accommodation');
    expect(second.state.excludedServices).toContain('accommodation');
    expect(second.state.excludedServices).not.toContain('car_hire');
  });

  it('No flights, but keep the hotel', () => {
    const first = processTravelMessage({
      message: 'Flights and accommodation from Sydney to Brisbane on 30 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'No flights, but keep the hotel.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toContain('accommodation');
    expect(second.state.requestedServices).not.toContain('flights');
    expect(second.state.excludedServices).toContain('flights');
    expect(second.state.excludedServices).not.toContain('accommodation');
  });

  it('Forget car hire, then add accommodation', () => {
    const first = processTravelMessage({
      message: 'Flights and car hire from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Forget car hire, then add accommodation.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'accommodation']));
    expect(second.state.requestedServices).not.toContain('car_hire');
    expect(second.state.excludedServices).toContain('car_hire');
  });

  it('Remove car hire and keep flights', () => {
    const first = processTravelMessage({
      message: 'Flights and car hire from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Remove car hire and keep flights.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toContain('flights');
    expect(second.state.requestedServices).not.toContain('car_hire');
    expect(second.state.excludedServices).toContain('car_hire');
  });

  it('Remove accommodation, add car hire, keep flights', () => {
    const first = processTravelMessage({
      message:
        'Flights, accommodation and car hire from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    // Start without car hire so add is meaningful after remove accommodation
    const trimmed = processTravelMessage({
      message: 'Forget car hire.',
      previousState: first.state,
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Remove accommodation, add car hire, keep flights.',
      previousState: trimmed.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'car_hire']));
    expect(second.state.requestedServices).not.toContain('accommodation');
    expect(second.state.excludedServices).toContain('accommodation');
    expect(second.state.excludedServices).not.toContain('car_hire');
  });

  it('Remove car hire, actually add it back', () => {
    const first = processTravelMessage({
      message: 'Flights and car hire from Sydney to Melbourne on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Remove car hire, actually add it back.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.requestedServices).toContain('car_hire');
    expect(second.state.excludedServices).not.toContain('car_hire');
    expect(second.reply).toMatch(/car hire/i);
  });
});

describe('Final approval fixes — bare actually / preference soft destination', () => {
  function adelaideTrip() {
    return processTravelMessage({
      message: 'Flights from Sydney to Adelaide on 28 August 2026',
      now: NOW,
    });
  }

  const softCases = [
    'I actually prefer Brisbane.',
    'Actually Brisbane is nicer.',
    'I actually like Brisbane.',
    'Brisbane might be better.',
    'Maybe Brisbane instead sometime.',
  ];

  for (const phrase of softCases) {
    it(`does not hard-replace Adelaide for “${phrase}”`, () => {
      const first = adelaideTrip();
      const second = processTravelMessage({
        message: phrase,
        previousState: first.state,
        now: NOW,
      });
      expect(second.state.destination?.value).toBe('Adelaide');
      // Soft candidates may be pending; hard overwrite is forbidden
      if (second.state.pendingDestination) {
        expect(second.state.pendingDestination.value).toBe('Brisbane');
        expect(second.state.awaitingDestinationConfirmation).toBe(true);
      }
      expect(second.reply).not.toMatch(/confidence/i);
    });
  }

  const hardCases = [
    'Actually make it Brisbane instead.',
    'Actually change the destination to Brisbane.',
    'Brisbane instead of Adelaide.',
    'Not Adelaide anymore — Brisbane.',
  ];

  for (const phrase of hardCases) {
    it(`hard-replaces Adelaide for “${phrase}”`, () => {
      const first = adelaideTrip();
      const second = processTravelMessage({
        message: phrase,
        previousState: first.state,
        now: NOW,
      });
      expect(second.state.destination?.value).toBe('Brisbane');
      expect(second.state.awaitingDestinationConfirmation).toBe(false);
    });
  }
});

describe('Final approval fixes — keep retention scoping', () => {
  function goldCoastTrip() {
    return processTravelMessage({
      message: 'Flights from Sydney to Gold Coast on 28 August 2026',
      now: NOW,
    });
  }

  it('Keep Gold Coast', () => {
    const second = processTravelMessage({
      message: 'Keep Gold Coast.',
      previousState: goldCoastTrip().state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Gold Coast');
  });

  it('Keep the current destination', () => {
    const second = processTravelMessage({
      message: 'Keep the current destination.',
      previousState: goldCoastTrip().state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Gold Coast');
  });

  it('Keep it as Gold Coast', () => {
    const second = processTravelMessage({
      message: 'Keep it as Gold Coast.',
      previousState: goldCoastTrip().state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Gold Coast');
  });

  it('Keep looking at Brisbane options instead', () => {
    const second = processTravelMessage({
      message: 'Keep looking at Brisbane options instead.',
      previousState: goldCoastTrip().state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
  });

  it('Keep the hotel but make the destination Brisbane', () => {
    const base = processTravelMessage({
      message:
        'Flights and accommodation from Sydney to Gold Coast on 28 August 2026',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Keep the hotel but make the destination Brisbane.',
      previousState: base.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
    expect(second.state.requestedServices).toContain('accommodation');
  });

  it('Keep flights and go to Brisbane instead', () => {
    const second = processTravelMessage({
      message: 'Keep flights and go to Brisbane instead.',
      previousState: goldCoastTrip().state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
    expect(second.state.requestedServices).toContain('flights');
  });

  it('Keep thinking about Brisbane for now does not force Gold Coast retention lock', () => {
    const first = goldCoastTrip();
    const second = processTravelMessage({
      message: 'Keep thinking about Brisbane for now.',
      previousState: first.state,
      now: NOW,
    });
    // Must not treat as "keep Gold Coast"; either unchanged without retention lock,
    // or soft/hard move — never a false retention that blocks later instead-language.
    expect(second.state.destination?.value).toBe('Gold Coast');
    const third = processTravelMessage({
      message: 'Actually make it Brisbane instead.',
      previousState: second.state,
      now: NOW,
    });
    expect(third.state.destination?.value).toBe('Brisbane');
  });
});

describe('Final approval fixes — pending destination continues extraction', () => {
  function melbourneWithPendingBali() {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 30 August 2026 after 5pm',
      now: NOW,
    });
    const soft = processTravelMessage({
      message: 'Maybe thinking of going to Bali instead sometime.',
      previousState: first.state,
      now: NOW,
    });
    expect(soft.state.destination?.value).toBe('Melbourne');
    expect(soft.state.pendingDestination?.value).toBe('Bali');
    expect(soft.state.awaitingDestinationConfirmation).toBe(true);
    return soft;
  }

  it('Yes, change to Bali, four nights, forget hotel', () => {
    const soft = melbourneWithPendingBali();
    // Ensure accommodation exists so forget is observable
    const withHotel = processTravelMessage({
      message: 'Also need accommodation.',
      previousState: soft.state,
      now: NOW,
    });
    // Re-establish pending if accommodation turn cleared it
    const pending =
      withHotel.state.awaitingDestinationConfirmation && withHotel.state.pendingDestination
        ? withHotel
        : processTravelMessage({
            message: 'Maybe thinking of going to Bali instead sometime.',
            previousState: withHotel.state,
            now: NOW,
          });

    const second = processTravelMessage({
      message: 'Yes, change to Bali, four nights, forget hotel.',
      previousState: pending.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Bali');
    expect(second.state.pendingDestination).toBeUndefined();
    expect(second.state.awaitingDestinationConfirmation).toBe(false);
    expect(second.state.durationNights?.value).toBe(4);
    expect(second.state.requestedServices).not.toContain('accommodation');
    expect(second.state.excludedServices).toContain('accommodation');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-30');
  });

  it('Yes, Bali, add car hire and fly Qantas', () => {
    const soft = melbourneWithPendingBali();
    const second = processTravelMessage({
      message: 'Yes, Bali, add car hire and fly Qantas.',
      previousState: soft.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Bali');
    expect(second.state.pendingDestination).toBeUndefined();
    expect(second.state.requestedServices).toContain('car_hire');
    expect(second.state.airlinePreferences?.value.airlines).toEqual(
      expect.arrayContaining(['Qantas']),
    );
  });

  it('No, keep Melbourne, and leave in the morning', () => {
    const soft = melbourneWithPendingBali();
    expect(soft.state.departureTimePreference?.value).toBe('after_5pm');
    const second = processTravelMessage({
      message: 'No, keep Melbourne, and leave in the morning.',
      previousState: soft.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.pendingDestination).toBeUndefined();
    expect(second.state.awaitingDestinationConfirmation).toBe(false);
    expect(second.state.departureTimePreference?.value).toBe('morning');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-30');
  });

  it('No, stay with Melbourne, make it five nights and remove car hire', () => {
    const soft = melbourneWithPendingBali();
    const withCar = processTravelMessage({
      message: 'Add car hire.',
      previousState: soft.state,
      now: NOW,
    });
    const pending =
      withCar.state.awaitingDestinationConfirmation && withCar.state.pendingDestination
        ? withCar
        : processTravelMessage({
            message: 'Maybe thinking of going to Bali instead sometime.',
            previousState: withCar.state,
            now: NOW,
          });

    const second = processTravelMessage({
      message: 'No, stay with Melbourne, make it five nights and remove car hire.',
      previousState: pending.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.pendingDestination).toBeUndefined();
    expect(second.state.durationNights?.value).toBe(5);
    expect(second.state.requestedServices).not.toContain('car_hire');
    expect(second.state.excludedServices).toContain('car_hire');
  });
});
