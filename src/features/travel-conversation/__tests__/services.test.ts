import { describe, expect, it } from 'vitest';
import { processTravelTurn } from '../pipeline';
import { createEmptyConversationState } from '../types';
import { NOW } from './helpers';

function withServices() {
  const state = createEmptyConversationState();
  state.services = ['flights', 'accommodation', 'car_hire'];
  state.origin = { value: 'Melbourne', source: 'explicit', confirmed: true };
  state.destination = { value: 'Gold Coast', source: 'explicit', confirmed: true };
  return state;
}

describe('services and removals', () => {
  it('Remove car hire', () => {
    const result = processTravelTurn({
      message: 'Remove car hire',
      previousState: withServices(),
      now: NOW,
      commit: false,
    });
    expect(result.state.services).toEqual(['flights', 'accommodation']);
    expect(result.state.excludedServices).toContain('car_hire');
  });

  it('Forget the hotel and add car hire', () => {
    const start = withServices();
    start.services = ['flights', 'accommodation'];
    const result = processTravelTurn({
      message: 'Forget the hotel and add car hire',
      previousState: start,
      now: NOW,
      commit: false,
    });
    expect(result.state.services).toEqual(expect.arrayContaining(['flights', 'car_hire']));
    expect(result.state.services).not.toContain('accommodation');
  });

  it('Remove flights and accommodation', () => {
    const result = processTravelTurn({
      message: 'Remove flights and accommodation',
      previousState: withServices(),
      now: NOW,
      commit: false,
    });
    expect(result.state.services).toEqual(['car_hire']);
  });

  it('Remove flights and accommodation and add car hire', () => {
    const start = withServices();
    start.services = ['flights', 'accommodation'];
    const result = processTravelTurn({
      message: 'Remove flights and accommodation and add car hire',
      previousState: start,
      now: NOW,
      commit: false,
    });
    expect(result.state.services).toEqual(['car_hire']);
  });

  it('No flights, keep the hotel', () => {
    const result = processTravelTurn({
      message: 'No flights, keep the hotel',
      previousState: withServices(),
      now: NOW,
      commit: false,
    });
    expect(result.state.services).toContain('accommodation');
    expect(result.state.services).not.toContain('flights');
  });
});
