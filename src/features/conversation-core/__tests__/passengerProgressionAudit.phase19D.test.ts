import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 19D — passenger progression gap audit.
 * Characterizes current behaviour only. Does not fix defects.
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ADULT_Q = FOLLOW_UPS.flightsAdultCount;
const GUEST_Q = FOLLOW_UPS.accommodationGuestCount;
const CHILD_Q = FOLLOW_UPS.childCount;
const INFANT_Q = FOLLOW_UPS.infantCount;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
} as const;

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-19d',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(
  message: string,
  seed: Partial<ConversationCoreState> = {},
  stateUpdate?: Partial<ConversationCoreState>,
) {
  const previous = createState(seed);
  const extracted = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-19d',
    assistantEntryId: 'assistant-19d',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
  const classification = classifyConversationStateChange(
    previous,
    result.state,
  );
  const components = selectConversationReplyComponents({
    state: result.state,
    classification,
  });
  return {
    previous,
    extracted,
    classification,
    components,
    state: result.state,
    reply: result.reply,
  };
}

describe('Phase 19D — passenger progression audit', () => {
  it('locks architecture: three passenger extractors; adult then child follow-up gates', () => {
    const factory = readSrc(
      'src/features/conversation-core/createConversationStateExtractor.ts',
    );
    expect(factory).toContain('AdultCountConversationStateExtractor');
    expect(factory).toContain('ChildCountConversationStateExtractor');
    expect(factory).toContain('InfantCountConversationStateExtractor');

    const selector = readSrc(
      'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
    );
    expect(selector).toMatch(/flightsRequested === true && state\.adultCount === null/);
    expect(selector).toMatch(
      /accommodationRequested === true && state\.adultCount === null/,
    );
    // Phase 19F/19G — child and infant are follow-up gates after adults.
    expect(selector).toMatch(/childCount/);
    expect(selector).toMatch(/infantCount/);

    const followUps = FOLLOW_UPS as Record<string, string>;
    expect(followUps.flightsAdultCount).toBe(
      'How many adults will be travelling?',
    );
    expect(followUps.accommodationGuestCount).toBe(
      'How many guests will be staying?',
    );
    expect(followUps.childCount).toBe('How many children will be travelling?');
    expect(followUps.infantCount).toBe('How many infants will be travelling?');
  });

  it('characterizes flights enabled with adultCount null → adult-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(ADULT_Q);

    const t = turn('hello there', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    expect(t.reply).toContain(ADULT_Q);
  });

  it('characterizes accommodation enabled with adultCount null → guest-count question', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(GUEST_Q);

    const t = turn('hello there', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.followUpQuestion).toBe(GUEST_Q);
    expect(t.reply).toContain(GUEST_Q);
  });

  it('characterizes flights before accommodation when both need adultCount', () => {
    const state = createState({
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
      accommodationRequested: true,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(ADULT_Q);
  });

  it('characterizes childCount null after adult count captured → child question (Phase 19F)', () => {
    const state = createState({
      ...COMPLETE_CORE,
      flightsRequested: true,
      adultCount: 2,
      childCount: null,
      infantCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(CHILD_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      flightsRequested: true,
      adultCount: 2,
      childCount: null,
    });
    expect(t.state.childCount).toBeNull();
    expect(t.components.followUpQuestion).toBe(CHILD_Q);
    expect(t.reply).toContain(CHILD_Q);
  });

  it('characterizes infantCount null after adult+child captured → infant question (Phase 19G)', () => {
    const state = createState({
      ...COMPLETE_CORE,
      accommodationRequested: true,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
    });
    expect(selectConversationFollowUpQuestion(state)).toBe(INFANT_Q);

    const t = turn('looking forward to it', {
      ...COMPLETE_CORE,
      accommodationRequested: true,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
    });
    expect(t.state.infantCount).toBeNull();
    expect(t.components.followUpQuestion).toBe(INFANT_Q);
    expect(t.reply).toContain(INFANT_Q);
  });

  it('characterizes bare "2" while adults question is active → no adultCount', () => {
    const t = turn('2', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
    expect(t.reply).toContain(ADULT_Q);
  });

  it('characterizes bare "2" while accommodation guests question is active → no adultCount', () => {
    const t = turn('2', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.followUpQuestion).toBe(GUEST_Q);
    expect(t.reply).toContain(GUEST_Q);
  });

  it('characterizes "2 adults" → adultCount=2 and advances to child follow-up (Phase 19F)', () => {
    const flights = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(flights.extracted).toEqual({ adultCount: 2 });
    expect(flights.state.adultCount).toBe(2);
    expect(flights.classification.hasInterpretedChange).toBe(true);
    expect(flights.classification.newlyPopulated).toContain('adultCount');
    expect(flights.components.acknowledgement).toMatch(/adult/i);
    expect(flights.components.followUpQuestion).toBe(CHILD_Q);

    const guests = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(guests.state.adultCount).toBe(2);
    expect(guests.components.followUpQuestion).toBe(CHILD_Q);
  });

  it('characterizes "2 guests" → adultCount stays null; guest Q re-asked', () => {
    const t = turn('2 guests', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(t.extracted).toEqual({});
    expect(t.state.adultCount).toBeNull();
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.components.followUpQuestion).toBe(GUEST_Q);
    expect(t.reply).toContain(GUEST_Q);
  });

  it('characterizes "2 children" → childCount set; adult Q still open when needed', () => {
    const volunteering = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(volunteering.extracted).toEqual({ childCount: 2 });
    expect(volunteering.state.childCount).toBe(2);
    expect(volunteering.state.adultCount).toBeNull();
    expect(volunteering.classification.newlyPopulated).toContain('childCount');
    expect(volunteering.components.acknowledgement).toMatch(/child/i);
    expect(volunteering.components.followUpQuestion).toBe(ADULT_Q);

    const afterAdults = turn('2 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      flightsRequested: true,
      childCount: null,
    });
    expect(afterAdults.state.childCount).toBe(2);
    // Phase 19G — child completion advances to infant question.
    expect(afterAdults.components.followUpQuestion).toBe(INFANT_Q);
  });

  it('characterizes "1 infant" → infantCount set; suppresses infant follow-up when complete', () => {
    const volunteering = turn('1 infant', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(volunteering.extracted).toEqual({ infantCount: 1 });
    expect(volunteering.state.infantCount).toBe(1);
    expect(volunteering.state.adultCount).toBeNull();
    expect(volunteering.components.acknowledgement).toMatch(/infant/i);
    expect(volunteering.components.followUpQuestion).toBe(ADULT_Q);

    const afterAdultsAndChildren = turn('1 infant', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      flightsRequested: true,
      infantCount: null,
    });
    expect(afterAdultsAndChildren.state.infantCount).toBe(1);
    expect(afterAdultsAndChildren.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes repeated identical adult count → no false newly-enabled / no adult ack', () => {
    const t = turn('2 adults', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({ adultCount: 2 });
    expect(t.state.adultCount).toBe(2);
    expect(t.classification.newlyPopulated).not.toContain('adultCount');
    expect(t.classification.updated).not.toContain('adultCount');
    expect(t.components.acknowledgement ?? '').not.toMatch(/adult/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes changed adult count → updated acknowledgement', () => {
    const t = turn('3 adults', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: 1,
      flightsRequested: true,
    });
    expect(t.extracted).toEqual({ adultCount: 3 });
    expect(t.state.adultCount).toBe(3);
    expect(t.classification.updated).toContain('adultCount');
    expect(t.classification.newlyPopulated).not.toContain('adultCount');
    expect(t.components.acknowledgement).toMatch(/3 adults/i);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('characterizes "2 adults and 1 child" → adult blocked; child may extract alone', () => {
    const t = turn('2 adults and 1 child', {
      ...COMPLETE_CORE,
      adultCount: null,
      childCount: null,
      flightsRequested: true,
    });
    // Adult extractor blocks any child/infant mention in the same message.
    expect(t.extracted.adultCount).toBeUndefined();
    expect(t.state.adultCount).toBeNull();
    // Child cue `\b1 child\b` still matches inside the combined sentence.
    expect(t.extracted.childCount).toBe(1);
    expect(t.state.childCount).toBe(1);
    expect(t.components.acknowledgement).toMatch(/child/i);
    expect(t.components.followUpQuestion).toBe(ADULT_Q);
  });

  it('characterizes zero adults / children / infants as non-extracting', () => {
    const zeroAdults = turn('0 adults', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(zeroAdults.extracted).toEqual({});
    expect(zeroAdults.state.adultCount).toBeNull();
    expect(zeroAdults.components.followUpQuestion).toBe(ADULT_Q);

    const zeroChildren = turn('0 children', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: null,
      flightsRequested: true,
    });
    expect(zeroChildren.extracted).toEqual({});
    expect(zeroChildren.state.childCount).toBeNull();
    expect(zeroChildren.components.followUpQuestion).toBe(CHILD_Q);

    const zeroInfants = turn('0 infants', {
      ...COMPLETE_CORE,
      adultCount: 2,
      childCount: 2,
      infantCount: null,
      flightsRequested: true,
    });
    expect(zeroInfants.extracted).toEqual({});
    expect(zeroInfants.state.infantCount).toBeNull();
    expect(zeroInfants.components.followUpQuestion).toBe(INFANT_Q);
  });

  it('characterizes unsupported input during passenger progression → re-asks active count Q', () => {
    const duringAdults = turn('asdf qwerty', {
      ...COMPLETE_CORE,
      adultCount: null,
      flightsRequested: true,
    });
    expect(duringAdults.extracted).toEqual({});
    expect(duringAdults.classification.hasInterpretedChange).toBe(false);
    expect(duringAdults.components.followUpQuestion).toBe(ADULT_Q);
    expect(duringAdults.reply).toContain(ADULT_Q);

    const duringGuests = turn('asdf qwerty', {
      ...COMPLETE_CORE,
      adultCount: null,
      accommodationRequested: true,
    });
    expect(duringGuests.components.followUpQuestion).toBe(GUEST_Q);
    expect(duringGuests.reply).toContain(GUEST_Q);
  });

  it('characterizes car-hire-only and no-service trips never solicit adultCount', () => {
    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: null,
        }),
      ),
    ).toBe(NEUTRAL);

    expect(
      selectConversationFollowUpQuestion(
        createState({
          ...COMPLETE_CORE,
          adultCount: null,
          carHireRequested: true,
        }),
      ),
    ).toBe(NEUTRAL);
  });

  it('characterizes trusted explicit updates can still set child/infant/adult without solicitation', () => {
    const child = turn(
      'please note',
      {
        ...COMPLETE_CORE,
        adultCount: 2,
        flightsRequested: true,
        childCount: null,
      },
      { childCount: 2 },
    );
    expect(child.state.childCount).toBe(2);
    expect(child.components.acknowledgement).toMatch(/child/i);
    // Phase 19G — after child is set, infant question is next.
    expect(child.components.followUpQuestion).toBe(INFANT_Q);

    const infant = turn(
      'please note',
      {
        ...COMPLETE_CORE,
        adultCount: 2,
        childCount: 2,
        flightsRequested: true,
        infantCount: null,
      },
      { infantCount: 1 },
    );
    expect(infant.state.infantCount).toBe(1);
    expect(infant.components.acknowledgement).toMatch(/infant/i);
    expect(infant.components.followUpQuestion).toBe(NEUTRAL);
  });
});
