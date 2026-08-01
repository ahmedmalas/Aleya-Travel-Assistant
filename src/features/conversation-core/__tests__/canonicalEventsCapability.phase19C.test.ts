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
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';

/**
 * Phase 19C — single canonical events capability (`eventsFestivalsRequested`).
 */

const ROOT = process.cwd();
const COMPOSITE = createConversationStateExtractor();
const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;
const ACTIVITIES_Q = FOLLOW_UPS.activities;
const NEUTRAL = FOLLOW_UPS.neutralContinuation;
const EVENTS_LABEL = 'events and festivals';

const COMPLETE_CORE = {
  destination: 'Cairns',
  origin: 'Sydney',
  departureDate: '2026-08-28',
  returnDate: '2026-09-01',
  adultCount: 2,
} as const;

const SUPPORTED_PHRASES = [
  'events',
  'I want events',
  'Add local events',
  'local events',
  'festivals',
  'I want festivals',
  'Include festivals',
  'local festivals',
  'Show us local festivals',
  'events and festivals',
  'We want events and festivals',
  "What's on during our trip",
  'what is on',
  'things happening nearby',
] as const;

const BLOCKED_PHRASES = [
  'Are events expensive?',
  'Are there festivals nearby?',
  'What events are happening?',
  'We do not want events',
  'Remove festivals',
  'The hotel hosts events',
] as const;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-19c',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function turn(message: string, seed: Partial<ConversationCoreState> = {}) {
  const previous = createState(seed);
  const extracted = COMPOSITE.extract({
    message,
    currentState: previous,
  }).stateUpdate;
  const result = processConversationTurn({
    message,
    state: previous,
    userEntryId: 'user-19c',
    assistantEntryId: 'assistant-19c',
    userMessageAt: new Date('2026-07-29T00:00:00.000Z'),
    assistantMessageAt: new Date('2026-07-29T00:00:01.000Z'),
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

describe('Phase 19C — canonical events capability', () => {
  it('locks a single canonical events field and removes the dual-model extractor', () => {
    const types = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/types.ts'),
      'utf8',
    );
    expect(types).toMatch(/eventsFestivalsRequested:\s*boolean \| null/);
    expect(types).not.toMatch(/eventsRequested:\s*boolean \| null/);
    expect(types).not.toMatch(/eventsRequested\?:/);

    const factory = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/createConversationStateExtractor.ts',
      ),
      'utf8',
    );
    expect(factory).toContain('EventsFestivalsRequestedConversationStateExtractor');
    expect(factory).not.toContain('EventsRequestedConversationStateExtractor');

    const selector = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
      ),
      'utf8',
    );
    expect(selector).toContain("'eventsFestivalsRequested'");
    expect(selector).not.toContain("'eventsRequested'");

    const ack = readFileSync(
      resolve(
        ROOT,
        'src/features/conversation-core/selectConversationAcknowledgement.ts',
      ),
      'utf8',
    );
    expect(ack).toContain("['eventsFestivalsRequested', 'events and festivals']");
    expect(ack).not.toContain("['eventsRequested'");
  });

  it.each(SUPPORTED_PHRASES)(
    'populates only eventsFestivalsRequested for %# %s',
    (message) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        activitiesRequested: true,
      });
      expect(t.extracted).toEqual({ eventsFestivalsRequested: true });
      expect(t.state.eventsFestivalsRequested).toBe(true);
      expect(t.extracted).not.toHaveProperty('eventsRequested');
      expect(t.classification.hasInterpretedChange).toBe(true);
      expect(t.classification.newlyEnabledRequestFlags).toEqual([
        'eventsFestivalsRequested',
      ]);
      expect(t.components.acknowledgement).toContain(EVENTS_LABEL);
      expect(t.components.acknowledgement?.match(/events/gi)?.length).toBe(1);
      expect(t.components.followUpQuestion).toBe(NEUTRAL);
      expect(t.reply).not.toContain(ACTIVITIES_Q);
      expect(t.state.nightlifeRequested).toBeNull();
      expect(t.state.shoppingRequested).toBeNull();
      expect(t.state.toursRequested).toBeNull();
    },
  );

  it('treats repeated equivalent events wording as unchanged', () => {
    const t = turn('I want events', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
      eventsFestivalsRequested: true,
    });
    expect(t.state.eventsFestivalsRequested).toBe(true);
    expect(t.classification.hasInterpretedChange).toBe(false);
    expect(t.classification.newlyEnabledRequestFlags).toEqual([]);
    expect(t.components.acknowledgement).toBeNull();
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
  });

  it('satisfies the activities follow-up from the canonical events capability', () => {
    const t = turn('Include festivals', {
      ...COMPLETE_CORE,
      activitiesRequested: true,
    });
    expect(t.state.eventsFestivalsRequested).toBe(true);
    expect(t.components.followUpQuestion).toBe(NEUTRAL);
    expect(t.reply).not.toContain(ACTIVITIES_Q);
  });

  it.each(BLOCKED_PHRASES)(
    'blocks question/negation/incidental mention: %s',
    (message) => {
      const t = turn(message, {
        ...COMPLETE_CORE,
        activitiesRequested: true,
      });
      expect(t.extracted.eventsFestivalsRequested, message).toBeUndefined();
      expect(t.state.eventsFestivalsRequested, message).toBeNull();
      // Incidental hotel wording may enable accommodation; events stay unset.
      if (!/\bhotel\b/i.test(message)) {
        expect(t.components.followUpQuestion, message).toBe(ACTIVITIES_Q);
      }
    },
  );

  it('unifies former events-only and festivals-only phrases onto one field', () => {
    const events = turn('I want events', COMPLETE_CORE);
    const festivals = turn('I want festivals', COMPLETE_CORE);
    expect(events.state.eventsFestivalsRequested).toBe(true);
    expect(festivals.state.eventsFestivalsRequested).toBe(true);
    expect(events.components.acknowledgement).toContain(EVENTS_LABEL);
    expect(festivals.components.acknowledgement).toContain(EVENTS_LABEL);
  });
});
