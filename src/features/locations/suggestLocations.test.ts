import { describe, expect, it, vi } from 'vitest';
import { createManualLocation, suggestLocations } from './suggestLocations';

describe('suggestLocations', () => {
  it('returns airport matches for origin/destination IATA codes', async () => {
    const result = await suggestLocations('SYD', { mode: 'flight' });
    expect(result.error).toBeNull();
    expect(result.suggestions.some((item) => item.airportCode === 'SYD')).toBe(true);
    expect(result.suggestions[0]?.label).toMatch(/Sydney/);
  });

  it('updates suggestions as each letter is typed for city search', async () => {
    const s = await suggestLocations('s', { mode: 'flight' });
    const sy = await suggestLocations('sy', { mode: 'flight' });
    const syd = await suggestLocations('syd', { mode: 'flight' });
    expect(s.suggestions.length).toBeGreaterThan(0);
    expect(sy.suggestions.some((item) => item.airportCode === 'SYD')).toBe(true);
    expect(syd.suggestions[0]?.airportCode).toBe('SYD');
  });

  it('prioritises airport catalog for short flight queries without calling places', async () => {
    const fetchPlaces = vi.fn(async () => []);
    const result = await suggestLocations('me', { mode: 'flight', fetchPlaces });
    expect(fetchPlaces).not.toHaveBeenCalled();
    expect(result.suggestions.some((item) => item.airportCode === 'MEL')).toBe(true);
  });

  it('supports place mode for hotels and local services', async () => {
    const fetchPlaces = vi.fn(async () => [
      {
        id: 'nominatim:1',
        label: 'Bondi Beach, Sydney, Australia',
        primary: 'Bondi Beach',
        secondary: 'Sydney, Australia',
        kind: 'landmark' as const,
        source: 'nominatim' as const,
      },
    ]);
    const result = await suggestLocations('Bondi', { mode: 'place', fetchPlaces });
    expect(result.suggestions[0]?.kind).toBe('landmark');
    expect(result.suggestions.some((item) => item.airportCode)).toBe(false);
  });

  it('returns no-results cleanly and allows manual entry fallback', async () => {
    const fetchPlaces = vi.fn(async () => []);
    const result = await suggestLocations('zzzznotacity999', { mode: 'place', fetchPlaces });
    expect(result.suggestions).toEqual([]);
    const manual = createManualLocation('Custom Village');
    expect(manual.source).toBe('manual');
    expect(manual.label).toBe('Custom Village');
  });

  it('does not hard-block when the places provider fails', async () => {
    const fetchPlaces = vi.fn(async () => {
      throw new Error('provider down');
    });
    const result = await suggestLocations('Tokyo', { mode: 'flight', fetchPlaces });
    expect(result.error).toMatch(/provider down|unavailable/i);
    expect(result.suggestions.some((item) => item.airportCode === 'NRT' || item.airportCode === 'HND')).toBe(
      true,
    );
  });
});
