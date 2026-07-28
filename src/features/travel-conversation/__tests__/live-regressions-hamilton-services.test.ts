import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeInput } from '../normalize';
import { extractServiceCandidates } from '../candidates/services';
import { resetTravelConversation, sendTravelMessage } from '../index';
import { NOW } from './helpers';

beforeEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

describe('live regression — Hamilton Island and natural corrections', () => {
  it.each([
    'I want to go Hamilton Island',
    'I want to go Hamilton Islands',
    'I want to go hmilton island',
    'I want to go hmailton island',
  ])('recognises destination from %s', (message) => {
    const result = sendTravelMessage({ message, now: NOW });
    expect(result.state.destination?.value).toBe('Hamilton Island');
    expect(result.progression.nextRequiredField?.id).toBe('origin');
    expect(result.reply).toMatch(/Hamilton Island/i);
  });

  it('replaces Brisbane with Cairns using natural correction wording', () => {
    sendTravelMessage({ message: 'I want to go Brisbane', now: NOW });
    sendTravelMessage({ message: 'Sydney', now: NOW });

    const changed = sendTravelMessage({
      message: 'change it the destination to cairns',
      now: NOW,
    });

    expect(changed.state.origin?.value).toBe('Sydney');
    expect(changed.state.destination?.value).toBe('Cairns');
    expect(changed.progression.nextRequiredField?.id).toBe('departureDate');
    expect(changed.reply).toMatch(/date/i);
    expect(changed.reply).not.toMatch(/Brisbane/i);
  });

  it('accepts the misspelled correction form from the browser transcript', () => {
    sendTravelMessage({ message: 'I want to go Brisbane', now: NOW });
    sendTravelMessage({ message: 'Sydney', now: NOW });

    const changed = sendTravelMessage({ message: 'chnage it to cairns', now: NOW });
    expect(changed.state.destination?.value).toBe('Cairns');
    expect(changed.state.origin?.value).toBe('Sydney');
  });
});

describe('live regression — concise and misspelled services', () => {
  it.each([
    ['hotel', 'accommodation'],
    ['book flights', 'flights'],
    ['car hire4', 'car_hire'],
    ['i ned actvities', 'activities'],
  ] as const)('extracts %s as %s', (message, expected) => {
    const normalized = normalizeInput(message);
    const services = extractServiceCandidates(normalized)
      .filter((candidate) => candidate.operation === 'add')
      .map((candidate) => candidate.service);
    expect(services).toContain(expected);
  });

  it('keeps progressing through missing core fields after adding services early', () => {
    const destination = sendTravelMessage({ message: 'I want to go Brisbane', now: NOW });
    expect(destination.progression.nextRequiredField?.id).toBe('origin');

    const hotel = sendTravelMessage({ message: 'hotel', now: NOW });
    expect(hotel.state.services).toContain('accommodation');
    expect(hotel.progression.nextRequiredField?.id).toBe('origin');
    expect(hotel.reply).toMatch(/travelling from/i);

    const origin = sendTravelMessage({ message: 'Sydney', now: NOW });
    expect(origin.state.origin?.value).toBe('Sydney');
    expect(origin.progression.nextRequiredField?.id).toBe('departureDate');
    expect(origin.reply).toMatch(/date/i);
  });
});
