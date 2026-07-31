import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ConversationalStyleProfile } from '../conversationalLayerContracts';
import {
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_PROFILES,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
} from '../referenceConversationalStyleProfiles';

/**
 * Phase 13D — reference conversational style profile characterisation.
 *
 * Locks Professional / Warm / Luxury reference profiles as style-only,
 * immutable, and unused by the runtime reply path.
 */

const ROOT = process.cwd();
const PROFILES_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/referenceConversationalStyleProfiles.ts',
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
const CREATE_PLAN_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/createConversationReplyPlan.ts',
);
const COMPONENTS_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/selectConversationReplyComponents.ts',
);

const ALLOWED_PROFILE_KEYS = new Set(['id', 'tone', 'phrasingPreferences']);

const FORBIDDEN_CONTROL_KEYS = [
  'state',
  'stateUpdate',
  'destination',
  'origin',
  'objective',
  'objectives',
  'priority',
  'eligibility',
  'approval',
  'approvals',
  'tool',
  'tools',
  'toolCall',
  'api',
  'booking',
  'plan',
  'followUpQuestion',
  'messageInterpreted',
] as const;

describe('phase 13D — reference conversational style profiles', () => {
  it('defines Professional, Warm, and Luxury reference profiles only', () => {
    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFILES).toHaveLength(3);
    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFILES.map((profile) => profile.id)).toEqual([
      'professional',
      'warm',
      'luxury',
    ]);
    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL.id).toBe('professional');
    expect(REFERENCE_CONVERSATIONAL_STYLE_WARM.id).toBe('warm');
    expect(REFERENCE_CONVERSATIONAL_STYLE_LUXURY.id).toBe('luxury');
  });

  it('satisfies ConversationalStyleProfile with only id, tone, and phrasingPreferences', () => {
    for (const profile of REFERENCE_CONVERSATIONAL_STYLE_PROFILES) {
      expectTypeOf(profile).toMatchTypeOf<ConversationalStyleProfile>();
      expect(Object.keys(profile).sort()).toEqual(
        ['id', 'phrasingPreferences', 'tone'].sort(),
      );
      expect(typeof profile.id).toBe('string');
      expect(['catalogue-literal', 'warm', 'concise', 'formal']).toContain(
        profile.tone,
      );
      expect(Array.isArray(profile.phrasingPreferences)).toBe(true);
      expect(profile.phrasingPreferences!.length).toBeGreaterThan(0);

      for (const key of Object.keys(profile)) {
        expect(ALLOWED_PROFILE_KEYS.has(key), key).toBe(true);
      }
      for (const forbidden of FORBIDDEN_CONTROL_KEYS) {
        expect(
          Object.prototype.hasOwnProperty.call(profile, forbidden),
          forbidden,
        ).toBe(false);
      }
    }

    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL.tone).toBe('formal');
    expect(REFERENCE_CONVERSATIONAL_STYLE_WARM.tone).toBe('warm');
    expect(REFERENCE_CONVERSATIONAL_STYLE_LUXURY.tone).toBe('formal');
  });

  it('keeps reference profiles immutable', () => {
    expect(Object.isFrozen(REFERENCE_CONVERSATIONAL_STYLE_PROFILES)).toBe(true);
    for (const profile of REFERENCE_CONVERSATIONAL_STYLE_PROFILES) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.phrasingPreferences)).toBe(true);
    }

    expect(() => {
      // @ts-expect-error — profiles are frozen reference constants
      REFERENCE_CONVERSATIONAL_STYLE_WARM.tone = 'concise';
    }).toThrow();
    expect(() => {
      // @ts-expect-error — profile list is frozen
      REFERENCE_CONVERSATIONAL_STYLE_PROFILES.push(
        REFERENCE_CONVERSATIONAL_STYLE_WARM,
      );
    }).toThrow();
    expect(() => {
      // @ts-expect-error — phrasing preferences are frozen
      REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL.phrasingPreferences!.push(
        'extra',
      );
    }).toThrow();

    expect(REFERENCE_CONVERSATIONAL_STYLE_WARM.tone).toBe('warm');
    expect(REFERENCE_CONVERSATIONAL_STYLE_PROFILES).toHaveLength(3);
  });

  it('contains no state, objectives, priority, eligibility, approvals, tools, or APIs', () => {
    const source = readFileSync(PROFILES_SOURCE, 'utf8');

    expect(source.includes('ConversationCoreState')).toBe(false);
    expect(source.includes('stateUpdate')).toBe(false);
    expect(source.includes('ConversationalObjective')).toBe(false);
    expect(source.includes('priority')).toBe(false);
    expect(source.includes('eligibility')).toBe(false);
    expect(source.includes('approval')).toBe(false);
    expect(source.includes('tool')).toBe(false);
    expect(source.includes('OpenAI')).toBe(false);
    expect(source.includes('Anthropic')).toBe(false);
    expect(source.includes('LLM')).toBe(false);
    expect(source.includes('fetch(')).toBe(false);
    expect(source.includes('supabase')).toBe(false);
    expect(source.includes('api')).toBe(false);
    expect(source.includes('booking')).toBe(false);
    expect(source.includes('prompt')).toBe(false);
    expect(source.includes('generateConversationReply')).toBe(false);

    expectTypeOf<typeof REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL>().not.toHaveProperty(
      'state',
    );
    expectTypeOf<typeof REFERENCE_CONVERSATIONAL_STYLE_WARM>().not.toHaveProperty(
      'objective',
    );
    expectTypeOf<typeof REFERENCE_CONVERSATIONAL_STYLE_LUXURY>().not.toHaveProperty(
      'priority',
    );
  });

  it('remains unused by the runtime reply path', () => {
    const generate = readFileSync(GENERATE_SOURCE, 'utf8');
    const processTurn = readFileSync(PROCESS_TURN_SOURCE, 'utf8');
    const index = readFileSync(INDEX_SOURCE, 'utf8');
    const createPlan = readFileSync(CREATE_PLAN_SOURCE, 'utf8');
    const components = readFileSync(COMPONENTS_SOURCE, 'utf8');

    for (const source of [generate, processTurn, index, createPlan, components]) {
      expect(source.includes('referenceConversationalStyleProfiles')).toBe(
        false,
      );
      expect(source.includes('REFERENCE_CONVERSATIONAL_STYLE_')).toBe(false);
    }

    expect(generate).toMatch(/createConversationReplyPlan\(/);
    expect(generate).toMatch(
      /return renderIntegratedConversationReplyPlan\(\{\s*plan\s*\}\)/,
    );
    expect(generate).toMatch(/export function renderConversationReplyPlan/);
  });
});
