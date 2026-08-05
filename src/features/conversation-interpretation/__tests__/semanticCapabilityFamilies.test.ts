/**
 * General SI capability families — travel relations + conversational control.
 * Proves semantic-equivalent classes, not one transcript / city / phrase lock.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialConversationCoreState } from '../../conversation-core';
import { runArchitecturePipeline } from '../../conversation-architecture/runArchitecturePipeline';
import { interpretSemanticMeaning } from '../interpretSemanticMeaning';

const NOW = new Date('2026-08-05T12:00:00.000Z');
const ROOT = resolve(__dirname, '../../../..');

function state(overrides: Record<string, unknown> = {}) {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'si-capabilities',
      now: NOW,
    }),
    status: 'active' as const,
    origin: 'Sydney',
    destination: 'Lebanon',
    destinationStops: ['Lebanon'],
    departureDate: '2026-12-18',
    returnDate: '2027-01-26',
    ...overrides,
  };
}

describe('SI travel-relation capability family', () => {
  it('routing through a place → relation_routing_ambiguous (unresolved transit/stopover)', () => {
    const semantic = interpretSemanticMeaning({
      message: 'I need the journey routed through Doha',
      currentState: state(),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'relation_routing_ambiguous'),
    ).toBe(true);
    const delta = semantic.deltas.find(
      (d) => d.kind === 'relation_routing_ambiguous',
    )!;
    expect(delta.entities[0]?.resolvedHint ?? delta.entities[0]?.surface).toBe(
      'Doha',
    );
    expect(delta.value).toMatchObject({
      relationFamily: 'routing_or_stopover_unresolved',
    });
    expect(semantic.deltas.every((d) => d.kind !== 'mention_place')).toBe(true);
  });

  it('avoiding a place → relation_avoid_place', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Please avoid flying through Dubai',
      currentState: state(),
      now: NOW,
    });
    expect(semantic.deltas.some((d) => d.kind === 'relation_avoid_place')).toBe(
      true,
    );
    expect(
      semantic.deltas.find((d) => d.kind === 'relation_avoid_place')?.entities[0]
        ?.resolvedHint,
    ).toBe('Dubai');
  });

  it('preferring a hub → relation_prefer_hub', () => {
    const semantic = interpretSemanticMeaning({
      message: 'I prefer connecting via Singapore',
      currentState: state(),
      now: NOW,
    });
    expect(semantic.deltas.some((d) => d.kind === 'relation_prefer_hub')).toBe(
      true,
    );
  });

  it('adding an actual stop → relation_itinerary_stop', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Also visit Melbourne on the way',
      currentState: state(),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'relation_itinerary_stop'),
    ).toBe(true);
  });

  it('transit-only lexicon → relation_transit', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Just a transit connection in Bangkok',
      currentState: state(),
      now: NOW,
    });
    expect(semantic.deltas.some((d) => d.kind === 'relation_transit')).toBe(
      true,
    );
    expect(
      semantic.deltas.every((d) => d.kind !== 'relation_stopover'),
    ).toBe(true);
  });

  it('stopover with stay cue → relation_stopover', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Stopover in Bangkok for two nights',
      currentState: state(),
      now: NOW,
    });
    expect(semantic.deltas.some((d) => d.kind === 'relation_stopover')).toBe(
      true,
    );
  });

  it('transit vs stopover ambiguity remains unresolved when cues conflict', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Transit layover stopover stay in Doha',
      currentState: state(),
      now: NOW,
    });
    const ambiguous = semantic.deltas.find(
      (d) => d.kind === 'relation_routing_ambiguous',
    );
    expect(ambiguous).toBeTruthy();
    expect(ambiguous?.value).toMatchObject({
      unresolvedBetween: expect.arrayContaining(['transit', 'stopover']),
    });
  });

  it('comparison / optimisation intent → relation_compare_optimise', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Find the cheapest routing option',
      currentState: state(),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'relation_compare_optimise'),
    ).toBe(true);
    expect(
      semantic.deltas.find((d) => d.kind === 'relation_compare_optimise')?.value,
    ).toMatchObject({ optimisationAxis: 'cheapest' });
  });
});

describe('SI conversational-control capability family', () => {
  it('finishing information gathering → control_information_complete (no search flag)', () => {
    const semantic = interpretSemanticMeaning({
      message: 'nothing else to add',
      currentState: state(),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'control_information_complete'),
    ).toBe(true);
    expect(semantic.conversationalControl).toBe('information_complete');
    expect(
      semantic.deltas.find((d) => d.kind === 'control_information_complete')
        ?.value,
    ).toMatchObject({ executesSearch: false });
  });

  it('requesting a summary → control_request_summary', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Can you summarise what you have so far?',
      currentState: state(),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'control_request_summary'),
    ).toBe(true);
    expect(semantic.conversationalControl).toBe('request_summary');
  });

  it('readiness to continue → control_ready_to_proceed (does not execute search)', () => {
    const semantic = interpretSemanticMeaning({
      message: 'Ready to search whenever you are',
      currentState: state(),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'control_ready_to_proceed'),
    ).toBe(true);
    expect(
      semantic.deltas.find((d) => d.kind === 'control_ready_to_proceed')?.value,
    ).toMatchObject({ executesSearch: false });
  });

  it('declining further questions → control_decline_further', () => {
    const semantic = interpretSemanticMeaning({
      message: "Don't ask me any more questions",
      currentState: state(),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'control_decline_further'),
    ).toBe(true);
  });

  it('confirm / reject plan → control_confirm_plan / control_reject_plan', () => {
    const confirm = interpretSemanticMeaning({
      message: 'confirm the plan',
      currentState: state(),
      now: NOW,
    });
    expect(confirm.deltas.some((d) => d.kind === 'control_confirm_plan')).toBe(
      true,
    );
    const reject = interpretSemanticMeaning({
      message: "that's wrong — not what I want",
      currentState: state(),
      now: NOW,
    });
    expect(reject.deltas.some((d) => d.kind === 'control_reject_plan')).toBe(
      true,
    );
  });

  it('completion combined with another clear fact keeps both meanings', () => {
    const semantic = interpretSemanticMeaning({
      message: "that's all — departing on the 18th of December",
      currentState: state({ departureDate: null }),
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'control_information_complete'),
    ).toBe(true);
    expect(semantic.deltas.some((d) => d.kind === 'set_date')).toBe(true);
  });
});

describe('Physical-failure eight-layer traces (SI first-fail repaired; no write ownership)', () => {
  it('via Bangkok: SI emits routing-ambiguous relation; Committer does not invent a stop', () => {
    const prior = state();
    const semantic = interpretSemanticMeaning({
      message: 'i need it be via bangkok',
      currentState: prior,
      now: NOW,
    });
    expect(
      semantic.deltas.some((d) => d.kind === 'relation_routing_ambiguous'),
    ).toBe(true);
    expect(
      semantic.deltas.find((d) => d.kind === 'relation_routing_ambiguous')
        ?.entities[0]?.resolvedHint,
    ).toBe('Bangkok');
    expect(semantic.deltas.every((d) => d.kind !== 'mention_place')).toBe(true);

    const pipe = runArchitecturePipeline({
      message: 'i need it be via bangkok',
      currentState: prior,
      semantic,
      now: NOW,
    });
    expect(pipe.semantic).toEqual(semantic);
    expect(pipe.contributions.some((c) => c.valueClasses.includes('PlaceLike'))).toBe(
      true,
    );
    // Planner/Committer must not silently add Bangkok as destination (SI-only phase).
    expect(pipe.committed.state.destinationStops).toEqual(['Lebanon']);
    expect(pipe.committed.state.origin).toBe('Sydney');
    expect(pipe.committed.state.searchExecutionRequested).toBeNull();
  });

  it('thats all: SI emits information_complete; Committer does not execute search', () => {
    const prior = state();
    const semantic = interpretSemanticMeaning({
      message: 'thats all',
      currentState: prior,
      now: NOW,
    });
    expect(semantic.conversationalControl).toBe('information_complete');
    expect(
      semantic.deltas.some((d) => d.kind === 'control_information_complete'),
    ).toBe(true);
    expect(
      semantic.deltas.find((d) => d.kind === 'control_information_complete')
        ?.value,
    ).toMatchObject({ executesSearch: false });

    const pipe = runArchitecturePipeline({
      message: 'thats all',
      currentState: prior,
      semantic,
      now: NOW,
    });
    expect(pipe.committed.state.searchExecutionRequested).toBeNull();
    expect(pipe.committed.state.conversationComplete).toBeNull();
    expect(pipe.committed.state.origin).toBe('Sydney');
  });
});

describe('No transcript / city / phrase-patch ownership', () => {
  it('SI modules do not hard-lock Bangkok or the physical transcript sentences', () => {
    const si = readFileSync(
      resolve(ROOT, 'src/features/conversation-interpretation/interpretSemanticMeaning.ts'),
      'utf8',
    );
    const relations = readFileSync(
      resolve(ROOT, 'src/features/conversation-interpretation/travelRelationSemantics.ts'),
      'utf8',
    );
    const control = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-interpretation/conversationalControlSemantics.ts',
      ),
      'utf8',
    );
    for (const source of [si, relations, control]) {
      expect(source).not.toMatch(/Bangkok/);
      expect(source).not.toMatch(/i need it be via/);
      expect(source).not.toMatch(/Lebanon/);
      expect(source).not.toMatch(/thats all/);
    }
  });

  it('runConsultantTurn still uses one SI owner', () => {
    const source = readFileSync(
      resolve(ROOT, 'src/features/conversation-consultant/runConsultantTurn.ts'),
      'utf8',
    );
    expect(source).toMatch(/interpretSemanticMeaning\(/);
    expect(source).not.toMatch(/interpretTravelUtterance\(/);
  });
});
