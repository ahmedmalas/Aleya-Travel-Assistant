import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLocationCache,
  extractLocationSpans,
  getDefaultLocationProvider,
  resolveLocationsForMessageSync,
  setDefaultLocationProviderForTests,
  CompositeTravelLocationProvider,
  LocalTravelLocationProvider,
} from '../index';
import {
  projectSearchForm,
  resetConversationRuntime,
  sendTravelMessage,
  STORAGE_KEY,
} from '../../travel-conversation';
import { createEmptyConversationState } from '../../travel-conversation/types';
import { migrateConversationStateFromV5 } from '../../travel-conversation/store';

const NOW = new Date('2026-07-01T00:00:00.000Z');

describe('travel-location-intelligence', () => {
  beforeEach(() => {
    clearLocationCache();
    resetConversationRuntime();
    setDefaultLocationProviderForTests(null);
    localStorage.clear();
  });

  it.each([
    'I want to go Hamilton Island',
    'I want to go to Hamilton Island',
    'I want to visit Hamilton Island',
    'Hamilton Island please',
    'HTI',
  ])('exact recognition: %s', (message) => {
    const turn = sendTravelMessage({ message, now: NOW });
    expect(turn.state.destination?.value).toBe('Hamilton Island');
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

  it('extracts destination replacement spans', () => {
    const spans = extractLocationSpans('change the destination to Cairns');
    expect(spans[0]?.roleHint).toBe('destination');
    expect(spans[0]?.operation).toBe('replace_destination');
    expect(spans[0]?.raw.toLowerCase()).toContain('cairns');
  });

  it('detects ambiguity for bare Hamilton / Springfield / Richmond', () => {
    for (const message of ['Hamilton', 'Springfield', 'Richmond']) {
      const pass = resolveLocationsForMessageSync({ message });
      expect(pass.ambiguity, message).toBeTruthy();
      expect(pass.ambiguity!.options.length).toBeGreaterThanOrEqual(2);
      expect(pass.candidates.length).toBe(0);
    }
  });

  it('does not resolve ordinary non-place phrases', () => {
    for (const q of ['all good', 'hotel', 'return', "I'm ready", 'something cheap', 'change it']) {
      expect(getDefaultLocationProvider().resolveSync(q)).toEqual([]);
      expect(resolveLocationsForMessageSync({ message: q }).candidates).toEqual([]);
    }
  });

  it('resolves airport codes and named airports', () => {
    const provider = getDefaultLocationProvider();
    expect(provider.resolveSync('SYD')[0]?.place.iataCode ?? provider.resolveSync('SYD')[0]?.place.canonicalName).toBeTruthy();
    expect(provider.resolveSync('CNS')[0]?.place.canonicalName).toMatch(/Cairns/i);
    expect(provider.resolveSync('OOL')[0]?.place.canonicalName).toMatch(/Gold Coast/i);
    expect(provider.resolveSync('Melbourne Airport')[0]?.place.type).toBe('airport');
    expect(provider.resolveSync('Kingsford Smith')[0]?.place.iataCode).toBe('SYD');
  });

  it('keeps hierarchy distinct for Surfers Paradise and Docklands', () => {
    const surfers = resolveLocationsForMessageSync({
      message: 'stay in Surfers Paradise',
    });
    expect(surfers.selectedPlaces.accommodation?.canonicalName).toBe('Surfers Paradise');
    expect(surfers.selectedPlaces.destination?.canonicalName).toBe('Gold Coast');

    const docklands = resolveLocationsForMessageSync({
      message: 'hotel in Docklands',
    });
    expect(docklands.selectedPlaces.accommodation?.canonicalName).toBe('Docklands');
    expect(docklands.selectedPlaces.destination?.canonicalName).toBe('Melbourne');
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
    const before = createEmptyConversationState();
    before.destination = { value: 'Brisbane', source: 'explicit', confirmed: true };
    setDefaultLocationProviderForTests(null);
    const turn = sendTravelMessage({
      message: 'I want to go to Hamilton Island',
      now: NOW,
    });
    expect(turn.state.destination?.value).toBe('Hamilton Island');
  });
});

describe('conversation location integration', () => {
  beforeEach(() => {
    clearLocationCache();
    resetConversationRuntime();
    setDefaultLocationProviderForTests(null);
    localStorage.clear();
  });

  it('captures Hamilton Island and progresses awaiting fields', () => {
    const dest = sendTravelMessage({
      message: 'I want to go to Hamilton Island',
      now: NOW,
    });
    expect(dest.state.destination?.value).toBe('Hamilton Island');
    expect(dest.progression.nextRequiredField?.id).toBe('origin');
    expect(dest.reply).toMatch(/travelling from/i);
    expect(dest.reply).not.toMatch(/Thanks — what else should I know/i);
    expect(dest.reply).not.toMatch(/Got it — what would you like to do next/i);

    const origin = sendTravelMessage({ message: 'Sydney', now: NOW });
    expect(origin.state.origin?.value).toBe('Sydney');
    expect(origin.state.destination?.value).toBe('Hamilton Island');
    expect(origin.progression.nextRequiredField?.id).toBe('departureDate');
    expect(origin.reply).toMatch(/Which date/i);
  });

  it.each([
    'change it to Cairns',
    'change the destination to Cairns',
    'change it the destination to Cairns',
    'chnage it to cairns',
    'actually Cairns',
    'not Brisbane anymore, Cairns',
  ])('destination replacement: %s', (message) => {
    sendTravelMessage({ message: 'I want to go to Brisbane', now: NOW });
    sendTravelMessage({ message: 'Sydney', now: NOW });
    const replaced = sendTravelMessage({ message, now: NOW });
    expect(replaced.state.origin?.value).toBe('Sydney');
    expect(replaced.state.destination?.value).toBe('Cairns');
  });

  it('services before completion do not corrupt destination', () => {
    sendTravelMessage({ message: 'I want to go to Cairns', now: NOW });
    sendTravelMessage({ message: 'Sydney', now: NOW });
    const hotel = sendTravelMessage({ message: 'hotel', now: NOW });
    expect(hotel.state.destination?.value).toBe('Cairns');
    expect(hotel.state.origin?.value).toBe('Sydney');
    expect(hotel.state.services).toContain('accommodation');
    const flights = sendTravelMessage({ message: 'book flights', now: NOW });
    expect(flights.state.destination?.value).toBe('Cairns');
    expect(flights.state.services).toContain('flights');
    const car = sendTravelMessage({ message: 'car hire', now: NOW });
    expect(car.state.origin?.value).toBe('Sydney');
    expect(car.state.services).toContain('car_hire');
    const activities = sendTravelMessage({ message: 'I need activities', now: NOW });
    expect(activities.state.destination?.value).toBe('Cairns');
    expect(activities.state.services).toContain('activities');
    expect(activities.reply).not.toMatch(/Thanks — what else should I know/i);
  });

  it('publishes ambiguity options for Hamilton and resolves the first one', () => {
    const first = sendTravelMessage({ message: 'I want to go to Hamilton', now: NOW });
    expect(first.runtimeEvidence.locationAmbiguityDetected).toBe(true);
    expect(first.reply.toLowerCase()).toContain('hamilton');
    expect(first.state.destination).toBeUndefined();

    const second = sendTravelMessage({ message: 'the first one', now: NOW });
    expect(second.state.destination?.value).toBeTruthy();
  });

  it('airport route SYD to HTI projects structured search codes', () => {
    const turn = sendTravelMessage({ message: 'SYD to HTI', now: NOW });
    expect(turn.state.origin?.value).toBe('Sydney');
    expect(turn.state.destination?.value).toBe('Hamilton Island');
    const form = projectSearchForm(turn.state);
    expect(form.originCode).toBe('SYD');
    expect(form.destinationCode).toBe('HTI');
  });

  it('migrates schema v5 string destinations into structured places', () => {
    const v5 = createEmptyConversationState();
    v5.schemaVersion = 5 as never;
    v5.destination = { value: 'Cairns', source: 'explicit', confirmed: true };
    v5.origin = { value: 'Sydney', source: 'explicit', confirmed: true };
    const migrated = migrateConversationStateFromV5(v5);
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.destinationPlace?.canonicalName).toBe('Cairns');
    expect(migrated.destinationPlace?.iataCode).toBe('CNS');
    expect(migrated.originPlace?.iataCode).toBe('SYD');
    expect(STORAGE_KEY).toContain('v7');
  });
});
