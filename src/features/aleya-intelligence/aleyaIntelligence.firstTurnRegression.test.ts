import { describe, expect, it } from 'vitest';
import { processTravelMessage } from './pipeline';

const NOW = new Date('2026-07-27T10:00:00+10:00');

describe('First-turn requirement extraction regression', () => {
  it('canonical single-pass first turn (rebuild contract)', () => {
    const result = processTravelMessage({
      message:
        'I want to go to Gold Coast on 28 August departing from Melbourne, staying in Surfers Paradise for three nights, returning Monday. I need flights, hotel and car hire.',
      now: NOW,
    });
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(result.state.returnDate?.value.isoDate).toBe('2026-08-31');
    expect(result.state.durationNights?.value).toBe(3);
    expect(result.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(result.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(result.state.requestedServices).toHaveLength(3);
    expect(result.reply).not.toMatch(/which city or destination/i);
    expect(result.reply).not.toMatch(/which date would you like to travel/i);
    expect(result.reply).toMatch(/Melbourne/i);
    expect(result.reply).toMatch(/Gold Coast/i);
    expect(result.reply).toMatch(/Surfers Paradise/i);
  });

  it('mandatory rich first turn — Gold Coast / Melbourne / Surfers / three services', () => {
    const first = processTravelMessage({
      message:
        "I want to go to Gold Coast from Melbourne. I need flights, hotel and car hire. I'll be staying in Surfers Paradise.",
      now: NOW,
    });

    expect(first.state.origin?.value).toBe('Melbourne');
    expect(first.state.destination?.value).toBe('Gold Coast');
    expect(first.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(first.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(first.state.requestedServices).toHaveLength(3);
    expect(first.state.excludedServices ?? []).toEqual([]);
    expect(first.reply).toMatch(/Melbourne/i);
    expect(first.reply).toMatch(/Gold Coast/i);
    expect(first.reply).toMatch(/Surfers Paradise/i);
    expect(first.reply).toMatch(/flights/i);
    expect(first.reply).toMatch(/accommodation|hotel/i);
    expect(first.reply).toMatch(/car hire/i);
    // Must not re-ask for origin or destination already provided
    expect(first.reply).not.toMatch(/which city or destination/i);
    expect(first.reply).not.toMatch(/where (?:are you|do you want to) (?:travelling|travel|fly) from/i);

    const second = processTravelMessage({
      message: '28th August and come back Monday',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.origin?.value).toBe('Melbourne');
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.returnDate?.value.weekday).toBe(1);
    expect(second.state.returnDate?.value.isoDate).toBe('2026-08-31');
    expect(second.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(second.reply).not.toMatch(/which date would you like to travel/i);

    const third = processTravelMessage({
      message: 'Remove the car hire.',
      previousState: second.state,
      now: NOW,
    });
    expect(third.state.origin?.value).toBe('Melbourne');
    expect(third.state.destination?.value).toBe('Gold Coast');
    expect(third.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(third.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(third.state.returnDate?.value.isoDate).toBe('2026-08-31');
    expect(third.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation']),
    );
    expect(third.state.requestedServices).not.toContain('car_hire');
    expect(third.state.excludedServices).toContain('car_hire');
    expect(third.reply).toMatch(/flights/i);
    expect(third.reply).toMatch(/accommodation|hotel/i);
    expect(third.reply).not.toMatch(/services:[^.]*car hire/i);
  });

  it('fragmented turns preserve origin and multi-services; Surfers Paradise is stay area only', () => {
    const t1 = processTravelMessage({
      message: 'I want to go to Gold Coast from Melbourne...',
      now: NOW,
    });
    expect(t1.state.origin?.value).toBe('Melbourne');
    expect(t1.state.destination?.value).toBe('Gold Coast');

    const t2 = processTravelMessage({
      message: 'I need flights hotel and a car hire',
      previousState: t1.state,
      now: NOW,
    });
    expect(t2.state.origin?.value).toBe('Melbourne');
    expect(t2.state.destination?.value).toBe('Gold Coast');
    expect(t2.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(t2.state.requestedServices).toHaveLength(3);

    const t3 = processTravelMessage({
      message: 'Surfers Paradise',
      previousState: t2.state,
      now: NOW,
    });
    expect(t3.state.origin?.value).toBe('Melbourne');
    expect(t3.state.destination?.value).toBe('Gold Coast');
    expect(t3.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(t3.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );

    const t4 = processTravelMessage({
      message: '28th of August and come back Monday',
      previousState: t3.state,
      now: NOW,
    });
    expect(t4.state.origin?.value).toBe('Melbourne');
    expect(t4.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(t4.state.returnDate?.value.isoDate).toBe('2026-08-31');
    expect(t4.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );

    const t5 = processTravelMessage({
      message: 'remove the car hire',
      previousState: t4.state,
      now: NOW,
    });
    expect(t5.state.origin?.value).toBe('Melbourne');
    expect(t5.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation']),
    );
    expect(t5.state.requestedServices).not.toContain('car_hire');
    expect(t5.state.excludedServices).toContain('car_hire');
  });

  it('Melbourne Airport while date pending still fills origin (non-area place)', () => {
    const first = processTravelMessage({
      message: 'Flights from Sydney to Adelaide for three nights',
      now: NOW,
    });
    const second = processTravelMessage({
      message: 'Melbourne Airport',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.destination?.value).toBe('Adelaide');
    expect(second.state.origin?.value).toMatch(/Melbourne/i);
  });
});
