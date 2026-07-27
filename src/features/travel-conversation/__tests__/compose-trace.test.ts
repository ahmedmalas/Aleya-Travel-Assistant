import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearComposeTraces,
  getComposeTraces,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';
import { NOW } from './helpers';

const COMPLETE =
  'I want to go to Gold Coast on the 28th of August departing from Melbourne and staying at Surfers Paradise for 3 nights returning Monday. I need flights and car hire.';

beforeEach(() => {
  resetTravelConversation();
  localStorage.clear();
  clearComposeTraces();
});

afterEach(() => {
  resetTravelConversation();
  localStorage.clear();
  clearComposeTraces();
});

describe('compose runtime trace', () => {
  it('traces soft affirm and summary after requirements', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    clearComposeTraces();

    const affirm = sendTravelMessage({ message: 'go ahead', now: NOW });
    const affirmTrace = getComposeTraces().at(-1);

    expect(affirmTrace?.messageClass).toBe('soft_affirm');
    expect(affirmTrace?.composeBranch).toBe('soft_affirm_ready');
    expect(affirm.reply).not.toMatch(/I’ve saved/i);
    expect(affirm.reply).not.toMatch(/We’re in planning/i);

    clearComposeTraces();
    resetTravelConversation();
    localStorage.clear();
    sendTravelMessage({ message: COMPLETE, now: NOW });
    clearComposeTraces();

    const summary = sendTravelMessage({ message: 'show me what you got', now: NOW });
    const summaryTrace = getComposeTraces().at(-1);

    expect(summaryTrace?.messageClass).toBe('summary');
    expect(summaryTrace?.composeBranch).toBe('summary_review');
    expect(summary.reply).not.toMatch(/I’ve saved/i);
    expect(summary.reply).toMatch(/Here’s what I’ve got for your trip/i);
  });

  it('traces booking generation while ready — never planning_idle', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    sendTravelMessage({ message: 'go ahead', now: NOW });
    clearComposeTraces();

    const next = sendTravelMessage({ message: 'invent the booking', now: NOW });
    const trace = getComposeTraces().at(-1);

    expect(trace?.messageClass).toBe('booking_generation');
    expect(trace?.composeBranch).toBe('booking_generation');
    expect(next.reply).not.toMatch(/We’re in planning/i);
  });
});
