import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16G — audit whether same-family opener diversification can be
 * principled and stateless with current acknowledgement-string inputs.
 *
 * Characterization only. Production wording is unchanged.
 */

const ROOT = process.cwd();
const TRANSFORM_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/transformBaselineAcknowledgement.ts',
);
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;

type Family =
  | 'destination'
  | 'origin'
  | 'departureDate'
  | 'returnDate'
  | 'adultCount'
  | 'childCount'
  | 'infantCount';

type CapturedTurn = {
  turn: number;
  message: string;
  family: Family | 'other';
  value: string;
  deterministicAcknowledgement: string | null;
  renderedAcknowledgement: string | null;
  renderedOpener: string;
  /** Whether the string encodes set vs changed (always false with current catalogue). */
  identifiesSetVersusChanged: boolean;
  /** Whether the string encodes first vs repeated occurrence (always false). */
  identifiesFirstVersusRepeated: boolean;
};

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16g',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function classifyFamily(acknowledgement: string | null): Family | 'other' {
  if (acknowledgement === null) return 'other';
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
  return 'other';
}

function renderedOpener(rendered: string | null): string {
  if (rendered === null) return '(none)';
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

/**
 * Catalogue acknowledgement strings still do not encode set/changed.
 * Phase 16J wording uses acknowledgementEvent — not literal value content.
 */
function identifiesSetVersusChanged(_acknowledgement: string | null): boolean {
  return false;
}

function identifiesFirstVersusRepeated(
  _acknowledgement: string | null,
): boolean {
  return false;
}

function runJourney(messages: string[]): CapturedTurn[] {
  let state = createState();
  const captured: CapturedTurn[] = [];

  for (const [index, message] of messages.entries()) {
    const previous = structuredClone(state);
    const result = processConversationTurn({
      message,
      state,
      userEntryId: `user-16g-${index}`,
      assistantEntryId: `assistant-16g-${index}`,
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
    const components = selectConversationReplyComponents({
      state: result.state,
      classification,
    });
    const deterministicAcknowledgement = components.acknowledgement;
    const renderedAcknowledgement =
      deterministicAcknowledgement === null
        ? null
        : transformBaselineAcknowledgement(
            deterministicAcknowledgement,
            components.acknowledgementEvent,
          );

    captured.push({
      turn: index + 1,
      message,
      family: classifyFamily(deterministicAcknowledgement),
      value: deterministicAcknowledgement ?? '',
      deterministicAcknowledgement,
      renderedAcknowledgement,
      renderedOpener: renderedOpener(renderedAcknowledgement),
      identifiesSetVersusChanged: identifiesSetVersusChanged(
        deterministicAcknowledgement,
      ),
      identifiesFirstVersusRepeated: identifiesFirstVersusRepeated(
        deterministicAcknowledgement,
      ),
    });
    state = result.state;
  }

  return captured;
}

const CORE = [
  'go to Cairns',
  'from Sydney',
  'Depart on 28 August 2026',
  'Return on 5 September 2026',
] as const;

describe('phase 16G — audit stateless same-family diversification', () => {
  it('locks same-family set-then-change openers via acknowledgementEvent (not literal values)', () => {
    const destination = runJourney([
      'go to Melbourne',
      'go to Cairns',
      'go to Hobart',
    ]);
    expect(destination.map((turn) => turn.family)).toEqual([
      'destination',
      'destination',
      'destination',
    ]);
    // Phase 16J: initial set vs later changes use event-aware openers.
    expect(destination.map((turn) => turn.renderedOpener)).toEqual([
      'Great,',
      'Updated —',
      'Updated —',
    ]);
    expect(destination.map((turn) => turn.renderedAcknowledgement)).toEqual([
      'Great, Melbourne it is.',
      'Updated — Cairns it is.',
      'Updated — Hobart it is.',
    ]);
    expect(
      new Set(destination.map((turn) => turn.deterministicAcknowledgement)).size,
    ).toBe(3);
    // Catalogue strings still do not encode set vs changed.
    expect(
      destination.every((turn) => turn.identifiesSetVersusChanged === false),
    ).toBe(true);
    expect(
      destination.every((turn) => turn.identifiesFirstVersusRepeated === false),
    ).toBe(true);

    const origin = runJourney([
      'go to Cairns',
      'from Sydney',
      'actually from Brisbane',
      'actually from Adelaide',
    ]);
    const originTurns = origin.filter((turn) => turn.family === 'origin');
    expect(originTurns).toHaveLength(3);
    expect(originTurns.map((turn) => turn.renderedOpener)).toEqual([
      "We'll start",
      "We'll depart",
      "We'll depart",
    ]);
    expect(originTurns.map((turn) => turn.renderedAcknowledgement)).toEqual([
      "We'll start from Sydney.",
      "We'll depart from Brisbane instead.",
      "We'll depart from Adelaide instead.",
    ]);
    expect(
      originTurns.every((turn) => turn.identifiesSetVersusChanged === false),
    ).toBe(true);

    const departure = runJourney([
      'go to Cairns',
      'from Sydney',
      'Depart on 28 August 2026',
      'Return on 5 September 2026',
      'Depart on 1 September 2026',
      'Depart on 3 September 2026',
    ]);
    const departureTurns = departure.filter(
      (turn) => turn.family === 'departureDate',
    );
    expect(departureTurns).toHaveLength(3);
    expect(departureTurns.map((turn) => turn.renderedOpener)).toEqual([
      'Departure is set',
      'Departure is now set',
      'Departure is now set',
    ]);
    expect(
      new Set(departureTurns.map((turn) => turn.renderedAcknowledgement)).size,
    ).toBe(3);

    const returnDates = runJourney([
      ...CORE,
      'Return on 10 September 2026',
      'Return on 12 September 2026',
    ]);
    const returnTurns = returnDates.filter(
      (turn) => turn.family === 'returnDate',
    );
    expect(returnTurns).toHaveLength(3);
    expect(returnTurns.map((turn) => turn.renderedOpener)).toEqual([
      'Return is set',
      'Return is now set',
      'Return is now set',
    ]);
    expect(
      new Set(returnTurns.map((turn) => turn.renderedAcknowledgement)).size,
    ).toBe(3);

    const adults = runJourney([...CORE, '1 adult', '2 adults', '4 adults']);
    const adultTurns = adults.filter((turn) => turn.family === 'adultCount');
    expect(adultTurns).toHaveLength(3);
    expect(adultTurns.map((turn) => turn.renderedOpener)).toEqual([
      'Travelling with',
      'Updated to',
      'Updated to',
    ]);
    expect(adultTurns.map((turn) => turn.renderedAcknowledgement)).toEqual([
      'Travelling with 1 adult.',
      'Updated to 2 adults.',
      'Updated to 4 adults.',
    ]);

    const children = runJourney([
      ...CORE,
      '1 child',
      '2 children',
      '3 children',
    ]);
    const childTurns = children.filter((turn) => turn.family === 'childCount');
    expect(childTurns).toHaveLength(3);
    expect(childTurns.map((turn) => turn.renderedOpener)).toEqual([
      "I've noted",
      'Updated to',
      'Updated to',
    ]);
    expect(childTurns.map((turn) => turn.renderedAcknowledgement)).toEqual([
      "I've noted 1 child.",
      'Updated to 2 children.',
      'Updated to 3 children.',
    ]);

    const infants = runJourney([
      ...CORE,
      '1 infant',
      '2 infants',
      '3 infants',
    ]);
    const infantTurns = infants.filter((turn) => turn.family === 'infantCount');
    expect(infantTurns).toHaveLength(3);
    expect(infantTurns.map((turn) => turn.renderedOpener)).toEqual([
      'That includes',
      'Updated to',
      'Updated to',
    ]);
    expect(infantTurns.map((turn) => turn.renderedAcknowledgement)).toEqual([
      'That includes 1 infant.',
      'Updated to 2 infants.',
      'Updated to 3 infants.',
    ]);
  });

  it('proves transformBaselineAcknowledgement does not inspect history or trip state', () => {
    const source = readFileSync(TRANSFORM_SOURCE, 'utf8');
    expect(source).toMatch(
      /export function transformBaselineAcknowledgement\(\s*acknowledgement: string,\s*acknowledgementEvent: ConversationAcknowledgementEvent = null,\s*\)/,
    );
    expect(source.includes('transcript')).toBe(false);
    expect(source.includes('turnCount')).toBe(false);
    expect(source.includes('setVersusChanged')).toBe(false);
    expect(source.includes('firstOccurrence')).toBe(false);
    // No history / previous-state params — event is the semantic input.
    expect(source).not.toMatch(
      /transformBaselineAcknowledgement\([^)]*previous/,
    );
    expect(source).not.toMatch(
      /transformBaselineAcknowledgement\([^)]*classification/,
    );

    // Catalogue set and change for destination use the same template shape.
    expect(ACKS.destination('Melbourne')).toBe('Great — Melbourne.');
    expect(ACKS.destination('Cairns')).toBe('Great — Cairns.');
    expect(ACKS.destination('Melbourne').replace('Melbourne', 'Cairns')).toBe(
      ACKS.destination('Cairns'),
    );
  });

  it('proves catalogue strings alone are not a set-versus-changed semantic signal', () => {
    const destination = runJourney([
      'go to Melbourne',
      'go to Cairns',
      'go to Hobart',
    ]);
    // Catalogue acknowledgement strings still cannot mark set vs changed.
    expect(destination[0]!.identifiesSetVersusChanged).toBe(false);
    expect(destination[1]!.identifiesSetVersusChanged).toBe(false);
    expect(destination[2]!.identifiesSetVersusChanged).toBe(false);
    expect(destination[0]!.identifiesFirstVersusRepeated).toBe(false);
    expect(destination[1]!.identifiesFirstVersusRepeated).toBe(false);

    // Technical distinguishability of values is present…
    expect(destination[0]!.deterministicAcknowledgement).not.toBe(
      destination[1]!.deterministicAcknowledgement,
    );
    // …but literal value differences alone are not the semantic signal.
    // Phase 16J openers differ via acknowledgementEvent, not via place names.
    expect(destination[0]!.renderedOpener).toBe('Great,');
    expect(destination[1]!.renderedOpener).toBe('Updated —');
    expect(
      transformBaselineAcknowledgement(
        destination[1]!.deterministicAcknowledgement!,
        null,
      ),
    ).toBe('Great, Cairns it is.');
  });

  it('preserves Phase 16F adult → child → infant and Phase 16D mixed-field sequences', () => {
    const passenger = runJourney([
      ...CORE,
      '2 adults',
      '1 child',
      '1 infant',
    ]);
    expect(
      passenger.slice(4).map((turn) => turn.renderedOpener),
    ).toEqual(['Travelling with', "I've noted", 'That includes']);

    const mixed = runJourney([
      'I want to go to Cairns',
      'flying from Sydney',
      'Depart on 28 August 2026',
      'Return on 5 September 2026',
      '2 adults',
    ]);
    expect(mixed.map((turn) => turn.renderedOpener)).toEqual([
      'Great,',
      "We'll start",
      'Departure is set',
      'Return is set',
      'Travelling with',
    ]);
  });

  it('documents that singular/plural changes wording interiors but not opener families', () => {
    expect(transformBaselineAcknowledgement(ACKS.adultCount(1))).toBe(
      'Travelling with 1 adult.',
    );
    expect(transformBaselineAcknowledgement(ACKS.adultCount(2))).toBe(
      'Travelling with 2 adults.',
    );
    expect(renderedOpener('Travelling with 1 adult.')).toBe('Travelling with');
    expect(renderedOpener('Travelling with 2 adults.')).toBe('Travelling with');

    expect(transformBaselineAcknowledgement(ACKS.childCount(1))).toBe(
      "I've noted 1 child.",
    );
    expect(transformBaselineAcknowledgement(ACKS.childCount(2))).toBe(
      "I've noted 2 children.",
    );
    expect(renderedOpener("I've noted 1 child.")).toBe("I've noted");
    expect(renderedOpener("I've noted 2 children.")).toBe("I've noted");

    expect(transformBaselineAcknowledgement(ACKS.infantCount(1))).toBe(
      'That includes 1 infant.',
    );
    expect(transformBaselineAcknowledgement(ACKS.infantCount(2))).toBe(
      'That includes 2 infants.',
    );
    expect(renderedOpener('That includes 1 infant.')).toBe('That includes');
    expect(renderedOpener('That includes 2 infants.')).toBe('That includes');
  });
});
