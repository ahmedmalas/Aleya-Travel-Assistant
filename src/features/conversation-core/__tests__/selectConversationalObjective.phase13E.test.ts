import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { selectConversationalObjective } from '../selectConversationalObjective';

/**
 * Phase 13E — conversational objective adapter characterisation.
 *
 * Proves objective identity is derived solely from the structured reply plan.
 */

const ROOT = process.cwd();
const ADAPTER_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationalObjective.ts',
);
const GENERATE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/generateConversationReply.ts',
);
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');

const FOLLOW_UPS = CONVERSATION_REPLY_CATALOGUE.followUps;

function plan(
  overrides: Partial<ConversationReplyPlan> = {},
): ConversationReplyPlan {
  return {
    acknowledgements: [],
    acknowledgementEvent: null,
    followUpQuestion: null,
    messageInterpreted: false,
    ...overrides,
  };
}

describe('phase 13E — selectConversationalObjective', () => {
  it('stays free of state, message, priority, and runtime integration', () => {
    const source = readFileSync(ADAPTER_SOURCE, 'utf8');
    expect(source.includes('ConversationCoreState')).toBe(false);
    expect(source.includes('stateUpdate')).toBe(false);
    expect(source.includes('input.message')).toBe(false);
    expect(source.includes('user message')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('selectConversationFollowUpQuestion')).toBe(false);
    expect(source.includes('generateConversationReply')).toBe(false);
    expect(source.includes('processConversationTurn')).toBe(false);

    expect(
      readFileSync(GENERATE_SOURCE, 'utf8').includes(
        'selectConversationalObjective',
      ),
    ).toBe(false);
    expect(
      readFileSync(PROCESS_TURN_SOURCE, 'utf8').includes(
        'selectConversationalObjective',
      ),
    ).toBe(false);
    expect(
      readFileSync(INDEX_SOURCE, 'utf8').includes(
        'selectConversationalObjective',
      ),
    ).toBe(false);
  });

  it('returns each representative objective from its catalogue plan slot', () => {
    const cases = [
      ['destination', FOLLOW_UPS.destination],
      ['origin', FOLLOW_UPS.origin],
      ['departureDate', FOLLOW_UPS.departureDate],
      ['returnDate', FOLLOW_UPS.returnDate],
      ['flightsAdultCount', FOLLOW_UPS.flightsAdultCount],
      ['accommodationGuestCount', FOLLOW_UPS.accommodationGuestCount],
      ['activities', FOLLOW_UPS.activities],
      ['restaurants', FOLLOW_UPS.restaurants],
      ['neutralContinuation', FOLLOW_UPS.neutralContinuation],
    ] as const;

    for (const [id, wording] of cases) {
      expect(
        selectConversationalObjective(
          plan({ followUpQuestion: wording, messageInterpreted: true }),
        ),
      ).toEqual({ id, catalogueWording: wording });
    }
  });

  it('returns null when no follow-up and no continuation are present', () => {
    expect(selectConversationalObjective(plan())).toBeNull();
    expect(
      selectConversationalObjective(
        plan({
          acknowledgements: ['Perfect.'],
      acknowledgementEvent: null,
          followUpQuestion: null,
          messageInterpreted: true,
        }),
      ),
    ).toBeNull();
  });

  it('returns the continuation objective when only continuation is present', () => {
    // Assembled plan stores continuation in followUpQuestion.
    expect(
      selectConversationalObjective(
        plan({ followUpQuestion: FOLLOW_UPS.neutralContinuation }),
      ),
    ).toEqual({
      id: 'neutralContinuation',
      catalogueWording: FOLLOW_UPS.neutralContinuation,
    });

    // Malformed / pre-assembly fixture: continuation only on excess slot.
    const continuationOnly = {
      ...plan({ followUpQuestion: null }),
      continuationPrompt: FOLLOW_UPS.neutralContinuation,
    };
    expect(selectConversationalObjective(continuationOnly)).toEqual({
      id: 'neutralContinuation',
      catalogueWording: FOLLOW_UPS.neutralContinuation,
    });
  });

  it('lets a specific follow-up take precedence over continuation in a malformed fixture', () => {
    const malformed = {
      ...plan({
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
      continuationPrompt: FOLLOW_UPS.neutralContinuation,
    };

    expect(selectConversationalObjective(malformed)).toEqual({
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    });
    expect(selectConversationalObjective(malformed)).not.toEqual({
      id: 'neutralContinuation',
      catalogueWording: FOLLOW_UPS.neutralContinuation,
    });
  });

  it('ignores acknowledgement and messageInterpreted when identifying the objective', () => {
    const wording = FOLLOW_UPS.flightsAdultCount;
    const baselines = [
      plan({
        acknowledgements: [],
      acknowledgementEvent: null,
        followUpQuestion: wording,
        messageInterpreted: false,
      }),
      plan({
        acknowledgements: ["I've added flights to your trip requirements."],
      acknowledgementEvent: null,
        followUpQuestion: wording,
        messageInterpreted: true,
      }),
      plan({
        acknowledgements: ['Perfect.'],
      acknowledgementEvent: null,
        followUpQuestion: wording,
        messageInterpreted: false,
      }),
    ];

    for (const entry of baselines) {
      expect(selectConversationalObjective(entry)).toEqual({
        id: 'flightsAdultCount',
        catalogueWording: wording,
      });
    }
  });

  it('produces identical objectives for identical plans and does not mutate frozen plans', () => {
    const frozen = Object.freeze(
      plan({
        acknowledgements: Object.freeze(['Great — Brisbane.']),
      acknowledgementEvent: null,
        followUpQuestion: FOLLOW_UPS.origin,
        messageInterpreted: true,
      }),
    );
    const before = structuredClone(frozen);

    const first = selectConversationalObjective(frozen);
    const second = selectConversationalObjective(frozen);
    const third = selectConversationalObjective(structuredClone(frozen));

    expect(first).toEqual({
      id: 'origin',
      catalogueWording: FOLLOW_UPS.origin,
    });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(frozen).toEqual(before);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.acknowledgements)).toBe(true);
  });

  it('retains the exact catalogue wording from the selected plan slot', () => {
    const objective = selectConversationalObjective(
      plan({ followUpQuestion: FOLLOW_UPS.activities }),
    );
    expect(objective).not.toBeNull();
    expect(objective!.catalogueWording).toBe(
      'What kinds of activities are you interested in?',
    );
    expect(objective!.catalogueWording).toBe(FOLLOW_UPS.activities);
    expect(objective!.catalogueWording).toBe(
      CONVERSATION_REPLY_CATALOGUE.followUps.activities,
    );
  });
});
