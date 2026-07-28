import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildOptionSet,
  buildServicesOptionSet,
  resolveContextualReference,
  validateContextualResolution,
  resetContextualReferenceRuntime,
} from '../contextual-reference';

beforeEach(() => {
  resetContextualReferenceRuntime();
});

const servicesSet = () =>
  buildServicesOptionSet(
    'Are you looking for flights only, or would you like accommodation or car hire as well?',
  );

function ids(message: string, set = servicesSet()) {
  const resolution = resolveContextualReference(message, set);
  const validated = validateContextualResolution(resolution, set);
  return { resolution, validated, selected: validated.selectedOptionIds };
}

describe('contextual reference resolver — service option set', () => {
  const cases: Array<[string, string[]]> = [
    ['all of them', ['flights', 'accommodation', 'car_hire']],
    ['all the above', ['flights', 'accommodation', 'car_hire']],
    ['all the above please', ['flights', 'accommodation', 'car_hire']],
    ['everything you mentioned', ['flights', 'accommodation', 'car_hire']],
    ['include them all', ['flights', 'accommodation', 'car_hire']],
    ['yes, those three', ['flights', 'accommodation', 'car_hire']],
    ['the first two', ['flights', 'accommodation']],
    ['the last one', ['car_hire']],
    ['the second option', ['accommodation']],
    ['flights and the last one', ['flights', 'car_hire']],
    ['everything except the car', ['flights', 'accommodation']],
    ['all except accommodation', ['flights', 'car_hire']],
    ['none of them', []],
  ];

  for (const [message, expected] of cases) {
    it(`resolves "${message}"`, () => {
      const { resolution, validated, selected } = ids(message);
      expect(resolution.resolved).toBe(true);
      expect(validated.ok).toBe(true);
      expect(selected.sort()).toEqual([...expected].sort());
    });
  }
});

describe('contextual reference resolver — non-service categories', () => {
  it('morning/evening: either is fine / both', () => {
    const set = buildOptionSet({
      prefix: 'pref',
      question: 'Would you prefer morning or evening?',
      selectionMode: 'multiple',
      awaitingField: 'preference',
      options: [
        { id: 'morning', label: 'morning', value: 'morning', category: 'preference' },
        { id: 'evening', label: 'evening', value: 'evening', category: 'preference' },
      ],
    });
    const both = resolveContextualReference('both are fine', set);
    expect(both.resolved).toBe(true);
    expect(both.selectedOptionIds.sort()).toEqual(['evening', 'morning']);

    const either = resolveContextualReference('either is fine', set);
    expect(either.resolved).toBe(true);
    expect(either.selectedOptionIds.sort()).toEqual(['evening', 'morning']);
  });

  it('airport: the first one', () => {
    const set = buildOptionSet({
      prefix: 'airport',
      question: 'Would you like Melbourne Airport or Avalon?',
      selectionMode: 'single',
      awaitingField: 'location',
      options: [
        {
          id: 'mel',
          label: 'Melbourne Airport',
          value: 'Melbourne Airport',
          category: 'location',
        },
        { id: 'av', label: 'Avalon', value: 'Avalon', category: 'location' },
      ],
    });
    const r = resolveContextualReference('the first one', set);
    expect(r.resolved).toBe(true);
    expect(r.selectedOptionIds).toEqual(['mel']);
  });

  it('rooms: two', () => {
    const set = buildOptionSet({
      prefix: 'rooms',
      question: 'Would you like one room or two rooms?',
      selectionMode: 'single',
      awaitingField: 'traveller',
      options: [
        { id: 'one', label: 'one room', value: 1, category: 'traveller' },
        { id: 'two', label: 'two rooms', value: 2, category: 'traveller' },
      ],
    });
    const r = resolveContextualReference('two', set);
    expect(r.resolved).toBe(true);
    expect(r.selectedOptionIds).toEqual(['two']);
  });

  it('does not hard-code three services — two-option all', () => {
    const set = buildOptionSet({
      prefix: 'two-svc',
      question: 'Flights or hotel?',
      selectionMode: 'multiple',
      options: [
        { id: 'flights', label: 'flights', value: 'flights', category: 'service' },
        {
          id: 'accommodation',
          label: 'hotel',
          value: 'accommodation',
          category: 'service',
        },
      ],
    });
    const r = resolveContextualReference('all the above', set);
    expect(r.selectedOptionIds.sort()).toEqual(['accommodation', 'flights']);
  });
});
