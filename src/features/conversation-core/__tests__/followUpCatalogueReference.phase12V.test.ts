import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';
import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from '../conversationReplyCatalogue';
import { selectConversationContinuationPrompt } from '../selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';

/**
 * Phase 12V — follow-up / continuation catalogue-reference characterisation.
 *
 * Locks the boundary that selectors return catalogue-owned wording only
 * (exact equality, no inline literals, no wording mutation). Does not
 * re-cover priority/eligibility owned by Phase 12A–12J.
 */

const ROOT = process.cwd();
const FOLLOW_UP_SELECTOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
);
const CONTINUATION_SELECTOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationContinuationPrompt.ts',
);

const CONVERSATION_ID = 'conversation-core-phase-12v-catalogue-ref-001';
const CREATED_AT = new Date('2026-07-30T00:00:00.000Z');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const CATALOGUE_FOLLOW_UP_VALUES: readonly string[] = Object.values(FOLLOW_UPS);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    }),
    status: 'active',
    turnCount: 1,
    ...overrides,
  };
}

function completeCore(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return createState({
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
    ...overrides,
  });
}

/** Minimal states that surface each catalogue follow-up value. */
const FOLLOW_UP_CASES: ReadonlyArray<{
  key: keyof typeof FOLLOW_UPS;
  state: ConversationCoreState;
}> = [
  { key: 'destination', state: createState() },
  { key: 'origin', state: createState({ destination: 'Cairns' }) },
  {
    key: 'departureDate',
    state: createState({ destination: 'Cairns', origin: 'Sydney' }),
  },
  {
    key: 'returnDate',
    state: createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    }),
  },
  {
    key: 'flightsAdultCount',
    state: completeCore({ flightsRequested: true, adultCount: null }),
  },
  {
    key: 'accommodationGuestCount',
    state: completeCore({ accommodationRequested: true, adultCount: null }),
  },
  {
    key: 'childCount',
    state: completeCore({
      adultCount: 2,
      childCount: null,
      flightsRequested: true,
    }),
  },
  {
    key: 'activities',
    state: completeCore({ adultCount: 2, activitiesRequested: true }),
  },
  {
    key: 'restaurants',
    state: completeCore({ adultCount: 2, restaurantsRequested: true }),
  },
  { key: 'neutralContinuation', state: completeCore() },
];

describe('phase 12V — follow-up catalogue-reference characterisation', () => {
  it('keeps user-facing follow-up wording out of the selectors', () => {
    const followUpSource = readFileSync(FOLLOW_UP_SELECTOR_SOURCE, 'utf8');
    const continuationSource = readFileSync(
      CONTINUATION_SELECTOR_SOURCE,
      'utf8',
    );

    for (const wording of CATALOGUE_FOLLOW_UP_VALUES) {
      expect(followUpSource.includes(`'${wording}'`)).toBe(false);
      expect(followUpSource.includes(`"${wording}"`)).toBe(false);
      expect(continuationSource.includes(`'${wording}'`)).toBe(false);
      expect(continuationSource.includes(`"${wording}"`)).toBe(false);
    }

    expect(followUpSource).toMatch(/CONVERSATION_REPLY_CATALOGUE\.followUps\./);
    expect(followUpSource).toMatch(/NEUTRAL_TRIP_FALLBACK_REPLY/);
    expect(continuationSource).toMatch(/NEUTRAL_TRIP_FALLBACK_REPLY/);
  });

  it('does not construct, prefix, suffix, or mutate catalogue wording', () => {
    const followUpSource = readFileSync(FOLLOW_UP_SELECTOR_SOURCE, 'utf8');
    const continuationSource = readFileSync(
      CONTINUATION_SELECTOR_SOURCE,
      'utf8',
    );

    for (const source of [followUpSource, continuationSource]) {
      expect(source.includes('`${')).toBe(false);
      expect(source.includes('.concat(')).toBe(false);
      expect(source.includes('.replace(')).toBe(false);
      expect(source.includes('.trim(')).toBe(false);
      expect(source.includes('.slice(')).toBe(false);
      expect(source.includes('+ \'')).toBe(false);
      expect(source.includes('+ "')).toBe(false);
    }
  });

  it('returns values that exactly equal the corresponding catalogue follow-up entries', () => {
    for (const entry of FOLLOW_UP_CASES) {
      const selected = selectConversationFollowUpQuestion(entry.state);
      expect(selected, entry.key).toBe(FOLLOW_UPS[entry.key]);
      expect(selected, entry.key).toBe(
        CONVERSATION_REPLY_CATALOGUE.followUps[entry.key],
      );
      expect(CATALOGUE_FOLLOW_UP_VALUES).toContain(selected);
    }

    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(FOLLOW_UPS.neutralContinuation);
  });

  it('returns only catalogue-owned follow-up values from selectConversationFollowUpQuestion', () => {
    for (const entry of FOLLOW_UP_CASES) {
      const selected = selectConversationFollowUpQuestion(entry.state);
      expect(selected).not.toBeNull();
      expect(typeof selected).toBe('string');
      expect(CATALOGUE_FOLLOW_UP_VALUES.includes(selected as string)).toBe(true);
    }
  });

  it('returns only the catalogue-owned neutral continuation from selectConversationContinuationPrompt', () => {
    const continuation = selectConversationContinuationPrompt({
      followUpQuestion: null,
    });
    expect(continuation).toBe(FOLLOW_UPS.neutralContinuation);
    expect(continuation).toBe(NEUTRAL_TRIP_FALLBACK_REPLY);
    expect(continuation).toBe(
      CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation,
    );
  });

  it('returns null as the only non-catalogue selector result', () => {
    for (const wording of CATALOGUE_FOLLOW_UP_VALUES) {
      const continuation = selectConversationContinuationPrompt({
        followUpQuestion: wording,
      });
      expect(continuation).toBeNull();
    }

    const terminalFollowUp = selectConversationFollowUpQuestion(completeCore());
    expect(terminalFollowUp).toBe(FOLLOW_UPS.neutralContinuation);

    const continuationWhenFollowUpPresent =
      selectConversationContinuationPrompt({
        followUpQuestion: terminalFollowUp,
      });
    expect(continuationWhenFollowUpPresent).toBeNull();

    const continuationWhenSpecificFollowUp =
      selectConversationContinuationPrompt({
        followUpQuestion: FOLLOW_UPS.destination,
      });
    expect(continuationWhenSpecificFollowUp).toBeNull();
    expect(continuationWhenSpecificFollowUp).not.toBe(
      FOLLOW_UPS.neutralContinuation,
    );
  });
});
