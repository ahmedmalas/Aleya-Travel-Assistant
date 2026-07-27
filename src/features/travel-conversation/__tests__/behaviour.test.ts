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
});
