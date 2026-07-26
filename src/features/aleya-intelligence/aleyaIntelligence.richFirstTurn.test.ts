import { describe, expect, it } from 'vitest';
import { processTravelMessage } from './pipeline';

const NOW = new Date('2026-07-26T10:00:00+10:00');

const RICH_REQUEST =
  'I want to go to Gold Coast from Melbourne end of August for four nights, flying Qantas, and take my wife with me. I’ll need a nice hotel.';

function expectRichFirstTurn(state: ReturnType<typeof processTravelMessage>['state']) {
  expect(state.origin?.value).toBe('Melbourne');
  expect(state.destination?.value).toBe('Gold Coast');
  expect(state.departureDate?.value.kind).toBe('month_end');
  expect(state.departureDate?.value.month).toBe(8);
  expect(state.departureDate?.value.label).toMatch(/end of august/i);
  expect(state.durationNights?.value).toBe(4);
  expect(state.travellers?.value.adults).toBe(2);
  expect(state.airlinePreferences?.value.airlines).toContain('Qantas');
  expect(state.requestedServices).toEqual(expect.arrayContaining(['flights', 'accommodation']));
  expect(state.hotelPreferences?.value.notes).toMatch(/nice hotel/i);
  expect(state.destination?.value).not.toBe('Melbourne');
}

describe('Rich first-turn extraction', () => {
  it('captures compound Gold Coast request in one turn', () => {
    const result = processTravelMessage({ message: RICH_REQUEST, now: NOW });
    expectRichFirstTurn(result.state);
    expect(result.reply).not.toMatch(/Tell me where you want to go/i);
    expect(result.reply).not.toMatch(/Which city or destination/i);
    expect(result.stage).toBe('clarify');
    expect(result.reply).toMatch(/Which date would you like to travel/i);
    expect(result.reply).not.toMatch(/Which Friday/i);
    expect(result.searchPerformed).toBe(false);
  });

  it('accepts 4 nights numeric form', () => {
    const result = processTravelMessage({
      message:
        'I want to go to Gold Coast from Melbourne end of August for 4 nights, flying Qantas, and take my wife with me. I’ll need a nice hotel.',
      now: NOW,
    });
    expect(result.state.durationNights?.value).toBe(4);
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
  });

  it('parses my wife and I as two adults', () => {
    const result = processTravelMessage({
      message: 'My wife and I want to go to Gold Coast from Melbourne end of August for four nights with a nice hotel',
      now: NOW,
    });
    expect(result.state.travellers?.value.adults).toBe(2);
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.origin?.value).toBe('Melbourne');
  });

  it('parses me and my wife as two adults', () => {
    const result = processTravelMessage({
      message: 'Me and my wife want to go to Gold Coast from Brisbane for four nights',
      now: NOW,
    });
    expect(result.state.travellers?.value.adults).toBe(2);
    expect(result.state.origin?.value).toBe('Brisbane');
    expect(result.state.destination?.value).toBe('Gold Coast');
  });

  it('strips a greeting and still extracts the travel request', () => {
    const result = processTravelMessage({
      message: `Hi Aleya, ${RICH_REQUEST}`,
      now: NOW,
      travellerName: 'Ahmed',
    });
    expectRichFirstTurn(result.state);
    expect(result.reply).not.toMatch(/^Hi Ahmed\. Tell me where you want to go/i);
    expect(result.reply).toMatch(/Gold Coast/i);
    expect(result.reply).toMatch(/Which date would you like to travel/i);
  });

  it('handles destination and origin in the same sentence', () => {
    const result = processTravelMessage({
      message: 'Going to Gold Coast from Melbourne end of August four nights flying Qantas nice hotel with my wife',
      now: NOW,
    });
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.durationNights?.value).toBe(4);
    expect(result.state.travellers?.value.adults).toBe(2);
  });

  it('handles punctuation-free user input', () => {
    const result = processTravelMessage({
      message:
        'I want to go to Gold Coast from Melbourne end of August for four nights flying Qantas and take my wife with me I need a nice hotel',
      now: NOW,
    });
    expectRichFirstTurn(result.state);
  });
});

describe('Pending departure-date clarification', () => {
  function pendingDateState() {
    const first = processTravelMessage({ message: RICH_REQUEST, now: NOW });
    expect(first.state.missingRequiredFields).toContain('departureDate');
    expect(first.reply).toMatch(/Which date would you like to travel/i);
    return first;
  }

  const answers = [
    '28th of August',
    '28 August',
    '28th August',
    'August 28',
    '28 Aug',
    'Friday the 28th',
  ];

  for (const answer of answers) {
    it(`resolves pending date from “${answer}”`, () => {
      const first = pendingDateState();
      const second = processTravelMessage({
        message: answer,
        previousState: first.state,
        now: NOW,
      });
      expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
      expect(second.state.awaitingDateConfirmation).toBe(false);
      expect(second.state.missingRequiredFields).not.toContain('departureDate');
      expect(second.state.missingRequiredFields).not.toContain('departureDateConfirmation');
      expect(second.reply).not.toMatch(/Which date would you like to travel/i);
      expect(second.reply).not.toMatch(/Which Friday/i);
      // Prior requirements preserved
      expect(second.state.origin?.value).toBe('Melbourne');
      expect(second.state.destination?.value).toBe('Gold Coast');
      expect(second.state.durationNights?.value).toBe(4);
      expect(second.state.travellers?.value.adults).toBe(2);
      expect(second.state.airlinePreferences?.value.airlines).toContain('Qantas');
      expect(second.searchPerformed).toBe(false);
    });
  }
});

describe('Full live conversation regression — rich first turn + date', () => {
  it('captures first turn, asks only for date, then saves 28 August 2026', () => {
    const first = processTravelMessage({
      message:
        'Hi Aleya, I want to go to Gold Coast from Melbourne end of August, four nights, flying Qantas, and I want to take my wife with me, so I’ll need a nice hotel.',
      now: NOW,
      travellerName: 'Ahmed',
    });

    expectRichFirstTurn(first.state);
    expect(first.reply).toMatch(/Which date would you like to travel/i);
    expect(first.reply).not.toMatch(/Tell me where you want to go/i);
    expect(first.reply).not.toMatch(/Which Friday/i);

    const second = processTravelMessage({
      message: '28th of August',
      previousState: first.state,
      now: NOW,
      travellerName: 'Ahmed',
    });

    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.departureDate?.value.year).toBe(2026);
    expect(second.state.awaitingDateConfirmation).toBe(false);
    expect(second.reply).not.toMatch(/Which date would you like to travel/i);
    expect(second.reply).not.toMatch(/Which Friday/i);

    expect(second.state.origin?.value).toBe('Melbourne');
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.durationNights?.value).toBe(4);
    expect(second.state.travellers?.value.adults).toBe(2);
    expect(second.state.airlinePreferences?.value.airlines).toContain('Qantas');
    expect(second.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'accommodation']));
    expect(second.state.hotelPreferences?.value.notes).toMatch(/nice hotel/i);
    expect(second.searchPerformed).toBe(false);
    expect(second.reply).not.toMatch(/\b(?:available|priced?|book(?:ed|ing)?|\$\d)\b/i);
  });
});
