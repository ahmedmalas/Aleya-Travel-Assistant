/**
 * Engine Consolidation — shared Semantic Interpretation ownership.
 * Proves governed path uses interpretSemanticMeaning once (not a second SI).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialConversationCoreState } from '../../conversation-core';
import { interpretSemanticMeaning } from '../../conversation-interpretation/interpretSemanticMeaning';
import { interpretDiagnosticSemantic } from '../interpretDiagnosticSemantic';
import { runArchitecturePipeline } from '../runArchitecturePipeline';

const NOW = new Date('2026-08-05T00:00:00.000Z');
const ROOT = resolve(__dirname, '../../../..');

describe('Engine Consolidation — Semantic Interpretation ownership', () => {
  it('interpretDiagnosticSemantic is an alias of interpretSemanticMeaning', () => {
    const state = createInitialConversationCoreState({
      conversationId: 'si-alias',
      now: NOW,
    });
    const a = interpretSemanticMeaning({
      message: 'I want to go Melbourne',
      currentState: state,
      now: NOW,
    });
    const b = interpretDiagnosticSemantic({
      message: 'I want to go Melbourne',
      currentState: state,
      now: NOW,
    });
    expect(b).toEqual(a);
    expect(a.deltas.some((d) => d.kind === 'mention_place')).toBe(true);
    const dest = a.deltas.find((d) => d.kind === 'mention_place');
    expect(dest?.value).toMatchObject({ roleHint: 'destination' });
  });

  it('destination travel frame commits via roleHint — not vacancy residual', () => {
    const state = createInitialConversationCoreState({
      conversationId: 'role-hint',
      now: NOW,
    });
    const pipe = runArchitecturePipeline({
      message: 'I want to go Melbourne',
      currentState: state,
      now: NOW,
    });
    expect(
      pipe.planner.operations.some(
        (o) =>
          o.op === 'set_destinations' &&
          o.reasoningTrace.some((t) => /roleHint=destination/i.test(t)),
      ),
    ).toBe(true);
    expect(
      pipe.planner.operations.every(
        (o) => !o.reasoningTrace.some((t) => /Residual empty-slot/i.test(t)),
      ),
    ).toBe(true);
    expect(pipe.committed.state.destination).toBe('Melbourne');
  });

  it('untyped bare place without obligation refuses vacancy add_destination', () => {
    const state = {
      ...createInitialConversationCoreState({
        conversationId: 'untyped',
        now: NOW,
      }),
      origin: 'Sydney',
      destination: 'Melbourne',
      destinationStops: ['Melbourne'],
      departureDate: '2026-12-01',
      returnDate: '2026-12-10',
    };
    const pipe = runArchitecturePipeline({
      message: 'Bangkok',
      currentState: state,
      now: NOW,
    });
    expect(
      pipe.planner.operations.every((o) => o.op !== 'add_destination'),
    ).toBe(true);
    expect(
      pipe.planner.operations.some(
        (o) =>
          o.op === 'no_state_change' &&
          o.reasoningTrace.some((t) => /refusing vacancy/i.test(t)),
      ),
    ).toBe(true);
    expect(pipe.committed.state.destinationStops).toEqual(['Melbourne']);
  });

  it('AiPlanningPanel and ConciergePlanPanel both enter via runConsultantTurn', () => {
    const ai = readFileSync(
      resolve(ROOT, 'src/components/trip-platform/AiPlanningPanel.tsx'),
      'utf8',
    );
    const concierge = readFileSync(
      resolve(ROOT, 'src/components/trip-platform/ConciergePlanPanel.tsx'),
      'utf8',
    );
    expect(ai).toMatch(/runConsultantTurn\(/);
    expect(concierge).toMatch(/runConsultantTurn\(/);
    expect(concierge).not.toMatch(/processConversationTurn\(/);
  });

  it('runConsultantTurn has one SI and no legacy ITU / chooseConsultantAct fork', () => {
    const source = readFileSync(
      resolve(ROOT, 'src/features/conversation-consultant/runConsultantTurn.ts'),
      'utf8',
    );
    expect(source).toMatch(/interpretSemanticMeaning\(/);
    expect(source).toMatch(/runArchitecturePipeline\(/);
    expect(source).toMatch(/situationFromSemantic\(/);
    expect(source).not.toMatch(/interpretTravelUtterance\(/);
    expect(source).not.toMatch(/chooseConsultantAct\(/);
    expect(source).not.toMatch(/runDualPathComparisonBundle\(/);
    expect(source).not.toMatch(/commitUnambiguousFacts\(/);
    expect(source).not.toMatch(/renderConsultantReply\(/);
  });
});
