import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { processTravelTurn, resetTravelConversation, sendTravelMessage } from '../index';
import { createEmptyConversationState } from '../types';
import { NOW } from './helpers';

beforeEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

const COMPLETE =
  'I want to go to Gold Coast on the 28th of August departing from Melbourne and staying at Surfers Paradise for 3 nights returning Monday. I need flights and car hire.';

describe('accommodation implication', () => {
  it('adds accommodation when an area is captured without saying accommodation', () => {
    const result = sendTravelMessage({ message: COMPLETE, now: NOW });
    expect(result.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(result.state.services).toContain('accommodation');
    expect(result.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
  });

  it('does not re-add accommodation after explicit removal while area remains', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const removed = sendTravelMessage({ message: 'Forget the hotel', now: NOW });
    expect(removed.state.services).not.toContain('accommodation');
    expect(removed.state.excludedServices).toContain('accommodation');
    expect(removed.state.accommodationArea?.value).toBe('Surfers Paradise');
  });

  it('re-engages accommodation when a new stay area is captured after removal', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    sendTravelMessage({ message: 'Forget the hotel', now: NOW });
    const again = sendTravelMessage({
      message: 'I will stay in Docklands',
      now: NOW,
    });
    expect(again.state.accommodationArea?.value).toBe('Docklands');
    expect(again.state.services).toContain('accommodation');
    expect(again.state.excludedServices).not.toContain('accommodation');
  });
});

describe('summary intent', () => {
  it.each([
    'Show me what you got',
    'Show me the trip',
    'Show me everything',
    "Let's review it",
    'What have you got',
    'Give me a summary',
  ])('reviews collected trip for: %s', (message) => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const review = sendTravelMessage({ message, now: NOW });
    expect(review.reply).toMatch(/Here’s what I’ve got for your trip/i);
    expect(review.reply).toMatch(/Surfers Paradise/i);
    expect(review.reply).not.toMatch(/I’ve saved/i);
    expect(review.reply).not.toMatch(/We’re in planning/i);
  });
});

describe('soft affirm readiness', () => {
  it.each([
    "That's all",
    'Looks good',
    'Go ahead',
    'Continue',
    'Proceed',
    'Perfect',
    "That's correct",
  ])('marks requirements ready for: %s', (message) => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({ message, now: NOW });
    expect(next.state.phase).toBe('ready');
    expect(next.reply).toMatch(/requirements look complete/i);
    expect(next.reply).not.toMatch(/We’re in planning/i);
    expect(next.reply).not.toMatch(/I’ve saved/i);
  });

  it.each([
    "That's all for now, you can go ahead",
    "That's all, go ahead",
    'Looks good, you can proceed',
    "That's correct, continue",
    'Perfect, proceed',
    'Everything looks good, you can proceed',
    'That will do, you can continue',
    'Looks good, go ahead',
  ])('accepts combined soft-affirm phrases: %s', (message) => {
    const before = sendTravelMessage({ message: COMPLETE, now: NOW });
    expect(before.state.phase).toBe('ready');
    const snapshot = {
      origin: before.state.origin?.value,
      destination: before.state.destination?.value,
      departure: before.state.departureDate?.value,
      returnIso: before.state.returnDate?.value.isoDate,
      area: before.state.accommodationArea?.value,
      services: [...before.state.services],
      nights: before.state.durationNights?.value,
    };

    const next = sendTravelMessage({ message, now: NOW });
    expect(next.state.phase).toBe('ready');
    expect(next.reply).toMatch(/requirements look complete/i);
    expect(next.reply).not.toMatch(/We’re in planning/i);
    expect(next.state.origin?.value).toBe(snapshot.origin);
    expect(next.state.destination?.value).toBe(snapshot.destination);
    expect(next.state.departureDate?.value).toEqual(snapshot.departure);
    expect(next.state.returnDate?.value.isoDate).toBe(snapshot.returnIso);
    expect(next.state.accommodationArea?.value).toBe(snapshot.area);
    expect(next.state.services).toEqual(snapshot.services);
    expect(next.state.durationNights?.value).toBe(snapshot.nights);
    expect(next.state.lastChangedFields).toEqual([]);
  });
});

describe('final confirmation intent', () => {
  function enterReady() {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    return sendTravelMessage({ message: 'go ahead', now: NOW });
  }

  it('all confirmed moves ready → locked without mutating trip state', () => {
    const ready = enterReady();
    expect(ready.state.phase).toBe('ready');
    const snapshot = {
      origin: ready.state.origin?.value,
      destination: ready.state.destination?.value,
      departure: ready.state.departureDate?.value,
      returnIso: ready.state.returnDate?.value.isoDate,
      area: ready.state.accommodationArea?.value,
      services: [...ready.state.services],
      nights: ready.state.durationNights?.value,
    };

    const locked = sendTravelMessage({ message: 'all confirmed', now: NOW });
    expect(locked.state.phase).toBe('locked');
    expect(locked.reply).toBe(
      'All confirmed. Your travel requirements are locked in and ready for search.',
    );
    expect(locked.reply).not.toMatch(/We’re in planning/i);
    expect(locked.reply).not.toMatch(/I’ve saved/i);
    expect(locked.state.origin?.value).toBe(snapshot.origin);
    expect(locked.state.destination?.value).toBe(snapshot.destination);
    expect(locked.state.departureDate?.value).toEqual(snapshot.departure);
    expect(locked.state.returnDate?.value.isoDate).toBe(snapshot.returnIso);
    expect(locked.state.accommodationArea?.value).toBe(snapshot.area);
    expect(locked.state.services).toEqual(snapshot.services);
    expect(locked.state.durationNights?.value).toBe(snapshot.nights);
    expect(locked.state.lastChangedFields).toEqual([]);
  });

  it.each([
    'confirmed',
    'everything is confirmed',
    "everything’s confirmed",
    'all good and confirmed',
    'yes, all confirmed',
    "that’s all confirmed",
    'finalise it',
    'finalize it',
    'lock it in',
  ])('final confirmation phrase works: %s', (message) => {
    enterReady();
    const locked = sendTravelMessage({ message, now: NOW });
    expect(locked.state.phase).toBe('locked');
    expect(locked.reply).toMatch(/locked in and ready for search/i);
  });

  it('does not short-circuit travel changes that mention confirmed', () => {
    enterReady();
    const next = sendTravelMessage({
      message: 'confirmed, but change Docklands to Southbank',
      now: NOW,
    });
    expect(next.state.phase).not.toBe('locked');
    expect(next.reply).not.toMatch(/^All confirmed\. Your travel requirements are locked in/i);
  });
});

describe('intent router while ready', () => {
  function enterReady() {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    sendTravelMessage({ message: 'go ahead', now: NOW });
  }

  it('does not trap invent-the-booking behind a planning idle reply', () => {
    enterReady();
    const next = sendTravelMessage({ message: 'invent the booking', now: NOW });
    expect(next.reply).not.toMatch(/We’re in planning/i);
    expect(next.reply).toMatch(/can’t invent|cannot invent|won’t invent|can’t invent/i);
    expect(next.reply).toMatch(/search now|live/i);
  });

  it('routes build my itinerary without planning idle', () => {
    enterReady();
    const next = sendTravelMessage({ message: 'build my itinerary', now: NOW });
    expect(next.reply).not.toMatch(/We’re in planning/i);
    expect(next.reply).toMatch(/itinerary|search now/i);
  });

  it('routes find me the best hotel without planning idle', () => {
    enterReady();
    const next = sendTravelMessage({ message: 'find me the best hotel', now: NOW });
    expect(next.reply).not.toMatch(/We’re in planning/i);
    expect(next.reply).toMatch(/hotel|search/i);
  });

  it('routes search now without planning idle', () => {
    enterReady();
    const next = sendTravelMessage({ message: 'search now', now: NOW });
    expect(next.reply).not.toMatch(/We’re in planning/i);
    expect(next.reply).toMatch(/Opening search|live travel providers/i);
  });

  it('routes stay-area change while ready without planning idle', () => {
    enterReady();
    const next = sendTravelMessage({
      message: 'I will stay in Docklands',
      now: NOW,
    });
    expect(next.state.accommodationArea?.value).toBe('Docklands');
    expect(next.reply).not.toMatch(/We’re in planning/i);
    expect(next.reply).toMatch(/Updated|Docklands/i);
  });

  it('only reports stage when asked', () => {
    enterReady();
    const next = sendTravelMessage({ message: 'what stage are we at', now: NOW });
    expect(next.reply).toMatch(/Requirements are complete and ready/i);
  });
});

describe('conversation readiness', () => {
  it('stops repeating requirements acknowledgement after requirements are complete', () => {
    const first = sendTravelMessage({ message: COMPLETE, now: NOW });
    expect(first.state.phase).toBe('ready');
    expect(first.reply).toMatch(/I’ve saved/i);

    const second = sendTravelMessage({ message: 'ok thanks', now: NOW });
    expect(second.reply).not.toMatch(/I’ve saved/i);

    const third = sendTravelMessage({ message: 'just checking in', now: NOW });
    expect(third.reply).not.toMatch(/I’ve saved/i);
    expect(third.reply).not.toMatch(/We’re in planning/i);
    expect(third.reply).toMatch(/summary|go ahead|search now/i);
  });

  it('flows requirements → ready → locked', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const review = sendTravelMessage({ message: 'Show me the trip', now: NOW });
    expect(review.reply).toMatch(/Here’s what I’ve got/i);
    const affirm = sendTravelMessage({ message: 'Go ahead', now: NOW });
    expect(affirm.state.phase).toBe('ready');
    const locked = sendTravelMessage({ message: 'all confirmed', now: NOW });
    expect(locked.state.phase).toBe('locked');
  });
});

describe('classify isolation', () => {
  it('does not treat travel details as soft affirm', () => {
    const result = processTravelTurn({
      message: 'Continue to Gold Coast from Melbourne',
      previousState: createEmptyConversationState(),
      now: NOW,
      commit: false,
    });
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.reply).not.toMatch(/requirements look complete/i);
    expect(result.reply).not.toMatch(/We’re in planning/i);
  });

  it('does not treat destination-change instructions as soft affirm', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({
      message: 'Go ahead and change the destination to Brisbane',
      now: NOW,
    });
    expect(next.reply).not.toMatch(/requirements look complete/i);
    expect(next.reply).not.toMatch(/We’re in planning/i);
  });

  it('does not treat service mutations as soft affirm', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({
      message: 'Proceed with flights but remove the hotel',
      now: NOW,
    });
    expect(next.reply).not.toMatch(/requirements look complete/i);
    expect(next.state.services).toContain('flights');
    expect(next.state.services).not.toContain('accommodation');
  });
});
