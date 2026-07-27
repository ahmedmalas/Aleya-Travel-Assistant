/**
 * Intent router — classifies every user message before compose.
 *
 * Phase is readiness only. It never blocks intent recognition.
 * Soft affirm ("go ahead") marks requirements ready; it is not a chat trap.
 */

import type { ClarificationField, ConversationPhase, ConversationState, MessageClass } from './types';

export type IntentClassification = {
  messageClass: MessageClass;
  answersField?: ClarificationField;
};

const SUMMARY_RE =
  /^(?:show me (?:what you(?:'?ve| have)? got|the trip|everything)|let'?s review(?: it)?|what have you got|give me a (?:summary|recap)|review (?:the )?(?:trip|it)|summar(?:y|ise|ize)(?:\s+(?:the\s+)?(?:trip|it))?)\s*[!.?]*$/i;

const FINAL_CONFIRMATION_RE =
  /^(?:(?:yes[,.]?\s+)?(?:all(?:\s+good\s+and)?\s+)?confirmed|everything(?:'s| is)\s+confirmed|that'?s all confirmed|finali[sz]e it|lock it in)$/i;

const START_SEARCH_RE =
  /^(?:please\s+)?(?:search now|find flights|show flights|search hotels|search accommodation|find hotels|search car hire|start searching|begin search)\s*[!.?]*$/i;

const BOOKING_GENERATION_RE =
  /\b(?:invent(?:\s+(?:the|a|my))?\s+booking|fabricate(?:\s+(?:the|a|my))?\s+booking|make up(?:\s+(?:the|a|my))?\s+booking|fake(?:\s+(?:the|a|my))?\s+booking|generate(?:\s+(?:the|a|my))?\s+booking|create(?:\s+(?:the|a|my))?\s+(?:fake\s+)?booking)\b/i;

const ITINERARY_GENERATION_RE =
  /\b(?:build|create|make|generate|draft)\s+(?:me\s+)?(?:an?\s+|my\s+)?itinerary\b|\bday[- ]by[- ]day\s+plan\b/i;

const PRICING_RE =
  /\b(?:how much(?:\s+will\s+it\s+cost)?|what(?:'s| is)\s+the\s+price|give me(?:\s+the)?\s+prices?|pricing|cost estimate)\b/i;

const HOTEL_RECOMMENDATION_RE =
  /\b(?:find(?:\s+me)?\s+the\s+best\s+hotel|best\s+hotel|recommend(?:\s+me)?\s+(?:a\s+)?hotels?|hotel recommendation)\b/i;

const FLIGHT_RECOMMENDATION_RE =
  /\b(?:find(?:\s+me)?\s+the\s+best\s+flight|best\s+flight|recommend(?:\s+me)?\s+(?:a\s+)?flights?|flight recommendation)\b/i;

const STAGE_QUERY_RE =
  /^(?:what(?:'s| is)?\s+(?:the\s+)?(?:stage|phase|status)|where are we(?:\s+at)?|are we in planning|what stage(?:\s+are\s+we(?:\s+at)?)?)\s*[!.?]*$/i;

const SOFT_PREFIX = /^(?:(?:you\s+can|please)\s+)/i;
const SOFT_SUFFIX = /\s+(?:please)$/i;

const SOFT_AFFIRM_CLAUSE_RE =
  /^(?:that'?s all(?:\s+for now)?|that will do|everything looks good(?:\s+to me)?|looks good(?:\s+to me)?|go ahead|continue|proceed|perfect|that'?s correct|yes|yep|yeah|correct|that'?s right|sounds good)$/i;

const CLAUSE_SPLIT_RE = /\s*[,;]+\s*|\s+\band\b\s+|\s+\bthen\b\s+|\s+\bbut\b\s+/i;

/** Control intents that skip extract/merge (no travel mutation expected). */
export const CONTROL_INTENTS: ReadonlySet<MessageClass> = new Set([
  'greeting',
  'thanks',
  'new_conversation',
  'summary',
  'soft_affirm',
  'final_confirmation',
  'start_search',
  'booking_generation',
  'itinerary_generation',
  'pricing_request',
  'hotel_recommendation',
  'flight_recommendation',
  'stage_query',
  'rejection',
]);

function normalizeIntentText(text: string): string {
  return text
    .trim()
    .replace(/[\u2018\u2019\u2032']/g, "'")
    .replace(/[.!?]+$/g, '')
    .trim();
}

function stripSoftWrappers(clause: string): string {
  return clause.replace(SOFT_PREFIX, '').replace(SOFT_SUFFIX, '').trim();
}

function matchesSoftAffirmClause(clause: string): boolean {
  const core = stripSoftWrappers(normalizeIntentText(clause));
  return core.length > 0 && SOFT_AFFIRM_CLAUSE_RE.test(core);
}

export function isFinalConfirmationMessage(text: string): boolean {
  return FINAL_CONFIRMATION_RE.test(normalizeIntentText(text));
}

/** Pure soft-affirm only — combined travel instructions fall through. */
export function isSoftAffirmMessage(text: string): boolean {
  const normalized = normalizeIntentText(text);
  if (!normalized) return false;
  if (isFinalConfirmationMessage(normalized)) return false;

  if (matchesSoftAffirmClause(normalized)) return true;

  const clauses = normalized
    .split(CLAUSE_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);

  if (clauses.length < 2) return false;
  return clauses.every(matchesSoftAffirmClause);
}

/** @deprecated Use isSoftAffirmMessage — kept for any external callers. */
export function isConfirmationMessage(text: string): boolean {
  return isSoftAffirmMessage(text);
}

function looksLikeClarificationAnswer(text: string, field: ClarificationField): boolean {
  if (text.length > 80) return false;
  if (field === 'origin' || field === 'destination') {
    return /^(?:(?:it'?s|from|to|in)\s+)?[a-z][a-z\s']{1,40}$/i.test(text.replace(/[.!?]+$/, ''));
  }
  if (field === 'departureDate' || field === 'returnDate') {
    return (
      /\b\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+[a-z]+/i.test(text) ||
      /\b(?:early|mid|late)\s+[a-z]+/i.test(text) ||
      /^\d{1,2}(?:st|nd|rd|th)?$/.test(text.trim()) ||
      /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/.test(text) ||
      /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(text)
    );
  }
  return false;
}

/**
 * Classify user intent. Order is deliberate: action intents beat soft affirm,
 * and soft affirm only matches when the whole message is affirmation.
 */
export function classifyIntent(
  text: string,
  previous: ConversationState,
): IntentClassification {
  const trimmed = text.trim();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.\s]*$/i.test(trimmed)) {
    return { messageClass: 'greeting' };
  }
  if (/^(thanks|thank you|cheers|ok thanks)[!,.\s]*$/i.test(trimmed)) {
    return { messageClass: 'thanks' };
  }
  if (/\b(?:start over|new (?:trip|conversation)|clear (?:everything|requirements))\b/i.test(trimmed)) {
    return { messageClass: 'new_conversation' };
  }
  if (STAGE_QUERY_RE.test(trimmed)) {
    return { messageClass: 'stage_query' };
  }
  if (START_SEARCH_RE.test(trimmed)) {
    return { messageClass: 'start_search' };
  }
  if (BOOKING_GENERATION_RE.test(trimmed)) {
    return { messageClass: 'booking_generation' };
  }
  if (ITINERARY_GENERATION_RE.test(trimmed)) {
    return { messageClass: 'itinerary_generation' };
  }
  if (HOTEL_RECOMMENDATION_RE.test(trimmed)) {
    return { messageClass: 'hotel_recommendation' };
  }
  if (FLIGHT_RECOMMENDATION_RE.test(trimmed)) {
    return { messageClass: 'flight_recommendation' };
  }
  if (PRICING_RE.test(trimmed)) {
    return { messageClass: 'pricing_request' };
  }
  if (SUMMARY_RE.test(trimmed)) {
    return { messageClass: 'summary' };
  }
  if (isFinalConfirmationMessage(trimmed)) {
    return { messageClass: 'final_confirmation' };
  }
  if (isSoftAffirmMessage(trimmed)) {
    return { messageClass: 'soft_affirm' };
  }
  if (/^(no|nope|nah)\.?$/i.test(trimmed)) {
    return { messageClass: 'rejection' };
  }

  const pending = previous.pendingClarification;
  if (pending && looksLikeClarificationAnswer(trimmed, pending)) {
    return { messageClass: 'clarification_answer', answersField: pending };
  }

  if (/\b(?:remove|forget|don'?t need|do not need|without|no more)\b/i.test(trimmed)) {
    return { messageClass: 'explicit_removal' };
  }
  if (
    /\b(?:change|switch|instead|make it|actually|not\s+\w+\s*[—\-–,])\b/i.test(trimmed) &&
    /\b(?:destination|origin|date|hotel|flights?|car hire)\b/i.test(trimmed)
  ) {
    return { messageClass: 'explicit_change' };
  }

  if (
    /\b(?:go(?:ing)?|from|to|depart|leav|flight|hotel|stay|night|august|january|february|march|april|may|june|july|september|october|november|december|melbourne|sydney|gold coast|brisbane)\b/i.test(
      trimmed,
    )
  ) {
    return { messageClass: 'travel_request' };
  }

  return { messageClass: 'general_conversation' };
}

/**
 * Readiness phase from completeness — never a sticky chat mode.
 * Complete requirements ⇒ ready. Final confirmation ⇒ locked.
 * Mutations while locked return to ready (requirements update).
 */
export function resolveReadinessPhase(input: {
  previous: ConversationState;
  intent: MessageClass;
  requirementsComplete: boolean;
  clarificationNeeded: boolean;
  mutated: boolean;
}): ConversationPhase {
  const { previous, intent, requirementsComplete, clarificationNeeded, mutated } = input;

  if (intent === 'new_conversation') return 'requirements';
  if (clarificationNeeded || !requirementsComplete) return 'requirements';

  if (intent === 'final_confirmation') return 'locked';
  if (mutated) return 'ready';
  if (previous.phase === 'locked') return 'locked';
  return 'ready';
}

export function isControlIntent(intent: MessageClass): boolean {
  return CONTROL_INTENTS.has(intent);
}
