import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { CURATED_PLACES } from '../../travel-location-intelligence/data/curatedPlaces';
import { resolveSync } from '../../travel-location-intelligence';
import { interpretTravelUtterance } from '../interpretTravelUtterance';
import { canonicalizeSemanticPlaces } from '../canonicalizePlaces';
import { emptySemanticInterpretation } from '../schema';
import {
  canSafelyConstructProviderSearch,
  isPlaceStatusSafeForProviderSearch,
} from '../providerSearchSafety';
import { isShapeValidPlaceName } from '../placeResolution';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;
const NOW = new Date('2026-08-04T00:00:00.000Z');

const curatedNames = new Set(
  CURATED_PLACES.flatMap((place) => [
    place.canonicalName.toLowerCase(),
    ...place.aliases.map((alias) => alias.toLowerCase()),
  ]),
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'unresolved-destinations',
      now: NOW,
    }),
    status: 'active',
    turnCount: 0,
    transcript: [
      {
        id: 'a0',
        role: 'assistant',
        message: F.destination,
        timestamp: NOW.toISOString(),
      },
    ],
    ...overrides,
  };
}

async function interpretedTurn(
  message: string,
  state: ConversationCoreState,
  index: number,
) {
  const interpretation = await interpretTravelUtterance({
    message,
    currentState: state,
    recentHistory: state.transcript,
    mode: 'auto',
    now: NOW,
  });
  const result = processConversationTurn({
    message,
    state,
    userEntryId: `u-${index}`,
    assistantEntryId: `a-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2 + 1)),
    stateUpdate: interpretation.stateUpdate,
    skipExtraction: true,
  });
  return { interpretation, result };
}

describe('Unresolved destination architecture', () => {
  it('TLI enrich retains shape-valid destinations outside curated coverage', () => {
    const outside = [
      'Rome',
      'Spain',
      'Newcastle',
      'Wollongong',
      'Vietnam',
      'Croatia',
      'San Francisco',
    ];
    for (const place of outside) {
      expect(curatedNames.has(place.toLowerCase()), place).toBe(false);
      expect(resolveSync(place).best, place).toBeUndefined();

      const semantic = emptySemanticInterpretation();
      semantic.intent = 'provide_info';
      semantic.confidence = 0.8;
      semantic.destination = place;
      const { semantic: enriched, warnings } = canonicalizeSemanticPlaces(semantic);
      expect(enriched.destination, place).toBeTruthy();
      expect(enriched.destinationResolutionStatus, place).toBe('unresolved');
      expect(warnings.some((w) => /Unresolved destination retained/i.test(w))).toBe(
        true,
      );
    }
  });

  it('curated destinations still resolve to canonical TLI names', async () => {
    const { interpretation, result } = await interpretedTurn(
      'I want to go to Melbourne',
      createState(),
      0,
    );
    expect(result.state.destination).toBe('Melbourne');
    expect(result.state.destinationResolutionStatus).toBe('resolved');
    expect(interpretation.warnings.join(' ')).not.toMatch(/Unresolved destination retained/i);
  });

  it('production skipExtraction path keeps non-curated framed destinations', async () => {
    // Engine Consolidation: bare vacancy fill retired — use travel frames.
    const cases = [
      'go to rome',
      'go to spain',
      'go to newcastle',
      'go to wollongong',
      'go to vietnam',
      'go to greece',
      'go to italy',
      'go to croatia',
      'go to ballarat',
      'go to alice springs',
    ];

    for (const [index, message] of cases.entries()) {
      const place = message.replace(/^go to /i, '');
      expect(curatedNames.has(place.toLowerCase()), place).toBe(false);
      const { result, interpretation } = await interpretedTurn(
        message,
        createState(),
        index,
      );
      expect(result.state.destination, message).toBeTruthy();
      expect(result.state.destination, message).toMatch(/[A-Za-z]/);
      expect(result.state.destinationResolutionStatus, message).toBe('unresolved');
      expect(selectConversationFollowUpQuestion(result.state), message).toBe(
        F.origin,
      );
      expect(
        interpretation.warnings.some((w) =>
          /Unresolved destination retained/i.test(w),
        ),
        message,
      ).toBe(true);
    }
  });

  it('non-curated framed destinations are retained without missing-to patch', async () => {
    const { result } = await interpretedTurn(
      'I want to go to Rome',
      createState({ transcript: [] }),
      0,
    );
    expect(result.state.destination).toBe('Rome');
    expect(result.state.destinationResolutionStatus).toBe('unresolved');
  });

  it('deterministic shape validation rejects non-place garbage without TLI erase semantics', async () => {
    expect(isShapeValidPlaceName('12')).toBe(false);
    expect(isShapeValidPlaceName('???')).toBe(false);
    expect(isShapeValidPlaceName('Rome')).toBe(true);

    const interpretation = await interpretTravelUtterance({
      message: '12',
      currentState: createState(),
      mode: 'regex-fallback',
      now: NOW,
    });
    expect(interpretation.stateUpdate.destination).toBeUndefined();
  });

  it('provider search stays gated while destination/origin are unresolved', async () => {
    let state = createState();
    let step = await interpretedTurn('go to rome', state, 0);
    state = step.result.state;
    expect(state.destination).toBe('Rome');
    expect(state.destinationResolutionStatus).toBe('unresolved');
    expect(canSafelyConstructProviderSearch(state)).toBe(false);

    step = await interpretedTurn('from newcastle', state, 1);
    state = step.result.state;
    expect(state.origin ?? state.destination).toBeTruthy();
    expect(canSafelyConstructProviderSearch(state)).toBe(false);
    expect(isPlaceStatusSafeForProviderSearch('unresolved')).toBe(false);
    expect(isPlaceStatusSafeForProviderSearch('resolved')).toBe(true);
  });

  it('resolved curated origin+destination allows provider-search safety', async () => {
    let state = createState({ transcript: [] });
    let step = await interpretedTurn('I want to go Melbourne from Sydney', state, 0);
    state = step.result.state;
    expect(state.destination).toBe('Melbourne');
    expect(state.origin).toBe('Sydney');
    expect(state.destinationResolutionStatus).toBe('resolved');
    expect(state.originResolutionStatus).toBe('resolved');
    expect(canSafelyConstructProviderSearch(state)).toBe(true);
  });

  it('completion with unresolved places summarises but does not claim search readiness', async () => {
    const state = createState({
      destination: 'Rome',
      origin: 'Spain',
      departureDate: '2026-08-28',
      returnDate: '2026-08-31',
      destinationResolutionStatus: 'unresolved',
      originResolutionStatus: 'unresolved',
      conversationComplete: true,
      flightsRequested: true,
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      accommodationRequested: false,
      carHireRequested: false,
    });
    const followUp = selectConversationFollowUpQuestion(state);
    expect(followUp).toMatch(/Rome/);
    expect(followUp).toMatch(/Spain/);
    expect(followUp).toMatch(/need validation before provider search/i);
    expect(followUp).not.toMatch(/ready to search when you confirm/i);
  });
});
