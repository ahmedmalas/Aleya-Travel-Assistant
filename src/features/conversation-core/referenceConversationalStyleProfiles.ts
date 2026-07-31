import type { ConversationalStyleProfile } from './conversationalLayerContracts';

/**
 * Phase 13D — immutable reference conversational style profiles.
 *
 * Design-only samples that satisfy ConversationalStyleProfile. Not wired into
 * reply generation, turn processing, selectors, or any runtime path.
 *
 * See docs/architecture/conversation-style-interface.md.
 */

export const REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL = Object.freeze({
  id: 'professional',
  tone: 'formal',
  phrasingPreferences: Object.freeze([
    'clear and precise',
    'business-travel appropriate',
    'Australian English',
  ]),
}) satisfies ConversationalStyleProfile;

export const REFERENCE_CONVERSATIONAL_STYLE_WARM = Object.freeze({
  id: 'warm',
  tone: 'warm',
  phrasingPreferences: Object.freeze([
    'friendly and reassuring',
    'light empathy without inventing facts',
    'Australian English',
  ]),
}) satisfies ConversationalStyleProfile;

export const REFERENCE_CONVERSATIONAL_STYLE_LUXURY = Object.freeze({
  id: 'luxury',
  tone: 'formal',
  phrasingPreferences: Object.freeze([
    'premium travel consultant',
    'polished and unhurried',
    'Australian English',
  ]),
}) satisfies ConversationalStyleProfile;

/** All reference profiles as a frozen list for characterisation. */
export const REFERENCE_CONVERSATIONAL_STYLE_PROFILES = Object.freeze([
  REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL,
  REFERENCE_CONVERSATIONAL_STYLE_WARM,
  REFERENCE_CONVERSATIONAL_STYLE_LUXURY,
] as const satisfies readonly ConversationalStyleProfile[]);
