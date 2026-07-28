import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyConversationState,
  describeProviderLaunchReply,
  launchProviderSearches,
  openProviderLaunchAction,
  resetLiveSearchActivationTracking,
  resetTravelConversation,
  sendTravelMessage,
  type ConversationState,
  type ProviderLaunchResult,
} from '../index';

const NOW = new Date('2026-07-28T12:00:00.000Z');

function field<T>(value: T) {
  return { value, source: 'explicit' as const, confirmed: true };
}

function readyState(): ConversationState {
  const state = createEmptyConversationState('launch-test');
  state.origin = field('Sydney');
  state.destination = field('Melbourne');
  state.departureDate = field({
    kind: 'exact' as const,
    isoDate: '2026-08-28',
    label: '28/08/2026',
    day: 28,
    month: 8,
    year: 2026,
  });
  state.returnDate = field({
    isoDate: '2026-08-31',
    label: '31/08/2026',
  });
  state.services = ['flights', 'accommodation', 'car_hire'];
  return state;
}

beforeEach(() => {
  resetTravelConversation();
  resetLiveSearchActivationTracking();
  vi.restoreAllMocks();
});

afterEach(() => {
  resetTravelConversation();
  resetLiveSearchActivationTracking();
  vi.restoreAllMocks();
});

describe('browser-safe provider launch', () => {
  it('never opens more than one tab automatically', () => {
    const open = vi.fn(() => ({ closed: false }) as Window);
    vi.stubGlobal('open', open);
    // window.open is what tryOpenProviderUrl calls
    window.open = open as typeof window.open;

    const batch = launchProviderSearches(readyState(), readyState().services, {
      openFirst: true,
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(batch.results.filter((r) => r.status === 'opened')).toHaveLength(1);
    expect(batch.results.filter((r) => r.status === 'ready_for_user')).toHaveLength(2);
    expect(batch.results[0]?.service).toBe('flights');
    expect(batch.results[0]?.status).toBe('opened');
  });

  it('does not record opened when window.open returns null', () => {
    window.open = vi.fn(() => null) as typeof window.open;

    const batch = launchProviderSearches(readyState(), ['flights', 'accommodation'], {
      openFirst: true,
    });

    expect(batch.results.every((r) => r.status !== 'opened')).toBe(true);
    expect(batch.results.map((r) => r.status)).toEqual([
      'ready_for_user',
      'ready_for_user',
    ]);
  });

  it('explicit Open button opens one provider from its own gesture', () => {
    window.open = vi.fn(() => null) as typeof window.open;
    launchProviderSearches(readyState(), readyState().services, { openFirst: false });

    window.open = vi.fn(() => ({ closed: false }) as Window) as typeof window.open;
    const opened = openProviderLaunchAction('accommodation');
    expect(opened?.status).toBe('opened');
    expect(opened?.service).toBe('accommodation');

    const again = openProviderLaunchAction('accommodation');
    expect(again?.status).toBe('opened');
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it('reply describes ready-for-user when nothing verified opened', () => {
    const results: ProviderLaunchResult[] = [
      {
        service: 'flights',
        provider: 'Skyscanner',
        url: 'https://example.com/f',
        status: 'ready_for_user',
      },
      {
        service: 'accommodation',
        provider: 'Booking.com',
        url: 'https://example.com/h',
        status: 'ready_for_user',
      },
      {
        service: 'car_hire',
        provider: 'Skyscanner Car Hire',
        url: 'https://example.com/c',
        status: 'ready_for_user',
      },
    ];
    expect(describeProviderLaunchReply(results)).toMatch(
      /searches are ready\. Open each option below/i,
    );
    expect(describeProviderLaunchReply(results)).not.toMatch(/I’m searching/i);
  });

  it('im ready turn evidence matches visible reply (no false searching claim)', () => {
    window.open = vi.fn(() => null) as typeof window.open;

    sendTravelMessage({
      message: 'i need to go melbourne from sydney on 28 August return for 3 nights',
      now: NOW,
    });
    sendTravelMessage({
      message: 'i need flights hotel and car hire',
      now: NOW,
    });
    const ready = sendTravelMessage({ message: 'im ready', now: NOW });

    expect(ready.activateSearch).toBe(true);
    expect(ready.reply).not.toMatch(/I’m searching flights, accommodation, and car hire now/i);
    expect(ready.reply).toMatch(/ready/i);
    expect(ready.runtimeEvidence.requestedServices).toEqual([
      'flights',
      'accommodation',
      'car_hire',
    ]);
    expect(ready.runtimeEvidence.projectedProviderActions).toHaveLength(3);
    expect(ready.runtimeEvidence.providerLaunchResults).toHaveLength(3);
    expect(ready.runtimeEvidence.openedServices).toEqual([]);
    expect(ready.runtimeEvidence.readyForUserServices).toEqual([
      'flights',
      'accommodation',
      'car_hire',
    ]);
    expect(ready.runtimeEvidence.generatedReply).toBe(ready.reply);
  });

  it('partial execution reply when flights opened and others ready', () => {
    const results: ProviderLaunchResult[] = [
      {
        service: 'flights',
        provider: 'Skyscanner',
        url: 'https://example.com/f',
        status: 'opened',
      },
      {
        service: 'accommodation',
        provider: 'Booking.com',
        url: 'https://example.com/h',
        status: 'ready_for_user',
      },
      {
        service: 'car_hire',
        provider: 'Skyscanner Car Hire',
        url: 'https://example.com/c',
        status: 'ready_for_user',
      },
    ];
    expect(describeProviderLaunchReply(results)).toBe(
      'I’ve opened your flight search. Your accommodation and car-hire searches are ready below.',
    );
  });
});
