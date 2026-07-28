import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  processTravelTurn,
  projectRequirementsSummary,
  projectSearchForm,
  projectSearchRequest,
  resetTravelConversation,
  sendTravelMessage,
  STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  CONVERSATION_SCHEMA_VERSION,
} from '../index';
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

describe('Scenario 1 — Complete one-turn request', () => {
  it('captures full trip without unnecessary clarification', () => {
    const message =
      'I want to go to Gold Coast on the 28th of August departing from Melbourne and staying at Surfers Paradise for 3 nights returning Monday. I need flights, hotel and car hire.';
    const result = sendTravelMessage({ message, now: NOW });
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
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
    expect(result.reply).not.toMatch(/Where will you be departing from/i);
    expect(result.reply).not.toMatch(/Which date/i);
  });
});

describe('Scenario 2 — Approximate date then clarification', () => {
  const firstMsg =
    'I want to go to Gold Coast departing Melbourne mid August, staying at Surfers Paradise for 3 nights over the weekend and returning Monday. I need flights, car hire and accommodation.';

  it('turn one retains mid-August and asks only for exact date', () => {
    const first = sendTravelMessage({ message: firstMsg, now: NOW });
    expect(first.state.origin?.value).toBe('Melbourne');
    expect(first.state.destination?.value).toBe('Gold Coast');
    expect(first.state.departureDate?.value).toMatchObject({
      kind: 'approximate',
      period: 'mid',
      month: 8,
      year: 2026,
    });
    expect(first.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(first.state.durationNights?.value).toBe(3);
    expect(first.state.services).toHaveLength(3);
    expect(first.clarification.field).toBe('departureDate');
    expect(first.reply).not.toMatch(/Where will you be departing from/i);
  });

  it('14th of August resolves to 14/08 and Monday return 17/08', () => {
    sendTravelMessage({ message: firstMsg, now: NOW });
    const second = sendTravelMessage({ message: '14th of August', now: NOW });
    expect(second.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-14',
    });
    expect(second.state.returnDate?.value.isoDate).toBe('2026-08-17');
    expect(second.state.pendingClarification).toBeUndefined();
    expect(second.clarification.needed).toBe(false);
    expect(second.reply).not.toMatch(/Which date/i);
    expect(projectSearchForm(second.state)).toMatchObject({
      originCode: 'MEL',
      destinationCode: 'OOL',
      departDate: '2026-08-14',
      returnDate: '2026-08-17',
      adults: 1,
      travellerSource: 'product_default',
    });
    expect(projectSearchRequest(second.state).origin).toBe('MEL');
    expect(projectSearchRequest(second.state).travellerSource).toBe('product_default');
  });
});

describe('Scenario 3 — Missing origin clarification', () => {
  it('asks for origin then melbourne fills origin only', () => {
    const first = sendTravelMessage({
      message: 'I want to go to Gold Coast on 28 August 2026.',
      now: NOW,
    });
    expect(first.state.destination?.value).toBe('Gold Coast');
    expect(first.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-28',
    });
    expect(first.state.pendingClarification).toBe('origin');
    expect(first.reply).toMatch(/Where will you be departing from/i);

    const second = sendTravelMessage({ message: 'melbourne', now: NOW });
    expect(second.state.origin?.value).toBe('Melbourne');
    expect(second.state.destination?.value).toBe('Gold Coast');
    expect(second.state.pendingClarification).not.toBe('origin');
    expect(second.reply).not.toMatch(/Where will you be departing from/i);
  });
});

describe('Scenario 4 — Fragmented requirements', () => {
  it('builds final state across five turns including removal', () => {
    sendTravelMessage({ message: 'I want to go to Gold Coast from Melbourne', now: NOW });
    sendTravelMessage({ message: 'I need flights, hotel and car hire', now: NOW });
    sendTravelMessage({ message: 'Surfers Paradise', now: NOW });
    sendTravelMessage({ message: '28th of August and come back Monday', now: NOW });
    const last = sendTravelMessage({ message: 'Remove the car hire', now: NOW });

    expect(last.state.origin?.value).toBe('Melbourne');
    expect(last.state.destination?.value).toBe('Gold Coast');
    expect(last.state.departureDate?.value).toMatchObject({
      kind: 'exact',
      isoDate: '2026-08-28',
    });
    expect(last.state.returnDate?.value.isoDate).toBe('2026-08-31');
    expect(last.state.accommodationArea?.value).toBe('Surfers Paradise');
    expect(last.state.services).toEqual(expect.arrayContaining(['flights', 'accommodation']));
    expect(last.state.services).not.toContain('car_hire');
    expect(last.state.excludedServices).toContain('car_hire');
  });
});

describe('Scenario 5 — Natural variations', () => {
  it.each([
    'From Melbourne to Gold Coast',
    'Gold Coast from Melbourne',
    'Leaving Melbourne for Gold Coast',
    'Departing Melbourne and going to Gold Coast',
    'Flying from Melbourne to Gold Coast',
    'I want Gold Coast, leaving from Melbourne',
    'Go to Gold Coast departing Melbourne',
  ])('%s', (message) => {
    const result = processTravelTurn({
      message,
      previousState: createEmptyConversationState(),
      now: NOW,
      commit: false,
    });
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
  });
});

describe('persistence and schema', () => {
  it('uses schema v5 only and purges legacy keys', () => {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.setItem(key, '{"schemaVersion":1}');
    }
    sendTravelMessage({
      message: 'From Melbourne to Gold Coast on 28 August 2026',
      now: NOW,
    });
    expect(CONVERSATION_SCHEMA_VERSION).toBe(5);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain('"schemaVersion":5');
    for (const key of LEGACY_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });
});

describe('UI projection', () => {
  it('projects summary and search form from canonical state', () => {
    const result = sendTravelMessage({
      message:
        'I want to go to Gold Coast on the 28th of August departing from Melbourne and staying at Surfers Paradise for 3 nights returning Monday. I need flights, hotel and car hire.',
      now: NOW,
    });
    expect(projectRequirementsSummary(result.state)).toMatchObject({
      origin: 'Melbourne',
      destination: 'Gold Coast',
      departing: '28/08/2026',
      returning: '31/08/2026',
      accommodation: 'Surfers Paradise',
      duration: '3 nights',
    });
  });
});
