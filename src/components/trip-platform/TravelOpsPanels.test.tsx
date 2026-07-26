import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TripPlatform } from './TripPlatform';

const goTo = (tabId: string) => {
  fireEvent.change(screen.getByLabelText('Section screen'), { target: { value: tabId } });
};

describe('Travel ops panels smoke', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('creates destination, flight, stay and checklist template items', async () => {
    render(<TripPlatform />);

    goTo('destinations');
    fireEvent.change(await screen.findByLabelText(/^Name$/i), { target: { value: 'Kyoto' } });
    fireEvent.click(await screen.findByRole('button', { name: /Save destination/i }));
    expect(await screen.findByText(/Kyoto/i)).toBeTruthy();

    goTo('flights');
    fireEvent.change(await screen.findByLabelText(/^Airline$/i), { target: { value: 'JAL' } });
    fireEvent.change(screen.getByLabelText(/^Flight number$/i), { target: { value: 'JL123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save flight$/i }));
    expect(await screen.findByText(/JL123|JAL/i)).toBeTruthy();

    goTo('stays');
    fireEvent.change(await screen.findByLabelText(/^Name$/i), { target: { value: 'Ryokan Stay' } });
    fireEvent.click(screen.getByRole('button', { name: /Save stay/i }));
    expect(await screen.findByText(/Ryokan Stay/i)).toBeTruthy();

    goTo('checklist');
    fireEvent.click(await screen.findByRole('button', { name: /Apply pre-departure template/i }));
    expect((await screen.findAllByRole('checkbox')).length).toBeGreaterThan(0);

    goTo('assistance');
    expect(await screen.findByRole('heading', { name: /Smart assistance/i })).toBeTruthy();

    goTo('onboarding');
    expect(await screen.findByRole('heading', { name: /Product onboarding/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Complete step/i }));
  });
});
