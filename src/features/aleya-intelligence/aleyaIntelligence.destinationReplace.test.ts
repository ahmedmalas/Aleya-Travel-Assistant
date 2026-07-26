import { describe, expect, it } from 'vitest';
import { processTravelMessage } from './pipeline';

const NOW = new Date('2026-07-26T10:00:00+10:00');

function melbourneDocklandsTrip() {
  const first = processTravelMessage({
    message:
      'I need flights, accommodation and car hire to Melbourne on Friday 28 August 2026, staying in Docklands',
    now: NOW,
  });
  const withOrigin = processTravelMessage({
    message: 'Sydney',
    previousState: first.state,
    now: NOW,
  });
  expect(withOrigin.state.destination?.value).toBe('Melbourne');
  expect(withOrigin.state.accommodationArea?.value).toBe('Docklands');
  expect(withOrigin.state.departureDate?.value.isoDate).toBe('2026-08-28');
  expect(withOrigin.state.requestedServices).toEqual(
    expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
  );
  expect(withOrigin.state.origin?.value).toBe('Sydney');
  return withOrigin;
}

describe('Explicit destination replacement', () => {
  const replacements: Array<{ phrase: string; dest?: string }> = [
    { phrase: 'Change of plans, Gold Coast instead of Melbourne.' },
    { phrase: 'Actually make it Gold Coast instead.' },
    { phrase: 'I want to go to Gold Coast instead of Melbourne.' },
    { phrase: 'Not Melbourne — Gold Coast.' },
    { phrase: 'Change the destination to Gold Coast.' },
    { phrase: 'Destination is Gold Coast.' },
  ];

  for (const { phrase } of replacements) {
    it(`Melbourne → “${phrase}”`, () => {
      const base = melbourneDocklandsTrip();
      const next = processTravelMessage({
        message: phrase,
        previousState: base.state,
        now: NOW,
      });
      expect(next.state.destination?.value).toBe('Gold Coast');
      expect(next.state.departureDate?.value.isoDate).toBe('2026-08-28');
      expect(next.state.requestedServices).toEqual(
        expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
      );
      expect(next.state.origin?.value).toBe('Sydney');
      expect(next.searchPerformed).toBe(false);
      expect(next.reply).not.toMatch(/\b(?:available|priced?|book(?:ed|ing)?|\$\d)\b/i);
    });
  }

  it('Melbourne + Docklands → Gold Coast instead, stay in Surfers Paradise', () => {
    const base = melbourneDocklandsTrip();
    const next = processTravelMessage({
      message: 'Gold Coast instead, stay in Surfers Paradise.',
      previousState: base.state,
      now: NOW,
    });
    expect(next.state.destination?.value).toBe('Gold Coast');
    expect(next.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(next.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(next.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(next.state.origin?.value).toBe('Sydney');
  });

  it('full change-of-plans message updates destination and stay area together', () => {
    const base = melbourneDocklandsTrip();
    const next = processTravelMessage({
      message:
        'Change of plans, I want to go to Gold Coast instead of Melbourne and I want to stay at Surfers Paradise.',
      previousState: base.state,
      now: NOW,
    });
    expect(next.state.destination?.value).toBe('Gold Coast');
    expect(next.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(next.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(next.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(next.state.origin?.value).toBe('Sydney');
  });

  it('Destination is Surfers Paradise normalizes to Gold Coast + Surfers Paradise', () => {
    const base = melbourneDocklandsTrip();
    const next = processTravelMessage({
      message: 'Destination is Surfers Paradise.',
      previousState: base.state,
      now: NOW,
    });
    expect(next.state.destination?.value).toBe('Gold Coast');
    expect(next.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(next.state.destination?.value).not.toBe('Melbourne');
    expect(next.state.destination?.value).not.toBe('Sydney');
  });

  it('full conversation: Melbourne → Gold Coast → Surfers Paradise → origin Sydney', () => {
    const first = processTravelMessage({
      message: 'I need flights, accommodation and car hire to Melbourne on Friday 28 August 2026, staying in Docklands',
      now: NOW,
    });
    expect(first.state.destination?.value).toBe('Melbourne');
    expect(first.state.missingRequiredFields).toContain('origin');

    const changed = processTravelMessage({
      message: 'Change the destination to Gold Coast.',
      previousState: first.state,
      now: NOW,
    });
    expect(changed.state.destination?.value).toBe('Gold Coast');
    expect(changed.state.departureDate?.value.isoDate).toBe('2026-08-28');

    const stay = processTravelMessage({
      message: 'Stay in Surfers Paradise.',
      previousState: changed.state,
      now: NOW,
    });
    expect(stay.state.destination?.value).toBe('Gold Coast');
    expect(stay.state.accommodationArea?.value).toBe('Surfers Paradise');

    expect(stay.state.missingRequiredFields).toContain('origin');
    expect(stay.reply).toMatch(/departing from/i);

    const withOrigin = processTravelMessage({
      message: 'Sydney',
      previousState: stay.state,
      now: NOW,
    });
    expect(withOrigin.state.origin?.value).toBe('Sydney');
    expect(withOrigin.state.destination?.value).toBe('Gold Coast');
    expect(withOrigin.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(withOrigin.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(withOrigin.state.requestedServices).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(withOrigin.searchPerformed).toBe(false);
  });
});
