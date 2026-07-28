import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearConversationTraces,
  getActiveOptionSet,
  resetTravelConversation,
  sendTravelMessage,
} from '../index';
import { getAwaitingField } from '../conversation/runtime';
import { NOW } from './helpers';

beforeEach(() => {
  resetTravelConversation();
  clearConversationTraces();
  localStorage.clear();
});

afterEach(() => {
  resetTravelConversation();
  clearConversationTraces();
  localStorage.clear();
});

function reachServicesQuestion() {
  sendTravelMessage({ message: 'I want to go Melbourne', now: NOW });
  sendTravelMessage({ message: 'Sydney', now: NOW });
  sendTravelMessage({ message: '28 August', now: NOW });
  const tripType = sendTravelMessage({ message: 'return', now: NOW });
  expect(tripType.progression.nextRequiredField?.id).toBe('services');
  expect(tripType.reply).toMatch(/flights only/i);
  expect(getAwaitingField()).toBe('services');
  const opts = getActiveOptionSet();
  expect(opts?.options.map((o) => o.id)).toEqual([
    'flights',
    'accommodation',
    'car_hire',
  ]);
  return tripType;
}

describe('Exact scenario — all the above please', () => {
  it('resolves three services and offers search', () => {
    reachServicesQuestion();

    const turn = sendTravelMessage({ message: 'all the above please', now: NOW });

    expect(turn.state.services.sort()).toEqual(
      ['accommodation', 'car_hire', 'flights'].sort(),
    );
    expect(turn.progression.nextRequiredField).toBeNull();
    expect(turn.reply).toMatch(/I’ve added/i);
    expect(turn.reply).toMatch(/flights/i);
    expect(turn.reply).toMatch(/accommodation/i);
    expect(turn.reply).toMatch(/car hire/i);
    expect(turn.reply).toMatch(/whenever you.?re ready/i);
    expect(turn.reply).not.toMatch(/flights only/i);

    const ev = turn.runtimeEvidence;
    expect(ev.contextualReferenceDetected).toBe(true);
    expect(ev.selectedOptionIds.sort()).toEqual(
      ['accommodation', 'car_hire', 'flights'].sort(),
    );
    expect(ev.canonicalStateAfter.services.sort()).toEqual(
      ['accommodation', 'car_hire', 'flights'].sort(),
    );
    expect(ev.nextRequiredField).toBeNull();
    expect(ev.activeOptionSet?.options.map((o) => o.id).sort()).toEqual(
      ['accommodation', 'car_hire', 'flights'].sort(),
    );
    expect(ev.combinedValidatedSelections?.ok).toBe(true);
  });
});

describe('Services awaitingField + option set lifecycle', () => {
  it('sets awaitingField=services and structured options after services question', () => {
    reachServicesQuestion();
  });

  it('first two against live conversation', () => {
    reachServicesQuestion();
    const turn = sendTravelMessage({ message: 'the first two', now: NOW });
    expect(turn.state.services.sort()).toEqual(['accommodation', 'flights'].sort());
    expect(turn.reply).not.toMatch(/flights only/i);
  });
});
