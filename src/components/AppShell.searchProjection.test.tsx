import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';
import {
  CONVERSATION_SCHEMA_VERSION,
  createEmptyConversationState,
  projectCanonicalSearch,
  rehydrateTravelConversation,
  resetTravelConversation,
  STORAGE_KEY,
} from '../features/travel-conversation';

function field<T>(value: T) {
  return { value, source: 'explicit' as const, confirmed: true };
}

function seedSydneyMelbourneTrip() {
  const state = createEmptyConversationState('browser-proof-syd-mel');
  state.origin = field('Sydney');
  state.destination = field('Melbourne');
  state.departureDate = field({
    kind: 'exact' as const,
    isoDate: '2026-08-28',
    label: '28/08/2026',
    day: 28,
    month: 8,
    year: 2026,
  });
  state.returnDate = field({
    isoDate: '2026-08-31',
    label: '31/08/2026',
  });
  state.services = ['flights', 'accommodation', 'car_hire'];
  state.phase = 'ready';
  state.turnCount = 1;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: CONVERSATION_SCHEMA_VERSION, state }),
  );
  rehydrateTravelConversation();
  return state;
}

async function enterApp(user: ReturnType<typeof userEvent.setup>) {
  const guest = screen.queryByRole('button', { name: /Explore as guest/i });
  if (guest) await user.click(guest);
}

beforeEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

describe('AppShell canonical search form binding', () => {
  it('browser proof: search form shows SYD → MEL with product_default 1 adult', async () => {
    const user = userEvent.setup();
    const state = seedSydneyMelbourneTrip();
    const projection = projectCanonicalSearch(state);
    expect(projection.origin.airportCode).toBe('SYD');
    expect(projection.destination.airportCode).toBe('MEL');
    expect(projection.adults).toBe(1);
    expect(projection.travellerSource).toBe('product_default');

    render(<AppShell />);
    await enterApp(user);

    const form = await screen.findByTestId('canonical-search-form');
    await waitFor(() => {
      expect(form).toHaveAttribute('data-origin', 'SYD');
      expect(form).toHaveAttribute('data-destination', 'MEL');
      expect(form).toHaveAttribute('data-route', 'SYD→MEL');
      expect(form).toHaveAttribute('data-depart', '2026-08-28');
      expect(form).toHaveAttribute('data-return', '2026-08-31');
      expect(form).toHaveAttribute('data-adults', '1');
      expect(form).toHaveAttribute('data-traveller-source', 'product_default');
    });

    expect(screen.getByTestId('search-origin')).toHaveValue('SYD');
    expect(screen.getByTestId('search-destination')).toHaveValue('MEL');
    expect(screen.getByTestId('search-travellers')).toHaveValue('1');
    expect(screen.getByTestId('search-travellers')).toHaveAttribute(
      'data-traveller-source',
      'product_default',
    );
    expect(screen.getByText(/Travellers \(default 1 adult\)/i)).toBeInTheDocument();
  });

  it('traveller-state proof: never fabricates a second adult from empty state', async () => {
    const user = userEvent.setup();
    seedSydneyMelbourneTrip();
    render(<AppShell />);
    await enterApp(user);

    const travellers = await screen.findByTestId('search-travellers');
    expect(travellers).toHaveValue('1');
    expect(travellers).not.toHaveValue('2');
    expect(screen.getByTestId('canonical-search-form')).toHaveAttribute(
      'data-traveller-source',
      'product_default',
    );
  });
});
