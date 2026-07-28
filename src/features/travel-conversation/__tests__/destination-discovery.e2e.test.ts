import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearConversationTraces,
  processTravelTurn,
  resetTravelConversation,
  sendTravelMessage,
  sendTravelMessageAsync,
  STORAGE_KEY,
  getTravelConversation,
  rehydrateTravelConversation,
} from '../index';
import { createEmptyConversationState } from '../types';
import { setTravelConversation } from '../store';
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

describe('Destination discovery — basic', () => {
  it('enters discovery for somewhere tropical and does not ask Where would you like to travel', () => {
    const turn = sendTravelMessage({
      message: 'Find me somewhere tropical',
      now: NOW,
    });
    expect(turn.progression.objective).toBe('discover_destination');
    expect(turn.state.discovery?.mode).toBe('active');
    expect(turn.state.discovery?.criteria.characters).toContain('tropical');
    expect(turn.reply).not.toMatch(/Where would you like to travel\?/i);
    expect(
      turn.progression.conversationalStep.kind === 'ask_discovery_question' ||
        turn.progression.conversationalStep.kind === 'recommend_destinations',
    ).toBe(true);
  });

  it('stores relaxation and beach criteria', () => {
    const turn = sendTravelMessage({
      message: 'I want a relaxing beach holiday',
      now: NOW,
    });
    expect(turn.progression.objective).toBe('discover_destination');
    expect(turn.state.discovery?.criteria.characters).toEqual(
      expect.arrayContaining(['beach', 'relaxation']),
    );
    expect(turn.reply).not.toMatch(/Where would you like to travel\?/i);
  });

  it('treats short city break as discovery', () => {
    const turn = sendTravelMessage({
      message: 'Where should I go for a short city break?',
      now: NOW,
    });
    expect(turn.progression.objective).toBe('discover_destination');
    expect(turn.state.discovery?.criteria.characters).toContain('city');
    expect(turn.reply).not.toMatch(/Where would you like to travel\?/i);
  });
});

describe('Destination discovery — progressive criteria', () => {
  it('accumulates criteria across turns without falling back to missing destination', () => {
    const t1 = sendTravelMessage({ message: 'Find me somewhere tropical', now: NOW });
    expect(t1.state.discovery?.mode).toBe('active');
    expect(t1.state.discovery?.criteria.characters).toContain('tropical');
    expect(t1.reply).not.toMatch(/Where would you like to travel\?/i);

    const t2 = sendTravelMessage({
      message: 'Under six hours from Sydney',
      now: NOW,
    });
    expect(t2.progression.objective).toBe('discover_destination');
    expect(t2.state.discovery?.criteria.characters).toContain('tropical');
    expect(t2.state.discovery?.criteria.originLabel).toBe('Sydney');
    expect(t2.state.discovery?.criteria.maxTravelHours).toBe(6);
    expect(t2.state.origin?.value).toBe('Sydney');
    expect(t2.state.destination).toBeUndefined();
    expect(t2.reply).not.toMatch(/Where would you like to travel\?/i);

    const t3 = sendTravelMessage({ message: 'Quiet, not Bali', now: NOW });
    expect(t3.state.discovery?.criteria.characters).toContain('tropical');
    expect(t3.state.discovery?.criteria.vibe).toBe('quiet');
    expect(t3.state.discovery?.criteria.exclusions.map((e) => e.toLowerCase())).toContain('bali');
    expect(t3.state.discovery?.rejectedIds.length).toBeGreaterThan(0);
    expect(t3.reply).not.toMatch(/Where would you like to travel\?/i);

    const t4 = sendTravelMessage({ message: 'For four nights', now: NOW });
    expect(t4.state.discovery?.criteria.durationNights).toBe(4);
    expect(t4.state.discovery?.criteria.maxTravelHours).toBe(6);
    expect(t4.state.discovery?.criteria.originLabel).toBe('Sydney');

    const t5 = sendTravelMessage({ message: 'Around mid-range budget', now: NOW });
    expect(t5.state.discovery?.criteria.budgetLevel).toBe('mid_range');
    expect(t5.state.discovery?.criteria.characters).toContain('tropical');
    expect(t5.state.discovery?.criteria.exclusions.map((e) => e.toLowerCase())).toContain('bali');
    expect(t5.progression.objective).toBe('discover_destination');
    expect(t5.reply).not.toMatch(/Where would you like to travel\?/i);
    // By now should recommend
    expect(t5.progression.conversationalStep.kind).toBe('recommend_destinations');
    expect(t5.state.discovery?.recommendations.length).toBeGreaterThan(1);
    expect(
      t5.state.discovery?.recommendations.some((r) => /bali/i.test(r.placeName)),
    ).toBe(false);
  });
});

describe('Destination discovery — recommendation + selection', () => {
  it('recommends with reasons then transitions to booking on Fiji selection', () => {
    sendTravelMessage({ message: 'Find me somewhere tropical', now: NOW });
    sendTravelMessage({ message: 'Under six hours from Sydney', now: NOW });
    sendTravelMessage({ message: 'Quiet, not Bali', now: NOW });
    const rec = sendTravelMessage({ message: 'For four nights, mid-range', now: NOW });
    expect(rec.progression.conversationalStep.kind).toBe('recommend_destinations');
    expect(rec.reply).toMatch(/shortlist/i);
    expect(rec.state.discovery?.recommendations.every((r) => r.reasons.length > 0)).toBe(true);

    const pick = sendTravelMessage({
      message: "Let's do Fiji",
      now: NOW,
    });
    expect(pick.state.destination?.value).toBe('Fiji');
    expect(pick.state.destinationPlace?.canonicalName).toBe('Fiji');
    expect(pick.state.discovery?.mode).toBe('completed');
    expect(pick.reply).not.toMatch(/Where would you like to travel\?/i);
    expect(pick.reply).not.toMatch(/shortlist/i);
    expect(pick.progression.nextRequiredField?.id).not.toBe('destination');
    // Origin already known from discovery
    expect(pick.state.origin?.value).toBe('Sydney');
  });

  it('Scenario E wording: The Fiji option sounds best', () => {
    sendTravelMessage({
      message: 'Find me somewhere tropical under six hours from Sydney',
      now: NOW,
    });
    sendTravelMessage({ message: 'Quiet mid-range for four nights', now: NOW });
    const pick = sendTravelMessage({
      message: 'The Fiji option sounds best',
      now: NOW,
    });
    expect(pick.state.destination?.value).toBe('Fiji');
    expect(pick.state.discovery?.mode).toBe('completed');
  });
});

describe('Destination discovery — refinements', () => {
  it('updates ranking for closer / cheaper / australia-only without losing prior criteria', () => {
    sendTravelMessage({ message: 'somewhere tropical', now: NOW });
    sendTravelMessage({ message: 'under six hours from Sydney', now: NOW });
    const base = sendTravelMessage({ message: 'quiet mid-range', now: NOW });
    expect(base.state.discovery?.recommendations.length).toBeGreaterThan(0);

    const closer = sendTravelMessage({ message: 'Somewhere closer', now: NOW });
    expect(closer.state.discovery?.criteria.characters).toContain('tropical');
    expect(closer.state.discovery?.criteria.originLabel).toBe('Sydney');
    expect(closer.state.discovery?.mode).toBe('active');

    const aus = sendTravelMessage({ message: 'Only within Australia', now: NOW });
    expect(aus.state.discovery?.criteria.regionBias).toBe('australia');
    expect(
      aus.state.discovery?.recommendations.every((r) =>
        ['Cairns', 'Hamilton Island', 'Noosa', 'Byron Bay', 'Gold Coast', 'Sydney', 'Melbourne', 'Hobart'].includes(
          r.placeName,
        ),
      ),
    ).toBe(true);
  });
});

describe('Destination discovery — acceptance scenarios', () => {
  it('Scenario B: tropical under six hours from Sydney keeps Sydney as origin', () => {
    const turn = sendTravelMessage({
      message: 'Find me somewhere tropical under six hours from Sydney.',
      now: NOW,
    });
    expect(turn.progression.objective).toBe('discover_destination');
    expect(turn.state.discovery?.criteria.characters).toContain('tropical');
    expect(turn.state.discovery?.criteria.originLabel).toBe('Sydney');
    expect(turn.state.discovery?.criteria.maxTravelHours).toBe(6);
    expect(turn.state.destination).toBeUndefined();
    expect(turn.state.origin?.value).toBe('Sydney');
  });

  it('Scenario C: quiet beach not Bali', () => {
    const turn = sendTravelMessage({
      message: 'I want a quiet beach holiday, not Bali.',
      now: NOW,
    });
    expect(turn.state.discovery?.criteria.characters).toEqual(
      expect.arrayContaining(['beach', 'relaxation']),
    );
    expect(turn.state.discovery?.criteria.vibe).toBe('quiet');
    expect(turn.state.discovery?.criteria.exclusions.map((e) => e.toLowerCase())).toContain('bali');
  });

  it('Scenario D: narrowing then accumulate', () => {
    const t1 = sendTravelMessage({ message: 'Somewhere tropical.', now: NOW });
    expect(t1.progression.conversationalStep.kind).toBe('ask_discovery_question');
    const t2 = sendTravelMessage({
      message: 'Four nights with my wife, mid-range.',
      now: NOW,
    });
    expect(t2.state.discovery?.criteria.characters).toContain('tropical');
    expect(t2.state.discovery?.criteria.durationNights).toBe(4);
    expect(t2.state.discovery?.criteria.travellerGroup).toBe('couple');
    expect(t2.state.discovery?.criteria.budgetLevel).toBe('mid_range');
    expect(t2.reply).not.toMatch(/Where would you like to travel\?/i);
  });
});

describe('Destination discovery — empty acknowledgements', () => {
  it('does not erase discovery or invent Thanks/Got it progress loops', () => {
    sendTravelMessage({ message: 'Find me somewhere tropical', now: NOW });
    const a = sendTravelMessage({ message: 'Thanks', now: NOW });
    expect(a.state.discovery?.mode).toBe('active');
    expect(a.state.discovery?.criteria.characters).toContain('tropical');
    expect(a.reply).not.toMatch(/^Thanks — what else should I know/i);
    expect(a.reply).not.toMatch(/^Got it — what would you like to do next/i);

    const b = sendTravelMessage({ message: 'Got it', now: NOW });
    expect(b.state.discovery?.criteria.characters).toContain('tropical');
    expect(b.reply).not.toMatch(/^Thanks — what else should I know/i);

    const c = sendTravelMessage({ message: 'Okay', now: NOW });
    expect(c.state.discovery?.mode).toBe('active');
  });
});

describe('Destination discovery — persistence', () => {
  it('survives localStorage reload', () => {
    sendTravelMessage({ message: 'Find me somewhere tropical', now: NOW });
    sendTravelMessage({ message: 'Under six hours from Sydney', now: NOW });
    sendTravelMessage({ message: 'Quiet, not Bali', now: NOW });
    const before = getTravelConversation();
    expect(before.discovery?.mode).toBe('active');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"schemaVersion":7');

    const snap = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    const reloaded = rehydrateTravelConversation();
    expect(reloaded.schemaVersion).toBe(7);
    expect(reloaded.discovery?.criteria.characters).toContain('tropical');
    expect(reloaded.discovery?.criteria.originLabel).toBe('Sydney');
    expect(reloaded.discovery?.criteria.exclusions.map((e: string) => e.toLowerCase())).toContain(
      'bali',
    );
  });
});

describe('Destination discovery — async entry parity', () => {
  it('sendTravelMessageAsync follows the same discovery path', async () => {
    const turn = await sendTravelMessageAsync({
      message: 'recommend somewhere tropical',
      now: NOW,
    });
    expect(turn.progression.objective).toBe('discover_destination');
    expect(turn.reply).not.toMatch(/Where would you like to travel\?/i);
  });
});

describe('Named-destination booking regression', () => {
  it('still books Melbourne without entering discovery', () => {
    const turn = sendTravelMessage({ message: 'i need to go melbourne', now: NOW });
    expect(turn.progression.objective).not.toBe('discover_destination');
    expect(turn.state.destination?.value).toBe('Melbourne');
    expect(turn.progression.nextRequiredField?.id).toBe('origin');
  });

  it('flights to Gold Coast still collect booking requirements', () => {
    const turn = sendTravelMessage({
      message: 'Flights to Gold Coast on 28 August',
      now: NOW,
    });
    expect(turn.state.destination?.value).toBe('Gold Coast');
    expect(turn.progression.objective).not.toBe('discover_destination');
  });
});

describe('processTravelTurn discovery wiring', () => {
  it('uses runConversationTurn via processTravelTurn', () => {
    const empty = createEmptyConversationState();
    setTravelConversation(empty);
    const turn = processTravelTurn({
      message: 'help me choose a destination',
      now: NOW,
      commit: true,
    });
    expect(turn.progression.runtimeEvidence.engineEntry).toBe('runConversationTurn');
    expect(turn.progression.objective).toBe('discover_destination');
  });
});
