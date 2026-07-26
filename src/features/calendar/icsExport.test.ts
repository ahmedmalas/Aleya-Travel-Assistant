import { describe, expect, it } from 'vitest';
import { createEmptyTrip } from '../../store/tripDomain';
import { buildItineraryIcs, buildPrintableItineraryHtml } from './icsExport';

describe('ics export', () => {
  it('builds a VCALENDAR payload from dated stops', () => {
    const trip = createEmptyTrip({
      tripName: 'Portugal Escape',
      destination: 'Lisbon',
      stops: [
        {
          id: 's1',
          title: 'Arrive',
          day: 1,
          order: 1,
          notes: 'Transfer',
          date: '2026-08-01',
          startTime: '14:00',
          endTime: '16:00',
          location: 'LIS',
          category: 'travel',
          cost: 0,
          currency: 'EUR',
          bookingReference: '',
          locked: false,
          travellerIds: [],
          itemStatus: 'planned',
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
      ],
    });
    const ics = buildItineraryIcs(trip);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Arrive');
    expect(ics).toContain('DTSTART:20260801T140000');
  });

  it('builds printable html with AI labels', () => {
    const trip = createEmptyTrip({
      tripName: 'Test',
      stops: [
        {
          id: 's1',
          title: 'Dinner',
          day: 1,
          order: 1,
          notes: 'Nice place',
          date: '2026-08-01',
          startTime: '19:00',
          endTime: '21:00',
          location: 'Chiado',
          category: 'food',
          cost: 40,
          currency: 'EUR',
          bookingReference: '',
          locked: true,
          travellerIds: [],
          itemStatus: 'planned',
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: true,
        },
      ],
    });
    const html = buildPrintableItineraryHtml(trip);
    expect(html).toContain('Dinner');
    expect(html).toContain('AI suggestion');
  });
});
