import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearConsultantTraces,
  getConsultantTraces,
  getSearchSession,
  isSearchActive,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';
import { NOW } from './helpers';

beforeEach(() => {
  resetTravelConversation();
  clearConsultantTraces();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  clearConsultantTraces();
  localStorage.clear();
});

describe('Exact live failure — multi-goal search', () => {
  it('does not invent services on route-only request, then adds hotel+car and searches same turn', () => {
    const first = sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });

    expect(first.state.origin?.value).toBe('Sydney');
    expect(first.state.destination?.value).toBe('Melbourne');
    expect(first.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-28',
    });
    expect(first.state.services).not.toContain('accommodation');
    expect(first.state.services).not.toContain('car_hire');
    expect(first.reply).not.toMatch(/accommodation|car hire|hire car/i);
    expect(first.reply).toMatch(/Sydney/i);
    expect(first.reply).toMatch(/Melbourne/i);
    expect(first.activateSearch).toBe(false);
    expect(first.trace?.inventedServicesOnTurn).toBe(false);

    const beforeServices = [...first.state.services];

    const second = sendTravelMessage({
      message: 'ill need hotel and car hire . yes begin your search',
      now: NOW,
    });

    expect(second.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(second.activateSearch).toBe(true);
    expect(second.searchSessionActive).toBe(true);
    expect(second.servicesToSearch).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(second.reply).toMatch(/added/i);
    expect(second.reply).toMatch(/accommodation|hotel/i);
    expect(second.reply).toMatch(/car hire/i);
    expect(second.reply).toMatch(/starting the search|searching|search now/i);
    expect(second.reply).not.toMatch(/whenever you.?re ready/i);
    expect(second.reply).not.toMatch(/Shall I start/i);
    expect(second.reply).not.toBe(first.reply);

    const goals = second.decision?.goals.map((g) => g.type) ?? [];
    expect(goals).toContain('add_service');
    expect(goals).toContain('start_search');
    expect(second.decision?.goals.filter((g) => g.type === 'add_service')).toEqual(
      expect.arrayContaining([
        { type: 'add_service', service: 'accommodation' },
        { type: 'add_service', service: 'car_hire' },
      ]),
    );

    expect(second.observation?.stateBefore.services).toEqual(beforeServices);
    expect(second.observation?.servicesAdded).toEqual(
      expect.arrayContaining(['accommodation', 'car_hire']),
    );
    expect(second.observation?.providerActions.some((a) => a.kind === 'start_search')).toBe(
      true,
    );
    expect(second.trace?.canonicalModifiedByValidatedActionsOnly).toBe(true);
    expect(second.trace?.inventedPricesAvailabilityOrBookings).toBe(false);
  });
});

describe('Additional required scenarios', () => {
  it('multiple actions: four nights, Docklands, start searching', () => {
    sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });
    const turn = sendTravelMessage({
      message: 'Make it four nights, stay around Docklands and start searching.',
      now: NOW,
    });
    expect(turn.state.durationNights?.value).toBe(4);
    expect(turn.state.accommodationArea?.value).toMatch(/Docklands/i);
    expect(turn.state.services).toContain('accommodation');
    expect(turn.activateSearch).toBe(true);
    expect(turn.reply).not.toMatch(/whenever you.?re ready/i);
  });

  it('change during active search: keep hotel, earlier flights', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne from Sydney on 28 August for three nights. I need flights, hotel and car hire.',
      now: NOW,
    });
    sendTravelMessage({ message: 'yes begin your search', now: NOW });
    expect(isSearchActive()).toBe(true);

    const refine = sendTravelMessage({
      message: 'Keep the hotel search but find me earlier flights.',
      now: NOW,
    });
    expect(refine.continueSearch).toBe(true);
    expect(refine.servicesToSearch).toContain('flights');
    expect(refine.reply).toMatch(/hotel|earlier|flights/i);
    expect(getSearchSession()?.filters.earlier).toBe('true');
  });

  it('question plus action: Docklands + hotels', () => {
    sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });
    const turn = sendTravelMessage({
      message: 'Is Docklands a good area? Also show me hotels there.',
      now: NOW,
    });
    expect(turn.decision?.goals.some((g) => g.type === 'answer_question')).toBe(true);
    expect(turn.state.accommodationArea?.value || turn.reply).toMatch(/Docklands/i);
    expect(turn.reply).toMatch(/Docklands|tram|CBD/i);
  });

  it('negative approval: add car hire without searching', () => {
    sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });
    const turn = sendTravelMessage({
      message: "I'm not ready to search yet, but add car hire.",
      now: NOW,
    });
    expect(turn.state.services).toContain('car_hire');
    expect(turn.activateSearch).toBe(false);
    expect(turn.reply).toMatch(/car hire/i);
    expect(turn.reply).not.toMatch(/starting the search/i);
  });

  it('new trip: Gold Coast for wife and me', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne from Sydney on 28 August. I need flights, hotel and car hire.',
      now: NOW,
    });
    sendTravelMessage({ message: 'yes begin your search', now: NOW });
    expect(isSearchActive()).toBe(true);

    const next = sendTravelMessage({
      message: "Forget Melbourne. Let's look at the Gold Coast for my wife and me.",
      now: NOW,
    });
    expect(isSearchActive()).toBe(false);
    expect(next.state.destination?.value).toBe('Gold Coast');
    expect(next.state.origin?.value).not.toBe('Sydney');
    expect(next.state.travellers?.value).toBe(2);
    expect(next.reply).toMatch(/Gold Coast/i);
    expect(next.reply).not.toMatch(/Melbourne/i);
  });
});

describe('traces', () => {
  it('records decision traces for the multi-goal turn', () => {
    sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });
    sendTravelMessage({
      message: 'ill need hotel and car hire . yes begin your search',
      now: NOW,
    });
    const traces = getConsultantTraces();
    expect(traces.length).toBeGreaterThanOrEqual(2);
    const last = traces.at(-1)!;
    expect(last.goals.some((g) => g.type === 'start_search')).toBe(true);
    expect(last.goals.filter((g) => g.type === 'add_service').length).toBeGreaterThanOrEqual(2);
    expect(last.providerActions.some((a) => a.kind === 'start_search')).toBe(true);
  });
});
