import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildLocationAmbiguityOptionSet,
  clearLocationCache,
  formatAmbiguityQuestion,
  getDefaultLocationProvider,
  isAmbiguousResults,
  setDefaultLocationProviderForTests,
  CompositeTravelLocationProvider,
  LocalTravelLocationProvider,
} from '../index';

describe('travel-location-intelligence', () => {
  beforeEach(() => {
    clearLocationCache();
    setDefaultLocationProviderForTests(null);
  });

  it.each([
    'Hamilton Islands',
    'hmilton island',
    'hmailton island',
    'hamilton islnd',
    'goldcoast',
    'cains',
    'melborne',
  ])('variant/misspelling resolves: %s', (query) => {
    const hit = getDefaultLocationProvider().resolveSync(query)[0]?.place;
    expect(hit?.canonicalName).toBeTruthy();
    if (/hamilton|hti/i.test(query)) {
      expect(hit?.canonicalName).toBe('Hamilton Island');
    }
    if (/gold/i.test(query)) expect(hit?.canonicalName).toBe('Gold Coast');
    if (/cain/i.test(query)) expect(hit?.canonicalName).toBe('Cairns');
    if (/melb/i.test(query)) expect(hit?.canonicalName).toBe('Melbourne');
  });

  it('detects ambiguity for bare Hamilton / Springfield / Richmond', () => {
    for (const message of ['Hamilton', 'Springfield', 'Richmond']) {
      const results = getDefaultLocationProvider().resolveSync(message);
      expect(isAmbiguousResults(results), message).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(2);
      const question = formatAmbiguityQuestion(results);
      const optionSet = buildLocationAmbiguityOptionSet(question, results);
      expect(optionSet.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not resolve ordinary non-place phrases', () => {
    for (const q of ['all good', 'hotel', 'return', "I'm ready", 'something cheap', 'change it']) {
      expect(getDefaultLocationProvider().resolveSync(q)).toEqual([]);
    }
  });

  it('resolves airport codes and named airports', () => {
    const provider = getDefaultLocationProvider();
    expect(
      provider.resolveSync('SYD')[0]?.place.iataCode ??
        provider.resolveSync('SYD')[0]?.place.canonicalName,
    ).toBeTruthy();
    expect(provider.resolveSync('CNS')[0]?.place.canonicalName).toMatch(/Cairns/i);
    expect(provider.resolveSync('OOL')[0]?.place.canonicalName).toMatch(/Gold Coast/i);
    expect(provider.resolveSync('Melbourne Airport')[0]?.place.type).toBe('airport');
    expect(provider.resolveSync('Kingsford Smith')[0]?.place.iataCode).toBe('SYD');
  });

  it('resolves Surfers Paradise and Docklands as accommodation areas', () => {
    const surfers = getDefaultLocationProvider().resolveSync('Surfers Paradise')[0]?.place;
    expect(surfers?.canonicalName).toBe('Surfers Paradise');

    const docklands = getDefaultLocationProvider().resolveSync('Docklands')[0]?.place;
    expect(docklands?.canonicalName).toBe('Docklands');
  });

  it('remote provider failure falls back to local without throwing', async () => {
    const remote = {
      id: 'remote-fail',
      resolve: vi.fn(async () => {
        throw new Error('network down');
      }),
    };
    const composite = new CompositeTravelLocationProvider(
      new LocalTravelLocationProvider(),
      remote as never,
    );
    setDefaultLocationProviderForTests(composite);
    await expect(composite.resolve('Hamilton Island')).resolves.toMatchObject([
      { place: { canonicalName: 'Hamilton Island' } },
    ]);
  });
});
