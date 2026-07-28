import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildProviderSearches,
  createEmptyConversationState,
  getLiveSearchActivationCount,
  projectCanonicalSearch,
  projectSearchForm,
  projectSearchRequest,
  resetLiveSearchActivationTracking,
  resetTravelConversation,
  runLiveSearchFromState,
  type ConversationState,
} from '../index';

function field<T>(value: T) {
  return { value, source: 'explicit' as const, confirmed: true };
}

function sydMelState(overrides?: Partial<ConversationState>): ConversationState {
  const state = createEmptyConversationState('proj-syd-mel');
  state.origin = field('Sydney');
  state.destination = field('Melbourne');
  state.departureDate = field({
    kind: 'exact' as const,
    isoDate: '2026-08-28',
    label: '28/08/2026',
    day: 28,
    month: 8,
    year: 2026,
  });
  state.returnDate = field({
    isoDate: '2026-08-31',
    label: '31/08/2026',
  });
  state.services = ['flights', 'accommodation', 'car_hire'];
  return { ...state, ...overrides };
}

function melSydState(): ConversationState {
  const state = sydMelState();
  state.origin = field('Melbourne');
  state.destination = field('Sydney');
  return state;
}

beforeEach(() => {
  resetTravelConversation();
  resetLiveSearchActivationTracking();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  resetLiveSearchActivationTracking();
  localStorage.clear();
});

describe('canonical search projection — direction', () => {
  it('1. Sydney → Melbourne projects as SYD → MEL', () => {
    const p = projectCanonicalSearch(sydMelState());
    expect(p.origin.airportCode).toBe('SYD');
    expect(p.destination.airportCode).toBe('MEL');
    expect(p.origin.label).toBe('Sydney');
    expect(p.destination.label).toBe('Melbourne');
    expect(projectSearchRequest(sydMelState())).toMatchObject({
      origin: 'SYD',
      destination: 'MEL',
    });
  });

  it('2. Melbourne → Sydney projects as MEL → SYD', () => {
    const p = projectCanonicalSearch(melSydState());
    expect(p.origin.airportCode).toBe('MEL');
    expect(p.destination.airportCode).toBe('SYD');
  });

  it('3. direction never reverses across form and request views', () => {
    const state = sydMelState();
    const form = projectSearchForm(state);
    const request = projectSearchRequest(state);
    const canonical = projectCanonicalSearch(state);

    expect(form.originCode).toBe('SYD');
    expect(form.destinationCode).toBe('MEL');
    expect(request.origin).toBe('SYD');
    expect(request.destination).toBe('MEL');
    expect(canonical.origin.airportCode).toBe(form.originCode);
    expect(canonical.destination.airportCode).toBe(form.destinationCode);

    // Swapped canonical fields must project swapped — never auto-correct/swap back.
    const swapped = projectCanonicalSearch(melSydState());
    expect(swapped.origin.airportCode).toBe('MEL');
    expect(swapped.destination.airportCode).toBe('SYD');
    expect(swapped.origin.airportCode).not.toBe(canonical.origin.airportCode);
  });
});

describe('canonical search projection — travellers', () => {
  it('4. missing traveller count is not converted to 2 adults', () => {
    const state = sydMelState();
    expect(state.travellers).toBeUndefined();
    const p = projectCanonicalSearch(state);
    expect(p.adults).toBe(1);
    expect(p.travellerSource).toBe('product_default');
    expect(p.adults).not.toBe(2);

    const form = projectSearchForm(state);
    expect(form.adults).toBe(1);
    expect(form.travellerSource).toBe('product_default');
  });

  it('uses explicit traveller count when stored (including 2)', () => {
    const state = sydMelState({ travellers: field(2) });
    const p = projectCanonicalSearch(state);
    expect(p.adults).toBe(2);
    expect(p.travellerSource).toBe('explicit');
  });

  it('uses explicit 3 adults when stored', () => {
    const state = sydMelState({ travellers: field(3) });
    expect(projectCanonicalSearch(state)).toMatchObject({
      adults: 3,
      travellerSource: 'explicit',
    });
  });
});

describe('canonical search projection — dates', () => {
  it('5. dates remain 28/08/2026 → 31/08/2026', () => {
    const p = projectCanonicalSearch(sydMelState());
    expect(p.departureDate).toBe('2026-08-28');
    expect(p.returnDate).toBe('2026-08-31');
    expect(projectSearchForm(sydMelState())).toMatchObject({
      departDate: '2026-08-28',
      returnDate: '2026-08-31',
    });
  });
});

describe('canonical search projection — multi-service handoff', () => {
  it('6. flights, accommodation and car hire receive the same canonical destination and dates', () => {
    const state = sydMelState({
      accommodationArea: field('Southbank'),
    });
    const projection = projectCanonicalSearch(state);
    const handoff = buildProviderSearches(projection, projection.services, {
      accommodationQuery: state.accommodationArea?.value,
    });

    expect(handoff.searches).toHaveLength(3);
    const flights = handoff.searches.find((s) => s.service === 'flights')!;
    const hotels = handoff.searches.find((s) => s.service === 'accommodation')!;
    const cars = handoff.searches.find((s) => s.service === 'car_hire')!;

    expect(flights.originCode).toBe('SYD');
    expect(flights.destinationCode).toBe('MEL');
    expect(flights.departDate).toBe('2026-08-28');
    expect(flights.returnDate).toBe('2026-08-31');
    expect(flights.url).toContain('/flights/syd/mel/260828/260831/');
    expect(flights.url).toContain('adultsv2=1');

    expect(hotels.destinationCode).toBe('MEL');
    expect(hotels.destinationLabel).toBe('Melbourne');
    expect(hotels.departDate).toBe('2026-08-28');
    expect(hotels.returnDate).toBe('2026-08-31');
    expect(hotels.url).toContain('checkin=2026-08-28');
    expect(hotels.url).toContain('checkout=2026-08-31');
    expect(hotels.url).toContain('group_adults=1');

    expect(cars.destinationCode).toBe('MEL');
    expect(cars.departDate).toBe('2026-08-28');
    expect(cars.returnDate).toBe('2026-08-31');
    expect(cars.url).toContain('/cars/mel/mel/260828/260831');
    expect(cars.url).toContain('adults=1');
  });
});

describe('canonical search projection — activation', () => {
  it('7. search activation occurs once per approval handoff', () => {
    const state = sydMelState();
    expect(getLiveSearchActivationCount()).toBe(0);

    const first = runLiveSearchFromState(state, state.services, {
      openWindows: false,
    });
    expect(first.activationId).toBe(1);
    expect(getLiveSearchActivationCount()).toBe(1);
    expect(first.opened).toEqual([]);
    expect(first.launchResults.map((r) => r.service)).toEqual([
      'flights',
      'accommodation',
      'car_hire',
    ]);
    expect(
      first.launchResults.every((r) => r.status === 'ready_for_user'),
    ).toBe(true);
    expect(first.projection.origin.airportCode).toBe('SYD');
    expect(first.projection.destination.airportCode).toBe('MEL');

    // A second deliberate activation is a new id — still one projection payload each time.
    const second = runLiveSearchFromState(state, ['flights'], { openWindows: false });
    expect(second.activationId).toBe(2);
    expect(getLiveSearchActivationCount()).toBe(2);
    expect(second.opened).toEqual([]);
    expect(second.launchResults.map((r) => r.service)).toEqual(['flights']);
  });

  it('8. no manual re-entry is required — provider URLs are fully populated from state', () => {
    const state = sydMelState();
    const result = runLiveSearchFromState(state, state.services, {
      openWindows: false,
    });
    expect(result.unavailable).toEqual([]);
    for (const search of result.providerSearches) {
      expect(search.url.length).toBeGreaterThan(20);
      expect(search.departDate).toBe('2026-08-28');
      expect(search.returnDate).toBe('2026-08-31');
      expect(search.adults).toBe(1);
      expect(search.travellerSource).toBe('product_default');
    }
    const flight = result.providerSearches.find((s) => s.service === 'flights')!;
    expect(flight.url).toMatch(/\/flights\/syd\/mel\//);
    expect(flight.url).not.toMatch(/\/flights\/mel\/syd\//);
  });
});
