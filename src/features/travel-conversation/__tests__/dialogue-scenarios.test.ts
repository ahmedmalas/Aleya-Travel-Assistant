import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertHumanReply,
  clearDialogueTraces,
  getDialogueTraces,
  getSearchMemory,
  isSearchActive,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';
import { NOW } from './helpers';

const FORBIDDEN =
  /Understood — I’ve saved|We’re in planning|What would you like next\?|Ask for a summary or say go ahead|I’ve still got your trip details|Tell me what to adjust|Shall I start the live search\?/i;

beforeEach(() => {
  resetTravelConversation();
  clearDialogueTraces();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  clearDialogueTraces();
  localStorage.clear();
});

function expectHuman(reply: string) {
  expect(reply).not.toMatch(FORBIDDEN);
  expect(reply).not.toMatch(/\bphase\b|\bschema\b|\bintent\b/i);
  assertHumanReply(reply);
}

describe('Scenario 1 — Complete trip and natural search', () => {
  it('asks origin, confirms, then searches on yes please', () => {
    const first = sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights. I need flights, accommodation and a hire car.',
      now: NOW,
    });
    expect(first.state.destination?.value).toBe('Melbourne');
    expect(first.state.origin).toBeUndefined();
    expect(first.reply).toMatch(/travelling from|flying from|departure city/i);
    expectHuman(first.reply);
    expect(first.reply).not.toMatch(/I’ve got destination Melbourne/i);

    const second = sendTravelMessage({ message: 'Sydney.', now: NOW });
    expect(second.state.origin?.value).toBe('Sydney');
    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.activateSearch).toBe(false);
    expect(second.reply).toMatch(/Sydney/i);
    expect(second.reply).toMatch(/Melbourne/i);
    expect(second.reply).toMatch(/ready|looking|Shall I start looking|whenever you’re ready/i);
    expectHuman(second.reply);
    expect(second.state.lastOffer?.kind).toBe('start_search');

    const third = sendTravelMessage({ message: 'Yes please.', now: NOW });
    expect(third.activateSearch).toBe(true);
    expect(third.searchSessionActive).toBe(true);
    expect(third.reply).toMatch(/looking|Searching|pulling live options/i);
    expect(third.reply).not.toMatch(/Shall I start the live search/i);
    expectHuman(third.reply);
    expect(third.trace?.inventedPricesAvailabilityOrBookings).toBe(false);
    expect(third.trace?.canonicalModifiedByValidatedActionsOnly).toBe(true);
  });
});

describe('Scenario 2 — Hotel refinement', () => {
  it('refines Docklands then luxury/value without restart questions', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.',
      now: NOW,
    });
    sendTravelMessage({ message: 'Yes please.', now: NOW });
    expect(isSearchActive()).toBe(true);

    const hotels = sendTravelMessage({
      message: 'Find me hotels around Docklands.',
      now: NOW,
    });
    expect(hotels.activateSearch).toBe(false);
    expect(hotels.continueSearch).toBe(true);
    expect(hotels.servicesToSearch).toContain('accommodation');
    expect(hotels.reply).toMatch(/Docklands/i);
    expect(hotels.reply).toMatch(/flights|car hire|unchanged|leaving/i);
    expect(hotels.reply).not.toMatch(/Shall I start the live search/i);
    expectHuman(hotels.reply);

    const luxury = sendTravelMessage({
      message: 'Something luxurious but still good value.',
      now: NOW,
    });
    expect(luxury.activateSearch).toBe(false);
    expect(luxury.continueSearch).toBe(true);
    expect(luxury.reply).toMatch(/value|four|five|luxur/i);
    expect(luxury.reply).not.toMatch(/Origin:|Departing:/i);
    expectHuman(luxury.reply);
    expect(getSearchMemory()?.filters.accommodation?.style).toMatch(/value|luxury/);
  });
});

describe('Scenario 3 — Result reference', () => {
  it('resolves second hotel and refines flights only', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.',
      now: NOW,
    });
    sendTravelMessage({ message: 'Yes please.', now: NOW });
    sendTravelMessage({ message: 'Find me hotels around Docklands.', now: NOW });

    const ref = sendTravelMessage({
      message: 'I like the second hotel. Are there better flights that arrive earlier?',
      now: NOW,
    });
    expect(ref.decision?.resultReferences.some((r) => r.ordinal === 2)).toBe(true);
    expect(ref.continueSearch).toBe(true);
    expect(ref.servicesToSearch).toContain('flights');
    expect(ref.reply).toMatch(/hotel|earlier|flights/i);
    expectHuman(ref.reply);
    expect(getSearchMemory()?.selected?.service).toBe('accommodation');
  });
});

describe('Scenario 4 — Requirement change', () => {
  it('updates dates and refreshes without full state speech', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.',
      now: NOW,
    });
    sendTravelMessage({ message: 'Yes please.', now: NOW });

    const changed = sendTravelMessage({
      message: 'Actually make it four nights and return Tuesday afternoon.',
      now: NOW,
    });
    expect(changed.state.durationNights?.value === 4 || changed.continueSearch).toBeTruthy();
    expect(changed.reply).not.toMatch(/Here’s what I’ve got for your trip/i);
    expect(changed.reply).not.toMatch(FORBIDDEN);
    expectHuman(changed.reply);
  });
});

describe('Scenario 5 — General travel question', () => {
  it('answers conversationally without forced search', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.',
      now: NOW,
    });
    const q = sendTravelMessage({
      message: 'Is Docklands convenient without a car?',
      now: NOW,
    });
    expect(q.activateSearch).toBe(false);
    expect(q.continueSearch).toBe(false);
    expect(q.reply).toMatch(/Docklands|tram|car/i);
    expect(q.reply).not.toMatch(/I’ve saved|Shall I start/i);
    expectHuman(q.reply);
    expect(q.decision?.userGoals).toContain('general_travel_question');
  });
});

describe('Scenario 6 — New trip', () => {
  it('ends session and does not carry Melbourne into Gold Coast', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.',
      now: NOW,
    });
    sendTravelMessage({ message: 'Yes please.', now: NOW });
    expect(isSearchActive()).toBe(true);

    const next = sendTravelMessage({
      message: 'Now let’s plan the Gold Coast for my wife and me.',
      now: NOW,
    });
    expect(isSearchActive()).toBe(false);
    expect(next.state.destination?.value).toBe('Gold Coast');
    expect(next.state.origin?.value).not.toBe('Sydney');
    expect(next.state.travellers?.value).toBe(2);
    expect(next.reply).toMatch(/Gold Coast/i);
    expect(next.reply).not.toMatch(/Melbourne/i);
    expectHuman(next.reply);
  });
});

describe('Scenario 7 — Misspellings and natural speech', () => {
  it('understands accommodation near Docklands with value intent', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.',
      now: NOW,
    });
    sendTravelMessage({ message: 'Yes please.', now: NOW });

    const messy = sendTravelMessage({
      message: 'i need accomodation neer docklands somthing nice but not too exspensive',
      now: NOW,
    });
    expect(messy.continueSearch).toBe(true);
    expect(messy.state.accommodationArea?.value || getSearchMemory()?.filters.accommodation?.area).toMatch(
      /Docklands/i,
    );
    expect(messy.reply).toMatch(/Docklands|value|nice|accommodation|hotel/i);
    expectHuman(messy.reply);
  });
});

describe('anti-robot and traces', () => {
  it('records decision traces with goals, context, actions, response plan', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights and a hotel.',
      now: NOW,
    });
    const search = sendTravelMessage({ message: 'go ahead', now: NOW });
    const traces = getDialogueTraces();
    expect(traces.length).toBeGreaterThan(0);
    const last = traces.at(-1)!;
    expect(last.userGoals.length).toBeGreaterThan(0);
    expect(last.contextUsed.currentAim).toBeTruthy();
    expect(last.responsePlan.purpose).toBeTruthy();
    expect(last.inventedPricesAvailabilityOrBookings).toBe(false);
    expect(search.activateSearch || search.continueSearch || search.reply).toBeTruthy();
  });
});
