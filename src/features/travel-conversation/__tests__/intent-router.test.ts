import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  classifyIntent,
  isSoftAffirmMessage,
  resolveReadinessPhase,
} from '../intentRouter';
import { createEmptyConversationState } from '../types';
import { resetTravelConversation, sendTravelMessage } from '../index';
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

describe('classifyIntent', () => {
  const empty = createEmptyConversationState();

  it.each([
    ['invent the booking', 'booking_generation'],
    ['build my itinerary', 'itinerary_generation'],
    ['search now', 'start_search'],
    ['find me the best hotel', 'hotel_recommendation'],
    ['find me the best flight', 'flight_recommendation'],
    ['how much will it cost', 'pricing_request'],
    ['what stage are we at', 'stage_query'],
    ['what have you got', 'summary'],
    ['go ahead', 'soft_affirm'],
    ['all confirmed', 'final_confirmation'],
    ['change destination to Brisbane', 'explicit_change'],
    ['start over', 'new_conversation'],
  ] as const)('classifies %s → %s', (message, intent) => {
    expect(classifyIntent(message, empty).messageClass).toBe(intent);
  });

  it('does not treat go-ahead-plus-mutation as soft affirm', () => {
    expect(isSoftAffirmMessage('Go ahead and change the destination to Brisbane')).toBe(false);
    expect(
      classifyIntent('Go ahead and change the destination to Brisbane', empty).messageClass,
    ).not.toBe('soft_affirm');
  });
});

describe('resolveReadinessPhase', () => {
  it('maps soft affirm to ready and final confirmation to locked', () => {
    const previous = createEmptyConversationState();
    expect(
      resolveReadinessPhase({
        previous,
        intent: 'soft_affirm',
        requirementsComplete: true,
        clarificationNeeded: false,
        mutated: false,
      }),
    ).toBe('ready');

    expect(
      resolveReadinessPhase({
        previous: { ...previous, phase: 'ready' },
        intent: 'final_confirmation',
        requirementsComplete: true,
        clarificationNeeded: false,
        mutated: false,
      }),
    ).toBe('locked');
  });

  it('does not keep a sticky planning trap — mutations unlock locked → ready', () => {
    const previous = { ...createEmptyConversationState(), phase: 'locked' as const };
    expect(
      resolveReadinessPhase({
        previous,
        intent: 'explicit_change',
        requirementsComplete: true,
        clarificationNeeded: false,
        mutated: true,
      }),
    ).toBe('ready');
  });
});

describe('ready phase never swallows intents', () => {
  it('answers invent the booking after go ahead', () => {
    sendTravelMessage({ message: COMPLETE, now: NOW });
    sendTravelMessage({ message: 'go ahead', now: NOW });
    const next = sendTravelMessage({ message: 'invent the booking', now: NOW });
    expect(next.state.phase).toBe('ready');
    expect(next.reply).toMatch(/can’t invent|can’t invent|fabricate/i);
    expect(next.reply).not.toMatch(/We’re in planning/i);
  });
});
