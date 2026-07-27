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
  it('traces go ahead and show me what you got after requirements', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    clearComposeTraces();

    const confirm = sendTravelMessage({ message: 'go ahead', now: NOW });
    const confirmTrace = getComposeTraces().at(-1);
    // eslint-disable-next-line no-console
    console.log('TRACE go ahead', JSON.stringify(confirmTrace, null, 2));
    // eslint-disable-next-line no-console
    console.log('REPLY go ahead', confirm.reply);

    expect(confirmTrace?.messageClass).toBe('confirmation');
    expect(confirmTrace?.composeBranch).toBe('confirmation_planning');
    expect(confirm.reply).not.toMatch(/I’ve saved/i);

    clearComposeTraces();
    // Reset to requirements-complete state for summary check in isolation
    resetTravelConversation();
    localStorage.clear();
    sendTravelMessage({ message: COMPLETE, now: NOW });
    clearComposeTraces();

    const summary = sendTravelMessage({ message: 'show me what you got', now: NOW });
    const summaryTrace = getComposeTraces().at(-1);
    // eslint-disable-next-line no-console
    console.log('TRACE show me what you got', JSON.stringify(summaryTrace, null, 2));
    // eslint-disable-next-line no-console
    console.log('REPLY show me what you got', summary.reply);

    expect(summaryTrace?.messageClass).toBe('summary');
    expect(summaryTrace?.composeBranch).toBe('summary_review');
    expect(summary.reply).not.toMatch(/I’ve saved/i);
    expect(summary.reply).toMatch(/Here’s what I’ve got for your trip/i);
  });
});
