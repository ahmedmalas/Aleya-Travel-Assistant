import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import type { ConversationAcknowledgementEvent } from '../conversationAcknowledgementEvent';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import { generateBaselineConversationalReply } from '../generateBaselineConversationalReply';
import { renderBaselineConversationalLayer } from '../renderBaselineConversationalLayer';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16J — event-aware set-versus-changed acknowledgement wording.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const BRIDGE_FIELD =
  "Is there anything else you'd like me to consider?";
const NEUTRAL = 'What else should I know about your trip?';

function readCore(relativePath: string): string {
  return readFileSync(resolve(CORE_SRC, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16j',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(
  state: ConversationCoreState,
  message: string,
  index: number,
) {
  const previous = structuredClone(state);
  const result = processConversationTurn({
    message,
    state,
    userEntryId: `user-16j-${index}`,
    assistantEntryId: `assistant-16j-${index}`,
    userMessageAt: new Date(
      `2026-07-29T00:${String(index).padStart(2, '0')}:00.000Z`,
    ),
    assistantMessageAt: new Date(
      `2026-07-29T00:${String(index).padStart(2, '0')}:01.000Z`,
    ),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const plan = createConversationReplyPlan({
    state: result.state,
    classification,
  });
  return { previous, result, plan, classification };
}

function opener(rendered: string): string {
  if (rendered.startsWith('Updated —')) return 'Updated —';
  if (rendered.startsWith('Great,')) return 'Great,';
  if (rendered.startsWith("We'll start")) return "We'll start";
  if (rendered.startsWith("We'll depart")) return "We'll depart";
  if (rendered.startsWith('Departure is now set')) return 'Departure is now set';
  if (rendered.startsWith('Departure is set')) return 'Departure is set';
  if (rendered.startsWith('Return is now set')) return 'Return is now set';
  if (rendered.startsWith('Return is set')) return 'Return is set';
  if (rendered.startsWith('Travelling with')) return 'Travelling with';
  if (rendered.startsWith('Updated to')) return 'Updated to';
  if (rendered.startsWith("I've noted")) return "I've noted";
  if (rendered.startsWith('That includes')) return 'That includes';
  return rendered.split(/[\s.]/)[0] ?? rendered;
}

function ackOnly(rendered: string): string {
  // Strip follow-up / bridge / neutral for opener measurements.
  const bridgeIdx = rendered.indexOf(` ${BRIDGE_FIELD} `);
  if (bridgeIdx >= 0) return rendered.slice(0, bridgeIdx);
  const neutralIdx = rendered.indexOf(`\n${NEUTRAL}`);
  if (neutralIdx >= 0) return rendered.slice(0, neutralIdx);
  const spaceFollowUp = rendered.indexOf(' Where ');
  if (spaceFollowUp >= 0) return rendered.slice(0, spaceFollowUp);
  const whenIdx = rendered.indexOf(' When ');
  if (whenIdx >= 0) return rendered.slice(0, whenIdx);
  const howIdx = rendered.indexOf(' How ');
  if (howIdx >= 0) return rendered.slice(0, howIdx);
  const whatIdx = rendered.indexOf(' What ');
  if (whatIdx >= 0) return rendered.slice(0, whatIdx);
  return rendered;
}

describe('Phase 16J — event-aware acknowledgement wording', () => {
  it('retains Phase 16F wording for all seven field-set families', () => {
    const set: ConversationAcknowledgementEvent = {
      kind: 'field-set',
      field: 'destination',
    };
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Cairns'), set),
    ).toBe('Great, Cairns it is.');
    expect(
      transformBaselineAcknowledgement(ACKS.origin('Sydney'), {
        kind: 'field-set',
        field: 'origin',
      }),
    ).toBe("We'll start from Sydney.");
    expect(
      transformBaselineAcknowledgement(ACKS.departureDate('2026-08-28'), {
        kind: 'field-set',
        field: 'departureDate',
      }),
    ).toBe('Departure is set for 2026-08-28.');
    expect(
      transformBaselineAcknowledgement(ACKS.returnDate('2026-09-05'), {
        kind: 'field-set',
        field: 'returnDate',
      }),
    ).toBe('Return is set for 2026-09-05.');
    expect(
      transformBaselineAcknowledgement(ACKS.adultCount(1), {
        kind: 'field-set',
        field: 'adultCount',
      }),
    ).toBe('Travelling with 1 adult.');
    expect(
      transformBaselineAcknowledgement(ACKS.adultCount(2), {
        kind: 'field-set',
        field: 'adultCount',
      }),
    ).toBe('Travelling with 2 adults.');
    expect(
      transformBaselineAcknowledgement(ACKS.childCount(1), {
        kind: 'field-set',
        field: 'childCount',
      }),
    ).toBe("I've noted 1 child.");
    expect(
      transformBaselineAcknowledgement(ACKS.childCount(3), {
        kind: 'field-set',
        field: 'childCount',
      }),
    ).toBe("I've noted 3 children.");
    expect(
      transformBaselineAcknowledgement(ACKS.infantCount(1), {
        kind: 'field-set',
        field: 'infantCount',
      }),
    ).toBe('That includes 1 infant.');
    expect(
      transformBaselineAcknowledgement(ACKS.infantCount(2), {
        kind: 'field-set',
        field: 'infantCount',
      }),
    ).toBe('That includes 2 infants.');
  });

  it('uses exact Phase 16J wording for all seven field-changed families', () => {
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Hobart'), {
        kind: 'field-changed',
        field: 'destination',
      }),
    ).toBe('Updated — Hobart it is.');
    expect(
      transformBaselineAcknowledgement(ACKS.origin('Brisbane'), {
        kind: 'field-changed',
        field: 'origin',
      }),
    ).toBe("We'll depart from Brisbane instead.");
    expect(
      transformBaselineAcknowledgement(ACKS.departureDate('2026-08-30'), {
        kind: 'field-changed',
        field: 'departureDate',
      }),
    ).toBe('Departure is now set for 2026-08-30.');
    expect(
      transformBaselineAcknowledgement(ACKS.returnDate('2026-09-08'), {
        kind: 'field-changed',
        field: 'returnDate',
      }),
    ).toBe('Return is now set for 2026-09-08.');
    expect(
      transformBaselineAcknowledgement(ACKS.adultCount(1), {
        kind: 'field-changed',
        field: 'adultCount',
      }),
    ).toBe('Updated to 1 adult.');
    expect(
      transformBaselineAcknowledgement(ACKS.adultCount(3), {
        kind: 'field-changed',
        field: 'adultCount',
      }),
    ).toBe('Updated to 3 adults.');
    expect(
      transformBaselineAcknowledgement(ACKS.childCount(1), {
        kind: 'field-changed',
        field: 'childCount',
      }),
    ).toBe('Updated to 1 child.');
    expect(
      transformBaselineAcknowledgement(ACKS.childCount(2), {
        kind: 'field-changed',
        field: 'childCount',
      }),
    ).toBe('Updated to 2 children.');
    expect(
      transformBaselineAcknowledgement(ACKS.infantCount(1), {
        kind: 'field-changed',
        field: 'infantCount',
      }),
    ).toBe('Updated to 1 infant.');
    expect(
      transformBaselineAcknowledgement(ACKS.infantCount(2), {
        kind: 'field-changed',
        field: 'infantCount',
      }),
    ).toBe('Updated to 2 infants.');
  });

  it('preserves removals, capabilities, generic, unknown, null, and mismatched events', () => {
    expect(transformBaselineAcknowledgement(ACKS.destinationRemoved)).toBe(
      "No problem, I've removed the destination.",
    );
    expect(
      transformBaselineAcknowledgement(ACKS.destinationRemoved, {
        kind: 'field-removed',
        field: 'destination',
      }),
    ).toBe("No problem, I've removed the destination.");

    expect(
      transformBaselineAcknowledgement(ACKS.addedCapabilities('flights'), {
        kind: 'capability-enabled',
        capabilities: ['flights'],
      }),
    ).toBe("Great, I've added flights to your trip.");
    expect(
      transformBaselineAcknowledgement(ACKS.removedCapabilities('flights'), {
        kind: 'capability-disabled',
        capabilities: ['flights'],
      }),
    ).toBe("No problem, I've removed flights from your trip.");

    expect(
      transformBaselineAcknowledgement(ACKS.genericTravelFieldChange, {
        kind: 'generic',
      }),
    ).toBe('Perfect, got it.');

    const unknown = 'Thanks for that travel note.';
    expect(transformBaselineAcknowledgement(unknown)).toBe(unknown);
    expect(
      transformBaselineAcknowledgement(unknown, {
        kind: 'field-changed',
        field: 'destination',
      }),
    ).toBe(unknown);

    // Null / omitted event → Phase 16F string-driven set wording.
    expect(transformBaselineAcknowledgement(ACKS.destination('Cairns'))).toBe(
      'Great, Cairns it is.',
    );
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Cairns'), null),
    ).toBe('Great, Cairns it is.');

    // Mismatched field → ignore changed event; keep string-driven set wording.
    expect(
      transformBaselineAcknowledgement(ACKS.destination('Cairns'), {
        kind: 'field-changed',
        field: 'origin',
      }),
    ).toBe('Great, Cairns it is.');
  });

  it('proves production set-then-change journeys for all seven fields', () => {
    const journeys: Array<{
      label: string;
      setMessage: string;
      changeMessage: string;
      setOpener: string;
      changeOpener: string;
      setAckIncludes: string;
      changeAckIncludes: string;
      eventField: ConversationAcknowledgementEvent extends infer E
        ? E extends { field: infer F }
          ? F
          : never
        : never;
    }> = [
      {
        label: 'destination',
        setMessage: 'go to Cairns',
        changeMessage: 'actually go to Hobart',
        setOpener: 'Great,',
        changeOpener: 'Updated —',
        setAckIncludes: 'Great, Cairns it is.',
        changeAckIncludes: 'Updated — Hobart it is.',
        eventField: 'destination',
      },
      {
        label: 'origin',
        setMessage: 'from Sydney',
        changeMessage: 'from Brisbane instead',
        setOpener: "We'll start",
        changeOpener: "We'll depart",
        setAckIncludes: "We'll start from Sydney.",
        changeAckIncludes: "We'll depart from Brisbane instead.",
        eventField: 'origin',
      },
      {
        label: 'departureDate',
        setMessage: 'Depart on 28 August 2026',
        changeMessage: 'Depart on 30 August 2026',
        setOpener: 'Departure is set',
        changeOpener: 'Departure is now set',
        setAckIncludes: 'Departure is set for',
        changeAckIncludes: 'Departure is now set for',
        eventField: 'departureDate',
      },
      {
        label: 'returnDate',
        setMessage: 'Return on 5 September 2026',
        changeMessage: 'Return on 8 September 2026',
        setOpener: 'Return is set',
        changeOpener: 'Return is now set',
        setAckIncludes: 'Return is set for',
        changeAckIncludes: 'Return is now set for',
        eventField: 'returnDate',
      },
      {
        label: 'adultCount',
        setMessage: '1 adult',
        changeMessage: '3 adults',
        setOpener: 'Travelling with',
        changeOpener: 'Updated to',
        setAckIncludes: 'Travelling with 1 adult.',
        changeAckIncludes: 'Updated to 3 adults.',
        eventField: 'adultCount',
      },
      {
        label: 'childCount',
        setMessage: '1 child',
        changeMessage: '2 children',
        setOpener: "I've noted",
        changeOpener: 'Updated to',
        setAckIncludes: "I've noted 1 child.",
        changeAckIncludes: 'Updated to 2 children.',
        eventField: 'childCount',
      },
      {
        label: 'infantCount',
        setMessage: '1 infant',
        changeMessage: '2 infants',
        setOpener: 'That includes',
        changeOpener: 'Updated to',
        setAckIncludes: 'That includes 1 infant.',
        changeAckIncludes: 'Updated to 2 infants.',
        eventField: 'infantCount',
      },
    ];

    for (const [journeyIndex, journey] of journeys.entries()) {
      // Seed prerequisites so the target field is the acknowledgement winner.
      let state = createState({
        ...(journey.eventField === 'origin' ||
        journey.eventField === 'departureDate' ||
        journey.eventField === 'returnDate' ||
        journey.eventField === 'adultCount' ||
        journey.eventField === 'childCount' ||
        journey.eventField === 'infantCount'
          ? { destination: 'Cairns' }
          : {}),
        ...(journey.eventField === 'departureDate' ||
        journey.eventField === 'returnDate' ||
        journey.eventField === 'adultCount' ||
        journey.eventField === 'childCount' ||
        journey.eventField === 'infantCount'
          ? { origin: 'Sydney' }
          : {}),
        ...(journey.eventField === 'returnDate' ||
        journey.eventField === 'adultCount' ||
        journey.eventField === 'childCount' ||
        journey.eventField === 'infantCount'
          ? { departureDate: '2026-08-20' }
          : {}),
        ...(journey.eventField === 'adultCount' ||
        journey.eventField === 'childCount' ||
        journey.eventField === 'infantCount'
          ? { returnDate: '2026-08-27' }
          : {}),
        ...(journey.eventField === 'childCount' ||
        journey.eventField === 'infantCount'
          ? { adultCount: 2 }
          : {}),
        ...(journey.eventField === 'infantCount' ? { childCount: 1 } : {}),
      });

      const setTurn = turn(
        state,
        journey.setMessage,
        journeyIndex * 2,
      );
      expect(setTurn.plan.acknowledgementEvent, journey.label).toEqual({
        kind: 'field-set',
        field: journey.eventField,
      });
      expect(setTurn.result.reply, journey.label).toContain(
        journey.setAckIncludes,
      );
      expect(opener(ackOnly(setTurn.result.reply)), journey.label).toBe(
        journey.setOpener,
      );
      // Follow-up / neutral content still present after acknowledgement.
      expect(setTurn.result.reply.length, journey.label).toBeGreaterThan(
        journey.setAckIncludes.length,
      );
      state = setTurn.result.state;

      const changeTurn = turn(
        state,
        journey.changeMessage,
        journeyIndex * 2 + 1,
      );
      expect(changeTurn.plan.acknowledgementEvent, journey.label).toEqual({
        kind: 'field-changed',
        field: journey.eventField,
      });
      expect(changeTurn.result.reply, journey.label).toContain(
        journey.changeAckIncludes,
      );
      expect(opener(ackOnly(changeTurn.result.reply)), journey.label).toBe(
        journey.changeOpener,
      );

      // Event is the semantic cause: same catalogue text + wrong event ≠ change wording.
      const catalogue = changeTurn.plan.acknowledgements[0]!;
      expect(
        transformBaselineAcknowledgement(catalogue, {
          kind: 'field-set',
          field: journey.eventField,
        }),
      ).not.toContain(
        journey.changeOpener === 'Updated —'
          ? 'Updated —'
          : journey.changeOpener === 'Updated to'
            ? 'Updated to'
            : journey.changeOpener === "We'll depart"
              ? 'instead'
              : 'now set',
      );
    }
  });

  it('records the full consecutive set/change opener sequence', () => {
    let state = createState();
    const messages = [
      'go to Cairns',
      'actually go to Hobart',
      'from Sydney',
      'from Brisbane instead',
      'Depart on 28 August 2026',
      'Depart on 30 August 2026',
      'Return on 5 September 2026',
      'Return on 8 September 2026',
      '1 adult',
      '3 adults',
      '1 child',
      '2 children',
      '1 infant',
      '2 infants',
    ];
    const expectedOpeners = [
      'Great,',
      'Updated —',
      "We'll start",
      "We'll depart",
      'Departure is set',
      'Departure is now set',
      'Return is set',
      'Return is now set',
      'Travelling with',
      'Updated to',
      "I've noted",
      'Updated to',
      'That includes',
      'Updated to',
    ];

    const openers: string[] = [];
    const completeAcks: string[] = [];

    for (const [index, message] of messages.entries()) {
      const { result, plan } = turn(state, message, index);
      const layer = renderBaselineConversationalLayer(
        buildConversationalLayerInput(plan),
      );
      expect(layer.wording).toBe(result.reply);
      expect(layer.wording).toBe(generateBaselineConversationalReply(plan));

      const renderedAck = ackOnly(result.reply);
      openers.push(opener(renderedAck));
      completeAcks.push(renderedAck);
      state = result.state;
    }

    expect(openers).toEqual(expectedOpeners);

    let longestIdenticalOpener = 1;
    let run = 1;
    for (let i = 1; i < openers.length; i += 1) {
      if (openers[i] === openers[i - 1]) {
        run += 1;
        longestIdenticalOpener = Math.max(longestIdenticalOpener, run);
      } else {
        run = 1;
      }
    }

    let longestIdenticalAck = 1;
    run = 1;
    for (let i = 1; i < completeAcks.length; i += 1) {
      if (completeAcks[i] === completeAcks[i - 1]) {
        run += 1;
        longestIdenticalAck = Math.max(longestIdenticalAck, run);
      } else {
        run = 1;
      }
    }

    // Adjacent set/change pairs differ; "Updated to" repeats across passenger
    // families but never consecutively in this sequence.
    expect(longestIdenticalOpener).toBe(1);
    expect(longestIdenticalAck).toBe(1);
  });

  it('keeps follow-up and 16B bridge wording unchanged around changed acks', () => {
    // Complete core without contextual follow-ups → canonical neutral (16B).
    let state = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
      returnDate: '2026-09-05',
      adultCount: 2,
    });
    const { result, plan } = turn(state, 'go to Hobart', 0);
    expect(plan.acknowledgementEvent).toEqual({
      kind: 'field-changed',
      field: 'destination',
    });
    expect(plan.followUpQuestion).toBe(NEUTRAL);
    expect(result.reply).toBe(
      `Updated — Hobart it is. ${BRIDGE_FIELD} ${NEUTRAL}`,
    );

    // Specific follow-up path (15C): origin set still uses set wording + follow-up.
    state = createState({ destination: 'Cairns' });
    const originSet = turn(state, 'from Sydney', 1);
    expect(originSet.plan.acknowledgementEvent).toEqual({
      kind: 'field-set',
      field: 'origin',
    });
    expect(originSet.result.reply).toBe(
      `${"We'll start from Sydney."} ${FOLLOW_UPS.departureDate}`,
    );
  });

  it('documents the transformer contract accepts acknowledgementEvent without state inspection', () => {
    const transform = readCore('transformBaselineAcknowledgement.ts');
    expect(transform).toMatch(/Phase 16J/);
    expect(transform).toMatch(
      /export function transformBaselineAcknowledgement\(\s*acknowledgement: string,\s*acknowledgementEvent: ConversationAcknowledgementEvent = null,\s*\): string/,
    );
    expect(transform).not.toMatch(/previousState/);
    expect(transform).not.toMatch(/classifyConversationStateChange/);
    expect(transform).not.toMatch(/ConversationCoreState/);
    expect(transform).not.toMatch(/transcript/);

    const layer = readCore('renderBaselineConversationalLayer.ts');
    expect(layer).toMatch(/acknowledgementEvent/);
    expect(layer).toMatch(
      /transformBaselineAcknowledgement\(\s*plan\.acknowledgements\[0\]!,\s*acknowledgementEvent,\s*\)/,
    );
  });
});
