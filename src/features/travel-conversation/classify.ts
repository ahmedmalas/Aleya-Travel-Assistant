import type { ClarificationField, ConversationState, MessageClass } from './types';

export type Classification = {
  messageClass: MessageClass;
  /** When the message is primarily answering an active clarification. */
  answersField?: ClarificationField;
};

const SUMMARY_RE =
  /^(?:show me (?:what you(?:'?ve| have)? got|the trip|everything)|let'?s review(?: it)?|what have you got|give me a (?:summary|recap)|review (?:the )?(?:trip|it)|summar(?:y|ise|ize)(?:\s+(?:the\s+)?(?:trip|it))?)\s*[!.?]*$/i;

/**
 * Final lock-in phrases — distinct from planning confirmation ("go ahead").
 * Whole-message match only so mutations like "confirmed, but change…" fall through.
 */
const FINAL_CONFIRMATION_RE =
  /^(?:(?:yes[,.]?\s+)?(?:all(?:\s+good\s+and)?\s+)?confirmed|everything(?:'s| is)\s+confirmed|that'?s all confirmed|finali[sz]e it|lock it in)$/i;

/** Soft wrappers allowed around a confirmation clause. */
const SOFT_PREFIX = /^(?:(?:you\s+can|please)\s+)/i;
const SOFT_SUFFIX = /\s+(?:please)$/i;

/**
 * Atomic planning-confirmation clauses ("go ahead"). Combined messages are
 * accepted when every clause (split on commas / and / then / but) matches.
 */
const CONFIRMATION_CLAUSE_RE =
  /^(?:that'?s all(?:\s+for now)?|that will do|everything looks good(?:\s+to me)?|looks good(?:\s+to me)?|go ahead|continue|proceed|perfect|that'?s correct|yes|yep|yeah|correct|that'?s right|sounds good)$/i;

const CLAUSE_SPLIT_RE = /\s*[,;]+\s*|\s+\band\b\s+|\s+\bthen\b\s+|\s+\bbut\b\s+/i;

function normalizeIntentText(text: string): string {
  return text
    .trim()
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[.!?]+$/g, '')
    .trim();
}

function stripSoftWrappers(clause: string): string {
  return clause.replace(SOFT_PREFIX, '').replace(SOFT_SUFFIX, '').trim();
}

function matchesConfirmationClause(clause: string): boolean {
  const core = stripSoftWrappers(normalizeIntentText(clause));
  return core.length > 0 && CONFIRMATION_CLAUSE_RE.test(core);
}

/** True when the message is a final lock-in (not planning "go ahead"). */
export function isFinalConfirmationMessage(text: string): boolean {
  return FINAL_CONFIRMATION_RE.test(normalizeIntentText(text));
}

/**
 * True when the message is only planning-confirmation clause(s), including
 * natural combinations like "That's all for now, you can go ahead".
 * Messages with travel details or mutations fail and fall through.
 */
export function isConfirmationMessage(text: string): boolean {
  const normalized = normalizeIntentText(text);
  if (!normalized) return false;
  if (isFinalConfirmationMessage(normalized)) return false;

  if (matchesConfirmationClause(normalized)) return true;

  const clauses = normalized
    .split(CLAUSE_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);

  if (clauses.length < 2) return false;
  return clauses.every(matchesConfirmationClause);
}

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
  if (isFinalConfirmationMessage(trimmed)) {
    return { messageClass: 'final_confirmation' };
  }
  if (isConfirmationMessage(trimmed)) {
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
