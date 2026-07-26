import { describe, expect, it } from 'vitest';
import { mapTripBriefToDraftPlan } from './tripBrief.mapper';
import { hasTripBriefErrors, validateTripBrief } from './tripBrief.validation';
import type { TripBriefInput } from './models';

const validBrief: TripBriefInput = {
  destination: 'Tokyo',
  startDate: '2026-09-01',
  endDate: '2026-09-05',
  travelers: 2,
  budgetStyle: 'moderate',
  interests: ['food', 'culture'],
  notes: 'Prefer walkable areas',
};

describe('trip brief validation', () => {
  it('accepts a complete brief', () => {
    expect(hasTripBriefErrors(validateTripBrief(validBrief))).toBe(false);
  });

  it('requires destination, dates, travelers, and interests', () => {
    const errors = validateTripBrief({
      ...validBrief,
      destination: '',
      interests: [],
      travelers: 0,
    });
    expect(errors.destination).toBeTruthy();
    expect(errors.interests).toBeTruthy();
    expect(errors.travelers).toBeTruthy();
  });

  it('rejects end before start', () => {
    const errors = validateTripBrief({ ...validBrief, endDate: '2026-08-01' });
    expect(errors.endDate).toMatch(/on or after/i);
  });
});

describe('mapTripBriefToDraftPlan', () => {
  it('builds a deterministic draft with suggested days', () => {
    const plan = mapTripBriefToDraftPlan(validBrief);
    expect(plan.durationDays).toBe(5);
    expect(plan.destination).toBe('Tokyo');
    expect(plan.tripPillars.length).toBeGreaterThan(0);
    expect(plan.suggestedDays).toHaveLength(5);
    expect(plan.suggestedDays[0]).toMatch(/Arrive/);
  });
});
