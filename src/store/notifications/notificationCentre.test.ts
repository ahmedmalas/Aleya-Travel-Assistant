import { describe, expect, it } from 'vitest';
import { createVaultTrip } from '../vaultDomain';
import {
  buildNotificationsFromTrips,
  dismissNotification,
  markNotificationRead,
  unreadNotificationCount,
  visibleNotifications,
} from './notificationCentre';

describe('notificationCentre', () => {
  it('builds departure, document, unpaid, booking, conflict and packing notifications', () => {
    const trip = createVaultTrip({
      tripName: 'Soon',
      departureDate: '2026-07-20',
      status: 'active',
      documents: [
        {
          id: 'd1',
          type: 'passport',
          title: 'Passport',
          holderName: 'A',
          documentNumberLast4: '1111',
          issuingCountry: 'US',
          issueDate: '2020-01-01',
          expiryDate: '2026-07-25',
          notes: '',
          attachmentName: '',
          attachmentMimeType: '',
          storagePath: '',
        },
      ],
      expenses: [
        {
          id: 'e1',
          title: 'Hotel',
          category: 'lodging',
          amount: 100,
          currency: 'USD',
          date: '2026-07-20',
          paid: false,
          notes: '',

          deposit: 0,
          refund: 0,
          sharedTravellerIds: [],
          exchangeRateToTrip: 1,
          attachmentName: '',
        },
      ],
      bookings: [
        {
          id: 'b1',
          type: 'flight',
          title: 'Flight',
          provider: 'Air',
          confirmationNumber: 'X',
          startDate: '2026-07-20',
          endDate: '2026-07-20',
          startTime: '09:00',
          endTime: '12:00',
          location: 'Airport',
          cost: 200,
          currency: 'USD',
          status: 'confirmed',
          notes: '',
          link: '',
          attachmentName: '',
          attachmentMimeType: '',
        },
      ],
      stops: [
        {
          id: 's1',
          title: 'A',
          day: 1,
          order: 1,
          notes: '',
          date: '2026-07-20',
          startTime: '10:00',
          endTime: '12:00',
          location: '',
          category: 'activity',
          cost: 0,
          currency: 'USD',
          bookingReference: '',

          locked: false,
          travellerIds: [],
          itemStatus: 'planned' as const,
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
        {
          id: 's2',
          title: 'B',
          day: 1,
          order: 2,
          notes: '',
          date: '2026-07-20',
          startTime: '11:00',
          endTime: '13:00',
          location: '',
          category: 'activity',
          cost: 0,
          currency: 'USD',
          bookingReference: '',

          locked: false,
          travellerIds: [],
          itemStatus: 'planned' as const,
          latitude: '',
          longitude: '',
          supplierDetails: '',
          reminderAt: '',
          aiGenerated: false,
        },
      ],
      packingLists: [
        {
          id: 'p1',
          name: 'Main',
          templateKey: null,
          items: [
            {
              id: 'pi1',
              name: 'Charger',
              category: 'electronics',
              customCategory: '',
              quantity: 1,
              packed: false,
              assignedTravellerId: null,
            },
          ],
        },
      ],
    });

    const state = buildNotificationsFromTrips([trip], undefined, new Date('2026-07-18T00:00:00.000Z'));
    const kinds = new Set(state.items.map((item) => item.kind));
    expect(kinds.has('departure')).toBe(true);
    expect(kinds.has('document-expiry')).toBe(true);
    expect(kinds.has('unpaid-expense')).toBe(true);
    expect(kinds.has('booking-reminder')).toBe(true);
    expect(kinds.has('itinerary-conflict')).toBe(true);
    expect(kinds.has('packing-deadline')).toBe(true);

    const read = markNotificationRead(state, state.items[0]!.id);
    expect(unreadNotificationCount(read)).toBeLessThan(unreadNotificationCount(state));
    const dismissed = dismissNotification(read, state.items[0]!.id);
    expect(visibleNotifications(dismissed).some((item) => item.id === state.items[0]!.id)).toBe(false);
  });
});
