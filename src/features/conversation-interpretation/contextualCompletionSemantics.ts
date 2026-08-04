import { NEUTRAL_TRIP_FALLBACK_REPLY } from '../conversation-core/conversationReplyCatalogue';
import type { TravelInterpretationContext } from './buildInterpretationContext';
import {
  emptySemanticInterpretation,
  type TravelSemanticInterpretation,
} from './schema';

/**
 * Contextual completion semantics — closes optional Q&A when the traveller
 * signals they are done. Uses conversation anchors (active requirement +
 * last assistant prompt), not destination/origin cue-extractor growth.
 */

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

function isOptionalFollowUpContext(context: TravelInterpretationContext): boolean {
  if (context.activeRequirement === 'none') return true;
  if (context.travelState.conversationComplete === true) return true;
  const last = context.lastAssistantMessage;
  if (!last) return false;
  if (last === NEUTRAL_TRIP_FALLBACK_REPLY) return true;
  if (/what else should i know about your trip/i.test(last)) return true;
  if (/ready to search when you confirm/i.test(last)) return true;
  if (/here'?s what i have for your trip/i.test(last)) return true;
  return false;
}

function looksLikeCompletionUtterance(folded: string): boolean {
  const trimmed = folded.replace(/[.!?]+$/g, '').trim();
  if (!trimmed) return false;

  // Closing / done signals (meaning classes, not travel cue extractors).
  if (
    /^(that'?s\s+it|thats\s+it|that\s+is\s+it)$/.test(trimmed) ||
    /^(that'?s\s+all|thats\s+all|that\s+is\s+all)$/.test(trimmed) ||
    /^(all\s+done|i'?m\s+done|im\s+done|done)$/.test(trimmed) ||
    /^(nothing|nothing\s+else|nothing\s+more)$/.test(trimmed) ||
    /^(no|nope|nah)$/.test(trimmed) ||
    /^(no\s+thanks|no\s+thank\s+you)$/.test(trimmed) ||
    /^(i'?m\s+good|im\s+good|all\s+good)$/.test(trimmed) ||
    /^(that\s+will\s+be\s+all|that'?ll\s+be\s+all)$/.test(trimmed)
  ) {
    return true;
  }

  // Soft multi-word closers that still mean "no more optional details".
  if (
    /\bnothing\s+else\b/.test(trimmed) ||
    /\bthat'?s\s+(?:it|all)\b/.test(trimmed) ||
    /\ball\s+done\b/.test(trimmed) ||
    /\bno\s+more\b/.test(trimmed)
  ) {
    return true;
  }

  return false;
}

/**
 * Resolve completion intent against interpretation context.
 * Returns null when the utterance is not a completion signal in context.
 */
export function resolveContextualCompletionSemantics(
  context: TravelInterpretationContext,
): TravelSemanticInterpretation | null {
  if (!isOptionalFollowUpContext(context)) return null;

  const folded = asciiFold(context.message);
  if (!looksLikeCompletionUtterance(folded)) return null;

  // Avoid treating "no" as completion when a required count/date slot is active.
  if (
    context.activeRequirement !== 'none' &&
    context.activeRequirement !== 'services' &&
    /^(no|nope|nah)$/.test(folded.replace(/[.!?]+$/g, '').trim())
  ) {
    return null;
  }

  const semantic = emptySemanticInterpretation();
  semantic.intent = 'confirm';
  semantic.confirmation = true;
  semantic.conversationComplete = true;
  semantic.confidence = 0.9;
  return semantic;
}
