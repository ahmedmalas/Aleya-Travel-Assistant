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
  it('traces go ahead as start_search with activateSearch', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    clearComposeTraces();

    const next = sendTravelMessage({ message: 'go ahead', now: NOW });
    const trace = getComposeTraces().at(-1);

    expect(trace?.messageClass).toBe('start_search');
    expect(trace?.composeBranch).toBe('start_search');
    expect(trace?.activateSearch).toBe(true);
    expect(next.activateSearch).toBe(true);
    expect(next.reply).toMatch(/Starting live search/i);
  });

  it('traces summary without activating search', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    clearComposeTraces();

    const summary = sendTravelMessage({ message: 'show me what you got', now: NOW });
    const summaryTrace = getComposeTraces().at(-1);

    expect(summaryTrace?.messageClass).toBe('summary');
    expect(summaryTrace?.composeBranch).toBe('summary_review');
    expect(summaryTrace?.activateSearch).toBe(false);
    expect(summary.activateSearch).toBe(false);
  });
});
