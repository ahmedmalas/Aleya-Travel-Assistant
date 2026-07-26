import { describe, expect, it } from 'vitest';
import { createVaultTrip } from '../vaultDomain';
import { buildCommandCentre } from './commandCentre';

describe('commandCentre', () => {
  it('summarises trips, departures, budgets and quick actions', () => {
    const trips = [
      createVaultTrip({
        id: 't1',
        tripName: 'Current',
        destination: 'Rome',
        departureDate: '2026-08-01',
        status: 'active',
        favourite: true,
        budget: 1000,
        expenses: [
          {
            id: 'e1',
            title: 'Train',
            category: 'transport',
            amount: 120,
            currency: 'USD',
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
      }),
      createVaultTrip({
        id: 't2',
        tripName: 'Drafty',
        status: 'draft',
        departureDate: '2026-09-01',
      }),
    ];
    const model = buildCommandCentre(trips, 't1', []);
    expect(model.tripCount).toBe(2);
    expect(model.currentTrip?.tripName).toBe('Current');
    expect(model.upcomingDepartures[0]?.tripName).toBe('Current');
    expect(model.budgetStatus[0]?.remaining).toBe(880);
    expect(model.quickActions.some((action) => action.tab === 'notifications')).toBe(true);
  });
});
