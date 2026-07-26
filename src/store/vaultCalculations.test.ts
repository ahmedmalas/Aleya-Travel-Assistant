import { describe, expect, it } from 'vitest';
import {
  collectDocumentExpiryReminders,
  filterAndSortVaultTrips,
  listCalendarDays,
  searchVault,
  canPerform,
} from './vaultCalculations';
import { createVaultTrip, toVaultTrip } from './vaultDomain';

describe('vaultCalculations', () => {
  it('filters favourites and sorts by name', () => {
    const trips = [
      createVaultTrip({ tripName: 'Zulu', favourite: false, lastOpenedAt: '2026-01-02T00:00:00.000Z' }),
      createVaultTrip({ tripName: 'Alpha', favourite: true, lastOpenedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const filtered = filterAndSortVaultTrips(trips, { filter: 'favourites', sort: 'name' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.tripName).toBe('Alpha');
  });

  it('searches across itinerary bookings expenses packing travellers and documents', () => {
    const trip = createVaultTrip({
      tripName: 'Lisbon Escape',
      destination: 'Lisbon',
      stops: [
        {
          id: 's1',
          title: 'Tram 28',
          day: 1,
          order: 1,
          notes: '',
          date: '2026-08-01',
          startTime: '10:00',
          endTime: '11:00',
          location: 'Alfama',
          category: 'transport',
          cost: 5,
          currency: 'EUR',
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
      bookings: [
        {
          id: 'b1',
          type: 'hotel',
          title: 'Baixa Hotel',
          provider: 'StayCo',
          confirmationNumber: 'H1',
          startDate: '2026-08-01',
          endDate: '2026-08-03',
          startTime: '',
          endTime: '',
          location: 'Lisbon',
          cost: 200,
          currency: 'EUR',
          status: 'confirmed',
          notes: '',
          link: '',
          attachmentName: '',
          attachmentMimeType: '',
        },
      ],
      expenses: [
        {
          id: 'e1',
          title: 'Pastel de nata',
          category: 'food',
          amount: 3,
          currency: 'EUR',
          date: '2026-08-01',
          paid: true,
          notes: '',

          deposit: 0,
          refund: 0,
          sharedTravellerIds: [],
          exchangeRateToTrip: 1,
          attachmentName: '',
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
              name: 'Adapter',
              category: 'electronics',
              customCategory: '',
              quantity: 1,
              packed: false,
              assignedTravellerId: null,
            },
          ],
        },
      ],
      travellers: [
        {
          id: 't1',
          name: 'Sam',
          dateOfBirth: '',
          nationality: 'PT',
          dietaryRequirements: '',
          accessibilityNeeds: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          loyaltyPrograms: '',
          passportNumberLast4: '',
          passportExpiry: '',
          passportCountry: '',

          preferredName: '',
          countryOfResidence: '',
          homeAirport: '',
          preferredDepartureAirports: '',
          language: 'en',
          currency: 'USD',
          timeZone: '',
          travelPreferences: '',
          seatingPreference: '',
          cabinPreference: '',
          hotelPreferences: '',
          loyaltyMemberships: [],
          companions: [],
          identityDocumentType: '',
          identityDocumentExpiry: '',
        },
      ],
      documents: [
        {
          id: 'd1',
          type: 'visa',
          title: 'Schengen visa',
          holderName: 'Sam',
          documentNumberLast4: '9988',
          issuingCountry: 'PT',
          issueDate: '2026-01-01',
          expiryDate: '2026-07-20',
          notes: '',
          attachmentName: 'visa.pdf',
          attachmentMimeType: 'application/pdf',
          storagePath: '',
        },
      ],
    });

    expect(searchVault([trip], 'tram').some((hit) => hit.entity === 'itinerary')).toBe(true);
    expect(searchVault([trip], 'baixa').some((hit) => hit.entity === 'booking')).toBe(true);
    expect(searchVault([trip], 'pastel').some((hit) => hit.entity === 'expense')).toBe(true);
    expect(searchVault([trip], 'adapter').some((hit) => hit.entity === 'packing')).toBe(true);
    expect(searchVault([trip], 'sam').some((hit) => hit.entity === 'traveller')).toBe(true);
    expect(searchVault([trip], 'schengen').some((hit) => hit.entity === 'document')).toBe(true);
  });

  it('builds document expiry reminders and permission checks', () => {
    const trip = toVaultTrip(
      createVaultTrip({
        documents: [
          {
            id: 'd1',
            type: 'passport',
            title: 'Passport',
            holderName: 'A',
            documentNumberLast4: '1234',
            issuingCountry: 'US',
            issueDate: '2020-01-01',
            expiryDate: '2026-07-25',
            notes: '',
            attachmentName: '',
            attachmentMimeType: '',
            storagePath: '',
          },
        ],
      }),
    );
    const reminders = collectDocumentExpiryReminders([trip], new Date('2026-07-18T00:00:00.000Z'));
    expect(reminders[0]?.severity).toBe('urgent');
    expect(canPerform('viewer', 'canEditTrip')).toBe(false);
    expect(canPerform('owner', 'canManageMembers')).toBe(true);
  });

  it('lists calendar days for month week and day modes', () => {
    const anchor = new Date('2026-07-15T00:00:00.000Z');
    expect(listCalendarDays(anchor, 'day')).toHaveLength(1);
    expect(listCalendarDays(anchor, 'week')).toHaveLength(7);
    expect(listCalendarDays(anchor, 'month')).toHaveLength(42);
  });
});
