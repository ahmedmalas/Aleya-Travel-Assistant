import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isDeclineSearchMessage,
  isSearchApprovalMessage,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';
import { NOW } from './helpers';

const COMPLETE =
  'I want to go to Gold Coast on the 28th of August departing from Melbourne and staying at Surfers Paradise for 3 nights returning Monday. I need flights and car hire.';

beforeEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

function completeTrip() {
  return sendTravelMessage({ message: COMPLETE, now: NOW });
}

describe('isSearchApprovalMessage', () => {
  it.each([
    'ready for live options',
    "I'm ready",
    'ready',
    'go ahead',
    'proceed',
    'continue',
    'start',
    "let's do it",
    'find them',
    'show me the options',
    "show me what's available",
    'search for me',
    'start searching',
    'book it',
    "let's book",
    'find my flights',
    'find everything',
    'search now',
  ])('approves: %s', (message) => {
    expect(isSearchApprovalMessage(message)).toBe(true);
  });

  it.each([
    'go ahead and change Melbourne to Brisbane',
    'continue but remove car hire',
    'show me a summary',
    "I'm not ready yet",
  ])('rejects: %s', (message) => {
    expect(isSearchApprovalMessage(message)).toBe(false);
  });
});

describe('isDeclineSearchMessage', () => {
  it('detects not ready yet', () => {
    expect(isDeclineSearchMessage("I'm not ready yet")).toBe(true);
  });
});

describe('completed-trip search approval', () => {
  it.each([
    'ready for live options',
    'go ahead',
    'proceed',
    'continue',
    'show me the options',
    'find everything',
    "let's do it",
  ])('activates search for: %s', (message) => {
    completeTrip();
    const next = sendTravelMessage({ message, now: NOW });
    expect(next.activateSearch).toBe(true);
    expect(next.searchPerformed).toBe(true);
    expect(next.servicesToSearch).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(next.reply).toMatch(/Starting live search/i);
    expect(next.reply).not.toMatch(/What would you like next/i);
    expect(next.reply).not.toMatch(/We’re in planning/i);
  });

  it('understands continuity after its own “ready for live options” wording', () => {
    const first = completeTrip();
    expect(first.reply).toMatch(/ready for live options|Shall I start the live search/i);
    expect(first.state.lastOffer?.kind).toBe('start_search');

    const next = sendTravelMessage({ message: 'ready for live options', now: NOW });
    expect(next.activateSearch).toBe(true);
    expect(next.reply).toMatch(/Starting live search/i);
  });

  it('go ahead after search offer starts search — not another menu', () => {
    completeTrip();
    sendTravelMessage({ message: 'what have you got', now: NOW });
    const next = sendTravelMessage({ message: 'go ahead', now: NOW });
    expect(next.activateSearch).toBe(true);
    expect(next.reply).toMatch(/Starting live search/i);
    expect(next.reply).not.toMatch(/What would you like next/i);
  });
});

describe('negative cases', () => {
  it('does not start search for mutation-with-approval phrasing', () => {
    completeTrip();
    const next = sendTravelMessage({
      message: 'go ahead and change Melbourne to Brisbane',
      now: NOW,
    });
    expect(next.activateSearch).toBe(false);
    expect(next.reply).not.toMatch(/Starting live search/i);
  });

  it('does not start search when removing a service', () => {
    completeTrip();
    const next = sendTravelMessage({
      message: 'continue but remove car hire',
      now: NOW,
    });
    expect(next.activateSearch).toBe(false);
    expect(next.state.services).not.toContain('car_hire');
  });

  it('show me a summary does not start search', () => {
    completeTrip();
    const next = sendTravelMessage({ message: 'show me a summary', now: NOW });
    expect(next.activateSearch).toBe(false);
    expect(next.reply).toMatch(/Here’s what I’ve got for your trip/i);
  });

  it('I’m not ready yet declines search', () => {
    completeTrip();
    const next = sendTravelMessage({ message: "I'm not ready yet", now: NOW });
    expect(next.activateSearch).toBe(false);
    expect(next.reply).toMatch(/won’t start the search yet/i);
  });

  it('subsequent chat after search does not re-activate automatically', () => {
    completeTrip();
    const search = sendTravelMessage({ message: 'go ahead', now: NOW });
    expect(search.activateSearch).toBe(true);
    const thanks = sendTravelMessage({ message: 'thanks', now: NOW });
    expect(thanks.activateSearch).toBe(false);
  });
});
