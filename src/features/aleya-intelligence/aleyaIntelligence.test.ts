import { beforeEach, describe, expect, it } from 'vitest';
import { resetProviderRegistry } from '../../providers/gateway';
import { findLastWeekdayOfMonth } from './clarify';
import { processTravelMessage } from './pipeline';
import { createEmptyConversationState } from './types';

const NOW = new Date('2026-07-26T10:00:00+10:00');

const MELBOURNE_REQUEST =
  'I want to travel to Melbourne at the end of August from Friday afternoon after 5pm and come back to Sydney around afternoon. I’ll need flights around the times I mentioned, car hire that matches the flights schedule and hotel at Docklands.';

describe('Aleya Intelligence Layer', () => {
  beforeEach(() => {
    resetProviderRegistry();
  });

  it('suggests the last Friday of August 2026 as Friday 28 August 2026', () => {
    const friday = findLastWeekdayOfMonth(2026, 8, 5);
    expect(friday.getFullYear()).toBe(2026);
    expect(friday.getMonth()).toBe(7); // August
    expect(friday.getDate()).toBe(28);
    expect(friday.getDay()).toBe(5);
  });

  it('Melbourne regression: extracts requirements and asks only for the unresolved date', async () => {
    const result = await processTravelMessage({
      message: MELBOURNE_REQUEST,
      previousState: createEmptyConversationState(),
      now: NOW,
      runSearch: false,
    });

    expect(result.state.origin?.value).toBe('Sydney');
    expect(result.state.destination?.value).toBe('Melbourne');
    expect(result.state.accommodationLocation?.value).toBe('Docklands');
    expect(result.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'hotels', 'car_hire']));
    expect(result.state.departureTimePreference?.value).toBe('after_5pm');
    expect(result.state.returnTimePreference?.value).toBe('afternoon');
    expect(result.state.carHireRequirements.join(' ')).toMatch(/align|match/i);
    expect(result.stage).toBe('clarify');
    expect(result.reply).toMatch(/28 August 2026/i);
    expect(result.reply).toMatch(/Friday/i);
    expect(result.reply).not.toMatch(/Tell me a little more about what you need/i);
    expect(result.reply).not.toMatch(/Which city or destination/i);
    expect(result.state.awaitingDateConfirmation).toBe(true);
  });

  it('multi-turn: date confirmation retains prior requirements and searches', async () => {
    const first = await processTravelMessage({
      message: MELBOURNE_REQUEST,
      now: NOW,
      runSearch: false,
    });
    const second = await processTravelMessage({
      message: 'Yes, Friday 28 August.',
      previousState: first.state,
      now: NOW,
      runSearch: true,
    });

    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.accommodationLocation?.value).toBe('Docklands');
    expect(second.state.requestedServices).toEqual(expect.arrayContaining(['flights', 'hotels', 'car_hire']));
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-28');
    expect(second.state.awaitingDateConfirmation).toBe(false);
    expect(second.stage).toBe('recommend');
    expect(second.search?.flights.length).toBeGreaterThan(0);
    expect(second.search?.hotels.length).toBeGreaterThan(0);
    expect(second.search?.carHire.length).toBeGreaterThan(0);
    expect(second.reply).not.toMatch(/Which city or destination/i);
    expect(second.reply).not.toMatch(/28 August 2026 work/i);
    expect(second.shouldGenerateItinerary).toBe(false);
  });

  it('does not restart clarification after date is confirmed', async () => {
    const first = await processTravelMessage({ message: MELBOURNE_REQUEST, now: NOW, runSearch: false });
    const second = await processTravelMessage({
      message: 'Yes, Friday 28 August.',
      previousState: first.state,
      now: NOW,
      runSearch: true,
    });
    expect(second.clarifications).toEqual([]);
    expect(second.stage).not.toBe('clarify');
  });

  it('domestic weekend travel', async () => {
    const result = await processTravelMessage({
      message: 'Weekend getaway from Sydney to Brisbane next weekend with a hotel',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.origin?.value).toBe('Sydney');
    expect(result.state.destination?.value).toBe('Brisbane');
    expect(result.state.requestedServices).toEqual(expect.arrayContaining(['hotels']));
    if (result.stage === 'clarify') {
      expect(result.reply).toMatch(/date|weekend|Friday/i);
    } else {
      expect(result.search).toBeDefined();
    }
  });

  it('international leisure travel', async () => {
    const result = await processTravelMessage({
      message: 'Leisure holiday to Bali from Sydney on 10 September 2026, flights and hotel for 2 adults',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.destination?.value).toBe('Bali');
    expect(result.state.origin?.value).toBe('Sydney');
    expect(result.state.tripPurpose?.value).toMatch(/leisure|international/);
    expect(result.stage).toBe('recommend');
    expect(result.search?.flights.length).toBeGreaterThan(0);
  });

  it('business travel', async () => {
    const result = await processTravelMessage({
      message: 'Business trip to Melbourne from Sydney on 15 September 2026, flights and hotel near the CBD',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.tripPurpose?.value).toBe('business');
    expect(result.state.businessRequirements.length).toBeGreaterThan(0);
    expect(result.stage).toBe('recommend');
  });

  it('recurring business travel', async () => {
    const result = await processTravelMessage({
      message: 'Recurring business travel every month to Melbourne from Sydney, next on 5 October 2026',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.tripPurpose?.value).toBe('recurring_business');
  });

  it('family holiday', async () => {
    const result = await processTravelMessage({
      message: 'Family holiday to Gold Coast from Sydney on 1 December 2026 with 2 adults and 2 children, hotel and activities',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.tripPurpose?.value).toBe('family');
    expect(result.state.travellers?.value.children).toBe(2);
    expect(result.planModeHint).toBe('family');
  });

  it('luxury travel', async () => {
    const result = await processTravelMessage({
      message: 'Luxury trip to Paris from Sydney on 20 October 2026, first class flights and five-star hotel',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.tripPurpose?.value).toBe('luxury');
    expect(result.planModeHint).toBe('luxury');
  });

  it('budget travel', async () => {
    const result = await processTravelMessage({
      message: 'Budget flights to Bangkok from Sydney on 12 November 2026, cheap hotel',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.budget?.value.style ?? result.state.tripPurpose?.value).toMatch(/budget/);
    expect(result.planModeHint).toBe('low-cost');
  });

  it('hotel-only search', async () => {
    const result = await processTravelMessage({
      message: 'Hotel in Singapore from 3 November 2026 to 7 November 2026 for 2 guests',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.requestedServices).toContain('hotels');
    expect(result.state.destination?.value).toBe('Singapore');
    expect(result.search?.hotels.length).toBeGreaterThan(0);
    expect(result.shouldGenerateItinerary).toBe(false);
  });

  it('flight-only search', async () => {
    const result = await processTravelMessage({
      message: 'Flights from Perth to Melbourne on 8 September 2026',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.requestedServices).toContain('flights');
    expect(result.search?.flights.length).toBeGreaterThan(0);
    expect(result.search?.hotels.length ?? 0).toBe(0);
  });

  it('car-hire search', async () => {
    const result = await processTravelMessage({
      message: 'Car hire in Cairns from 10 September 2026 to 14 September 2026',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.requestedServices).toContain('car_hire');
    expect(result.state.destination?.value).toBe('Cairns');
    expect(result.search?.carHire.length).toBeGreaterThan(0);
  });

  it('airport transfer', async () => {
    const result = await processTravelMessage({
      message: 'Airport transfer in Melbourne on 28 August 2026 after flights from Sydney',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.requestedServices).toEqual(expect.arrayContaining(['airport_transfers', 'flights']));
    expect(result.search?.transfers.length ?? result.search?.flights.length).toBeGreaterThan(0);
  });

  it('activities', async () => {
    const result = await processTravelMessage({
      message: 'Activities and experiences in Queenstown on 15 September 2026',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.requestedServices).toContain('activities');
    expect(result.search?.activities.length).toBeGreaterThan(0);
  });

  it('road trip', async () => {
    const result = await processTravelMessage({
      message: 'Road trip from Sydney to Melbourne on 1 October 2026 with car hire',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.requestedServices).toEqual(expect.arrayContaining(['road_trip', 'car_hire']));
    expect(result.state.origin?.value).toBe('Sydney');
    expect(result.state.destination?.value).toBe('Melbourne');
  });

  it('camping', async () => {
    const result = await processTravelMessage({
      message: 'Camping trip near Cairns starting 20 September 2026',
      now: NOW,
      runSearch: false,
    });
    expect(result.state.requestedServices).toContain('camping');
    expect(result.state.campingRequirements.length).toBeGreaterThan(0);
  });

  it('4WD expedition', async () => {
    const result = await processTravelMessage({
      message: '4WD expedition around Cairns from 5 October 2026',
      now: NOW,
      runSearch: false,
    });
    expect(result.state.requestedServices).toContain('four_wd');
    expect(result.state.vehiclePreferences).toContain('4WD');
  });

  it('cruise', async () => {
    const result = await processTravelMessage({
      message: 'Cruise from Sydney on 1 November 2026 for 7 nights',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.requestedServices).toContain('cruises');
    expect(result.search?.cruises.length).toBeGreaterThan(0);
  });

  it('multi-city trip', async () => {
    const result = await processTravelMessage({
      message: 'Multi-city trip from Sydney to Tokyo via Singapore on 12 October 2026, flights and hotels',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.destination?.value).toMatch(/Tokyo|Singapore/);
    expect(
      result.state.intermediateDestinations.length > 0 ||
        result.state.tripPurpose?.value === 'multi_city' ||
        result.state.requestedServices.includes('flights'),
    ).toBe(true);
  });

  it('explicit itinerary request sets shouldGenerateItinerary', async () => {
    const result = await processTravelMessage({
      message: 'Build an itinerary for Tokyo from Sydney on 10 April 2027 for 5 days',
      now: NOW,
      runSearch: true,
    });
    expect(result.state.explicitItineraryIntent).toBe(true);
    expect(result.shouldGenerateItinerary).toBe(true);
  });

  it('search without itinerary generation by default', async () => {
    const result = await processTravelMessage({
      message: 'Flights and hotel Melbourne from Sydney on 28 August 2026',
      now: NOW,
      runSearch: true,
    });
    expect(result.shouldGenerateItinerary).toBe(false);
    expect(result.state.explicitItineraryIntent).toBe(false);
    expect(result.search?.flights.length).toBeGreaterThan(0);
  });

  it('updates previously supplied dates or destinations', async () => {
    const first = await processTravelMessage({
      message: 'Flights from Sydney to Melbourne on 28 August 2026',
      now: NOW,
      runSearch: true,
    });
    const second = await processTravelMessage({
      message: 'Actually change destination to Brisbane on 30 August 2026',
      previousState: first.state,
      now: NOW,
      runSearch: true,
    });
    expect(second.state.destination?.value).toBe('Brisbane');
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.departureDate?.value.isoDate).toBe('2026-08-30');
  });

  it('never uses the generic fallback when travel intent exists', async () => {
    const result = await processTravelMessage({
      message: 'I need flights to Melbourne and a hotel in Docklands at the end of August',
      now: NOW,
      runSearch: false,
    });
    expect(result.reply).not.toMatch(/Tell me a little more about what you need/i);
    expect(result.state.destination?.value).toBe('Melbourne');
  });
});
