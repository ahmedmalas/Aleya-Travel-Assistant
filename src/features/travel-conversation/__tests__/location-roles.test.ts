import { describe, expect, it } from 'vitest';
import { resolveLocationsForTest } from './helpers';

describe('location role assignment', () => {
  it.each([
    'From Melbourne to Gold Coast',
    'Gold Coast from Melbourne',
    'Leaving Melbourne for Gold Coast',
    'Departing Melbourne and going to Gold Coast',
    'Flying from Melbourne to Gold Coast',
    'I want Gold Coast, leaving from Melbourne',
    'Go to Gold Coast departing Melbourne',
    'I want to go to Gold Coast and departing Melbourne',
    'I want to go Gold Coast and departing Melbourne',
    'departing from Melbourne for Gold Coast',
  ])('assigns Melbourne origin and Gold Coast destination for: %s', (message) => {
    const roles = resolveLocationsForTest(message);
    expect(roles.origin).toBe('Melbourne');
    expect(roles.destination).toBe('Gold Coast');
  });

  it('never treats Surfers Paradise as origin', () => {
    const roles = resolveLocationsForTest(
      'staying at Surfers Paradise departing Melbourne going to Gold Coast',
    );
    expect(roles.origin).toBe('Melbourne');
    expect(roles.destination).toBe('Gold Coast');
    expect(roles.accommodationArea).toBe('Surfers Paradise');
  });
});
