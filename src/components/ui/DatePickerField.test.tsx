import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatePickerField, formatAuDate, todayIso } from './DatePickerField';

describe('DatePickerField', () => {
  it('formats dates in Australian DD/MM/YYYY style', () => {
    expect(formatAuDate('2026-09-01')).toBe('01/09/2026');
  });

  it('opens a calendar on click for departure selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePickerField id="depart" value="" min={todayIso()} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /DD\/MM\/YYYY/i }));
    expect(screen.getByRole('dialog', { name: /Choose date/i })).toBeInTheDocument();
  });

  it('prevents selecting dates before the minimum (past dates disabled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePickerField id="depart" value="2026-09-10" min="2026-09-10" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '10/09/2026' }));
    const dialog = screen.getByRole('dialog', { name: /Choose date/i });
    expect(dialog).toBeInTheDocument();
    // Day 9 should be disabled when min is the 10th.
    const day9 = screen.getByRole('button', { name: '9' });
    expect(day9).toBeDisabled();
  });

  it('enforces return-date minimum after departure', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePickerField id="return" value="2026-09-20" min="2026-09-15" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '20/09/2026' }));
    const day14 = screen.getByRole('button', { name: '14' });
    expect(day14).toBeDisabled();
    const day16 = screen.getByRole('button', { name: '16' });
    expect(day16).toBeEnabled();
    await user.click(day16);
    expect(onChange).toHaveBeenCalledWith('2026-09-16');
  });

  it('supports keyboard focus on the date field trigger', async () => {
    const user = userEvent.setup();
    render(<DatePickerField id="depart" value="2026-10-01" onChange={vi.fn()} />);
    await user.tab();
    expect(screen.getByRole('button', { name: '01/10/2026' })).toHaveFocus();
  });
});
