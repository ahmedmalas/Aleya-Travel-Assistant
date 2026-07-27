import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyConversationState,
  getTravelConversation,
  processTravelTurn,
  projectRequirementsSummary,
  projectSearchForm,
  projectSearchRequest,
  resetTravelConversation,
  sendTravelMessage,
  STORAGE_KEY,
} from '../index';

const NOW = new Date('2026-07-27T10:00:00+10:00');

const SCENARIO_A =
  'From Melbourne, I want to go to Gold Coast on 28 August 2026, returning Monday, staying in Surfers Paradise for 3 nights. I need flights, accommodation and car hire.';

/** Exact live-paste shape (newlines) — must still resolve in one turn. */
const SCENARIO_A_MULTILINE = `From Melbourne, I want to go to Gold Coast on 28 August 2026,
returning Monday, staying in Surfers Paradise for 3 nights.
I need flights, accommodation and car hire.`;

beforeEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  localStorage.clear();
});

describe('Scenario A — complete first turn', () => {
  it.each([
    ['single-line', SCENARIO_A],
    ['multiline live paste', SCENARIO_A_MULTILINE],
  ])('extracts origin/destination/dates/area/services without asking for origin (%s)', (_label, message) => {
    resetTravelConversation();
    const result = sendTravelMessage({ message, now: NOW });
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.destination?.source).toBe('explicit');
    expect(result.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-28',
    });
    expect(result.state.returnDate?.value.isoDate).toBe('2026-08-31');
    expect(result.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(result.state.durationNights?.value).toBe(3);
    expect(result.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(result.clarification.needed).toBe(false);
    expect(result.state.pendingClarification).toBeUndefined();
    expect(result.reply).not.toMatch(/Where will you be departing from/i);
    expect(result.reply).not.toMatch(/Which date would you like to travel/i);
    expect(result.reply).toMatch(/Melbourne/i);
    expect(result.reply).toMatch(/Gold Coast/i);

    const summary = projectRequirementsSummary(result.state);
    expect(summary).toMatchObject({
      origin: 'Melbourne',
      destination: 'Gold Coast',
      departing: '28/08/2026',
      returning: '31/08/2026',
      accommodation: 'Surfers Paradise',
      duration: '3 nights',
    });

    const form = projectSearchForm(result.state);
    expect(form.originCode).toBe('MEL');
    expect(form.destinationCode).toBe('OOL');
    expect(form.departDate).toBe('2026-08-28');
    expect(form.returnDate).toBe('2026-08-31');

    const search = projectSearchRequest(result.state);
    expect(search).toMatchObject({
      origin: 'MEL',
      destination: 'OOL',
      departDate: '2026-08-28',
      returnDate: '2026-08-31',
    });
  });
});

describe('Scenario B — explicit mid-August correction', () => {
  it('removes 28 August and asks only for the unresolved date', () => {
    sendTravelMessage({ message: SCENARIO_A, now: NOW });
    const second = sendTravelMessage({
      message: 'no i want to leave mid august',
      now: NOW,
    });
    expect(second.state.origin?.value).toBe('Melbourne');
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(second.state.services).toEqual(
      expect.arrayContaining(['flights', 'accommodation', 'car_hire']),
    );
    expect(second.state.departureDate?.value.kind).toBe('mid_month');
    expect(second.state.departureDate?.value).toMatchObject({ month: 8, year: 2026 });
    // May mention the removed date while acknowledging the change — must not claim it is still active.
    expect(second.reply).toMatch(/removed 28 August/i);
    expect(second.reply).not.toMatch(/departing 28/i);
    expect(second.reply).toMatch(/mid-August/i);
    expect(projectRequirementsSummary(second.state).departing).toMatch(/mid-August/i);
    expect(projectRequirementsSummary(second.state).departingIso).toBeUndefined();
    expect(second.clarification.field).toBe('departureDate');
  });
});

describe('Scenario C — numeric date answer', () => {
  it('sets departure to 15/08/2026 without re-asking', () => {
    sendTravelMessage({ message: SCENARIO_A, now: NOW });
    sendTravelMessage({ message: 'no i want to leave mid august', now: NOW });
    const third = sendTravelMessage({ message: '15-08-26', now: NOW });
    expect(third.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-15',
    });
    // Returning Monday after 15 Aug 2026 (Saturday) → Monday 17 Aug
    expect(third.state.returnDate?.value.isoDate).toBe('2026-08-17');
    expect(third.clarification.needed).toBe(false);
    expect(third.reply).not.toMatch(/Which date/i);
    expect(projectRequirementsSummary(third.state).departing).toBe('15/08/2026');
  });
});

describe('Scenario D — persistence / refresh', () => {
  it('restores latest corrected state and never revives the deleted date', async () => {
    sendTravelMessage({ message: SCENARIO_A, now: NOW });
    sendTravelMessage({ message: 'no i want to leave mid august', now: NOW });
    sendTravelMessage({ message: '15-08-26', now: NOW });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).toContain('2026-08-15');
    expect(raw).not.toContain('2026-08-28');

    const saved = raw!;
    // Simulate full page reload: empty memory + storage retained
    resetTravelConversation();
    localStorage.setItem(STORAGE_KEY, saved);
    const { rehydrateTravelConversation } = await import('../store');
    const state = rehydrateTravelConversation();
    expect(state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-15',
    });
    expect(state.destination?.value).toBe('Gold Coast');
    expect(state.origin?.value).toBe('Melbourne');
    const dep = getTravelConversation().departureDate?.value;
    expect(dep?.kind === 'exact' ? dep.isoDate : undefined).toBe('2026-08-15');
  });
});

describe('Scenario E — fresh conversation', () => {
  it('clears all trip fields', () => {
    sendTravelMessage({ message: SCENARIO_A, now: NOW });
    const fresh = resetTravelConversation();
    expect(fresh.origin).toBeUndefined();
    expect(fresh.destination).toBeUndefined();
    expect(fresh.departureDate).toBeUndefined();
    expect(fresh.services).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('Scenario F — destination correction', () => {
  it('replaces Melbourne destination with Gold Coast; origin unchanged', () => {
    const first = processTravelTurn({
      message: 'I want to go to Melbourne.',
      previousState: createEmptyConversationState(),
      now: NOW,
      commit: false,
    });
    expect(first.state.destination?.value).toBe('Melbourne');
    const second = processTravelTurn({
      message: 'No, go to Gold Coast instead.',
      previousState: first.state,
      now: NOW,
      commit: false,
    });
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.origin).toBeUndefined();
  });
});

describe('Clarification live path — missing origin then bare answer', () => {
  it('asks for origin, then melbourne fills origin only', () => {
    const first = sendTravelMessage({
      message: 'I want to go to Gold Coast on 28 August 2026.',
      now: NOW,
    });
    expect(first.state.destination?.value).toBe('Gold Coast');
    expect(first.state.origin).toBeUndefined();
    expect(first.state.pendingClarification).toBe('origin');
    expect(first.reply).toMatch(/Where will you be departing from/i);

    const second = sendTravelMessage({ message: 'melbourne', now: NOW });
    expect(second.state.origin?.value).toBe('Melbourne');
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.pendingClarification).not.toBe('origin');
    expect(second.reply).not.toMatch(/Where will you be departing from/i);
    expect(second.reply).toMatch(/origin Melbourne/i);
    expect(second.reply).toMatch(/destination Gold Coast/i);
  });
});
