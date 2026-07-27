import { describe, expect, it } from 'vitest';
import { extractDateCorrection, parseExactDate, parseMidMonth } from '../extract/dates';
import { extractPlaces } from '../extract/places';
import { createEmptyConversationState } from '../types';
import { extractTravelRequirements } from '../extract';

const NOW = new Date('2026-07-27T10:00:00+10:00');

describe('parseExactDate', () => {
  it('parses natural and numeric AU dates', () => {
    expect(parseExactDate('28 August 2026', NOW)?.isoDate).toBe('2026-08-28');
    expect(parseExactDate('15-08-26', NOW)?.isoDate).toBe('2026-08-15');
    expect(parseExactDate('15/08/2026', NOW)?.isoDate).toBe('2026-08-15');
  });
});

describe('parseMidMonth', () => {
  it('parses mid August preference', () => {
    expect(parseMidMonth('leave mid august', NOW)).toMatchObject({
      kind: 'mid_month',
      month: 8,
      year: 2026,
    });
  });
});

describe('extractDateCorrection', () => {
  it('treats no i want to leave mid august as an explicit correction', () => {
    const patch = extractDateCorrection('no i want to leave mid august', NOW);
    expect(patch?.departureDate?.value.kind).toBe('mid_month');
    expect(patch?.explicitChanges).toContain('departureDate');
  });
});

describe('extractPlaces', () => {
  it('reads From Melbourne as origin and go to Gold Coast as destination', () => {
    const patch = extractPlaces(
      'From Melbourne, I want to go to Gold Coast on 28 August 2026, staying in Surfers Paradise',
    );
    expect(patch.origin?.value).toBe('Melbourne');
    expect(patch.destination?.value).toBe('Gold Coast');
    expect(patch.accommodationArea?.value).toBe('Surfers Paradise');
  });
});

describe('extractTravelRequirements single pass', () => {
  it('fills the mandatory first-turn fields together', () => {
    const patch = extractTravelRequirements(
      'From Melbourne, I want to go to Gold Coast on 28 August 2026, returning Monday, staying in Surfers Paradise for 3 nights. I need flights, accommodation and car hire.',
      createEmptyConversationState(),
      NOW,
    );
    expect(patch.origin?.value).toBe('Melbourne');
    expect(patch.destination?.value).toBe('Gold Coast');
    expect(patch.departureDate?.value).toMatchObject({ kind: 'exact', isoDate: '2026-08-28' });
    expect(patch.durationNights?.value).toBe(3);
    expect(patch.servicesAdd).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(patch.explicitChanges).toEqual(
      expect.arrayContaining(['origin', 'destination', 'departureDate']),
    );
  });
});
