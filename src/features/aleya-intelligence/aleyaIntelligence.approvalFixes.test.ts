import { describe, expect, it } from 'vitest';
import { processTravelMessage } from './pipeline';

const NOW = new Date('2026-07-26T10:00:00+10:00');

function baseTrip() {
  return processTravelMessage({
    message: 'Flights from Sydney to Melbourne on 28 August 2026 after 5pm',
    now: NOW,
  });
}

describe('Approval fixes — earlier/later false positives (Blocker 1)', () => {
  it('does not change departure time for “I’ll decide later.”', () => {
    const first = baseTrip();
    const second = processTravelMessage({
      message: "I'll decide later.",
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureTimePreference?.value).toBe('after_5pm');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.lastReference?.kind).not.toBe('later');
  });

  it('does not change departure time for “See you later.”', () => {
    const first = baseTrip();
    const second = processTravelMessage({
      message: 'See you later.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureTimePreference?.value).toBe('after_5pm');
    expect(second.state.lastReference?.kind).not.toBe('later');
  });

  it('does not change departure time for “We’ll talk later.”', () => {
    const first = baseTrip();
    const second = processTravelMessage({
      message: "We'll talk later.",
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureTimePreference?.value).toBe('after_5pm');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('moves date only for “Make it one day earlier.”', () => {
    const first = baseTrip();
    const second = processTravelMessage({
      message: 'Make it one day earlier.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-27');
    expect(second.state.departureTimePreference?.value).toBe('after_5pm');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('moves date only for “Leave one day later.”', () => {
    const first = baseTrip();
    const second = processTravelMessage({
      message: 'Leave one day later.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-29');
    expect(second.state.departureTimePreference?.value).toBe('after_5pm');
  });

  it('shifts time only for “Earlier flight please.”', () => {
    const first = baseTrip();
    const second = processTravelMessage({
      message: 'Earlier flight please.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureTimePreference?.value).toBe('afternoon');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('shifts time only for “Later departure.”', () => {
    const first = baseTrip();
    const second = processTravelMessage({
      message: 'Later departure.',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.departureTimePreference?.value).toBe('evening');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
  });
});

describe('Approval fixes — pending low-confidence destination (Blocker 2)', () => {
  it('asks to confirm soft destination and commits only after yes', () => {
    const first = baseTrip();
    expect(first.state.destination?.value).toBe('Melbourne');

    const soft = processTravelMessage({
      message: 'Maybe Bali instead sometime.',
      previousState: first.state,
      now: NOW,
    });
    expect(soft.state.destination?.value).toBe('Melbourne');
    expect(soft.state.pendingDestination?.value).toBe('Bali');
    expect(soft.state.awaitingDestinationConfirmation).toBe(true);
    expect(soft.stage).toBe('clarify');
    expect(soft.reply).toMatch(/Bali/i);
    expect(soft.reply).toMatch(/Melbourne/i);
    expect(soft.reply).not.toMatch(/confidence/i);
    expect(soft.searchPerformed).toBe(false);

    const confirmed = processTravelMessage({
      message: 'Yes, change to Bali.',
      previousState: soft.state,
      now: NOW,
    });
    expect(confirmed.state.destination?.value).toBe('Bali');
    expect(confirmed.state.pendingDestination).toBeUndefined();
    expect(confirmed.state.awaitingDestinationConfirmation).toBe(false);
    expect(confirmed.state.origin?.value).toBe('Sydney');
    expect(confirmed.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(confirmed.state.departureTimePreference?.value).toBe('after_5pm');
  });

  it('retains original destination when soft suggestion is declined', () => {
    const first = baseTrip();
    const soft = processTravelMessage({
      message: 'Maybe thinking of going to Bali instead sometime',
      previousState: first.state,
      now: NOW,
    });
    expect(soft.state.pendingDestination?.value).toBe('Bali');

    const declined = processTravelMessage({
      message: 'No, keep Melbourne.',
      previousState: soft.state,
      now: NOW,
    });
    expect(declined.state.destination?.value).toBe('Melbourne');
    expect(declined.state.pendingDestination).toBeUndefined();
    expect(declined.state.awaitingDestinationConfirmation).toBe(false);
    expect(declined.state.origin?.value).toBe('Sydney');
    expect(declined.state.departureDate?.value.isoDate).toBe('2026-08-28');
  });

  it('replaces prior pending destination with the latest soft candidate', () => {
    const first = baseTrip();
    const bali = processTravelMessage({
      message: 'Maybe Bali instead sometime.',
      previousState: first.state,
      now: NOW,
    });
    expect(bali.state.pendingDestination?.value).toBe('Bali');

    const tokyo = processTravelMessage({
      message: 'Actually maybe Tokyo instead sometime.',
      previousState: bali.state,
      now: NOW,
    });
    expect(tokyo.state.destination?.value).toBe('Melbourne');
    expect(tokyo.state.pendingDestination?.value).toBe('Tokyo');
    expect(tokyo.state.awaitingDestinationConfirmation).toBe(true);
    expect(tokyo.reply).toMatch(/Tokyo/i);
    expect(tokyo.reply).toMatch(/Melbourne/i);
  });
});
