import { describe, expect, it } from 'vitest';
import { TRAVEL_SERVICE_GROUPS, findService, listAllServices } from './catalog';

describe('travel services catalog', () => {
  it('groups Book / Plan / Explore / Move / Organise / Assist', () => {
    expect(TRAVEL_SERVICE_GROUPS.map((group) => group.id)).toEqual([
      'book',
      'plan',
      'explore',
      'move',
      'organise',
      'assist',
    ]);
  });

  it('includes required service categories with availability labels', () => {
    const titles = listAllServices().map((item) => item.title);
    for (const required of [
      'Flights',
      'Hotels',
      'Itinerary Builder',
      'AI Concierge',
      'Car Hire',
      'Cruises',
      'Leisure and Activities',
      'Tours and Attractions',
      'Taxis',
      'Rideshare',
      'Airport Transfers',
      'Private Hire',
      'Chauffeur Services',
      'Off-Roading',
      'Adventure Activities',
      'Restaurants',
      'Nearby Recommendations',
      'Things To Do Nearby',
      'Shopping Nearby',
      'Beaches and Nature',
      'Family Activities',
      'Nightlife',
      'Events',
      'Local Transport',
      'Trains',
      'Buses and Coaches',
      'Ferries',
      'Travel Insurance',
      'Visa and Entry Guidance',
      'Currency and Budgeting',
      'Weather and Seasonal Guidance',
      'Packing Assistance',
      'Booking Organiser',
      'Travel Documents',
      'Trip Notes',
      'Emergency and Local Assistance',
      'Concierge Plan',
    ]) {
      expect(titles).toContain(required);
    }
    for (const item of listAllServices()) {
      expect([
        'Available now',
        'Planning and recommendation tool',
        'Live search connected',
        'Coming soon',
      ]).toContain(item.availability);
    }
  });

  it('wires core sections to platform tabs', () => {
    expect(findService('flights')?.tabId).toBe('flights');
    expect(findService('hotels')?.tabId).toBe('stays');
    expect(findService('itineraries')?.tabId).toBe('itinerary');
    expect(findService('concierge-plan')?.tabId).toBe('concierge-plan');
  });
});
