import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearConversationTraces,
  getConversationTraces,
  getSearchSession,
  isSearchActive,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';
import { NOW } from './helpers';

beforeEach(() => {
  resetTravelConversation();
  clearConversationTraces();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  clearConversationTraces();
  localStorage.clear();
});

describe('Immediate live failure — destination then services', () => {
  it('asks origin after Melbourne, then keeps asking origin after services', () => {
    const first = sendTravelMessage({ message: 'i need to go melbourne', now: NOW });

    expect(first.state.destination?.value).toBe('Melbourne');
    expect(first.state.origin).toBeUndefined();
    expect(first.state.departureDate).toBeUndefined();
    expect(first.state.services).toEqual([]);
    expect(first.progression.nextRequiredField?.id).toBe('origin');
    expect(first.reply).toMatch(/Where will you be travelling from\?/i);
    expect(first.reply).not.toMatch(/what else should i know|anything else|tell me more/i);

    const trace1 = first.progression.trace;
    expect(trace1.knownFacts.destination).toBe('Melbourne');
    expect(trace1.missingRequirements).toEqual(
      expect.arrayContaining(['origin', 'departureDate']),
    );
    expect(trace1.nextRequiredField).toBe('origin');

    const second = sendTravelMessage({
      message: 'i need hotel car hire and flights',
      now: NOW,
    });

    expect(second.state.destination?.value).toBe('Melbourne');
    expect(second.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(second.state.origin).toBeUndefined();
    expect(second.state.departureDate).toBeUndefined();
    expect(second.progression.nextRequiredField?.id).toBe('origin');
    expect(second.reply).toMatch(/flights|accommodation|car hire/i);
    expect(second.reply).toMatch(/Where will you be travelling from\?/i);
    expect(second.reply).not.toMatch(/what else should i know|anything else|tell me more/i);
    expect(second.activateSearch).toBe(false);

    const trace2 = second.progression.trace;
    expect(trace2.stateAfter.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(trace2.nextRequiredField).toBe('origin');
    expect(trace2.executedResults.some((r) => r.type === 'add_services')).toBe(true);
  });
});

describe('Progression first-field scenarios', () => {
  it('origin-first asks destination', () => {
    const turn = sendTravelMessage({ message: "I'm leaving from Sydney.", now: NOW });
    expect(turn.state.origin?.value).toBe('Sydney');
    expect(turn.progression.nextRequiredField?.id).toBe('destination');
    expect(turn.reply).toMatch(/Where would you like to travel\?/i);
  });

  it('date-first asks destination or origin from completeness', () => {
    const turn = sendTravelMessage({ message: '28 August.', now: NOW });
    expect(turn.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-28',
    });
    expect(turn.progression.nextRequiredField?.id).toBe('destination');
    expect(turn.reply).toMatch(/Where would you like to travel\?/i);
  });

  it('services-first asks highest missing trip requirement', () => {
    const turn = sendTravelMessage({
      message: 'I need flights and a hotel.',
      now: NOW,
    });
    expect(turn.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation']),
    );
    expect(turn.progression.nextRequiredField?.id).toBe('destination');
    expect(turn.reply).toMatch(/Where would you like to travel\?/i);
    expect(turn.reply).not.toMatch(/what else should i know/i);
  });

  it('complete route asks departure date', () => {
    const turn = sendTravelMessage({ message: 'Sydney to Melbourne.', now: NOW });
    expect(turn.state.origin?.value).toBe('Sydney');
    expect(turn.state.destination?.value).toBe('Melbourne');
    expect(turn.progression.nextRequiredField?.id).toBe('departureDate');
    expect(turn.reply).toMatch(/Which date would you like to travel\?/i);
  });

  it('route and date asks trip type and never invents hotel/car', () => {
    const turn = sendTravelMessage({
      message: 'Sydney to Melbourne on 28 August.',
      now: NOW,
    });
    expect(turn.state.services).not.toContain('accommodation');
    expect(turn.state.services).not.toContain('car_hire');
    expect(turn.reply).not.toMatch(/accommodation|car hire|hotel/i);
    expect(turn.progression.nextRequiredField?.id).toBe('tripType');
    expect(turn.reply).toMatch(/one-way|returning/i);
  });
});

describe('Multi-goal search authorisation', () => {
  it('adds hotel+car and starts search in one turn when ready', () => {
    const first = sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });
    expect(first.state.services).not.toContain('accommodation');
    expect(first.activateSearch).toBe(false);

    // Answer trip type so search can start
    sendTravelMessage({ message: 'one-way', now: NOW });

    const second = sendTravelMessage({
      message: 'ill need hotel and car hire . yes begin your search',
      now: NOW,
    });

    expect(second.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(second.activateSearch).toBe(true);
    expect(second.searchSessionActive).toBe(true);
    expect(second.reply).toMatch(/added/i);
    expect(second.reply).toMatch(/ready|opened/i);
    expect(second.reply).not.toMatch(/I’m searching flights, accommodation, and car hire now/i);
    expect(second.reply).not.toMatch(/whenever you.?re ready/i);
    expect(second.progression.trace.executedResults.some((r) => r.type === 'start_search' && r.ok)).toBe(
      true,
    );
    expect(second.runtimeEvidence.readyForUserServices.length + second.runtimeEvidence.openedServices.length).toBeGreaterThan(0);
    expect(second.progression.provider.launchResults?.length).toBe(3);
  });

  it('acceptance after offer starts search without asking again', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne from Sydney on 28 August one-way. I need flights.',
      now: NOW,
    });
    const offered = sendTravelMessage({
      message: 'flights only please',
      now: NOW,
    });
    // Ensure ready path offered search or we authorise directly
    void offered;
    const accept = sendTravelMessage({ message: 'yes begin your search', now: NOW });
    expect(accept.activateSearch).toBe(true);
    expect(accept.reply).not.toMatch(/whenever you.?re ready/i);
    expect(isSearchActive()).toBe(true);
  });
});

describe('Active search refine + Q+A', () => {
  it('keep hotel, earlier flights', () => {
    sendTravelMessage({
      message:
        'I want to go to Melbourne from Sydney on 28 August one-way. I need flights, hotel and car hire.',
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

  it('Docklands question plus hotels', () => {
    sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });
    const turn = sendTravelMessage({
      message: 'Is Docklands a good area? Also show me hotels there.',
      now: NOW,
    });
    expect(turn.progression.goals.some((g) => g.kind === 'answer_area_question')).toBe(true);
    expect(turn.state.accommodationArea?.value || turn.reply).toMatch(/Docklands/i);
    expect(turn.reply).toMatch(/Docklands|tram|CBD/i);
  });
});

describe('New trip', () => {
  it('Forget Melbourne → Gold Coast for wife and me', () => {
    sendTravelMessage({
      message: 'i want to go melbourne from sydney on the 28th of august',
      now: NOW,
    });
    const turn = sendTravelMessage({
      message: "Forget Melbourne. Let's go to the Gold Coast instead for my wife and me.",
      now: NOW,
    });
    expect(turn.state.destination?.value).toMatch(/Gold Coast/i);
    expect(turn.state.origin?.value).not.toBe('Sydney'); // cleared with new trip unless re-stated
    expect(turn.state.travellers?.value).toBe(2);
    expect(turn.reply).toMatch(/Gold Coast|travelling from|Where/i);
  });
});

describe('No consultant / clarify leftovers', () => {
  it('turn result has progression, not clarification/consultant', () => {
    const turn = sendTravelMessage({ message: 'i need to go melbourne', now: NOW });
    expect(turn.progression).toBeDefined();
    expect(turn.progression.nextRequiredField?.id).toBe('origin');
    expect('clarification' in turn).toBe(false);
    expect('decision' in turn).toBe(false);
    expect(getConversationTraces().length).toBeGreaterThan(0);
  });
});
