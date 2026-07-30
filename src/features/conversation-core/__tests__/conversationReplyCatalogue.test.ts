import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from '../conversationReplyCatalogue';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationFollowUpQuestion } from '../selectConversationFollowUpQuestion';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../index';

const ROOT = process.cwd();
const CATALOGUE_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/conversationReplyCatalogue.ts',
);
const ACK_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationAcknowledgement.ts',
);
const FOLLOW_UP_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationFollowUpQuestion.ts',
);
const INDEX_SOURCE = resolve(ROOT, 'src/features/conversation-core/index.ts');
const PROCESS_TURN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/processTurn.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-10k',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    ...overrides,
  };
}

describe('phase 10K — deterministic travel-consultant reply catalogue', () => {
  it('keeps the reply catalogue internal with fixed wording only', () => {
    const catalogueSource = readFileSync(CATALOGUE_SOURCE, 'utf8');
    const ackSource = readFileSync(ACK_SOURCE, 'utf8');
    const followUpSource = readFileSync(FOLLOW_UP_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');

    expect(catalogueSource).toContain('Phase 10K');
    expect(catalogueSource).toContain('Phase 10O');
    expect(catalogueSource).toContain('Phase 10P');
    expect(catalogueSource).toContain('Phase 10Q');
    expect(catalogueSource).toContain('Phase 10R');
    expect(catalogueSource).toContain('Phase 10S');
    expect(catalogueSource).toContain('Phase 10T');
    expect(catalogueSource).toContain('Phase 10U');
    expect(catalogueSource).toContain('Phase 10V');
    expect(catalogueSource).toContain('Phase 10W');
    expect(catalogueSource).toContain('Phase 10X');
    expect(catalogueSource).toContain('Phase 10Y');
    expect(catalogueSource).toContain('Phase 11C');
    expect(catalogueSource).toContain('Phase 11J');
    expect(catalogueSource).toContain('Phase 11K');
    expect(catalogueSource).toMatch(/export const CONVERSATION_REPLY_CATALOGUE/);
    expect(catalogueSource).toContain('Great — ${destination}.');
    expect(catalogueSource).toContain("destinationRemoved: 'Destination removed.'");
    expect(catalogueSource).toContain(
      "originRemoved: 'Departure location removed.'",
    );
    expect(catalogueSource).not.toContain('Sounds good — ${destination}.');
    expect(catalogueSource).toContain('Perfect — departing from ${origin}.');
    expect(catalogueSource).not.toContain(
      'Got it — travelling from ${origin}.',
    );
    expect(catalogueSource).toContain(
      'Perfect — departing on ${departureDate}.',
    );
    expect(catalogueSource).toContain('Perfect — returning on ${returnDate}.');
    expect(catalogueSource).toContain(
      'Perfect — ${adultCount} adult travelling.',
    );
    expect(catalogueSource).toContain(
      'Perfect — ${adultCount} adults travelling.',
    );
    expect(catalogueSource).toContain(
      'Perfect — ${childCount} child travelling.',
    );
    expect(catalogueSource).toContain(
      'Perfect — ${childCount} children travelling.',
    );
    expect(catalogueSource).toContain(
      'Perfect — ${infantCount} infant travelling.',
    );
    expect(catalogueSource).toContain(
      'Perfect — ${infantCount} infants travelling.',
    );
    expect(catalogueSource).toContain(
      "I've removed ${labelList} from your trip requirements.",
    );
    expect(catalogueSource).toContain("genericTravelFieldChange: 'Perfect.'");
    expect(catalogueSource).not.toContain(
      "genericTravelFieldChange: 'Got it.'",
    );
    expect(catalogueSource).not.toMatch(/ConversationCoreState/);
    expect(catalogueSource).not.toMatch(/classifyConversationStateChange/);
    expect(catalogueSource).not.toMatch(/selectConversation/);
    expect(catalogueSource).not.toMatch(/Math\.random|openai|fetch\(/i);
    expect(ackSource).toMatch(/CONVERSATION_REPLY_CATALOGUE/);
    expect(followUpSource).toMatch(/CONVERSATION_REPLY_CATALOGUE/);
    expect(index).not.toMatch(/conversationReplyCatalogue/);
    expect(index).not.toMatch(/CONVERSATION_REPLY_CATALOGUE/);
    expect(processTurn).not.toMatch(/conversationReplyCatalogue/);
    expect(processTurn).not.toMatch(/CONVERSATION_REPLY_CATALOGUE/);
  });

  it('retains exact acknowledgement wording entries', () => {
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.addedCapabilities('flights'),
    ).toBe("I've added flights to your trip requirements.");
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.addedCapabilities(
        'flights and accommodation',
      ),
    ).toBe("I've added flights and accommodation to your trip requirements.");
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.addedCapabilities(
        'flights, accommodation and activities',
      ),
    ).toBe(
      "I've added flights, accommodation and activities to your trip requirements.",
    );
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.removedCapabilities(
        'flights',
      ),
    ).toBe("I've removed flights from your trip requirements.");
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.removedCapabilities(
        'flights and accommodation',
      ),
    ).toBe(
      "I've removed flights and accommodation from your trip requirements.",
    );
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.removedCapabilities(
        'flights, accommodation and car hire',
      ),
    ).toBe(
      "I've removed flights, accommodation and car hire from your trip requirements.",
    );
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.destination('Brisbane'),
    ).toBe('Great — Brisbane.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.destinationRemoved,
    ).toBe('Destination removed.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.origin('Sydney'),
    ).toBe('Perfect — departing from Sydney.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.originRemoved,
    ).toBe('Departure location removed.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.departureDate('2026-08-28'),
    ).toBe('Perfect — departing on 2026-08-28.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.returnDate('2026-09-05'),
    ).toBe('Perfect — returning on 2026-09-05.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.adultCount(1),
    ).toBe('Perfect — 1 adult travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.adultCount(2),
    ).toBe('Perfect — 2 adults travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.adultCount(3),
    ).toBe('Perfect — 3 adults travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.childCount(1),
    ).toBe('Perfect — 1 child travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.childCount(2),
    ).toBe('Perfect — 2 children travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.childCount(3),
    ).toBe('Perfect — 3 children travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.infantCount(1),
    ).toBe('Perfect — 1 infant travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.infantCount(2),
    ).toBe('Perfect — 2 infants travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.infantCount(3),
    ).toBe('Perfect — 3 infants travelling.');
    expect(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.genericTravelFieldChange,
    ).toBe('Perfect.');
  });

  it('retains exact follow-up wording entries', () => {
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.destination).toBe(
      'Where would you like to travel?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.origin).toBe(
      'Where will you be travelling from?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.departureDate).toBe(
      'When would you like to depart?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.returnDate).toBe(
      'When would you like to return?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.flightsAdultCount).toBe(
      'How many adults will be travelling?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.accommodationGuestCount).toBe(
      'How many guests will be staying?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.activities).toBe(
      'What kinds of activities are you interested in?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.restaurants).toBe(
      'What type of dining are you looking for?',
    );
    expect(CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation).toBe(
      'What else should I know about your trip?',
    );
    expect(NEUTRAL_TRIP_FALLBACK_REPLY).toBe(
      CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation,
    );
  });

  it('leaves selection, priority, and suppression in the selectors', () => {
    const ackSource = readFileSync(ACK_SOURCE, 'utf8');
    const followUpSource = readFileSync(FOLLOW_UP_SOURCE, 'utf8');
    const catalogueSource = readFileSync(CATALOGUE_SOURCE, 'utf8');

    expect(ackSource).toMatch(/CAPABILITY_LABELS/);
    expect(ackSource).toMatch(/fieldValueChanged/);
    expect(ackSource).toMatch(/newlyEnabledRequestFlags/);
    expect(ackSource).toMatch(/newlyDisabledRequestFlags/);
    expect(followUpSource).toMatch(/PROGRESSION_QUESTIONS|CONTEXTUAL_QUESTIONS/);
    expect(followUpSource).toMatch(/adultCount === null/);
    expect(catalogueSource).not.toMatch(/CAPABILITY_LABELS/);
    expect(catalogueSource).not.toMatch(/PROGRESSION_QUESTIONS/);
    expect(catalogueSource).not.toMatch(/CONTEXTUAL_QUESTIONS/);
    expect(catalogueSource).not.toMatch(/adultCount\s*===\s*null/);
    expect(catalogueSource).not.toMatch(/childCount\s*===\s*null/);
    expect(catalogueSource).not.toMatch(/infantCount\s*===\s*null/);
    expect(catalogueSource).not.toMatch(/newlyEnabledRequestFlags/);
    expect(catalogueSource).not.toMatch(/newlyDisabledRequestFlags/);
  });

  it('keeps selector output byte-for-byte identical to catalogue wording', () => {
    const previous = createState();
    const destinationState = createState({ destination: 'Brisbane' });
    expect(
      selectConversationAcknowledgement(
        destinationState,
        classifyConversationStateChange(previous, destinationState),
      ),
    ).toBe(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.destination('Brisbane'),
    );

    const originPrevious = createState({ destination: 'Brisbane' });
    const originState = createState({
      destination: 'Brisbane',
      origin: 'Sydney',
    });
    expect(
      selectConversationAcknowledgement(
        originState,
        classifyConversationStateChange(originPrevious, originState),
      ),
    ).toBe(CONVERSATION_REPLY_CATALOGUE.acknowledgements.origin('Sydney'));

    const capabilityPrevious = createState({
      destination: 'Cairns',
      origin: 'Sydney',
      departureDate: '2026-09-01',
      returnDate: '2026-09-08',
    });
    const capabilityState = {
      ...capabilityPrevious,
      flightsRequested: true,
    };
    expect(
      selectConversationAcknowledgement(
        capabilityState,
        classifyConversationStateChange(capabilityPrevious, capabilityState),
      ),
    ).toBe(
      CONVERSATION_REPLY_CATALOGUE.acknowledgements.addedCapabilities('flights'),
    );

    expect(selectConversationFollowUpQuestion(createState())).toBe(
      CONVERSATION_REPLY_CATALOGUE.followUps.destination,
    );
    expect(
      selectConversationFollowUpQuestion(
        createState({ destination: 'Brisbane' }),
      ),
    ).toBe(CONVERSATION_REPLY_CATALOGUE.followUps.origin);
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-09-01',
          returnDate: '2026-09-08',
          flightsRequested: true,
        }),
      ),
    ).toBe(CONVERSATION_REPLY_CATALOGUE.followUps.flightsAdultCount);
    expect(
      selectConversationFollowUpQuestion(
        createState({
          destination: 'Cairns',
          origin: 'Sydney',
          departureDate: '2026-09-01',
          returnDate: '2026-09-08',
          adultCount: 2,
        }),
      ),
    ).toBe(CONVERSATION_REPLY_CATALOGUE.followUps.neutralContinuation);
  });
});
