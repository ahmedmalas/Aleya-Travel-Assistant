import { describe, expect, it } from 'vitest';
import { createEmptyTrip } from '../../store/tripDomain';
import { aiPlanToStops, generateAiTravelPlan } from './aiPlanning';

describe('ai planning mock abstraction', () => {
  it('generates labelled mock plans with day schedules', () => {
    const trip = createEmptyTrip({
      destination: 'Lisbon',
      departureDate: '2026-08-01',
      returnDate: '2026-08-03',
      currency: 'EUR',
      budget: 2000,
    });
    const plan = generateAiTravelPlan(trip, 'family');
    expect(plan.source).toBe('mock-ai');
    expect(plan.disclaimer.toLowerCase()).toContain('not live');
    expect(plan.days.length).toBe(3);
    expect(plan.budgetSuggestion.currency).toBe('EUR');
  });

  it('converts plans into aiGenerated itinerary stops', () => {
    const trip = createEmptyTrip({ destination: 'Tokyo', departureDate: '2026-09-01', returnDate: '2026-09-02' });
    const plan = generateAiTravelPlan(trip, 'business');
    const stops = aiPlanToStops(plan, 'USD');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((stop) => stop.aiGenerated)).toBe(true);
    expect(stops[0]?.notes.toLowerCase()).toContain('mock');
  });
});
