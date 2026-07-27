/**
 * Stage 2 — Base message classification before extraction / post-requirements.
 * Natural search approval is decided in postRequirements.ts (not here).
 */

import type { ClarificationField, ConversationState, MessageClass } from './types';

export type Classification = {
  messageClass: MessageClass;
  answersField?: ClarificationField;
};

const SUMMARY_RE =
  /^(?:show me (?:what you(?:'?ve| have)? got|the trip|everything|a summary)|let'?s review(?: it)?|what have you got|give me a (?:summary|recap)|review (?:the )?(?:trip|it)|summar(?:y|ise|ize)(?:\s+(?:the\s+)?(?:trip|it))?)\s*[!.?]*$/i;

const FINAL_CONFIRMATION_RE =
  /^(?:(?:yes[,.]?\s+)?(?:all(?:\s+good\s+and)?\s+)?confirmed|everything(?:'s| is)\s+confirmed|that'?s all confirmed|finali[sz]e it|lock it in)$/i;

const START_SEARCH_EXPLICIT_RE =
  /^(?:please\s+)?(?:search now|find flights|show flights|search hotels|search accommodation|find hotels|search car hire|start searching|begin search|find everything|show me the options|show me what'?s available|search for me|find my flights|find them|ready for live options|i'?m ready(?: for (?:live )?options)?|let'?s do it|book it|let'?s book)\s*[!.?]*$/i;

const BOOKING_GENERATION_RE =
  /\b(?:invent(?:\s+(?:the|a|my))?\s+booking|fabricate(?:\s+(?:the|a|my))?\s+booking|make up(?:\s+(?:the|a|my))?\s+booking|fake(?:\s+(?:the|a|my))?\s+booking)\b/i;

const ITINERARY_GENERATION_RE =
  /\b(?:build|create|make|generate|draft)\s+(?:me\s+)?(?:an?\s+|my\s+)?itinerary\b|\bday[- ]by[- ]day\s+plan\b/i;

const PRICING_RE =
  /\b(?:how much(?:\s+will\s+it\s+cost)?|what(?:'s| is)\s+the\s+price|give me(?:\s+the)?\s+prices?|pricing|cost estimate)\b/i;

const HOTEL_RECOMMENDATION_RE =
  /\b(?:find(?:\s+me)?\s+the\s+best\s+hotel|best\s+hotel|recommend(?:\s+me)?\s+(?:a\s+)?hotels?|hotel recommendation)\b/i;

const FLIGHT_RECOMMENDATION_RE =
  /\b(?:find(?:\s+me)?\s+the\s+best\s+flight|best\s+flight|recommend(?:\s+me)?\s+(?:a\s+)?flights?|flight recommendation)\b/i;

const DECLINE_SEARCH_RE =
  /^(?:i'?m not ready(?: yet)?|not ready(?: yet)?|don'?t search(?: yet)?|do not search(?: yet)?|hold off|not yet)\s*[!.?]*$/i;

function normalizeIntentText(text: string): string {
  return text
    .trim()
    .replace(/[\u2018\u2019\u2032']/g, "'")
    .replace(/[.!?]+$/g, '')
    .trim();
}

export function isFinalConfirmationMessage(text: string): boolean {
  return FINAL_CONFIRMATION_RE.test(normalizeIntentText(text));
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

export function classifyMessage(
  text: string,
  previous: ConversationState,
): Classification {
  const trimmed = text.trim();
  const normalized = normalizeIntentText(trimmed);

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.\s]*$/i.test(trimmed)) {
    return { messageClass: 'greeting' };
  }
  if (/^(thanks|thank you|cheers|ok thanks)[!,.\s]*$/i.test(trimmed)) {
    return { messageClass: 'thanks' };
  }
  if (/\b(?:start over|new (?:trip|conversation)|clear (?:everything|requirements))\b/i.test(trimmed)) {
    return { messageClass: 'new_conversation' };
  }
  if (DECLINE_SEARCH_RE.test(normalized)) {
    return { messageClass: 'decline_search' };
  }
  if (SUMMARY_RE.test(trimmed)) {
    return { messageClass: 'summary' };
  }
  if (isFinalConfirmationMessage(trimmed)) {
    return { messageClass: 'final_confirmation' };
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
  if (START_SEARCH_EXPLICIT_RE.test(normalized)) {
    return { messageClass: 'start_search' };
  }
  if (/^(no|nope|nah)\.?$/i.test(trimmed)) {
    return { messageClass: 'rejection' };
  }

  // Affirm + mutation must go through extract ("go ahead and change…").
  if (
    /\b(?:go ahead|continue|proceed)\b/i.test(trimmed) &&
    /\b(?:change|remove|forget|switch|but)\b/i.test(trimmed)
  ) {
    if (/\b(?:remove|forget)\b/i.test(trimmed)) {
      return { messageClass: 'explicit_removal' };
    }
    return { messageClass: 'explicit_change' };
  }

  // Bare approvals before travel_request — "go ahead" must not match /\bgo\b/.
  if (
    /^(?:go ahead|proceed|continue|start|ready|i'?m ready|let'?s do it|yes|yep|yeah|do it|ok(?:ay)?|perfect|sounds good)\s*[!.?]*$/i.test(
      normalized,
    )
  ) {
    return { messageClass: 'start_search' };
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
    /\b(?:destination|origin|date|hotel|flights?|car hire|melbourne|brisbane|sydney|gold coast)\b/i.test(
      trimmed,
    )
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

/** Control intents that skip extract/merge when post-requirements doesn't force mutate. */
export const CONTROL_MESSAGE_CLASSES: ReadonlySet<MessageClass> = new Set([
  'greeting',
  'thanks',
  'new_conversation',
  'summary',
  'final_confirmation',
  'start_search',
  'booking_generation',
  'itinerary_generation',
  'pricing_request',
  'hotel_recommendation',
  'flight_recommendation',
  'decline_search',
  'rejection',
  'general_conversation',
]);

export function isControlMessageClass(messageClass: MessageClass): boolean {
  return CONTROL_MESSAGE_CLASSES.has(messageClass);
}
