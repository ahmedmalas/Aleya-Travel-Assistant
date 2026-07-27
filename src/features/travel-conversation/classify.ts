import type { ClarificationField, ConversationState, MessageClass } from './types';

export type Classification = {
  messageClass: MessageClass;
  /** When the message is primarily answering an active clarification. */
  answersField?: ClarificationField;
};

const SUMMARY_RE =
  /^(?:show me (?:what you(?:'?ve| have)? got|the trip|everything)|let'?s review(?: it)?|what have you got|give me a (?:summary|recap)|review (?:the )?(?:trip|it)|summar(?:y|ise|ize)(?:\s+(?:the\s+)?(?:trip|it))?)\s*[!.?]*$/i;

const CONFIRMATION_RE =
  /^(?:that'?s all(?:\s+for now)?|looks good(?:\s+to me)?|go ahead(?:\s+please)?|continue|proceed|perfect|that'?s correct|yes|yep|yeah|correct|that'?s right|sounds good)(?:[.!]|\s+thanks)?\.?$/i;

/**
 * Stage 2 — Classify before extraction.
 * Active clarification is consulted before generic travel parsing.
 */
export function classifyMessage(
  text: string,
  previous: ConversationState,
): Classification {
  const trimmed = text.trim();
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)(?:\s+\w+)?[!,.\s]*$/i.test(trimmed)) {
    return { messageClass: 'greeting' };
  }
  if (/^(thanks|thank you|cheers)[!,.\s]*$/i.test(trimmed)) {
    return { messageClass: 'thanks' };
  }
  if (/\b(?:start over|new (?:trip|conversation)|clear (?:everything|requirements))\b/i.test(trimmed)) {
    return { messageClass: 'new_conversation' };
  }
  if (SUMMARY_RE.test(trimmed)) {
    return { messageClass: 'summary' };
  }
  if (CONFIRMATION_RE.test(trimmed)) {
    return { messageClass: 'confirmation' };
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

  return { messageClass: 'non_travel' };
}

function looksLikeClarificationAnswer(text: string, field: ClarificationField): boolean {
  // Short answers, or date-shaped / place-shaped replies while a field is pending.
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
