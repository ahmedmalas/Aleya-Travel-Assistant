import { describe, expect, it } from 'vitest';
import { processTravelMessage } from './pipeline';

const NOW = new Date('2026-07-26T10:00:00+10:00');

function melbourneNeedsOrigin() {
  const result = processTravelMessage({
    message: 'I need flights to Melbourne on 28 August 2026',
    now: NOW,
  });
  expect(result.state.destination?.value).toBe('Melbourne');
  expect(result.state.origin).toBeUndefined();
  expect(result.state.missingRequiredFields).toContain('origin');
  expect(result.stage).toBe('clarify');
  expect(result.reply).toMatch(/departing from/i);
  return result;
}

describe('Clarification-aware entity assignment — origin', () => {
  it('Melbourne → departing-from clarify → “Sydney” sets origin only', () => {
    const first = melbourneNeedsOrigin();
    const second = processTravelMessage({
      message: 'Sydney',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.missingRequiredFields).not.toContain('origin');
    expect(second.searchPerformed).toBe(false);
  });

  it('assigns “Sydney Airport” to origin while preserving Melbourne', () => {
    const first = melbourneNeedsOrigin();
    const second = processTravelMessage({
      message: 'Sydney Airport',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('assigns “Brisbane Airport” to origin while preserving Melbourne', () => {
    const first = melbourneNeedsOrigin();
    const second = processTravelMessage({
      message: 'Brisbane Airport',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.origin?.value).toBe('Brisbane');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('assigns “From Sydney” to origin while preserving Melbourne', () => {
    const first = melbourneNeedsOrigin();
    const second = processTravelMessage({
      message: 'From Sydney',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('assigns “Leaving from Sydney” to origin while preserving Melbourne', () => {
    const first = melbourneNeedsOrigin();
    const second = processTravelMessage({
      message: 'Leaving from Sydney',
      previousState: first.state,
      now: NOW,
    });
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
  });

  it('still allows explicit destination change after origin is set', () => {
    const first = melbourneNeedsOrigin();
    const withOrigin = processTravelMessage({
      message: 'Sydney',
      previousState: first.state,
      now: NOW,
    });
    expect(withOrigin.state.origin?.value).toBe('Sydney');
    expect(withOrigin.state.destination?.value).toBe('Melbourne');

    const changed = processTravelMessage({
      message: 'Actually make it Brisbane instead.',
      previousState: withOrigin.state,
      now: NOW,
    });
    expect(changed.state.destination?.value).toBe('Brisbane');
    expect(changed.state.origin?.value).toBe('Sydney');
    expect(changed.state.departureDate?.value.isoDate).toBe('2026-08-28');
  });

  it('explicit destination change still works even while origin clarification is pending', () => {
    const first = melbourneNeedsOrigin();
    const changed = processTravelMessage({
      message: 'Actually make it Brisbane instead.',
      previousState: first.state,
      now: NOW,
    });
    expect(changed.state.destination?.value).toBe('Brisbane');
    // Origin still missing — clarification should continue asking for departure city
    expect(changed.state.origin).toBeUndefined();
    expect(changed.stage).toBe('clarify');
    expect(changed.reply).toMatch(/departing from/i);
  });
});
