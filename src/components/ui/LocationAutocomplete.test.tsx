import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LocationAutocomplete } from './LocationAutocomplete';

vi.mock('../../features/locations/suggestLocations', async () => {
  const actual = await vi.importActual<typeof import('../../features/locations/suggestLocations')>(
    '../../features/locations/suggestLocations',
  );
  return {
    ...actual,
    suggestLocations: vi.fn(async (query: string) => {
      const q = query.toLowerCase();
      if (q.startsWith('zzz')) {
        return { suggestions: [], error: null };
      }
      if (q.includes('fail')) {
        return { suggestions: [], error: 'Location lookup failed' };
      }
      return {
        suggestions: [
          {
            id: 'airport:SYD',
            label: 'Sydney — Sydney Airport (SYD), Australia',
            primary: 'Sydney (SYD)',
            secondary: 'Sydney Airport, Australia',
            kind: 'airport' as const,
            airportCode: 'SYD',
            city: 'Sydney',
            country: 'Australia',
            source: 'airport-catalog' as const,
          },
          {
            id: 'airport:MEL',
            label: 'Melbourne — Melbourne Airport (MEL), Australia',
            primary: 'Melbourne (MEL)',
            secondary: 'Melbourne Airport, Australia',
            kind: 'airport' as const,
            airportCode: 'MEL',
            city: 'Melbourne',
            country: 'Australia',
            source: 'airport-catalog' as const,
          },
        ].filter((item) => item.label.toLowerCase().includes(q) || item.airportCode?.toLowerCase().includes(q)),
        error: null,
      };
    }),
  };
});

function ControlledAutocomplete({
  initial = '',
  mode = 'flight' as const,
}: {
  initial?: string;
  mode?: 'flight' | 'place' | 'any';
}) {
  const [value, setValue] = useState(initial);
  return (
    <LocationAutocomplete
      id="origin"
      mode={mode}
      value={value}
      onChange={(next) => setValue(next)}
    />
  );
}

describe('LocationAutocomplete', () => {
  it('shows live suggestions while typing origin characters', async () => {
    const user = userEvent.setup();
    render(<ControlledAutocomplete />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'sy');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Sydney/i })).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation and Enter selection', async () => {
    const user = userEvent.setup();
    render(<ControlledAutocomplete initial="mel" />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await waitFor(() => expect(screen.getByRole('option', { name: /Melbourne/i })).toBeInTheDocument());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /Melbourne/i })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(input).toHaveValue('Melbourne — Melbourne Airport (MEL), Australia');
    });
  });

  it('supports mouse selection of an airport code result', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LocationAutocomplete id="origin" mode="flight" value="SYD" onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('option', { name: /Sydney/i })).toBeInTheDocument());
    await user.click(screen.getByRole('option', { name: /Sydney/i }));
    expect(onChange).toHaveBeenCalledWith(
      'Sydney — Sydney Airport (SYD), Australia',
      expect.objectContaining({ airportCode: 'SYD' }),
    );
  });

  it('shows no-results state without blocking manual entry', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LocationAutocomplete id="origin" mode="flight" value="zzznowhere" onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText(/No matches/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  it('shows provider error with manual-entry fallback messaging', async () => {
    const user = userEvent.setup();
    render(<LocationAutocomplete id="origin" mode="place" value="failtown" onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText(/keep typing a location manually/i)).toBeInTheDocument();
    });
  });
});
