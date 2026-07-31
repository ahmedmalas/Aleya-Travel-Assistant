import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assembleConversationReplyPlan,
  type ConversationReplyPlan,
} from '../assembleConversationReplyPlan';
import { classifyConversationStateChange } from '../classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from '../conversationReplyCatalogue';
import { buildConversationalLayerInput } from '../buildConversationalLayerInput';
import type { ConversationalLayerInput } from '../conversationalLayerContracts';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../index';
import { selectConversationAcknowledgement } from '../selectConversationAcknowledgement';
import { selectConversationReplyComponents } from '../selectConversationReplyComponents';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Phase 16H — characterize where set-versus-changed semantics exist and
 * where they are lost on the production path.
 *
 * Audit only. Does not implement acknowledgementEvent metadata.
 */

const ROOT = process.cwd();
const CORE_SRC = resolve(ROOT, 'src/features/conversation-core');
const ACKS = CONVERSATION_REPLY_CATALOGUE.acknowledgements;

function readCore(relativePath: string): string {
  return readFileSync(resolve(CORE_SRC, relativePath), 'utf8');
}

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-16h',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 0,
    ...overrides,
  };
}

function opener(rendered: string): string {
  if (rendered.startsWith('Great,')) return 'Great,';
  if (rendered.startsWith("We'll start")) return "We'll start";
  if (rendered.startsWith('Departure is set')) return 'Departure is set';
  if (rendered.startsWith('Return is set')) return 'Return is set';
  if (rendered.startsWith('Travelling with')) return 'Travelling with';
  if (rendered.startsWith("I've noted")) return "I've noted";
  if (rendered.startsWith('That includes')) return 'That includes';
  return rendered.split(/[\s.]/)[0] ?? rendered;
}

function runTurn(
  state: ConversationCoreState,
  message: string,
  index: number,
): {
  previous: ConversationCoreState;
  next: ConversationCoreState;
  classification: ReturnType<typeof classifyConversationStateChange>;
  acknowledgement: string | null;
  plan: ConversationReplyPlan;
  layerInput: ConversationalLayerInput;
  rendered: string | null;
} {
  const previous = structuredClone(state);
  const result = processConversationTurn({
    message,
    state,
    userEntryId: `user-16h-${index}`,
    assistantEntryId: `assistant-16h-${index}`,
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
  const plan = assembleConversationReplyPlan(components);
  const layerInput = buildConversationalLayerInput(plan);
  const rendered =
    components.acknowledgement === null
      ? null
      : transformBaselineAcknowledgement(components.acknowledgement);

  return {
    previous,
    next: result.state,
    classification,
    acknowledgement: components.acknowledgement,
    plan,
    layerInput,
    rendered,
  };
}

describe('Phase 16H — set-versus-changed metadata path audit', () => {
  it('classification distinguishes initial set from later change for destination and adult count', () => {
    let state = createState();

    const initialDestination = runTurn(state, 'go to Cairns', 0);
    expect(initialDestination.classification.newlyPopulated).toContain(
      'destination',
    );
    expect(initialDestination.classification.updated).not.toContain(
      'destination',
    );
    state = initialDestination.next;

    const changedDestination = runTurn(state, 'actually go to Hobart', 1);
    expect(changedDestination.classification.updated).toContain('destination');
    expect(changedDestination.classification.newlyPopulated).not.toContain(
      'destination',
    );
    state = changedDestination.next;

    // Seed adults via authoritative state so the next turn is a pure change.
    state = { ...state, adultCount: 1 };
    const changedAdults = runTurn(state, '2 adults', 2);
    expect(changedAdults.classification.updated).toContain('adultCount');
    expect(changedAdults.classification.newlyPopulated).not.toContain(
      'adultCount',
    );

    const empty = createState();
    const initialAdults = runTurn(empty, '2 adults', 3);
    expect(initialAdults.classification.newlyPopulated).toContain('adultCount');
    expect(initialAdults.classification.updated).not.toContain('adultCount');
  });

  it('rendered acknowledgement text does not preserve set-versus-changed', () => {
    let state = createState();
    const set = runTurn(state, 'go to Melbourne', 0);
    state = set.next;
    const changed = runTurn(state, 'go to Cairns', 1);

    expect(set.acknowledgement).toBe(ACKS.destination('Melbourne'));
    expect(changed.acknowledgement).toBe(ACKS.destination('Cairns'));
    expect(set.acknowledgement).not.toBe(changed.acknowledgement);

    // Same catalogue family template; only the place interior differs.
    expect(set.acknowledgement?.startsWith('Great — ')).toBe(true);
    expect(changed.acknowledgement?.startsWith('Great — ')).toBe(true);

    expect(set.rendered).toBe('Great, Melbourne it is.');
    expect(changed.rendered).toBe('Great, Cairns it is.');
    expect(opener(set.rendered!)).toBe(opener(changed.rendered!));
    expect(opener(set.rendered!)).toBe('Great,');
  });

  it('reply-plan acknowledgement is currently only a string array with no event field', () => {
    const planSource = readCore('assembleConversationReplyPlan.ts');
    expect(planSource).toMatch(
      /export type ConversationReplyPlan = \{[\s\S]*acknowledgements: readonly string\[];/,
    );
    expect(planSource).not.toMatch(/acknowledgementEvent/);

    let state = createState();
    const set = runTurn(state, 'go to Cairns', 0);
    expect(set.plan.acknowledgements).toEqual([ACKS.destination('Cairns')]);
    expect(set.plan).not.toHaveProperty('acknowledgementEvent');
    expect(typeof set.plan.acknowledgements[0]).toBe('string');

    const componentsSource = readCore('selectConversationReplyComponents.ts');
    expect(componentsSource).toMatch(
      /acknowledgement: string \| null;/,
    );
    expect(componentsSource).not.toMatch(/acknowledgementEvent/);
  });

  it('conversational input receives no set-versus-changed event', () => {
    const contracts = readCore('conversationalLayerContracts.ts');
    expect(contracts).toMatch(
      /export type ConversationalLayerInput = \{[\s\S]*readonly plan: ConversationReplyPlan;/,
    );
    expect(contracts).not.toMatch(/acknowledgementEvent/);
    expect(contracts).not.toMatch(/field-set/);
    expect(contracts).not.toMatch(/newlyPopulated/);

    let state = createState();
    const set = runTurn(state, 'go to Cairns', 0);
    expect(set.layerInput.plan.acknowledgements).toEqual([
      ACKS.destination('Cairns'),
    ]);
    expect(set.layerInput).not.toHaveProperty('acknowledgementEvent');
    expect(Object.keys(set.layerInput).sort()).toEqual(
      ['objective', 'plan'].sort(),
    );
  });

  it('transformBaselineAcknowledgement receives only the acknowledgement string', () => {
    const transformSource = readCore('transformBaselineAcknowledgement.ts');
    expect(transformSource).toMatch(
      /export function transformBaselineAcknowledgement\(\s*acknowledgement: string,\s*\): string/,
    );
    expect(transformSource).not.toMatch(/acknowledgementEvent/);
    expect(transformSource).not.toMatch(/previousState/);
    expect(transformSource).not.toMatch(/newlyPopulated/);

    const setText = ACKS.destination('Cairns');
    const changeText = ACKS.destination('Hobart');
    expect(transformBaselineAcknowledgement(setText)).toBe(
      'Great, Cairns it is.',
    );
    expect(transformBaselineAcknowledgement(changeText)).toBe(
      'Great, Hobart it is.',
    );
    expect(opener(transformBaselineAcknowledgement(setText))).toBe(
      opener(transformBaselineAcknowledgement(changeText)),
    );
  });

  it('initial set and later change share the same family opener for destination and passenger counts', () => {
    // Destination
    let state = createState();
    const destSet = runTurn(state, 'go to Cairns', 0);
    state = destSet.next;
    const destChange = runTurn(state, 'go to Hobart', 1);
    expect(opener(destSet.rendered!)).toBe('Great,');
    expect(opener(destChange.rendered!)).toBe('Great,');

    // Adult count: initial set from empty, then change
    state = createState();
    const adultSet = runTurn(state, '1 adult', 2);
    expect(adultSet.classification.newlyPopulated).toContain('adultCount');
    state = adultSet.next;
    const adultChange = runTurn(state, '3 adults', 3);
    expect(adultChange.classification.updated).toContain('adultCount');
    expect(opener(adultSet.rendered!)).toBe('Travelling with');
    expect(opener(adultChange.rendered!)).toBe('Travelling with');

    // Child count
    state = createState({ adultCount: 2 });
    const childSet = runTurn(state, '2 children', 4);
    expect(childSet.classification.newlyPopulated).toContain('childCount');
    state = childSet.next;
    const childChange = runTurn(state, '1 child', 5);
    expect(childChange.classification.updated).toContain('childCount');
    expect(opener(childSet.rendered!)).toBe("I've noted");
    expect(opener(childChange.rendered!)).toBe("I've noted");
  });

  it('selector collapses newlyPopulated and updated through fieldValueChanged', () => {
    const selectorSource = readCore('selectConversationAcknowledgement.ts');
    expect(selectorSource).toMatch(/fieldValueChanged\(classification,/);
    expect(selectorSource).toMatch(
      /export function selectConversationAcknowledgement\([\s\S]*\): string \| null/,
    );

    const previousEmpty = createState();
    const withCairns = { ...previousEmpty, destination: 'Cairns' };
    const setClassification = classifyConversationStateChange(
      previousEmpty,
      withCairns,
    );
    expect(setClassification.newlyPopulated).toContain('destination');

    const withHobart = { ...withCairns, destination: 'Hobart' };
    const changeClassification = classifyConversationStateChange(
      withCairns,
      withHobart,
    );
    expect(changeClassification.updated).toContain('destination');

    expect(selectConversationAcknowledgement(withCairns, setClassification)).toBe(
      ACKS.destination('Cairns'),
    );
    expect(
      selectConversationAcknowledgement(withHobart, changeClassification),
    ).toBe(ACKS.destination('Hobart'));

    // Same family template; distinction not present in selected strings.
    expect(
      selectConversationAcknowledgement(withCairns, setClassification)?.replace(
        'Cairns',
        '',
      ),
    ).toBe(
      selectConversationAcknowledgement(withHobart, changeClassification)?.replace(
        'Hobart',
        '',
      ),
    );
  });

  it('documents that Phase 16H is audit-only and does not alter production modules', () => {
    const auditDoc = readFileSync(
      resolve(
        ROOT,
        'docs/conversation-engine/phase16-set-versus-changed-metadata-path-audit.md',
      ),
      'utf8',
    );
    expect(auditDoc).toMatch(/PREFERRED/);
    expect(auditDoc).toMatch(/acknowledgementEvent/);
    expect(auditDoc).toMatch(/REJECT/);
    expect(auditDoc).toMatch(/TWO PHASES/);
    expect(auditDoc).toMatch(/Parsing acknowledgement text for set-versus-changed: \*\*not acceptable\*\*/);

    // Production selector/transform signatures remain string-only.
    expect(readCore('selectConversationAcknowledgement.ts')).toMatch(
      /\): string \| null/,
    );
    expect(readCore('transformBaselineAcknowledgement.ts')).toMatch(
      /acknowledgement: string/,
    );
    expect(readCore('assembleConversationReplyPlan.ts')).not.toMatch(
      /acknowledgementEvent/,
    );
  });
});
