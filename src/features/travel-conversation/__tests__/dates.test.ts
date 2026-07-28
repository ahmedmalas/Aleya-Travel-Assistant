import { describe, expect, it } from 'vitest';
import { extractDateCandidates } from '../candidates/dates';
import { createEmptyConversationState } from '../types';
import { NOW } from './helpers';

describe('exact dates', () => {
  it.each([
    ['28 August', '2026-08-28'],
    ['28th August', '2026-08-28'],
    ['28th of August', '2026-08-28'],
    ['the 28th of August', '2026-08-28'],
    ['Friday 28 August', '2026-08-28'],
    ['14/08/2026', '2026-08-14'],
  ])('parses %s', (text, iso) => {
    const dates = extractDateCandidates(text, NOW);
    const exact = dates.find((d) => d.exact);
    expect(exact?.exact?.isoDate).toBe(iso);
  });
});

describe('approximate dates', () => {
  it.each(['mid August', 'early August', 'late August'])('retains %s', (text) => {
    const dates = extractDateCandidates(text, NOW);
    expect(dates.some((d) => d.approximate)).toBe(true);
  });
});

describe('return constraints', () => {
  it('captures return Monday and weekend', () => {
    const dates = extractDateCandidates(
      '3 nights over the weekend returning Monday',
      NOW,
    );
    const ret = dates.find((d) => d.roleHint === 'return');
    expect(ret?.returnWeekday).toBe(1);
    expect(ret?.weekend).toBe(true);
  });

  it('resolves day-only against mid-August context', () => {
    const previous = createEmptyConversationState();
    previous.departureDate = {
      value: { kind: 'approximate', period: 'mid', month: 8, year: 2026, label: 'mid August' },
      source: 'explicit',
      confirmed: false,
    };
    const dates = extractDateCandidates('14th', NOW, previous, 'departureDate');
    expect(dates.find((d) => d.exact)?.exact?.isoDate).toBe('2026-08-14');
  });
});
