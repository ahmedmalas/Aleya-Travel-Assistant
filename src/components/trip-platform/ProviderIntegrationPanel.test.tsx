import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TripPlatform } from './TripPlatform';

describe('Provider integration surface', () => {
  it('opens provider layer panel with architecture and supplier statuses', async () => {
    const user = userEvent.setup();
    render(<TripPlatform />);
    await user.click(screen.getByRole('tab', { name: /^Book$/i }));
    await user.click(screen.getByRole('tab', { name: /Provider layer/i }));
    expect(await screen.findByRole('heading', { name: /Travel provider integration/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/Amadeus/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Booking\.com/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Viator/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText(/Provider architecture diagram/i)).toBeInTheDocument();
    expect(screen.getByText(/never to supplier APIs/i)).toBeInTheDocument();
  });
});
