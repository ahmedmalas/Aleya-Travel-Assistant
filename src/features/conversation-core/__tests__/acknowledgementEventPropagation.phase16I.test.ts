import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleConversationReplyPlan } from '../assembleConversationReplyPlan';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import type { ConversationAcknowledgementEvent } from '../conversationAcknowledgementEvent';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16I — propagate acknowledgementEvent through selection → components →
 * plan → conversational input without changing rendered wording.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;

function readCore(relativePath: string): string {
  return readFileSync(resolve(CORE_SRC, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16i',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function selectFor(
  previous: ConversationCoreState,
  next: ConversationCoreState,
) {
  const classification = classifyConversationStateChange(previous, next);
  const selected = selectConversationAcknowledgement(next, classification);
  const components = selectConversationReplyComponents({
    state: next,
    classification,
  });
  const plan = assembleConversationReplyPlan(components);
  const layerInput = buildConversationalLayerInput(plan);
  return { classification, selected, components, plan, layerInput };
}

function turn(
  state: ConversationCoreState,
  message: string,
  index: number,
  stateUpdate?: Parameters<typeof processConversationTurn>[0]['stateUpdate'],
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-16i-${index}`,
    assistantEntryId: `assistant-16i-${index}`,
    userMessageAt: new Date(
      `2026-07-29T00:${String(index).padStart(2, '0')}:00.000Z`,
    ),
    assistantMessageAt: new Date(
      `2026-07-29T00:${String(index).padStart(2, '0')}:01.000Z`,
    ),
    stateUpdate,
  });
}

describe('Phase 16I — acknowledgement event contract propagation', () => {
  it('emits field-set, field-changed, and field-removed for destination', () => {
    const empty = createState();
    const withCairns = { ...empty, destination: 'Cairns' };
    const withHobart = { ...withCairns, destination: 'Hobart' };
    const cleared = { ...withHobart, destination: null };

    expect(selectFor(empty, withCairns).selected).toEqual({
      text: ACKS.destination('Cairns'),
      event: { kind: 'field-set', field: 'destination' },
    });
    expect(selectFor(withCairns, withHobart).selected).toEqual({
      text: ACKS.destination('Hobart'),
      event: { kind: 'field-changed', field: 'destination' },
    });
    expect(selectFor(withHobart, cleared).selected).toEqual({
      text: ACKS.destinationRemoved,
      event: { kind: 'field-removed', field: 'destination' },
    });
  });

  it('distinguishes initial set and later change for origin, dates, and passengers', () => {
    const cases: Array<{
      field:
        | 'origin'
        | 'departureDate'
        | 'returnDate'
        | 'adultCount'
        | 'childCount'
        | 'infantCount';
      initial: ConversationCoreState;
      changed: ConversationCoreState;
      initialText: string;
      changedText: string;
    }> = [
      {
        field: 'origin',
        initial: createState({ origin: 'Sydney' }),
        changed: createState({ origin: 'Brisbane' }),
        initialText: ACKS.origin('Sydney'),
        changedText: ACKS.origin('Brisbane'),
      },
      {
        field: 'departureDate',
        initial: createState({ departureDate: '2026-08-28' }),
        changed: createState({ departureDate: '2026-08-30' }),
        initialText: ACKS.departureDate('2026-08-28'),
        changedText: ACKS.departureDate('2026-08-30'),
      },
      {
        field: 'returnDate',
        initial: createState({ returnDate: '2026-09-05' }),
        changed: createState({ returnDate: '2026-09-08' }),
        initialText: ACKS.returnDate('2026-09-05'),
        changedText: ACKS.returnDate('2026-09-08'),
      },
      {
        field: 'adultCount',
        initial: createState({ adultCount: 1 }),
        changed: createState({ adultCount: 3 }),
        initialText: ACKS.adultCount(1),
        changedText: ACKS.adultCount(3),
      },
      {
        field: 'childCount',
        initial: createState({ childCount: 1 }),
        changed: createState({ childCount: 2 }),
        initialText: ACKS.childCount(1),
        changedText: ACKS.childCount(2),
      },
      {
        field: 'infantCount',
        initial: createState({ infantCount: 1 }),
        changed: createState({ infantCount: 2 }),
        initialText: ACKS.infantCount(1),
        changedText: ACKS.infantCount(2),
      },
    ];

    for (const entry of cases) {
      const empty = createState();
      const set = selectFor(empty, entry.initial);
      expect(set.selected, entry.field).toEqual({
        text: entry.initialText,
        event: { kind: 'field-set', field: entry.field },
      });

      const change = selectFor(entry.initial, entry.changed);
      expect(change.selected, entry.field).toEqual({
        text: entry.changedText,
        event: { kind: 'field-changed', field: entry.field },
      });
    }
  });

  it('emits capability-enabled, capability-disabled, generic, and null', () => {
    const base = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
    });

    const enabled = selectFor(base, { ...base, flightsRequested: true });
    expect(enabled.selected).toEqual({
      text: ACKS.addedCapabilities('flights'),
      event: { kind: 'capability-enabled', capabilities: ['flights'] },
    });

    const withFlights = { ...base, flightsRequested: true };
    const disabled = selectFor(withFlights, {
      ...withFlights,
      flightsRequested: false,
    });
    expect(disabled.selected).toEqual({
      text: ACKS.removedCapabilities('flights'),
      event: { kind: 'capability-disabled', capabilities: ['flights'] },
    });

    const unchanged = selectFor(base, { ...base });
    expect(unchanged.selected).toBeNull();
    expect(unchanged.plan.acknowledgementEvent).toBeNull();
    expect(unchanged.layerInput.acknowledgementEvent).toBeNull();

    // Generic event propagates when selected (selector still owns the branch).
    expect(readCore('selectConversationAcknowledgement.ts')).toMatch(
      /kind: 'generic'/,
    );
    const genericComponents = {
      acknowledgement: ACKS.genericTravelFieldChange,
      acknowledgementEvent: { kind: 'generic' } as const,
      followUpQuestion: null,
      continuationPrompt: CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation,
      messageInterpreted: true,
    };
    const genericPlan = assembleConversationReplyPlan(genericComponents);
    expect(genericPlan.acknowledgementEvent).toEqual({ kind: 'generic' });
    expect(buildConversationalLayerInput(genericPlan).acknowledgementEvent).toEqual(
      { kind: 'generic' },
    );
    const _generic: ConversationAcknowledgementEvent = { kind: 'generic' };
    expect(_generic).toEqual({ kind: 'generic' });
  });

  it('shares one priority decision for acknowledgement text and event', () => {
    // Capability enable beats destination change.
    const previous = createState({
      destination: 'Cairns',
      flightsRequested: null,
    });
    const next = createState({
      destination: 'Hobart',
      flightsRequested: true,
    });
    const { selected, components, plan } = selectFor(previous, next);
    expect(selected?.text).toBe(ACKS.addedCapabilities('flights'));
    expect(selected?.event).toEqual({
      kind: 'capability-enabled',
      capabilities: ['flights'],
    });
    expect(components.acknowledgement).toBe(selected?.text ?? null);
    expect(components.acknowledgementEvent).toEqual(selected?.event ?? null);
    expect(plan.acknowledgements).toEqual([selected!.text]);
    expect(plan.acknowledgementEvent).toEqual(selected!.event);

    // Destination set beats origin set.
    const destWins = selectFor(createState(), createState({
      destination: 'Cairns',
      origin: 'Sydney',
    }));
    expect(destWins.selected).toEqual({
      text: ACKS.destination('Cairns'),
      event: { kind: 'field-set', field: 'destination' },
    });

    // Selector source still owns a single priority chain (Phase 16I note).
    const selectorSource = readCore('selectConversationAcknowledgement.ts');
    expect(selectorSource).toMatch(/Phase 16I/);
    expect(selectorSource).toMatch(/SelectedConversationAcknowledgement/);
  });

  it('propagates the event through components → plan → conversational input', () => {
    const { components, plan, layerInput } = selectFor(
      createState(),
      createState({ destination: 'Cairns' }),
    );

    expect(components.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'destination',
    });
    expect(plan.acknowledgementEvent).toBe(components.acknowledgementEvent);
    expect(layerInput.plan).toBe(plan);
    expect(layerInput.acknowledgementEvent).toBe(plan.acknowledgementEvent);
    expect(layerInput.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'destination',
    });

    // No trip state / classification / prior-reply fields on the layer input.
    expect(layerInput).not.toHaveProperty('state');
    expect(layerInput).not.toHaveProperty('previousState');
    expect(layerInput).not.toHaveProperty('classification');
    expect(layerInput).not.toHaveProperty('previousReply');
    expect(Object.keys(layerInput).sort()).toEqual(
      ['acknowledgementEvent', 'objective', 'plan'].sort(),
    );
  });

  it('lets the baseline renderer receive the event without changing output', () => {
    const setPlan = selectFor(
      createState(),
      createState({ destination: 'Cairns' }),
    ).plan;
    const changePlan = selectFor(
      createState({ destination: 'Cairns' }),
      createState({ destination: 'Hobart' }),
    ).plan;

    expect(setPlan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'destination',
    });
    expect(changePlan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });

    const setInput = buildConversationalLayerInput(setPlan);
    const changeInput = buildConversationalLayerInput(changePlan);
    expect(setInput.acknowledgementEvent).toEqual(setPlan.acknowledgementEvent);
    expect(changeInput.acknowledgementEvent).toEqual(
      changePlan.acknowledgementEvent,
    );

    const setWording = renderBaselineConversationalLayer(setInput).wording;
    const changeWording = renderBaselineConversationalLayer(changeInput).wording;
    expect(setWording).toBe(generateBaselineConversationalReply(setPlan));
    expect(changeWording).toBe(generateBaselineConversationalReply(changePlan));

    // Same family openers — event is present but unused by transform.
    expect(setWording.startsWith('Great, Cairns')).toBe(true);
    expect(changeWording.startsWith('Great, Hobart')).toBe(true);
    expect(transformBaselineAcknowledgement(ACKS.destination('Cairns'))).toBe(
      'Great, Cairns it is.',
    );
    expect(readCore('transformBaselineAcknowledgement.ts')).not.toMatch(
      /acknowledgementEvent/,
    );
  });

  it('preserves byte-identical production replies for representative turns', () => {
    let state = createState();
    const replies: string[] = [];

    const steps = [
      'go to Cairns',
      'from Sydney',
      'Depart on 28 August 2026',
      'Return on 5 September 2026',
      '2 adults',
      '1 child',
      '1 infant',
      'include flights',
    ];

    for (const [index, message] of steps.entries()) {
      const previous = structuredClone(state);
      const result = turn(state, message, index);
      const { plan, layerInput } = selectFor(previous, result.state);

      expect(result.reply).toBe(generateBaselineConversationalReply(plan));
      expect(layerInput.acknowledgementEvent).toBe(plan.acknowledgementEvent);
      expect(plan.acknowledgementEvent).not.toBeUndefined();
      replies.push(result.reply);
      state = result.state;
    }

    // Spot-check known Phase 16B/16D/16F wording remains.
    expect(replies[0]).toContain('Great, Cairns it is.');
    expect(replies[1]).toContain("We'll start from Sydney.");
    expect(replies[4]).toContain('Travelling with 2 adults.');
    expect(replies[5]).toContain("I've noted 1 child.");
    expect(replies[6]).toContain('That includes 1 infant.');

    // Deterministic fallback path still matches plan render.
    const fallbackPlan = selectFor(
      createState(),
      createState({ destination: 'Hobart' }),
    ).plan;
    expect(renderConversationReplyPlan(fallbackPlan)).toBe(
      `${ACKS.destination('Hobart')}\n${CONVERSATION_REPLY_CATALOGUE.followUps.origin}`,
    );
  });

  it('does not classify removals as field-changed', () => {
    for (const field of [
      'destination',
      'origin',
      'departureDate',
      'returnDate',
      'adultCount',
      'childCount',
      'infantCount',
    ] as const) {
      const storedValue =
        field === 'adultCount' || field === 'childCount' || field === 'infantCount'
          ? 2
          : field === 'departureDate' || field === 'returnDate'
            ? '2026-08-28'
            : 'Sydney';
      const previous = createState({ [field]: storedValue });
      const next = createState({ [field]: null });
      const { selected } = selectFor(previous, next);
      expect(selected?.event.kind, field).toBe('field-removed');
      expect(selected?.event).toEqual({ kind: 'field-removed', field });
    }
  });

  it('keeps transformBaselineAcknowledgement string-driven and catalogue wording unchanged', () => {
    expect(ACKS.destination('Cairns')).toBe('Great — Cairns.');
    expect(ACKS.adultCount(2)).toBe('Perfect — 2 adults travelling.');
    expect(readCore('transformBaselineAcknowledgement.ts')).toMatch(
      /export function transformBaselineAcknowledgement\(\s*acknowledgement: string,\s*\): string/,
    );
    expect(readCore('renderBaselineAcknowledgementNeutralContinuation.ts')).not.toMatch(
      /acknowledgementEvent/,
    );
    expect(readCore('renderBaselineAcknowledgementFollowUp.ts')).not.toMatch(
      /acknowledgementEvent/,
    );
  });
});
