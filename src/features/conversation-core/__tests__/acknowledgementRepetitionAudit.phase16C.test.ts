import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationReplyPlan } from '../createConversationReplyPlan';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderBaselineAcknowledgementNeutralContinuation } from '../renderBaselineAcknowledgementNeutralContinuation';
import {
  ACTIVATED_NEUTRAL_CONTINUATION_REPLY,
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
} from '../renderBaselineNeutralContinuation';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16C — acknowledgement-repetition and stateless-rendering audit.
 *
 * Investigation-only. Production wording is unchanged. Proves where repeated
 * openers come from and whether the conversational helpers receive history.
 */

const ROOT = process.cwd();
const LAYER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
);
const TRANSFORM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/transformBaselineAcknowledgement.ts',
);
const ACK_FOLLOW_UP_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineAcknowledgementFollowUp.ts',
);
const ACK_NEUTRAL_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/renderBaselineAcknowledgementNeutralContinuation.ts',
);
const CONTRACTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/conversationalLayerContracts.ts',
);
const BUILD_INPUT_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/buildConversationalLayerInput.ts',
);

const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

type Owner = '15B' | '15C' | '15J' | '15F' | '15E' | '16B' | 'deterministic';

type TurnStep = {
  message: string;
  stateUpdate?: ConversationStateUpdate;
};

type CapturedTurn = {
  turn: number;
  message: string;
  acknowledgement: string | null;
  followUpShape: string | null;
  owner: Owner;
  reply: string;
  openingPhrase: string;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16c',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function classifyOwner(plan: {
  acknowledgements: readonly string[];
  followUpQuestion: string | null;
}): Owner {
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return '16B';
  }
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === null
  ) {
    return '15B';
  }
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion !== null
  ) {
    return '15C';
  }
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return '15J';
  }
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion !== null
  ) {
    const followUp = plan.followUpQuestion;
    if (
      followUp === FOLLOW_UPS.destination ||
      followUp === FOLLOW_UPS.origin ||
      followUp === FOLLOW_UPS.departureDate ||
      followUp === FOLLOW_UPS.returnDate ||
      followUp === FOLLOW_UPS.flightsAdultCount ||
      followUp === FOLLOW_UPS.accommodationGuestCount ||
      followUp === FOLLOW_UPS.activities ||
      followUp === FOLLOW_UPS.restaurants
    ) {
      return '15F';
    }
    return '15E';
  }
  return 'deterministic';
}

/** Leading opener family used for repetition measurement. */
function openingPhrase(reply: string): string {
  if (reply.startsWith('Perfect,')) return 'Perfect,';
  if (reply.startsWith('Updated —')) return 'Updated —';
  if (reply.startsWith('Great,')) return 'Great,';
  if (reply.startsWith('No problem,')) return 'No problem,';
  if (reply.startsWith("We'll start")) return "We'll start";
  if (reply.startsWith("We'll depart")) return "We'll depart";
  if (reply.startsWith('Departure is now set')) return 'Departure is now set';
  if (reply.startsWith('Departure is set')) return 'Departure is set';
  if (reply.startsWith('Return is now set')) return 'Return is now set';
  if (reply.startsWith('Return is set')) return 'Return is set';
  if (reply.startsWith('Travelling with')) return 'Travelling with';
  if (reply.startsWith('Updated to')) return 'Updated to';
  if (reply.startsWith("I've noted")) return "I've noted";
  if (reply.startsWith('That includes')) return 'That includes';
  if (reply.startsWith("There's just one more thing")) {
    return "There's just one more thing";
  }
  const match = reply.match(/^(\S+)/);
  return match?.[1] ?? '';
}

function runJourney(steps: TurnStep[]): CapturedTurn[] {
  let state = createState();
  const captured: CapturedTurn[] = [];

  for (const [index, step] of steps.entries()) {
    const previous = structuredClone(state);
    const result = processConversationTurn({
      message: step.message,
      state,
      userEntryId: `user-16c-${index}`,
      assistantEntryId: `assistant-16c-${index}`,
      userMessageAt: new Date(
        `2026-07-29T00:${String(index).padStart(2, '0')}:00.000Z`,
      ),
      assistantMessageAt: new Date(
        `2026-07-29T00:${String(index).padStart(2, '0')}:01.000Z`,
      ),
      ...(step.stateUpdate !== undefined ? { stateUpdate: step.stateUpdate } : {}),
    });
    const classification = classifyConversationStateChange(
      previous,
      result.state,
    );
    const components = selectConversationReplyComponents({
      state: result.state,
      classification,
    });
    const plan = createConversationReplyPlan({
      state: result.state,
      classification,
    });

    captured.push({
      turn: index + 1,
      message: step.message,
      acknowledgement: components.acknowledgement,
      followUpShape: plan.followUpQuestion,
      owner: classifyOwner(plan),
      reply: result.reply,
      openingPhrase: openingPhrase(result.reply),
    });
    state = result.state;
  }

  return captured;
}

function maxConsecutiveIdentical(values: readonly string[]): number {
  if (values.length === 0) return 0;
  let max = 1;
  let run = 1;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] === values[i - 1]) {
      run += 1;
      max = Math.max(max, run);
    } else {
      run = 1;
    }
  }
  return max;
}

function countBy<T extends string>(values: readonly T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

const CATALOGUE_TRANSFORM_ROWS: Array<{
  category: string;
  deterministic: string;
  transformed: string;
  openingPhrase: string;
  productionShapes: string;
  owningHelper: string;
}> = [
  {
    category: 'field set (destination)',
    deterministic: ACKS.destination('Cairns'),
    transformed: 'Great, Cairns it is.',
    openingPhrase: 'Great,',
    productionShapes: '15C (specific follow-up) / 16B (neutral)',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field changed (destination)',
    deterministic: ACKS.destination('Hobart'),
    transformed: 'Great, Hobart it is.',
    openingPhrase: 'Great,',
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field set (origin)',
    deterministic: ACKS.origin('Sydney'),
    // Phase 16D supersedes prior Perfect, we'll start…
    transformed: "We'll start from Sydney.",
    openingPhrase: "We'll start",
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field set (departure date)',
    deterministic: ACKS.departureDate('2026-08-28'),
    // Phase 16D supersedes prior Perfect, set to depart…
    transformed: 'Departure is set for 2026-08-28.',
    openingPhrase: 'Departure is set',
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field set (return date)',
    deterministic: ACKS.returnDate('2026-09-05'),
    // Phase 16D supersedes prior Perfect, set to return…
    transformed: 'Return is set for 2026-09-05.',
    openingPhrase: 'Return is set',
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field set (adult count)',
    deterministic: ACKS.adultCount(2),
    // Phase 16D supersedes prior Perfect, N adults travelling.
    transformed: 'Travelling with 2 adults.',
    openingPhrase: 'Travelling with',
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field set (child count)',
    deterministic: ACKS.childCount(1),
    // Phase 16D supersedes prior Perfect, N child travelling.
    transformed: "I've noted 1 child.",
    openingPhrase: "I've noted",
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field set (infant count)',
    deterministic: ACKS.infantCount(1),
    // Phase 16F supersedes prior I've noted infant wording.
    transformed: 'That includes 1 infant.',
    openingPhrase: 'That includes',
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'field removed',
    deterministic: ACKS.destinationRemoved,
    transformed: "No problem, I've removed the destination.",
    openingPhrase: 'No problem,',
    productionShapes: '15C (usually specific) / 16B when continuation is neutral',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'capability enabled',
    deterministic: ACKS.addedCapabilities('flights'),
    transformed: "Great, I've added flights to your trip.",
    openingPhrase: 'Great,',
    productionShapes: '15C / 16B',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'capability disabled',
    deterministic: ACKS.removedCapabilities('flights'),
    transformed: "No problem, I've removed flights from your trip.",
    openingPhrase: 'No problem,',
    productionShapes: '16B (typical post-core) / 15C if specific follow-up',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'generic acknowledgement',
    deterministic: ACKS.genericTravelFieldChange,
    transformed: 'Perfect, got it.',
    openingPhrase: 'Perfect,',
    productionShapes: '15C / 16B (defensive when selected)',
    owningHelper: 'transformBaselineAcknowledgement → 15C or 16B',
  },
  {
    category: 'unknown acknowledgement',
    deterministic: 'Thanks for that travel note.',
    transformed: 'Thanks for that travel note.',
    openingPhrase: 'Thanks',
    productionShapes: 'defensive renderer only (selector does not emit)',
    owningHelper: 'transformBaselineAcknowledgement (identity) → 15C or 16B',
  },
];

describe('phase 16C — acknowledgement repetition and stateless rendering audit', () => {
  it('locks the acknowledgement catalogue → transformation → opener map', () => {
    for (const row of CATALOGUE_TRANSFORM_ROWS) {
      expect(
        transformBaselineAcknowledgement(row.deterministic),
        row.category,
      ).toBe(row.transformed);
      expect(row.transformed.startsWith(row.openingPhrase), row.category).toBe(
        true,
      );
    }

    // Historical Phase 16C evidence: before Phase 16D, origin/dates/passengers/
    // generic all opened with Perfect,. After 16D only generic remains Perfect,.
    const perfectOpeners = CATALOGUE_TRANSFORM_ROWS.filter(
      (row) => row.openingPhrase === 'Perfect,',
    );
    expect(perfectOpeners.map((row) => row.category)).toEqual([
      'generic acknowledgement',
    ]);
  });

  it('characterises consecutive openers across realistic journeys (16D-superseded)', () => {
    // Historical Phase 16C measurement (pre-16D): core progression opened
    // Great, then Perfect,×4 (max consecutive identical opener = 4).
    const core = runJourney([
      { message: 'I want to go to Cairns' },
      { message: 'flying from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
    ]);
    // Phase 16D supersedes the Perfect, streak with diversified openers.
    expect(core.map((turn) => turn.openingPhrase)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Travelling with',
    ]);
    expect(maxConsecutiveIdentical(core.map((turn) => turn.openingPhrase))).toBe(
      1,
    );
    expect(core.map((turn) => turn.owner)).toEqual([
      '15C',
      '15C',
      '15C',
      '16B',
      '16B',
    ]);
    expect(core.map((turn) => turn.acknowledgement)).toEqual([
      ACKS.destination('Cairns'),
      ACKS.origin('Sydney'),
      ACKS.departureDate('2026-08-28'),
      ACKS.returnDate('2026-09-05'),
      ACKS.adultCount(2),
    ]);

    const passengers = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'I need flights' },
      { message: '2 adults' },
      { message: '1 child' },
      { message: '1 infant' },
      { message: '3 adults' },
    ]);
    // Phase 16F: infant uses That includes; child keeps I've noted.
    // Historical 16C had Perfect,×4; historical 16E had I've noted×2 for child→infant.
    // Phase 16J: later adult-count change uses Updated to.
    expect(passengers.slice(5).map((turn) => turn.openingPhrase)).toEqual([
      'Travelling with',
      "I've noted",
      'That includes',
      'Updated to',
    ]);
    expect(
      maxConsecutiveIdentical(
        passengers.slice(5).map((turn) => turn.openingPhrase),
      ),
    ).toBe(1);

    const destChange = runJourney([
      { message: 'go to Brisbane' },
      { message: 'go to Cairns' },
    ]);
    expect(destChange.map((turn) => turn.openingPhrase)).toEqual([
      'Great,',
      'Updated —',
    ]);
    expect(maxConsecutiveIdentical(destChange.map((t) => t.openingPhrase))).toBe(
      1,
    );

    const originChange = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Brisbane' },
      { message: 'actually from Sydney' },
    ]);
    expect(originChange.map((turn) => turn.openingPhrase)).toEqual([
      'Great,',
      "We'll start",
      "We'll depart",
    ]);

    const removal = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'clear destination', stateUpdate: { destination: null } },
      { message: 'go to Hobart' },
    ]);
    expect(removal.map((turn) => turn.openingPhrase)).toEqual([
      'Great,',
      "We'll start",
      'No problem,',
      'Great,',
    ]);
    expect(removal[2]!.owner).toBe('15C');
    expect(removal[2]!.acknowledgement).toBe(ACKS.destinationRemoved);

    const capabilities = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'I need flights' },
      { message: '2 adults' },
      { message: 'remove flights', stateUpdate: { flightsRequested: false } },
    ]);
    expect(capabilities.map((turn) => turn.openingPhrase)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Great,',
      'Travelling with',
      'No problem,',
    ]);
    expect(capabilities[4]!.acknowledgement).toBe(
      ACKS.addedCapabilities('flights'),
    );
    expect(capabilities[6]!.acknowledgement).toBe(
      ACKS.removedCapabilities('flights'),
    );
    expect(capabilities[6]!.owner).toBe('16B');

    const preference = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: '2 adults' },
      { message: 'I like beaches' },
    ]);
    expect(preference[5]!.openingPhrase).toBe('Great,');
    expect(preference[5]!.owner).toBe('16B');
    expect(preference[5]!.acknowledgement).toBe(
      ACKS.addedCapabilities('beaches'),
    );

    // Historical Phase 16C: Perfect, was the most frequent opener (≥18).
    // After 16D, Perfect, remains only for generic acknowledgements.
    const allOpeners = [
      ...core,
      ...passengers,
      ...destChange,
      ...originChange,
      ...removal,
      ...capabilities,
      ...preference,
    ].map((turn) => turn.openingPhrase);
    const openerCounts = countBy(allOpeners);
    expect(openerCounts['Perfect,'] ?? 0).toBe(0);
    expect(openerCounts['Great,']).toBeGreaterThan(0);
  });

  it('records that catalogue prefixes still cluster under Perfect — while transforms diversify (16D)', () => {
    // Catalogue still clusters origin/dates/passengers/generic under Perfect —
    expect(ACKS.origin('Sydney').startsWith('Perfect —')).toBe(true);
    expect(ACKS.departureDate('2026-08-28').startsWith('Perfect —')).toBe(true);
    expect(ACKS.returnDate('2026-09-05').startsWith('Perfect —')).toBe(true);
    expect(ACKS.adultCount(2).startsWith('Perfect —')).toBe(true);
    expect(ACKS.genericTravelFieldChange).toBe('Perfect.');

    // Phase 16D diversifies conversational openers for those catalogue families.
    expect(transformBaselineAcknowledgement(ACKS.origin('Sydney'))).toMatch(
      /^We'll start/,
    );
    expect(
      transformBaselineAcknowledgement(ACKS.departureDate('2026-08-28')),
    ).toMatch(/^Departure is set/);
    expect(transformBaselineAcknowledgement(ACKS.adultCount(2))).toMatch(
      /^Travelling with/,
    );
    expect(
      transformBaselineAcknowledgement(ACKS.genericTravelFieldChange),
    ).toBe('Perfect, got it.');

    // Destination / capability-enabled catalogue uses Great — / I've added,
    // and transform keeps Great,.
    expect(ACKS.destination('Cairns').startsWith('Great —')).toBe(true);
    expect(transformBaselineAcknowledgement(ACKS.destination('Cairns'))).toMatch(
      /^Great,/,
    );
    expect(
      transformBaselineAcknowledgement(ACKS.addedCapabilities('beaches')),
    ).toMatch(/^Great,/);
  });

  it('proves conversational helpers are stateless with respect to history', () => {
    const layer = readFileSync(LAYER_SOURCE, 'utf8');
    const transform = readFileSync(TRANSFORM_SOURCE, 'utf8');
    const ackFollowUp = readFileSync(ACK_FOLLOW_UP_SOURCE, 'utf8');
    const ackNeutral = readFileSync(ACK_NEUTRAL_SOURCE, 'utf8');
    const contracts = readFileSync(CONTRACTS_SOURCE, 'utf8');
    const buildInput = readFileSync(BUILD_INPUT_SOURCE, 'utf8');

    for (const source of [layer, transform, ackFollowUp, ackNeutral]) {
      expect(source.includes('transcript')).toBe(false);
      expect(source.includes('previousReply')).toBe(false);
      expect(source.includes('previousAcknowledgement')).toBe(false);
      expect(source.includes('turnCount')).toBe(false);
      expect(source.includes('conversationId')).toBe(false);
      expect(source.includes('recentPhrase')).toBe(false);
    }

    // ConversationalLayerInput exposes plan + objective + acknowledgementEvent + optional style.
    expect(contracts).toMatch(/readonly plan: ConversationReplyPlan/);
    expect(contracts).toMatch(
      /readonly objective: ConversationalObjective \| null/,
    );
    expect(contracts).toMatch(/readonly acknowledgementEvent: ConversationAcknowledgementEvent/);
    expect(contracts).toMatch(/readonly styleProfile\?: ConversationalStyleProfile/);
    expect(contracts.includes('transcript')).toBe(false);
    expect(contracts.includes('turnCount')).toBe(false);

    // Adapter derives objective from the plan only.
    expect(buildInput).toMatch(/selectConversationalObjective\(plan\)/);
    expect(buildInput.includes('transcript')).toBe(false);

    // Helper signatures are rendering-layer strings + optional acknowledgementEvent.
    expect(ackFollowUp).toMatch(/acknowledgement: string/);
    expect(ackFollowUp).toMatch(/followUpQuestion: string/);
    expect(ackNeutral).toMatch(/acknowledgement: string/);
    expect(ackNeutral).toMatch(/followUpQuestion: string/);
    expect(transform).toMatch(
      /export function transformBaselineAcknowledgement\(\s*acknowledgement: string,\s*acknowledgementEvent: ConversationAcknowledgementEvent = null,\s*\)/,
    );

    // Layer ignores styleProfile and never consults objective for wording.
    expect(layer).toMatch(/Ignores styleProfile/);
    expect(layer.includes('input.objective')).toBe(false);
    expect(layer.includes('input.styleProfile')).toBe(false);
  });

  it('preserves Phase 16B behaviour exactly (regression)', () => {
    expect(
      renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement: ACKS.returnDate('2026-09-05'),
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      }),
    ).toBe(
      "Return is set for 2026-09-05. Is there anything else you'd like me to consider? What else should I know about your trip?",
    );
    expect(
      renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement: ACKS.destinationRemoved,
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      }),
    ).toBe(
      "No problem, I've removed the destination. We can update the rest as we go. What else should I know about your trip?",
    );
    expect(
      renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement: ACKS.addedCapabilities('beaches'),
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      }),
    ).toBe(
      "Great, I've added beaches to your trip. Tell me anything else that matters for this trip. What else should I know about your trip?",
    );
    expect(
      renderBaselineAcknowledgementNeutralContinuation({
        acknowledgement: ACKS.removedCapabilities('flights'),
        followUpQuestion: CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
      }),
    ).toBe(
      "No problem, I've removed flights from your trip. We can keep refining the plan. What else should I know about your trip?",
    );

    const productionNeutral = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
    ]);
    expect(productionNeutral[3]!.reply.endsWith(CANONICAL_NEUTRAL_CONTINUATION_PROMPT)).toBe(
      true,
    );
    expect(
      productionNeutral[3]!.reply.slice(
        productionNeutral[3]!.reply.length -
          CANONICAL_NEUTRAL_CONTINUATION_PROMPT.length,
      ),
    ).toBe(CANONICAL_NEUTRAL_CONTINUATION_PROMPT);

    expect(
      renderBaselineAcknowledgementFollowUp({
        acknowledgement: ACKS.destination('Cairns'),
        followUpQuestion: FOLLOW_UPS.origin,
      }),
    ).toBe('Great, Cairns it is. Where will you be travelling from?');

    const specific = runJourney([{ message: 'go to Cairns' }]);
    expect(specific[0]!.reply).toBe(
      'Great, Cairns it is. Where will you be travelling from?',
    );
    expect(specific[0]!.reply.endsWith(FOLLOW_UPS.origin)).toBe(true);

    const neutralOnly = runJourney([
      { message: 'go to Cairns' },
      { message: 'what is the weather like' },
    ]);
    expect(neutralOnly[1]!.reply).toBe(ACTIVATED_NEUTRAL_CONTINUATION_REPLY);
    expect(neutralOnly[1]!.owner).toBe('15J');
  });
});
