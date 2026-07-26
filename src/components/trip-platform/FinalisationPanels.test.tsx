import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TripPlatform } from './TripPlatform';

describe('Finalisation surfaces', () => {
  it('opens trip health, universal import, operations, and release centre', async () => {
    const user = userEvent.setup();
    render(<TripPlatform />);

    await user.click(screen.getByRole('tab', { name: /^Plan$/i }));
    await user.click(screen.getByRole('tab', { name: /Trip health/i }));
    expect(await screen.findByRole('heading', { name: /Trip Health Score/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Organise$/i }));
    await user.click(screen.getByRole('tab', { name: /Universal import/i }));
    expect(await screen.findByRole('heading', { name: /Universal import/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^System$/i }));
    await user.click(screen.getByRole('tab', { name: /^Operations$/i }));
    expect(await screen.findByRole('heading', { name: /Operations dashboard/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Release$/i }));
    expect(await screen.findByRole('heading', { name: /Release centre/i })).toBeInTheDocument();
    expect(screen.getByText(/Live providers off/i)).toBeInTheDocument();
  });
});
