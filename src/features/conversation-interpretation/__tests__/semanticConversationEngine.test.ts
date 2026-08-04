import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../conversation-core';
import { selectConversationFollowUpQuestion } from '../../conversation-core/selectConversationFollowUpQuestion';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { interpretTravelUtterance } from '../interpretTravelUtterance';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'semantic-engine',
      now: new Date('2026-08-04T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

async function turn(
  message: string,
  state: ConversationCoreState,
  index: number,
) {
  const interpretation = await interpretTravelUtterance({
    message,
    currentState: state,
    recentHistory: state.transcript,
    mode: 'offline-semantic',
  });
  return processConversationTurn({
    message,
    state,
    userEntryId: `u-${index}`,
    assistantEntryId: `a-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2 + 1)),
    stateUpdate: interpretation.stateUpdate,
    skipExtraction: true,
  });
}

describe('Semantic conversation engine — multi-turn regressions', () => {
  it('I want to go Melbourne → Sydney', async () => {
    let s = createState();
    let r = await turn('I want to go Melbourne', s, 0);
    expect(r.state.destination).toBe('Melbourne');
    expect(selectConversationFollowUpQuestion(r.state)).toBe(F.origin);

    s = r.state;
    r = await turn('Sydney', s, 1);
    expect(r.state.destination).toBe('Melbourne');
    expect(r.state.origin).toBe('Sydney');
    expect(selectConversationFollowUpQuestion(r.state)).toBe(F.departureDate);
  });

  it('Thinking Lebanon as destination', async () => {
    const r = await turn('Thinking Lebanon', createState(), 0);
    expect(r.state.destination).toBe('Lebanon');
    expect(selectConversationFollowUpQuestion(r.state)).toBe(F.origin);
  });

  it('Sydney sounds good while destination is missing', async () => {
    const r = await turn('Sydney sounds good', createState(), 0);
    expect(r.state.destination).toBe('Sydney');
    expect(r.state.origin).toBeNull();
  });

  it('Actually make that Brisbane corrects destination', async () => {
    let s = createState({ destination: 'Melbourne', origin: null });
    const r = await turn('Actually make that Brisbane', s, 0);
    expect(r.state.destination).toBe('Brisbane');
  });

  it('travelling from Sydney then I want to go Lebanon', async () => {
    let s = createState();
    let r = await turn('I am travelling from Sydney', s, 0);
    expect(r.state.origin).toBe('Sydney');
    expect(r.state.destination).toBeNull();

    s = r.state;
    r = await turn('I want to go Lebanon', s, 1);
    expect(r.state.origin).toBe('Sydney');
    expect(r.state.destination).toBe('Lebanon');
  });

  it('28th of August sets departure date when origin/destination known', async () => {
    const s = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
    });
    const r = await turn('28th of August', s, 0);
    expect(r.state.departureDate).toMatch(/^\d{4}-08-28$/);
  });

  it('in the afternoon records time preference without fabricating places', async () => {
    const interpretation = await interpretTravelUtterance({
      message: 'in the afternoon',
      currentState: createState({
        destination: 'Melbourne',
        origin: 'Sydney',
        departureDate: '2026-08-28',
      }),
      mode: 'offline-semantic',
    });
    expect(interpretation.semantic.departureTimePreference).toBe('afternoon');
    expect(interpretation.stateUpdate.destination).toBeUndefined();
  });

  it('after 5 records time preference', async () => {
    const interpretation = await interpretTravelUtterance({
      message: 'after 5',
      currentState: createState({
        destination: 'Melbourne',
        origin: 'Sydney',
      }),
      mode: 'offline-semantic',
    });
    expect(interpretation.semantic.departureTimePreference).toMatch(/after 5/i);
  });

  it('for four nights derives return when departure known', async () => {
    const s = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      departureDate: '2026-08-28',
    });
    const r = await turn('for four nights', s, 0);
    expect(r.state.returnDate).toBe('2026-09-01');
  });

  it('remove the car clears car hire', async () => {
    const s = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
      carHireRequested: true,
    });
    const r = await turn('remove the car', s, 0);
    expect(r.state.carHireRequested).toBe(false);
  });

  it('add a hotel too requests accommodation', async () => {
    const s = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
    });
    const r = await turn('add a hotel too', s, 0);
    expect(r.state.accommodationRequested).toBe(true);
  });

  it('Melbourne from Sydney in one utterance — no reversal', async () => {
    const r = await turn('I want to go Melbourne from Sydney', createState(), 0);
    expect(r.state.destination).toBe('Melbourne');
    expect(r.state.origin).toBe('Sydney');
  });

  it('AI failure path: regex fallback still available via mode', async () => {
    const interpretation = await interpretTravelUtterance({
      message: 'I want to go to Melbourne',
      currentState: createState(),
      mode: 'regex-fallback',
    });
    expect(interpretation.source).toBe('regex-fallback');
    expect(interpretation.stateUpdate.destination).toBe('Melbourne');
  });

  it('empty smalltalk does not fabricate destination', async () => {
    const r = await turn('I want to go', createState(), 0);
    expect(r.state.destination).toBeNull();
    expect(selectConversationFollowUpQuestion(r.state)).toBe(F.destination);
  });
});
