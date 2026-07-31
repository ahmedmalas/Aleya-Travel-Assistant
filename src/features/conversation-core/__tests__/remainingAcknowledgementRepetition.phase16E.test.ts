import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16E — remaining acknowledgement-repetition audit after Phase 16D.
 *
 * Characterization only. Production wording is unchanged. Locks observed
 * production-path opener/acknowledgement repetition and boundary classes.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;

type AcknowledgementFamily =
  | 'destination'
  | 'origin'
  | 'departureDate'
  | 'returnDate'
  | 'adultCount'
  | 'childCount'
  | 'infantCount'
  | 'fieldRemoved'
  | 'capabilityEnabled'
  | 'capabilityDisabled'
  | 'generic'
  | 'none'
  | 'unknown';

type BoundaryClass =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'n/a';

type TurnStep = {
  message: string;
  stateUpdate?: ConversationStateUpdate;
};

type CapturedTurn = {
  turn: number;
  message: string;
  family: AcknowledgementFamily;
  deterministicAcknowledgement: string | null;
  renderedAcknowledgement: string | null;
  renderedOpener: string;
  openerMatchesPrevious: boolean;
  completeAckMatchesPrevious: boolean;
  /** Whether current acknowledgement string alone distinguishes this turn from previous. */
  distinguishableByCurrentAck: boolean;
  boundaryClass: BoundaryClass;
  reply: string;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16e',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function classifyFamily(
  acknowledgement: string | null,
): AcknowledgementFamily {
  if (acknowledgement === null) return 'none';
  if (acknowledgement.startsWith('Great — ')) return 'destination';
  if (acknowledgement.startsWith('Perfect — departing from ')) return 'origin';
  if (acknowledgement.startsWith('Perfect — departing on ')) {
    return 'departureDate';
  }
  if (acknowledgement.startsWith('Perfect — returning on ')) {
    return 'returnDate';
  }
  if (
    acknowledgement.includes(' adult travelling.') ||
    acknowledgement.includes(' adults travelling.')
  ) {
    return 'adultCount';
  }
  if (
    acknowledgement.includes(' child travelling.') ||
    acknowledgement.includes(' children travelling.')
  ) {
    return 'childCount';
  }
  if (
    acknowledgement.includes(' infant travelling.') ||
    acknowledgement.includes(' infants travelling.')
  ) {
    return 'infantCount';
  }
  if (acknowledgement.endsWith(' removed.')) return 'fieldRemoved';
  if (acknowledgement.startsWith("I've added ")) return 'capabilityEnabled';
  if (acknowledgement.startsWith("I've removed ")) {
    return 'capabilityDisabled';
  }
  if (acknowledgement === 'Perfect.') return 'generic';
  return 'unknown';
}

function renderedOpener(renderedAcknowledgement: string | null): string {
  if (renderedAcknowledgement === null) return '(none)';
  const t = renderedAcknowledgement;
  if (t.startsWith("Great, I've added")) return "Great, I've added";
  if (t.startsWith('Great,')) return 'Great,';
  if (t.startsWith("We'll start")) return "We'll start";
  if (t.startsWith('Departure is set')) return 'Departure is set';
  if (t.startsWith('Return is set')) return 'Return is set';
  if (t.startsWith('Travelling with')) return 'Travelling with';
  if (t.startsWith("I've noted")) return "I've noted";
  if (t.startsWith('That includes')) return 'That includes';
  if (t.startsWith("No problem, I've removed") && t.endsWith(' from your trip.')) {
    return "No problem, I've removed (capability)";
  }
  if (t.startsWith("No problem, I've removed")) {
    return "No problem, I've removed (field)";
  }
  if (t.startsWith('Perfect,')) return 'Perfect,';
  const match = t.match(/^(\S+)/);
  return match?.[1] ?? t;
}

function classifyBoundary(
  previous: CapturedTurn | null,
  current: Omit<
    CapturedTurn,
    | 'openerMatchesPrevious'
    | 'completeAckMatchesPrevious'
    | 'distinguishableByCurrentAck'
    | 'boundaryClass'
  >,
): Pick<
  CapturedTurn,
  | 'openerMatchesPrevious'
  | 'completeAckMatchesPrevious'
  | 'distinguishableByCurrentAck'
  | 'boundaryClass'
> {
  if (previous === null) {
    return {
      openerMatchesPrevious: false,
      completeAckMatchesPrevious: false,
      distinguishableByCurrentAck: false,
      boundaryClass: 'n/a',
    };
  }
  const openerMatchesPrevious =
    current.renderedOpener === previous.renderedOpener;
  const completeAckMatchesPrevious =
    current.renderedAcknowledgement !== null &&
    current.renderedAcknowledgement === previous.renderedAcknowledgement;
  const distinguishableByCurrentAck =
    current.deterministicAcknowledgement !== null &&
    previous.deterministicAcknowledgement !== null &&
    current.deterministicAcknowledgement !==
      previous.deterministicAcknowledgement;

  let boundaryClass: BoundaryClass = 'n/a';
  if (openerMatchesPrevious) {
    if (distinguishableByCurrentAck) {
      // Same opener, different acknowledgement string → opener could vary
      // from current ack text alone (cross-family or same-family with values).
      boundaryClass = 'A';
    } else if (completeAckMatchesPrevious) {
      // Identical complete acknowledgement → only history can break repetition.
      boundaryClass = 'C';
    } else {
      boundaryClass = 'C';
    }
  }

  return {
    openerMatchesPrevious,
    completeAckMatchesPrevious,
    distinguishableByCurrentAck,
    boundaryClass,
  };
}

function runJourney(steps: TurnStep[]): CapturedTurn[] {
  let state = createState();
  const captured: CapturedTurn[] = [];

  for (const [index, step] of steps.entries()) {
    const previousState = structuredClone(state);
    const result = processConversationTurn({
      message: step.message,
      state,
      userEntryId: `user-16e-${index}`,
      assistantEntryId: `assistant-16e-${index}`,
      userMessageAt: new Date(
        `2026-07-29T00:${String(index).padStart(2, '0')}:00.000Z`,
      ),
      assistantMessageAt: new Date(
        `2026-07-29T00:${String(index).padStart(2, '0')}:01.000Z`,
      ),
      ...(step.stateUpdate !== undefined ? { stateUpdate: step.stateUpdate } : {}),
    });
    const classification = classifyConversationStateChange(
      previousState,
      result.state,
    );
    const components = selectConversationReplyComponents({
      state: result.state,
      classification,
    });
    const deterministicAcknowledgement = components.acknowledgement;
    const renderedAcknowledgement =
      deterministicAcknowledgement === null
        ? null
        : transformBaselineAcknowledgement(deterministicAcknowledgement);
    const base = {
      turn: index + 1,
      message: step.message,
      family: classifyFamily(deterministicAcknowledgement),
      deterministicAcknowledgement,
      renderedAcknowledgement,
      renderedOpener: renderedOpener(renderedAcknowledgement),
      reply: result.reply,
    };
    const previous = captured[captured.length - 1] ?? null;
    captured.push({
      ...base,
      ...classifyBoundary(previous, base),
    });
    state = result.state;
  }

  return captured;
}

function maxConsecutive(values: readonly string[]): number {
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

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

const CORE_SETUP: TurnStep[] = [
  { message: 'go to Cairns' },
  { message: 'from Sydney' },
  { message: 'Depart on 28 August 2026' },
  { message: 'Return on 5 September 2026' },
];

describe('phase 16E — remaining acknowledgement repetition audit', () => {
  it('preserves the Phase 16D mixed-field opener sequence', () => {
    const turns = runJourney([
      ...CORE_SETUP,
      { message: '2 adults' },
    ]);
    expect(turns.map((turn) => turn.renderedOpener)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Travelling with',
    ]);
    expect(maxConsecutive(turns.map((turn) => turn.renderedOpener))).toBe(1);
    expect(
      turns.every((turn) => turn.openerMatchesPrevious === false),
    ).toBe(true);
  });

  it('measures same-family repeated turns for destination, origin, dates, and passengers', () => {
    const destination = runJourney([
      { message: 'go to Brisbane' },
      { message: 'go to Cairns' },
    ]);
    expect(destination.map((turn) => turn.family)).toEqual([
      'destination',
      'destination',
    ]);
    expect(destination.map((turn) => turn.renderedOpener)).toEqual([
      'Great,',
      'Great,',
    ]);
    expect(destination[1]!.openerMatchesPrevious).toBe(true);
    expect(destination[1]!.completeAckMatchesPrevious).toBe(false);
    expect(destination[1]!.distinguishableByCurrentAck).toBe(true);
    expect(destination[1]!.boundaryClass).toBe('A');
    expect(destination.map((turn) => turn.renderedAcknowledgement)).toEqual([
      'Great, Brisbane it is.',
      'Great, Cairns it is.',
    ]);

    const origin = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Brisbane' },
      { message: 'actually from Sydney' },
    ]);
    expect(origin.slice(1).map((turn) => turn.family)).toEqual([
      'origin',
      'origin',
    ]);
    expect(origin.slice(1).map((turn) => turn.renderedOpener)).toEqual([
      "We'll start",
      "We'll start",
    ]);
    expect(origin[2]!.openerMatchesPrevious).toBe(true);
    expect(origin[2]!.distinguishableByCurrentAck).toBe(true);
    expect(origin[2]!.boundaryClass).toBe('A');

    const departure = runJourney([
      ...CORE_SETUP,
      { message: 'Depart on 1 September 2026' },
    ]);
    // turns 3 and 5 are departure-date sets (index 2 and 4)
    expect(departure[2]!.family).toBe('departureDate');
    expect(departure[4]!.family).toBe('departureDate');
    expect(departure[4]!.renderedOpener).toBe('Departure is set');
    expect(departure[4]!.renderedOpener).toBe(departure[2]!.renderedOpener);
    // Not consecutive — interrupted by return date — so openerMatchesPrevious is false
    expect(departure[4]!.openerMatchesPrevious).toBe(false);
    expect(departure[4]!.distinguishableByCurrentAck).toBe(true);

    const consecutiveDeparture = runJourney([
      { message: 'go to Cairns' },
      { message: 'from Sydney' },
      { message: 'Depart on 28 August 2026' },
      { message: 'Return on 5 September 2026' },
      { message: 'Depart on 1 September 2026' },
      { message: 'Depart on 3 September 2026' },
    ]);
    expect(consecutiveDeparture[4]!.family).toBe('departureDate');
    expect(consecutiveDeparture[5]!.family).toBe('departureDate');
    expect(consecutiveDeparture[5]!.openerMatchesPrevious).toBe(true);
    expect(consecutiveDeparture[5]!.completeAckMatchesPrevious).toBe(false);
    expect(consecutiveDeparture[5]!.boundaryClass).toBe('A');

    const consecutiveReturn = runJourney([
      ...CORE_SETUP,
      { message: 'Return on 10 September 2026' },
      { message: 'Return on 12 September 2026' },
    ]);
    expect(consecutiveReturn[4]!.family).toBe('returnDate');
    expect(consecutiveReturn[5]!.family).toBe('returnDate');
    expect(consecutiveReturn[5]!.openerMatchesPrevious).toBe(true);
    expect(consecutiveReturn[5]!.boundaryClass).toBe('A');

    const adult = runJourney([
      ...CORE_SETUP,
      { message: '2 adults' },
      { message: '3 adults' },
    ]);
    expect(adult.slice(4).map((turn) => turn.family)).toEqual([
      'adultCount',
      'adultCount',
    ]);
    expect(adult[5]!.openerMatchesPrevious).toBe(true);
    expect(adult[5]!.renderedAcknowledgement).toBe('Travelling with 3 adults.');
    expect(adult[5]!.boundaryClass).toBe('A');

    const child = runJourney([
      ...CORE_SETUP,
      { message: '1 child' },
      { message: '2 children' },
    ]);
    expect(child.slice(4).map((turn) => turn.family)).toEqual([
      'childCount',
      'childCount',
    ]);
    expect(child[5]!.openerMatchesPrevious).toBe(true);
    expect(child[5]!.boundaryClass).toBe('A');

    const infant = runJourney([
      ...CORE_SETUP,
      { message: '1 infant' },
      { message: '2 infants' },
    ]);
    expect(infant.slice(4).map((turn) => turn.family)).toEqual([
      'infantCount',
      'infantCount',
    ]);
    expect(infant[5]!.openerMatchesPrevious).toBe(true);
    expect(infant[5]!.boundaryClass).toBe('A');
  });

  it('captures child-to-infant opener distinction after Phase 16F (supersedes shared I\'ve noted)', () => {
    const turns = runJourney([
      ...CORE_SETUP,
      { message: '1 child' },
      { message: '1 infant' },
    ]);
    expect(turns[4]!.family).toBe('childCount');
    expect(turns[5]!.family).toBe('infantCount');
    expect(turns[4]!.renderedOpener).toBe("I've noted");
    // Phase 16F supersedes prior shared I've noted opener for infants.
    expect(turns[5]!.renderedOpener).toBe('That includes');
    expect(turns[5]!.openerMatchesPrevious).toBe(false);
    expect(turns[5]!.completeAckMatchesPrevious).toBe(false);
    expect(turns[5]!.distinguishableByCurrentAck).toBe(true);
    expect(turns[4]!.deterministicAcknowledgement).toBe(ACKS.childCount(1));
    expect(turns[5]!.deterministicAcknowledgement).toBe(ACKS.infantCount(1));
    expect(turns[4]!.renderedAcknowledgement).toBe("I've noted 1 child.");
    expect(turns[5]!.renderedAcknowledgement).toBe('That includes 1 infant.');
    expect(turns[5]!.boundaryClass).toBe('n/a');
  });

  it('captures capability enable/disable and field-removal opener repetition', () => {
    const enables = runJourney([
      ...CORE_SETUP,
      { message: 'I like beaches' },
      { message: 'I need camping' },
    ]);
    expect(enables.slice(4).map((turn) => turn.family)).toEqual([
      'capabilityEnabled',
      'capabilityEnabled',
    ]);
    expect(enables.slice(4).map((turn) => turn.renderedOpener)).toEqual([
      "Great, I've added",
      "Great, I've added",
    ]);
    expect(enables[5]!.openerMatchesPrevious).toBe(true);
    expect(enables[5]!.completeAckMatchesPrevious).toBe(false);
    expect(enables[5]!.distinguishableByCurrentAck).toBe(true);
    expect(enables[5]!.boundaryClass).toBe('A');

    const disables = runJourney([
      ...CORE_SETUP,
      { message: 'I need flights' },
      { message: '2 adults' },
      { message: 'I like beaches' },
      {
        message: 'remove flights',
        stateUpdate: { flightsRequested: false },
      },
      {
        message: 'remove beaches',
        stateUpdate: { beachesRequested: false },
      },
    ]);
    const disableTurns = disables.filter(
      (turn) => turn.family === 'capabilityDisabled',
    );
    expect(disableTurns).toHaveLength(2);
    expect(disableTurns.map((turn) => turn.renderedOpener)).toEqual([
      "No problem, I've removed (capability)",
      "No problem, I've removed (capability)",
    ]);
    // Consecutive disables after beaches enable + flight remove + beach remove
    const last = disables[disables.length - 1]!;
    const previous = disables[disables.length - 2]!;
    expect(last.family).toBe('capabilityDisabled');
    expect(previous.family).toBe('capabilityDisabled');
    expect(last.openerMatchesPrevious).toBe(true);
    expect(last.boundaryClass).toBe('A');

    const removals = runJourney([
      ...CORE_SETUP,
      { message: '2 adults' },
      { message: '1 child' },
      { message: 'clear child', stateUpdate: { childCount: null } },
      { message: 'clear adults', stateUpdate: { adultCount: null } },
    ]);
    const removalTurns = removals.filter((turn) => turn.family === 'fieldRemoved');
    expect(removalTurns).toHaveLength(2);
    expect(removalTurns.map((turn) => turn.renderedOpener)).toEqual([
      "No problem, I've removed (field)",
      "No problem, I've removed (field)",
    ]);
    expect(removals[removals.length - 1]!.openerMatchesPrevious).toBe(true);
    expect(removals[removals.length - 1]!.boundaryClass).toBe('A');
    // Field-removal vs capability-disable openers are already distinguished
    // by trailing "from your trip." in the rendered acknowledgement.
    expect(removalTurns[0]!.renderedAcknowledgement).toContain(
      'the child count',
    );
    expect(disableTurns[0]!.renderedAcknowledgement).toContain(
      'from your trip.',
    );
  });

  it('captures that generic acknowledgements are rare and identical when repeated', () => {
    // Production selection emits Perfect. only for residual travel-field
    // changes. Consecutive identical generic acknowledgements would be class C.
    expect(transformBaselineAcknowledgement(ACKS.genericTravelFieldChange)).toBe(
      'Perfect, got it.',
    );
    expect(renderedOpener('Perfect, got it.')).toBe('Perfect,');

    // Prove identity: same deterministic string → identical rendered ack.
    expect(
      transformBaselineAcknowledgement(ACKS.genericTravelFieldChange),
    ).toBe(transformBaselineAcknowledgement(ACKS.genericTravelFieldChange));
  });

  it('aggregates remaining-repetition measurements across audited journeys', () => {
    const journeys: CapturedTurn[][] = [
      runJourney([...CORE_SETUP, { message: '2 adults' }]),
      runJourney([
        { message: 'go to Brisbane' },
        { message: 'go to Cairns' },
      ]),
      runJourney([
        { message: 'go to Cairns' },
        { message: 'from Brisbane' },
        { message: 'actually from Sydney' },
      ]),
      runJourney([
        ...CORE_SETUP,
        { message: 'Depart on 1 September 2026' },
        { message: 'Depart on 3 September 2026' },
      ]),
      runJourney([
        ...CORE_SETUP,
        { message: 'Return on 10 September 2026' },
        { message: 'Return on 12 September 2026' },
      ]),
      runJourney([...CORE_SETUP, { message: '2 adults' }, { message: '3 adults' }]),
      runJourney([
        ...CORE_SETUP,
        { message: '1 child' },
        { message: '2 children' },
      ]),
      runJourney([
        ...CORE_SETUP,
        { message: '1 infant' },
        { message: '2 infants' },
      ]),
      runJourney([...CORE_SETUP, { message: '1 child' }, { message: '1 infant' }]),
      runJourney([
        ...CORE_SETUP,
        { message: 'I like beaches' },
        { message: 'I need camping' },
      ]),
      runJourney([
        ...CORE_SETUP,
        { message: 'I need flights' },
        { message: '2 adults' },
        { message: 'I like beaches' },
        {
          message: 'remove flights',
          stateUpdate: { flightsRequested: false },
        },
        {
          message: 'remove beaches',
          stateUpdate: { beachesRequested: false },
        },
      ]),
      runJourney([
        ...CORE_SETUP,
        { message: '2 adults' },
        { message: '1 child' },
        { message: 'clear child', stateUpdate: { childCount: null } },
        { message: 'clear adults', stateUpdate: { adultCount: null } },
      ]),
      runJourney([
        ...CORE_SETUP,
        { message: '2 adults' },
        { message: '1 child' },
        { message: '1 infant' },
      ]),
    ];

    const allTurns = journeys.flat();
    const openers = allTurns
      .filter((turn) => turn.renderedAcknowledgement !== null)
      .map((turn) => turn.renderedOpener);
    const openerCounts = countBy(openers);
    const mostFrequent = Object.entries(openerCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]!;

    // After 16D diversification, Great, (destination + capability-added lead-in
    // counted separately) and shared family openers dominate — not Perfect,.
    expect(openerCounts['Perfect,'] ?? 0).toBe(0);
    expect(mostFrequent[0]).not.toBe('Perfect,');

    const longestOpenerRun = Math.max(
      ...journeys.map((journey) =>
        maxConsecutive(journey.map((turn) => turn.renderedOpener)),
      ),
    );
    // Same-family consecutive changes produce run length 2.
    expect(longestOpenerRun).toBeGreaterThanOrEqual(2);

    const longestAckRun = Math.max(
      ...journeys.map((journey) =>
        maxConsecutive(
          journey.map((turn) => turn.renderedAcknowledgement ?? ''),
        ),
      ),
    );
    // Complete acknowledgement strings change with values; identical-ack runs
    // should not appear in these journeys.
    expect(longestAckRun).toBe(1);

    const repeatedOpenerTurns = allTurns.filter(
      (turn) => turn.openerMatchesPrevious,
    );
    expect(repeatedOpenerTurns.length).toBeGreaterThan(0);
    expect(
      repeatedOpenerTurns.every((turn) => turn.boundaryClass === 'A'),
    ).toBe(true);
    expect(
      repeatedOpenerTurns.every((turn) => turn.distinguishableByCurrentAck),
    ).toBe(true);
    expect(
      repeatedOpenerTurns.every((turn) => !turn.completeAckMatchesPrevious),
    ).toBe(true);

    // Phase 16F: child → infant no longer shares an opener; infant re-sets may
    // still repeat That includes within the infant family (same-family Class A).
    const infantOpenerRepeats = repeatedOpenerTurns.filter(
      (turn) => turn.family === 'infantCount',
    );
    expect(
      infantOpenerRepeats.every((turn) => turn.renderedOpener === 'That includes'),
    ).toBe(true);
  });

  it('proves findings from production path without modifying production sources', () => {
    const productionFiles = readdirSync(CORE_SRC).filter((name) =>
      name.endsWith('.ts'),
    );
    // Characterization test file is the only Phase 16E artifact in tests;
    // production transform/layer sources must still match Phase 16D content.
    const transform = readFileSync(
      resolve(CORE_SRC, 'transformBaselineAcknowledgement.ts'),
      'utf8',
    );
    expect(transform).toContain('Phase 16D');
    expect(transform).toContain('Phase 16F');
    expect(transform).not.toContain('Phase 16E');
    expect(transform).toContain("We'll start from ${origin}.");
    expect(transform).toContain("I've noted ${childSingular} child.");
    expect(transform).toContain(
      'That includes ${infantSingular} infant.',
    );

    const layer = readFileSync(
      resolve(CORE_SRC, 'renderBaselineConversationalLayer.ts'),
      'utf8',
    );
    expect(layer).not.toContain('Phase 16E');
    expect(layer).toContain('renderBaselineAcknowledgementNeutralContinuation');

    expect(productionFiles.includes('transformBaselineAcknowledgement.ts')).toBe(
      true,
    );
  });
});
