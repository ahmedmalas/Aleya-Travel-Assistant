import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TripPlatform } from './TripPlatform';

describe('TripPlatform UI', () => {
  it('renders command centre and switches to trip setup via grouped nav', async () => {
    const user = userEvent.setup();
    render(<TripPlatform />);
    expect(screen.getByRole('heading', { name: /Trip platform/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /^Command centre$/i })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Plan$/i }));
    await user.click(screen.getByRole('tab', { name: /Trip setup/i }));
    expect(await screen.findByRole('heading', { name: /Create or edit trip/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Trip name/i)).toBeInTheDocument();
  });

  it('opens assistance, flights, and emergency via section groups', async () => {
    const user = userEvent.setup();
    render(<TripPlatform />);
    await user.click(screen.getByRole('tab', { name: /^Home$/i }));
    await user.click(screen.getByRole('tab', { name: /AI Concierge/i }));
    expect(await screen.findByRole('heading', { name: /Smart assistance/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Book$/i }));
    await user.click(screen.getByRole('tab', { name: /^Flights$/i }));
    expect(await screen.findByRole('heading', { name: /^Flights$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Organise$/i }));
    await user.click(screen.getByRole('tab', { name: /^Emergency$/i }));
    expect(await screen.findByRole('heading', { name: /Emergency centre/i })).toBeInTheDocument();
  });

  it('supports arrow-key tab navigation within the active group', async () => {
    const user = userEvent.setup();
    render(<TripPlatform />);
    const command = await screen.findByRole('tab', { name: /Command centre/i });
    command.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^Onboarding$/i })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: /Product onboarding/i })).toBeInTheDocument();
  });
});
