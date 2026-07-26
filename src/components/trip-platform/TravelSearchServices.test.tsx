import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TripPlatform } from './TripPlatform';

vi.mock('../../features/locations/suggestLocations', async () => {
  const actual = await vi.importActual<typeof import('../../features/locations/suggestLocations')>(
    '../../features/locations/suggestLocations',
  );
  return {
    ...actual,
    suggestLocations: vi.fn(async (query: string) => ({
      suggestions: [
        {
          id: 'airport:SYD',
          label: 'Sydney — Sydney Airport (SYD), Australia',
          primary: 'Sydney (SYD)',
          secondary: 'Sydney Airport, Australia',
          kind: 'airport' as const,
          airportCode: 'SYD',
          source: 'airport-catalog' as const,
        },
        {
          id: 'airport:NRT',
          label: 'Tokyo — Narita International (NRT), Japan',
          primary: 'Tokyo (NRT)',
          secondary: 'Narita International, Japan',
          kind: 'airport' as const,
          airportCode: 'NRT',
          source: 'airport-catalog' as const,
        },
      ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()) || item.airportCode?.toLowerCase().includes(query.toLowerCase())),
      error: null,
    })),
  };
});

describe('Travel search and services restoration', () => {
  it('exposes Flights, Hotels, Itinerary, Concierge Plan, and Travel services without disabled grey cards', async () => {
    const user = userEvent.setup();
    render(<TripPlatform />);

    await user.click(screen.getByRole('tab', { name: /^Book$/i }));
    await user.click(screen.getByRole('tab', { name: /^Flights$/i }));
    expect(await screen.findByRole('heading', { name: /^Flights$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Planning and recommendation tool/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Save flight plan to trip/i })).toBeEnabled();

    await user.click(screen.getByRole('tab', { name: /^Hotels$/i }));
    expect(await screen.findByRole('heading', { name: /^Hotels$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save hotel plan to trip/i })).toBeEnabled();

    await user.click(screen.getByRole('tab', { name: /^Plan$/i }));
    await user.click(screen.getByRole('tab', { name: /^Itinerary$/i }));
    expect(await screen.findByRole('heading', { name: /Day-by-day itinerary/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Home$/i }));
    await user.click(screen.getByRole('tab', { name: /Concierge Plan/i }));
    expect(await screen.findByRole('heading', { name: /Concierge Plan/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Book$/i }));
    await user.click(screen.getByRole('tab', { name: /Travel services/i }));
    expect(await screen.findByRole('heading', { name: /Travel services/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Explore$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Move$/i })).toBeInTheDocument();
  });

  it('saves a flight plan with autocomplete selection and date pickers', async () => {
    const user = userEvent.setup();
    render(<TripPlatform />);
    await user.click(screen.getByRole('tab', { name: /^Book$/i }));
    await user.click(screen.getByRole('tab', { name: /^Flights$/i }));
    await screen.findByRole('heading', { name: /^Flights$/i });

    const origin = screen.getByRole('combobox', { name: /Origin|flight-plan-origin/i });
    // Field wraps label; combobox may lack aria-label — fall back to id.
    const originInput = document.getElementById('flight-plan-origin') as HTMLInputElement;
    const destinationInput = document.getElementById('flight-plan-destination') as HTMLInputElement;
    expect(originInput).toBeTruthy();
    await user.type(originInput, 'sy');
    await waitFor(() => expect(screen.getByRole('option', { name: /Sydney/i })).toBeInTheDocument());
    await user.click(screen.getByRole('option', { name: /Sydney/i }));

    await user.type(destinationInput, 'nr');
    await waitFor(() => expect(screen.getByRole('option', { name: /Tokyo|Narita/i })).toBeInTheDocument());
    await user.click(screen.getByRole('option', { name: /Tokyo|Narita/i }));

    await user.click(document.getElementById('flight-plan-depart')!);
    expect(screen.getByRole('dialog', { name: /Choose date/i })).toBeInTheDocument();
    const enabledDay = screen.getAllByRole('button').find((button) => {
      const label = button.textContent?.trim() ?? '';
      return /^\d+$/.test(label) && !button.hasAttribute('disabled');
    });
    expect(enabledDay).toBeTruthy();
    await user.click(enabledDay!);

    await user.click(screen.getByRole('button', { name: /Save flight plan to trip/i }));
    expect(await screen.findByText(/Flight plan saved/i)).toBeInTheDocument();
    void origin;
  });
});
