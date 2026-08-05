import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateUpdate,
} from '../index';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { createConversationStateExtractor } from '../createConversationStateExtractor';

/**
 * Phase 11D — request-flag null-transition characterisation.
 *
 * Proves production-reachable writers, public null capability, extraction
 * limitations, and acknowledgement outcomes through processConversationTurn.
 * Does not change production behaviour.
 */

const ROOT = process.cwd();
const TYPES_SOURCE = resolve(ROOT, 'src/features/conversation-core/types.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const APPLY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/applyConversationStateUpdate.ts',
);
const FLIGHTS_EXTRACTOR_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/FlightsRequestedConversationStateExtractor.ts',
);
const FACTORY_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationStateExtractor.ts',
);
const AI_PANEL_SOURCE = resolve(
  ROOT,
  'src/components/trip-platform/AiPlanningPanel.tsx',
);
const CONCIERGE_PANEL_SOURCE = resolve(
  ROOT,
  'src/components/trip-platform/ConciergePlanPanel.tsx',
);

const CONVERSATION_ID = 'conversation-core-phase-11d-null-001';
const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

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
    destination: 'Cairns',
    origin: 'Sydney',
    departureDate: '2026-08-28',
    returnDate: '2026-09-05',
    adultCount: 2,
    ...overrides,
  };
}

function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
  stateUpdate?: ConversationStateUpdate,
) {
  return processConversationTurn({
    message,
    state,
    userEntryId: `user-11d-${index}`,
    assistantEntryId: `assistant-11d-${index}`,
    userMessageAt: new Date(CREATED_AT.getTime() + index * 2000),
    assistantMessageAt: new Date(CREATED_AT.getTime() + index * 2000 + 1000),
    ...(stateUpdate !== undefined ? { stateUpdate } : {}),
  });
}

describe('phase 11D — request-flag null-transition audit characterisation', () => {
  it('public ConversationStateUpdate permits boolean | null for request flags', () => {
    const types = readFileSync(TYPES_SOURCE, 'utf8');
    expect(types).toMatch(/flightsRequested\?: boolean \| null/);
    expect(types).toMatch(/flightsRequested: boolean \| null/);
    expect(types).toMatch(/Explicit `null` \/ `false` values are stored as supplied/);

    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    expect(processTurn).toMatch(
      /supplied values \(including `false` and `null`\) are stored/,
    );

    const update: ConversationStateUpdate = {
      flightsRequested: null,
    };
    expectTypeOf(update.flightsRequested).toEqualTypeOf<
      boolean | null | undefined
    >();
    expect(update.flightsRequested).toBeNull();
  });

  it('canonical initial request flags are null (unset), not false', () => {
    const initial = createInitialConversationCoreState({
      conversationId: CONVERSATION_ID,
      now: CREATED_AT,
    });
    expect(initial.flightsRequested).toBeNull();
    expect(initial.accommodationRequested).toBeNull();
    expect(initial.toursRequested).toBeNull();
    expect(initial.accessibleTravelRequested).toBeNull();
  });

  it('explicit stateUpdate stores request flag true, false, and null exactly', () => {
    const initial = createState({ flightsRequested: null });

    const enabled = turn('hello', initial, 0, { flightsRequested: true });
    expect(enabled.state.flightsRequested).toBe(true);
    expect(enabled.reply).toContain(
      "Great, I've added flights to your trip.",
    );

    const disabled = turn('hello', enabled.state, 1, {
      flightsRequested: false,
    });
    expect(disabled.state.flightsRequested).toBe(false);
    expect(disabled.state.flightsRequested).not.toBeNull();
    expect(disabled.reply).toContain(
      "No problem, I've removed flights from your trip.",
    );

    const cleared = turn('hello', enabled.state, 2, {
      flightsRequested: null,
    });
    expect(cleared.state.flightsRequested).toBeNull();
    expect(cleared.reply).not.toMatch(/I've removed flights/);
    expect(cleared.reply).not.toMatch(/Perfect\./);
  });

  it('explicit null→false via stateUpdate is newlyDisabled and removal-acknowledged', () => {
    const previous = createState({ flightsRequested: null });
    const result = turn('hello', previous, 0, { flightsRequested: false });

    expect(result.state.flightsRequested).toBe(false);
    const classification = classifyConversationStateChange(
      previous,
      result.state,
    );
    expect(classification.newlyDisabledRequestFlags).toEqual([
      'flightsRequested',
    ]);
    expect(classification.newlyPopulated).not.toContain('flightsRequested');
    expect(classification.newlyEnabledRequestFlags).toEqual([]);
    expect(result.reply).toContain(
      "No problem, I've removed flights from your trip.",
    );
    expect(result.reply).not.toMatch(/I've added flights/);
  });

  it('explicit true→null via stateUpdate is updated (not newlyDisabled) with no acknowledgement', () => {
    const previous = createState({ flightsRequested: true });
    const result = turn('hello', previous, 0, { flightsRequested: null });

    expect(result.state.flightsRequested).toBeNull();
    const classification = classifyConversationStateChange(
      previous,
      result.state,
    );
    expect(classification.updated).toContain('flightsRequested');
    expect(classification.newlyDisabledRequestFlags).toEqual([]);
    expect(classification.hasAcknowledgementEligibleChange).toBe(false);
    expect(classification.hasInterpretedChange).toBe(true);
    expect(result.reply).not.toMatch(/I've removed flights/);
    expect(result.reply).not.toMatch(/Perfect\./);
  });

  it('message extraction can enable a request flag (null→true) but not disable or clear', () => {
    const extractor = createConversationStateExtractor();
    const fromNull = extractor.extract({
      message: 'I need flights',
      currentState: createState({ flightsRequested: null }),
    });
    expect(fromNull.stateUpdate).toEqual({ flightsRequested: true });

    const enabled = turn('I need flights', createState({ flightsRequested: null }), 0);
    expect(enabled.state.flightsRequested).toBe(true);
    expect(enabled.reply).toContain(
      "Great, I've added flights to your trip.",
    );

    const alreadyTrue = createState({ flightsRequested: true });
    const blockedDisable = turn('no flights', alreadyTrue, 1);
    expect(blockedDisable.state.flightsRequested).toBe(true);

    const blockedClear = turn('remove flights', alreadyTrue, 2);
    expect(blockedClear.state.flightsRequested).toBe(true);

    const alreadyFalse = createState({ flightsRequested: false });
    const negationPreservesFalse = turn('no flights', alreadyFalse, 3);
    expect(negationPreservesFalse.state.flightsRequested).toBe(false);

    const flightsSource = readFileSync(FLIGHTS_EXTRACTOR_SOURCE, 'utf8');
    expect(flightsSource).toMatch(/emits only true, never false or null/);
    expect(flightsSource.includes('flightsRequested: false')).toBe(false);
    expect(flightsSource.includes('flightsRequested: null')).toBe(false);
  });

  it('applyConversationStateUpdate writes supplied null; omitted keys preserve prior', () => {
    const applySource = readFileSync(APPLY_SOURCE, 'utf8');
    expect(applySource).toMatch(
      /stateUpdate\?\.flightsRequested !== undefined[\s\S]*\? stateUpdate\.flightsRequested[\s\S]*: currentState\.flightsRequested/,
    );

    const previous = createState({ flightsRequested: true });
    const omitted = turn('unrelated', previous, 0);
    expect(omitted.state.flightsRequested).toBe(true);

    const cleared = turn('unrelated', previous, 1, {
      flightsRequested: null,
    });
    expect(cleared.state.flightsRequested).toBeNull();
  });

  it('current UI callers never pass stateUpdate (false/null only via public API)', () => {
    const aiPanel = readFileSync(AI_PANEL_SOURCE, 'utf8');
    const concierge = readFileSync(CONCIERGE_PANEL_SOURCE, 'utf8');
    // Engine Consolidation Phase 7: both surfaces use the Consultant Turn Governor.
    expect(aiPanel).toMatch(/runConsultantTurn\(/);
    expect(aiPanel).toMatch(/from ['"].*conversation-consultant['"]/);
    expect(concierge).toMatch(/runConsultantTurn\(/);
    expect(concierge).toMatch(/from ['"].*conversation-consultant['"]/);
    expect(concierge).not.toMatch(/processConversationTurn\(/);
    // Governor owns interpretation + commits; panels do not inject stateUpdate.
    expect(aiPanel.includes('stateUpdate:')).toBe(false);
    expect(aiPanel.includes('skipExtraction')).toBe(false);
    expect(concierge.includes('stateUpdate')).toBe(false);
  });

  it('factory-wired request extractors include tours/nightlife/shopping/wellness/family/accessible (Phase 19B/19C)', () => {
    const factory = readFileSync(FACTORY_SOURCE, 'utf8');
    expect(factory).toMatch(/FlightsRequestedConversationStateExtractor/);
    expect(factory).toMatch(/NationalParksRequestedConversationStateExtractor/);
    expect(factory.includes('ToursRequested')).toBe(true);
    expect(factory.includes('NightlifeRequested')).toBe(true);
    expect(factory.includes('ShoppingRequested')).toBe(true);
    expect(factory.includes('WellnessRequested')).toBe(true);
    expect(factory.includes('FamilyActivitiesRequested')).toBe(true);
    expect(factory.includes('AccessibleTravelRequested')).toBe(true);
    expect(factory.includes('EventsRequestedConversationStateExtractor')).toBe(
      false,
    );
  });

  it('classifies the nine request-flag transitions factually', () => {
    const base = createState();

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: null },
        { ...base, flightsRequested: true },
      ).newlyEnabledRequestFlags,
    ).toEqual(['flightsRequested']);

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: null },
        { ...base, flightsRequested: false },
      ).newlyDisabledRequestFlags,
    ).toEqual(['flightsRequested']);

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: null },
        { ...base, flightsRequested: null },
      ).unchanged,
    ).toContain('flightsRequested');

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: false },
        { ...base, flightsRequested: true },
      ).newlyEnabledRequestFlags,
    ).toEqual(['flightsRequested']);

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: false },
        { ...base, flightsRequested: false },
      ).unchanged,
    ).toContain('flightsRequested');

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: false },
        { ...base, flightsRequested: null },
      ).updated,
    ).toContain('flightsRequested');

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: true },
        { ...base, flightsRequested: true },
      ).unchanged,
    ).toContain('flightsRequested');

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: true },
        { ...base, flightsRequested: false },
      ).newlyDisabledRequestFlags,
    ).toEqual(['flightsRequested']);

    expect(
      classifyConversationStateChange(
        { ...base, flightsRequested: true },
        { ...base, flightsRequested: null },
      ).updated,
    ).toContain('flightsRequested');
  });
});
