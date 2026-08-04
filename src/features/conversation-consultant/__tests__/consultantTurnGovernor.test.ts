import { describe, expect, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
} from '../../conversation-core';
import { CONVERSATION_REPLY_CATALOGUE } from '../../conversation-core/conversationReplyCatalogue';
import { runConsultantTurn } from '../runConsultantTurn';

const F = CONVERSATION_REPLY_CATALOGUE.followUps;

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'consultant-governor',
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
  return runConsultantTurn({
    message,
    state,
    userEntryId: `u-${index}`,
    assistantEntryId: `a-${index}`,
    userMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2)),
    assistantMessageAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index * 2 + 1)),
    interpretationMode: 'offline-semantic',
    now: new Date('2026-08-04T00:00:00.000Z'),
  });
}

describe('Consultant Turn Governor — place-role clarify-before-write', () => {
  it('asks whether Sydney is origin or first destination for Sydney Bangkok Beirut', async () => {
    const r = await turn(
      'I want to go Sydney Bangkok Beirut',
      createState(),
      0,
    );

    expect(r.act.kind).toBe('clarify');
    expect(r.reply).toBe(
      'Are you starting from Sydney, or is Sydney your first destination?',
    );
    expect(r.state.destination).toBeNull();
    expect(r.state.origin).toBeNull();
    expect(r.state.destinationStops).toBeNull();
    expect(r.state.openClarification).toMatchObject({
      type: 'place_role',
      subject: 'Sydney',
      blocking: true,
      placesInOrder: ['Sydney', 'Bangkok', 'Beirut'],
    });
    expect(r.situation.ambiguities.some((a) => a.blocking)).toBe(true);
  });

  it('commits origin + multi-city stops after clarifying starting from Sydney', async () => {
    let s = createState();
    let r = await turn('I want to go Sydney Bangkok Beirut', s, 0);
    s = r.state;

    r = await turn('starting from Sydney', s, 1);
    expect(r.state.openClarification).toBeNull();
    expect(r.state.origin).toBe('Sydney');
    expect(r.state.destinationStops).toEqual(['Bangkok', 'Beirut']);
    expect(r.state.destination).toBe('Bangkok');
    expect(r.state.tripStructure).toBe('multi_city');
    expect(r.act.kind).toBe('ask');
    expect(r.reply).toContain(F.departureDate);
  });

  it('treats Sydney as first destination when clarified that way', async () => {
    let s = createState();
    let r = await turn('I would like to go Sydney Bangkok Beirut.', s, 0);
    s = r.state;

    r = await turn('Sydney is my first destination', s, 1);
    expect(r.state.origin).toBeNull();
    expect(r.state.destinationStops).toEqual(['Sydney', 'Bangkok', 'Beirut']);
    expect(r.state.tripStructure).toBe('multi_city');
    expect(r.act.kind).toBe('ask');
    expect(r.reply).toContain(F.origin);
  });
});

describe('Consultant Turn Governor — goal-driven regressions', () => {
  it('Melbourne then Sydney advances to departure ask without form ladder reply void', async () => {
    let s = createState();
    let r = await turn('I want to go Melbourne', s, 0);
    expect(r.state.destination).toBe('Melbourne');
    expect(r.act.kind).toBe('ask');
    expect(r.reply).toContain('Where will you be travelling from');

    s = r.state;
    r = await turn('Sydney', s, 1);
    expect(r.state.origin).toBe('Sydney');
    expect(r.state.destination).toBe('Melbourne');
    expect(r.act.kind).toBe('ask');
    expect(r.reply).toContain(F.departureDate);
  });

  it('explicit from + to commits without place-role clarification', async () => {
    const r = await turn(
      'I want to go from Sydney to Bangkok then Beirut',
      createState(),
      0,
    );
    expect(r.act.kind).not.toBe('clarify');
    expect(r.state.origin).toBe('Sydney');
    expect(r.state.destinationStops?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('relative departure date commits through interpretation under the governor', async () => {
    const s = createState({
      destination: 'Melbourne',
      origin: 'Sydney',
    });
    const r = await turn('28th of August', s, 0);
    expect(r.state.departureDate).toMatch(/^\d{4}-08-28$/);
    expect(r.act.kind).toBe('ask');
  });

  it('does not use selectConversationFollowUpQuestion on the production panel path', async () => {
    const panel = await import('node:fs').then((fs) =>
      fs.readFileSync(
        'src/components/trip-platform/AiPlanningPanel.tsx',
        'utf8',
      ),
    );
    expect(panel).toMatch(/runConsultantTurn/);
    expect(panel).not.toMatch(/selectConversationFollowUpQuestion/);
    expect(panel).not.toMatch(/interpretTravelUtterance/);
  });

  it('attaches Phase 1 diagnostic architectureTrace without changing act/reply', async () => {
    const r = await turn(
      'I want to go Sydney Bangkok Beirut',
      createState(),
      0,
    );
    expect(r.act.kind).toBe('clarify');
    expect(r.reply).toBe(
      'Are you starting from Sydney, or is Sydney your first destination?',
    );
    expect(r.architectureTrace).toMatchObject({
      phase: 3,
      diagnosticOnly: true,
      behaviourSwitchActive: false,
      committer: { active: false },
    });
    // Diagnostic preview must not become the governor result state.
    expect(r.state.openClarification?.subject).toBe('Sydney');
  });
});
