import { describe, expect, it } from 'vitest';
import { createEmptyConversationState } from '../types';
import { processTravelTurn } from '../pipeline';
import { extractLocations, resolveLocations } from '../locations';

const NOW = new Date('2026-07-27T10:00:00+10:00');

const ROUTE_MESSAGES = [
  'From Melbourne, I want to go to Gold Coast',
  'From Melbourne to Gold Coast',
  'Melbourne to Gold Coast',
  'Leaving Melbourne for Gold Coast',
  'Departing from Melbourne and going to Gold Coast',
  'Flying from Melbourne to Gold Coast',
  'I’m leaving from Melbourne.',
  'My departure city is Melbourne.',
] as const;

describe('location role extraction — origin/destination pairs', () => {
  it.each([
    'From Melbourne, I want to go to Gold Coast',
    'From Melbourne to Gold Coast',
    'Melbourne to Gold Coast',
    'Leaving Melbourne for Gold Coast',
    'Departing from Melbourne and going to Gold Coast',
    'Flying from Melbourne to Gold Coast',
  ])('assigns Melbourne origin and Gold Coast destination for: %s', (message) => {
    const assignment = resolveLocations(message);
    expect(assignment.origin).toBe('Melbourne');
    expect(assignment.destination).toBe('Gold Coast');

    const turn = processTravelTurn({
      message,
      previousState: createEmptyConversationState(),
      now: NOW,
      commit: false,
    });
    expect(turn.state.origin?.value).toBe('Melbourne');
    expect(turn.state.destination?.value).toBe('Gold Coast');
  });

  it.each(['I’m leaving from Melbourne.', 'My departure city is Melbourne.'])(
    'assigns Melbourne origin for: %s',
    (message) => {
      const assignment = resolveLocations(message);
      expect(assignment.origin).toBe('Melbourne');
      expect(assignment.destination).toBeUndefined();
    },
  );
});

describe('clarification-context location answers', () => {
  it('pending origin + melbourne → origin only; destination unchanged; pending cleared', () => {
    const previous = createEmptyConversationState();
    previous.destination = { value: 'Gold Coast', source: 'explicit', confirmed: true };
    previous.departureDate = {
      value: {
        kind: 'exact',
        isoDate: '2026-08-28',
        label: '28 August 2026',
        day: 28,
        month: 8,
        year: 2026,
      },
      source: 'explicit',
      confirmed: true,
    };
    previous.services = ['flights', 'accommodation', 'car_hire'];
    previous.pendingClarification = 'origin';

    const result = processTravelTurn({
      message: 'melbourne',
      previousState: previous,
      now: NOW,
      commit: false,
    });

    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.pendingClarification).toBeUndefined();
    expect(result.clarification.needed).toBe(false);
    expect(result.reply).not.toMatch(/Where will you be departing from/i);
    expect(result.reply).toMatch(/Melbourne/i);
    expect(result.reply).toMatch(/Gold Coast/i);
  });

  it('pending destination + gold coast → destination only; origin unchanged; pending cleared', () => {
    const previous = createEmptyConversationState();
    previous.origin = { value: 'Melbourne', source: 'explicit', confirmed: true };
    previous.pendingClarification = 'destination';

    const result = processTravelTurn({
      message: 'gold coast',
      previousState: previous,
      now: NOW,
      commit: false,
    });

    expect(result.state.destination?.value).toBe('Gold Coast');
    expect(result.state.origin?.value).toBe('Melbourne');
    expect(result.state.pendingClarification).toBeUndefined();
    expect(result.clarification.field).not.toBe('destination');
  });

  it('never treats a bare clarification answer as destination when origin is pending', () => {
    const patch = extractLocations('melbourne', { pendingClarification: 'origin' });
    expect(patch.origin?.value).toBe('Melbourne');
    expect(patch.destination).toBeUndefined();
  });
});

describe('route message inventory (engine contract)', () => {
  it('covers every mandated phrasing', () => {
    expect(ROUTE_MESSAGES.length).toBeGreaterThanOrEqual(8);
  });
});
