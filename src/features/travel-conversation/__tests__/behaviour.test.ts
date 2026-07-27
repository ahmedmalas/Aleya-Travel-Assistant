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
    expect(review.activateSearch).toBe(false);
    expect(review.reply).not.toMatch(/I’ve saved/i);
  });
});

describe('search approval after requirements', () => {
  it.each(['Go ahead', 'Continue', 'Proceed', 'ready for live options'])(
    'starts live search for: %s',
    (message) => {
      sendTravelMessage({ message: COMPLETE, now: NOW });
      const next = sendTravelMessage({ message, now: NOW });
      expect(next.activateSearch).toBe(true);
      expect(next.reply).toMatch(/Starting live search/i);
      expect(next.reply).not.toMatch(/What would you like next/i);
    },
  );
});

describe('final confirmation intent', () => {
  it('all confirmed locks and offers search without activating', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const locked = sendTravelMessage({ message: 'all confirmed', now: NOW });
    expect(locked.state.phase).toBe('locked');
    expect(locked.activateSearch).toBe(false);
    expect(locked.reply).toMatch(/locked in/i);
    expect(locked.state.lastOffer?.kind).toBe('start_search');
  });

  it('go ahead after lock starts search', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    sendTravelMessage({ message: 'all confirmed', now: NOW });
    const next = sendTravelMessage({ message: 'go ahead', now: NOW });
    expect(next.activateSearch).toBe(true);
  });

  it('does not short-circuit travel changes that mention confirmed', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({
      message: 'confirmed, but change Docklands to Southbank',
      now: NOW,
    });
    expect(next.state.phase).not.toBe('locked');
    expect(next.activateSearch).toBe(false);
  });
});

describe('classify isolation', () => {
  it('does not treat travel details as search approval', () => {
    const result = processTravelTurn({
      message: 'Continue to Gold Coast from Melbourne',
      previousState: createEmptyConversationState(),
      now: NOW,
      commit: false,
    });
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.activateSearch).toBe(false);
  });

  it('does not treat destination-change instructions as search approval', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({
      message: 'Go ahead and change the destination to Brisbane',
      now: NOW,
    });
    expect(next.activateSearch).toBe(false);
    expect(next.reply).not.toMatch(/Starting live search/i);
  });

  it('does not treat service mutations as search approval', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    const next = sendTravelMessage({
      message: 'Proceed with flights but remove the hotel',
      now: NOW,
    });
    expect(next.activateSearch).toBe(false);
    expect(next.state.services).toContain('flights');
    expect(next.state.services).not.toContain('accommodation');
  });
});
