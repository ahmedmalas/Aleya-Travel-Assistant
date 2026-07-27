import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  processTravelTurn,
  projectRequirementsSummary,
  projectSearchForm,
  projectSearchRequest,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';
import { createEmptyConversationState } from '../types';
import { resolveLocations } from '../locations';
import { parseExactDate } from '../extract/dates';

const NOW = new Date('2026-07-27T10:00:00+10:00');

const SCENARIO_A =
  'I want to go to Gold Coast departing Melbourne mid August staying at Surfers Paradise for 3 nights over the weekend returning Monday. I need flights, accommodation and car hire.';

beforeEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

describe('NL route precedence', () => {
  it.each([
    'I want to go to Gold Coast and departing Melbourne',
    'I want to go to Gold Coast departing Melbourne',
    'Going to Gold Coast departing from Melbourne',
    'Departing Melbourne going to Gold Coast',
  ])('keeps Gold Coast as destination and Melbourne as origin for: %s', (message) => {
    const roles = resolveLocations(message);
    expect(roles.origin).toBe('Melbourne');
    expect(roles.destination).toBe('Gold Coast');
  });
});

describe('Exact date answers', () => {
  it.each(['14th of August', '14 August', '14th August', 'Friday 14 August', '14/08/2026'])(
    'parses %s as 2026-08-14',
    (text) => {
      expect(parseExactDate(text, NOW)?.isoDate).toBe('2026-08-14');
    },
  );
});

describe('Mandatory Scenario A — mid August + 14th of August', () => {
  it('first turn extracts route/stay/services and only asks for exact departure date', () => {
    const first = sendTravelMessage({ message: SCENARIO_A, now: NOW });

    expect(first.state.origin?.value).toBe('Melbourne');
    expect(first.state.destination?.value).toBe('Gold Coast');
    expect(first.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(first.state.durationNights?.value).toBe(3);
    expect(first.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(first.state.departureDate?.value).toMatchObject({
      kind: 'mid_month',
      month: 8,
      year: 2026,
    });
    expect(first.state.returnDate?.value.weekday).toBe(1);
    expect(first.clarification.needed).toBe(true);
    expect(first.clarification.field).toBe('departureDate');
    expect(first.state.pendingClarification).toBe('departureDate');
    expect(first.reply).toMatch(/mid-August/i);
    expect(first.reply).not.toMatch(/Where will you be departing from/i);
    expect(first.reply).toMatch(/origin Melbourne/i);
    expect(first.reply).toMatch(/destination Gold Coast/i);

    const summary = projectRequirementsSummary(first.state);
    expect(summary).toMatchObject({
      origin: 'Melbourne',
      destination: 'Gold Coast',
      accommodation: 'Surfers Paradise',
      duration: '3 nights',
    });
  });

  it('14th of August resolves departure to 2026-08-14 and return Monday 2026-08-17', () => {
    sendTravelMessage({ message: SCENARIO_A, now: NOW });
    const second = sendTravelMessage({ message: '14th of August', now: NOW });

    expect(second.state.origin?.value).toBe('Melbourne');
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-14',
    });
    expect(second.state.returnDate?.value.isoDate).toBe('2026-08-17');
    expect(second.state.pendingClarification).toBeUndefined();
    expect(second.clarification.needed).toBe(false);
    expect(second.reply).not.toMatch(/Which date/i);
    expect(second.reply).not.toMatch(/Where will you be departing from/i);

    const form = projectSearchForm(second.state);
    expect(form).toMatchObject({
      originCode: 'MEL',
      destinationCode: 'OOL',
      departDate: '2026-08-14',
      returnDate: '2026-08-17',
    });

    const search = projectSearchRequest(second.state);
    expect(search).toMatchObject({
      origin: 'MEL',
      destination: 'OOL',
      departDate: '2026-08-14',
      returnDate: '2026-08-17',
    });
  });

  it('does not re-ask for travel date after an exact answer', () => {
    const first = processTravelTurn({
      message: SCENARIO_A,
      previousState: createEmptyConversationState(),
      now: NOW,
      commit: false,
    });
    const second = processTravelTurn({
      message: '14th of August',
      previousState: first.state,
      now: NOW,
      commit: false,
    });
    expect(second.clarification.field).not.toBe('departureDate');
    expect(second.state.departureDate?.value.kind).toBe('exact');
  });
});
