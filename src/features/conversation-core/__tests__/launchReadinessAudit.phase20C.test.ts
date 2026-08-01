import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import * as baselineModule from '../generateBaselineConversationalReply';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import {
  generateConversationReply,
  renderConversationReplyPlan,
} from '../generateConversationReply';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { renderIntegratedConversationReplyPlan } from '../renderIntegratedConversationReplyPlan';
import { expectedActivatedBaselineReply } from './expectedActivatedBaselineReply';

/**
 * Phase 20C — final launch-readiness audit (validation only).
 *
 * Proves end-to-end journeys, launch invariants, repository hygiene locks, and
 * the frozen integration seam. Does not change production behaviour.
 */

const ROOT = process.cwd();
const CORE = resolve(ROOT, 'src/features/conversation-core');
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const SELECTABLE_QUESTIONS = Object.values(FOLLOW_UPS);
const ADULT_Q = FOLLOW_UPS.flightsAdultCount;
const GUEST_Q = FOLLOW_UPS.accommodationGuestCount;
const CHILD_Q = FOLLOW_UPS.childCount;
const INFANT_Q = FOLLOW_UPS.infantCount;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const RESTAURANTS_Q = FOLLOW_UPS.restaurants;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-20c',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  stateUpdate?: ConversationStateUpdate,
) {
  const previousSnapshot = structuredClone(state);
  const result = processConversationTurn({
    message,
    state,
    userEntryId: `user-20c-${index}`,
    assistantEntryId: `assistant-20c-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 6, 29, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 6, 29, 0, 0, index * 2 + 1)),
    ...(stateUpdate ? { stateUpdate } : {}),
  });
  const classification = classifyConversationStateChange(state, result.state);
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return {
    previous: state,
    previousSnapshot,
    result,
    classification,
    plan,
    expected: expectedActivatedBaselineReply(plan),
  };
}

function assertLaunchInvariants(t: ReturnType<typeof turn>): void {
  // One reply, one plan, activated baseline parity.
  expect(typeof t.result.reply).toBe('string');
  expect(t.result.reply.length).toBeGreaterThan(0);
  expect(t.plan.acknowledgements.length).toBeLessThanOrEqual(1);
  expect(t.result.reply).toBe(t.expected);
  expect(t.result.reply).toBe(
    renderIntegratedConversationReplyPlan({ plan: t.plan }),
  );
  expect(t.result.reply).toBe(
    generateConversationReply({
      message: 'ignored',
      state: t.result.state,
      previousState: t.previous,
    }),
  );

  // No duplicate selectable catalogue question.
  const questionHits = SELECTABLE_QUESTIONS.filter((q) =>
    t.result.reply.includes(q),
  );
  expect(questionHits.length).toBeLessThanOrEqual(1);

  // Question-mark budget.
  // Progression / unsupported / capability replies: ≤1 '?'.
  // Phase 16B field-set/generic acknowledgement+neutral bridges intentionally
  // insert "Is there anything else you'd like me to consider?" before the
  // canonical neutral, producing exactly two '?' characters. That frozen
  // expression shape is accepted; it is not a second selectable catalogue ask.
  const questionMarkCount = (t.result.reply.match(/\?/g) ?? []).length;
  const isPhase16BAckNeutralBridge =
    t.plan.acknowledgements.length === 1 &&
    t.plan.followUpQuestion === NEUTRAL &&
    t.result.reply.includes("Is there anything else you'd like me to consider?") &&
    t.result.reply.includes(NEUTRAL);
  if (isPhase16BAckNeutralBridge) {
    expect(questionMarkCount).toBe(2);
  } else {
    expect(questionMarkCount).toBeLessThanOrEqual(1);
  }

  // State mutation completes before expression; previous input unchanged.
  expect(t.previous).toEqual(t.previousSnapshot);

  // Expression purity: re-render does not mutate plan or travel fields.
  const planBefore = structuredClone(t.plan);
  const travelBefore = {
    destination: t.result.state.destination,
    origin: t.result.state.origin,
    adultCount: t.result.state.adultCount,
    childCount: t.result.state.childCount,
    infantCount: t.result.state.infantCount,
    flightsRequested: t.result.state.flightsRequested,
    accommodationRequested: t.result.state.accommodationRequested,
    restaurantPreference: t.result.state.restaurantPreference,
  };
  expect(generateBaselineConversationalReply(t.plan)).toBe(t.result.reply);
  expect(t.plan).toEqual(planBefore);
  expect({
    destination: t.result.state.destination,
    origin: t.result.state.origin,
    adultCount: t.result.state.adultCount,
    childCount: t.result.state.childCount,
    infantCount: t.result.state.infantCount,
    flightsRequested: t.result.state.flightsRequested,
    accommodationRequested: t.result.state.accommodationRequested,
    restaurantPreference: t.result.state.restaurantPreference,
  }).toEqual(travelBefore);

  // Interpreted status + transcript sequencing.
  expect(t.result.trace.messageInterpreted).toBe(
    t.classification.hasInterpretedChange,
  );
  expect(t.result.trace.turnCount).toBe(t.previous.turnCount + 1);
  const transcript = t.result.state.transcript;
  expect(transcript.length).toBe(t.previous.transcript.length + 2);
  expect(transcript.at(-2)?.role).toBe('user');
  expect(transcript.at(-1)?.role).toBe('assistant');
  expect(transcript.at(-1)?.message).toBe(t.result.reply);
}

describe('Phase 20C — final launch-readiness audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('locks frozen production architecture and hygiene gates', () => {
    const processTurn = readSrc(
      'src/features/conversation-core/processTurn.ts',
    );
    const generate = readSrc(
      'src/features/conversation-core/generateConversationReply.ts',
    );
    const seam = readSrc(
      'src/features/conversation-core/renderIntegratedConversationReplyPlan.ts',
    );
    const modeDriven = readSrc(
      'src/features/conversation-core/renderConversationReplyPlanByIntegrationMode.ts',
    );
    const types = readSrc('src/features/conversation-core/types.ts');
    const index = readSrc('src/features/conversation-core/index.ts');
    const auditDoc = readSrc(
      'docs/conversation-engine/phase20C-final-launch-readiness-audit.md',
    );

    expect(processTurn).toMatch(/generateIntegratedConversationReply\(/);
    expect(generate).toMatch(/renderIntegratedConversationReplyPlan\(/);
    expect(seam).toMatch(
      /const mode: ConversationReplyPlanIntegrationMode =\s*'baseline-conversational'/,
    );
    expect(modeDriven).toMatch(
      /case 'baseline-conversational':\s*try \{\s*return generateBaselineConversationalReply\(input\.plan\);\s*\} catch \{\s*return renderConversationReplyPlan\(input\.plan\);\s*\}/,
    );

    expect(types).not.toMatch(/eventsRequested:\s*boolean \| null/);
    expect(types).not.toMatch(/guestCount:\s*/);
    expect(types).toMatch(/eventsFestivalsRequested:\s*boolean \| null/);
    expect(types).toMatch(/adultCount:\s*number \| null/);

    expect(index).toMatch(/processConversationTurn/);
    expect(index).not.toMatch(/generateConversationReply/);
    expect(index).not.toMatch(/generateBaselineConversationalReply/);
    expect(index).not.toMatch(/renderIntegratedConversationReplyPlan/);

    expect(processTurn).not.toMatch(/generateBaselineConversationalReply/);
    expect(processTurn).not.toMatch(/buildConversationalLayerInput/);
    expect(processTurn).not.toMatch(/invokeConversationalLayerRenderer/);
    expect(generate).not.toMatch(/generateBaselineConversationalReply/);

    expect(auditDoc).toContain('Phase 20C');
    expect(auditDoc).toContain('launch-readiness');
  });

  it('proves repository hygiene: no skipped/focused tests, no production TODO/FIXME, dist untracked', () => {
    const testFiles = readdirSync(resolve(CORE, '__tests__')).filter((n) =>
      n.endsWith('.test.ts'),
    );
    for (const name of testFiles) {
      const source = readFileSync(resolve(CORE, '__tests__', name), 'utf8');
      expect(source, name).not.toMatch(/\bit\.only\b|\bdescribe\.only\b|\btest\.only\b/);
      expect(source, name).not.toMatch(/\bit\.skip\b|\bdescribe\.skip\b|\btest\.skip\b/);
    }

    const productionModules = readdirSync(CORE).filter(
      (n) => n.endsWith('.ts') && !n.startsWith('.'),
    );
    for (const name of productionModules) {
      const source = readFileSync(resolve(CORE, name), 'utf8');
      expect(source, name).not.toMatch(/\bTODO\b|\bFIXME\b/);
    }

    const gitignore = readSrc('.gitignore');
    expect(gitignore).toMatch(/^dist\/?$/m);
    expect(readFileSync(resolve(ROOT, '.gitignore'), 'utf8')).toContain('dist');
  });

  it('1–4: flights / accommodation / combined / car-hire journeys preserve invariants', () => {
    // Flights only — use explicit extraction cues accepted by production extractors.
    let s = createState();
    let t = turn('Go to Cairns', s, 0);
    assertLaunchInvariants(t);
    expect(t.result.state.destination).toBe('Cairns');
    s = t.result.state;
    t = turn('Fly from Sydney', s, 1);
    assertLaunchInvariants(t);
    expect(t.result.state.origin).toBe('Sydney');
    s = t.result.state;
    t = turn('Depart on 28 August 2026', s, 2);
    assertLaunchInvariants(t);
    s = t.result.state;
    t = turn('Return on 1 September 2026', s, 3);
    assertLaunchInvariants(t);
    s = t.result.state;
    t = turn('book flights', s, 4);
    assertLaunchInvariants(t);
    expect(t.result.state.flightsRequested).toBe(true);
    expect(t.result.reply).toContain(ADULT_Q);
    s = t.result.state;
    t = turn('2 adults', s, 5);
    assertLaunchInvariants(t);
    expect(t.result.state.adultCount).toBe(2);
    expect(t.result.reply).toContain(CHILD_Q);

    // Accommodation only
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
    });
    t = turn('book a hotel', s, 10);
    assertLaunchInvariants(t);
    expect(t.result.state.accommodationRequested).toBe(true);
    expect(t.result.reply).toContain(GUEST_Q);
    s = t.result.state;
    t = turn('2 guests', s, 11);
    assertLaunchInvariants(t);
    expect(t.result.state.adultCount).toBe(2);

    // Flights + accommodation
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
    });
    t = turn('book flights', s, 20);
    assertLaunchInvariants(t);
    s = t.result.state;
    t = turn('book a hotel', s, 21);
    assertLaunchInvariants(t);
    expect(t.result.state.flightsRequested).toBe(true);
    expect(t.result.state.accommodationRequested).toBe(true);
    expect(t.result.reply).toContain(ADULT_Q);
    expect(t.result.reply).not.toContain(GUEST_Q);

    // Flights + accommodation + car hire
    s = t.result.state;
    t = turn('book car hire', s, 22);
    assertLaunchInvariants(t);
    expect(t.result.state.carHireRequested).toBe(true);
    expect(t.result.reply).toContain(ADULT_Q);
  });

  it('5–11: activities/restaurants, passengers, bare/guest/multi/zero journeys', () => {
    // Destination / origin / dates already covered; continue passenger matrix.
    let s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      flightsRequested: true,
      adultCount: null,
    });
    let t = turn('2', s, 0);
    assertLaunchInvariants(t);
    expect(t.result.state.adultCount).toBe(2);
    expect(t.result.reply).toContain(CHILD_Q);

    s = t.result.state;
    t = turn('0 children', s, 1);
    assertLaunchInvariants(t);
    expect(t.result.state.childCount).toBe(0);
    expect(t.result.reply).toContain(INFANT_Q);

    s = t.result.state;
    t = turn('0', s, 2);
    assertLaunchInvariants(t);
    expect(t.result.state.infantCount).toBe(0);

    // Multi-passenger from null passengers
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      flightsRequested: true,
    });
    t = turn('2 adults, 1 child and 1 infant', s, 10);
    assertLaunchInvariants(t);
    expect(t.result.state.adultCount).toBe(2);
    expect(t.result.state.childCount).toBe(1);
    expect(t.result.state.infantCount).toBe(1);

    // Explicit guest (accommodation)
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      accommodationRequested: true,
    });
    t = turn('There will be 2 guests', s, 20);
    assertLaunchInvariants(t);
    expect(t.result.state.adultCount).toBe(2);

    // Activities + restaurants progression
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
    });
    t = turn('book activities', s, 30);
    assertLaunchInvariants(t);
    expect(t.result.state.activitiesRequested).toBe(true);
    expect(t.result.reply).toContain(ACTIVITIES_Q);
    s = t.result.state;
    t = turn('add beaches', s, 31);
    assertLaunchInvariants(t);
    expect(t.result.state.beachesRequested).toBe(true);
    s = t.result.state;
    t = turn('find restaurants', s, 32);
    assertLaunchInvariants(t);
    expect(t.result.state.restaurantsRequested).toBe(true);
    expect(t.result.reply).toContain(RESTAURANTS_Q);
    s = t.result.state;
    t = turn('Italian', s, 33);
    assertLaunchInvariants(t);
    expect(t.result.state.restaurantPreference).toBe('Italian');
  });

  it('12–17: capability toggle, field change/removal, unsupported, neutral, re-request', () => {
    let s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
    });
    let t = turn('book flights', s, 0);
    assertLaunchInvariants(t);
    expect(t.result.state.flightsRequested).toBe(true);

    // Capability disable via trusted stateUpdate (explicit boundary).
    s = t.result.state;
    t = turn('Hello', s, 1, { flightsRequested: false });
    assertLaunchInvariants(t);
    expect(t.result.state.flightsRequested).toBe(false);

    // Field change
    s = createState({ destination: 'Cairns' });
    t = turn('Go to Brisbane', s, 10);
    assertLaunchInvariants(t);
    expect(t.result.state.destination).toBe('Brisbane');
    expect(t.classification.hasInterpretedChange).toBe(true);

    // Field removal
    s = t.result.state;
    t = turn('Hello', s, 11, { destination: null });
    assertLaunchInvariants(t);
    expect(t.result.state.destination).toBeNull();

    // Unsupported during passenger question — state preserved, question remains
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      flightsRequested: true,
      adultCount: null,
    });
    const before = structuredClone(s);
    t = turn('asdf qwerty nonsense', s, 20);
    assertLaunchInvariants(t);
    expect(t.result.state.adultCount).toBeNull();
    expect(t.result.state.destination).toBe(before.destination);
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.result.reply).toContain(ADULT_Q);

    // Neutral continuation after passengers complete
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      flightsRequested: true,
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
    });
    t = turn('thanks', s, 30);
    assertLaunchInvariants(t);
    expect(t.result.reply).toContain(NEUTRAL);

    // Activities re-request after interest already set — no blocking corruption
    s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      activitiesRequested: true,
      beachesRequested: true,
    });
    t = turn('book activities', s, 40);
    assertLaunchInvariants(t);
    expect(t.result.state.beachesRequested).toBe(true);
    expect(t.result.state.activitiesRequested).toBe(true);
  });

  it('18–20: conversational acknowledgement wording, fallback, transcript sequencing', () => {
    const s = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-01',
    });
    const t = turn('book flights', s, 0);
    assertLaunchInvariants(t);
    expect(t.result.state.flightsRequested).toBe(true);
    expect(t.plan.acknowledgements.length).toBe(1);
    // Conversational expression transforms catalogue ack wording for eligible plans.
    expect(t.result.reply).toBe(t.expected);
    expect(t.result.reply).toMatch(/flights/i);
    expect(t.result.reply).not.toBe(renderConversationReplyPlan(t.plan));

    // Fallback after baseline throw
    vi.spyOn(
      baselineModule,
      'generateBaselineConversationalReply',
    ).mockImplementation(() => {
      throw new Error('baseline unavailable');
    });
    const fallback = renderIntegratedConversationReplyPlan({ plan: t.plan });
    expect(fallback).toBe(renderConversationReplyPlan(t.plan));

    // Multi-turn transcript order remains user/assistant pairs
    vi.restoreAllMocks();
    let state = createState();
    const first = turn('Go to Cairns', state, 10);
    assertLaunchInvariants(first);
    expect(first.result.state.destination).toBe('Cairns');
    state = first.result.state;
    const second = turn('Fly from Sydney', state, 11);
    assertLaunchInvariants(second);
    expect(second.result.state.origin).toBe('Sydney');
    const roles = second.result.state.transcript.map((e) => e.role);
    expect(roles).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('proves passenger service gating and no deprecated field leakage on journeys', () => {
    // Out of service context: multi-passenger ignored
    const gated = turn(
      '2 adults and 1 child',
      createState({
        destination: 'Cairns',
        origin: 'Sydney',
        departureDate: '2026-08-28',
        returnDate: '2026-09-01',
      }),
      0,
    );
    assertLaunchInvariants(gated);
    expect(gated.result.state.adultCount).toBeNull();
    expect(gated.result.state.childCount).toBeNull();

    // No deprecated fields on state
    expect(gated.result.state).not.toHaveProperty('eventsRequested');
    expect(gated.result.state).not.toHaveProperty('guestCount');
  });
});
