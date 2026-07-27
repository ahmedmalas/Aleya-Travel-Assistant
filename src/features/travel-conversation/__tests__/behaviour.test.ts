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
    expect(review.state.phase).toBe('review');
    expect(review.reply).toMatch(/Here’s what I’ve got for your trip/i);
    expect(review.reply).toMatch(/Surfers Paradise/i);
    expect(review.reply).not.toMatch(/I’ve saved/i);
  });
});

describe('confirmation intent', () => {
  it.each([
    "That's all",
    'Looks good',
    'Go ahead',
    'Continue',
    'Proceed',
    'Perfect',
    "That's correct",
  ])('moves into planning for: %s', (message) => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({ message, now: NOW });
    expect(next.state.phase).toBe('planning');
    expect(next.reply).toMatch(/planning and search/i);
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
  ])('accepts combined confirmation phrases: %s', (message) => {
    const before = sendTravelMessage({ message: COMPLETE, now: NOW });
    expect(before.state.phase).toBe('requirements');
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
    expect(next.state.phase).toBe('planning');
    expect(next.reply).toMatch(/planning and search/i);
    expect(next.reply).not.toMatch(/I’ve saved/i);
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
  function enterPlanning() {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    return sendTravelMessage({ message: 'go ahead', now: NOW });
  }

  it('all confirmed moves planning → confirmed without mutating trip state', () => {
    const planning = enterPlanning();
    expect(planning.state.phase).toBe('planning');
    const snapshot = {
      origin: planning.state.origin?.value,
      destination: planning.state.destination?.value,
      departure: planning.state.departureDate?.value,
      returnIso: planning.state.returnDate?.value.isoDate,
      area: planning.state.accommodationArea?.value,
      services: [...planning.state.services],
      nights: planning.state.durationNights?.value,
    };

    const locked = sendTravelMessage({ message: 'all confirmed', now: NOW });
    expect(locked.state.phase).toBe('confirmed');
    expect(locked.reply).toBe(
      'All confirmed. Your travel requirements are locked in and ready for search.',
    );
    expect(locked.reply).not.toMatch(/We’re in planning/i);
    expect(locked.reply).not.toMatch(/Tell me what to adjust/i);
    expect(locked.reply).not.toMatch(/planning and search next/i);
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
    enterPlanning();
    const locked = sendTravelMessage({ message, now: NOW });
    expect(locked.state.phase).toBe('confirmed');
    expect(locked.reply).toMatch(/locked in and ready for search/i);
    expect(locked.reply).not.toMatch(/Tell me what to adjust/i);
  });

  it('keeps go ahead as planning and summary as review', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const summary = sendTravelMessage({ message: 'show me what you got', now: NOW });
    expect(summary.state.phase).toBe('review');
    const planning = sendTravelMessage({ message: 'go ahead', now: NOW });
    expect(planning.state.phase).toBe('planning');
    expect(planning.reply).toMatch(/planning and search/i);
  });

  it('does not short-circuit travel changes that mention confirmed', () => {
    enterPlanning();
    const next = sendTravelMessage({
      message: 'confirmed, but change Docklands to Southbank',
      now: NOW,
    });
    // Must not take the final-confirmation short-circuit — continues through normal extraction.
    expect(next.state.phase).not.toBe('confirmed');
    expect(next.reply).not.toMatch(/^All confirmed\. Your travel requirements are locked in/i);
    expect(next.reply).not.toMatch(/locked in and ready for search/i);
  });
});

describe('conversation phases', () => {
  it('stops repeating requirements acknowledgement after requirements are complete', () => {
    const first = sendTravelMessage({ message: COMPLETE, now: NOW });
    expect(first.state.phase).toBe('requirements');
    expect(first.reply).toMatch(/I’ve saved/i);

    const second = sendTravelMessage({ message: 'ok thanks', now: NOW });
    // thanks is handled without phase change; use a non-mutating follow-up
    expect(second.reply).not.toMatch(/I’ve saved/i);

    const third = sendTravelMessage({ message: 'just checking in', now: NOW });
    expect(third.reply).not.toMatch(/I’ve saved/i);
    expect(third.reply).toMatch(/summary|go ahead/i);
  });

  it('flows requirements → review → planning', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const review = sendTravelMessage({ message: 'Show me the trip', now: NOW });
    expect(review.state.phase).toBe('review');
    const confirm = sendTravelMessage({ message: 'Go ahead', now: NOW });
    expect(confirm.state.phase).toBe('planning');
    expect(confirm.reply).toMatch(/planning and search/i);
  });
});

describe('classify isolation', () => {
  it('does not treat travel details as confirmation', () => {
    const result = processTravelTurn({
      message: 'Continue to Gold Coast from Melbourne',
      previousState: createEmptyConversationState(),
      now: NOW,
      commit: false,
    });
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.phase).not.toBe('planning');
  });

  it('does not treat destination-change instructions as plain confirmation', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({
      message: 'Go ahead and change the destination to Brisbane',
      now: NOW,
    });
    // Must continue through normal extraction — not the confirmation short-circuit.
    expect(next.state.phase).not.toBe('planning');
    expect(next.reply).not.toMatch(/planning and search/i);
    expect(next.reply).not.toMatch(/^Perfect — moving into planning/i);
  });

  it('does not treat service mutations as plain confirmation', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({
      message: 'Proceed with flights but remove the hotel',
      now: NOW,
    });
    expect(next.state.phase).not.toBe('planning');
    expect(next.state.services).toContain('flights');
    expect(next.state.services).not.toContain('accommodation');
  });
});
