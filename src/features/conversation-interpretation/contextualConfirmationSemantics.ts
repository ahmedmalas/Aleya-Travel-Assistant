import type { TravelInterpretationContext } from './buildInterpretationContext';
import {
  emptySemanticInterpretation,
  type TravelSemanticInterpretation,
} from './schema';

/**
 * Contextual confirmation → search-execution semantics.
 *
 * Distinct from optional-detail completion (`conversationComplete`):
 * when the planner has already moved to trip-ready / confirm-to-search,
 * confirmation intent requests search execution rather than re-emitting
 * the summary.
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

function isAwaitingSearchConfirmation(
  context: TravelInterpretationContext,
): boolean {
  if (context.travelState.searchExecutionRequested === true) return false;

  if (context.travelState.conversationComplete === true) return true;

  const last = context.lastAssistantMessage;
  if (!last) return false;
  if (/ready to search when you confirm/i.test(last)) return true;
  if (/here'?s what i have for your trip/i.test(last)) return true;
  if (/i'?m ready to search when you confirm/i.test(last)) return true;
  return false;
}

/**
 * Confirmation-to-execute meaning class (not optional-detail closers).
 * Closers like "that's it" / "nothing else" remain completion semantics.
 */
function looksLikeSearchConfirmationUtterance(folded: string): boolean {
  const trimmed = folded.replace(/[.!?]+$/g, '').trim();
  if (!trimmed) return false;

  if (
    /^(?:confirmed|confirm|confirmation)$/.test(trimmed) ||
    /^(?:yes|yep|yeah|yea|yup)$/.test(trimmed) ||
    /^(?:yes\s+please|yes\s+please\s+search)$/.test(trimmed) ||
    /^(?:ok|okay|okey|sure)$/.test(trimmed) ||
    /^(?:go\s+ahead|proceed|please\s+proceed|please\s+search|search|search\s+now|do\s+it)$/.test(
      trimmed,
    ) ||
    /^(?:looks?\s+good|sounds?\s+good|all\s+good|perfect)$/.test(trimmed) ||
    /^(?:that'?s\s+correct|thats\s+correct|correct)$/.test(trimmed) ||
    /^(?:i\s+confirm|confirmed\s+please)$/.test(trimmed)
  ) {
    return true;
  }

  if (
    /\b(?:please\s+)?(?:go\s+ahead|proceed|search\s+now|confirm)\b/.test(
      trimmed,
    ) &&
    trimmed.split(/\s+/).length <= 6
  ) {
    return true;
  }

  return false;
}

/**
 * Resolve confirmation intent against trip-ready context.
 * Returns null when the utterance is not a confirm-to-search signal.
 */
export function resolveContextualConfirmationSemantics(
  context: TravelInterpretationContext,
): TravelSemanticInterpretation | null {
  if (!isAwaitingSearchConfirmation(context)) return null;

  const folded = asciiFold(context.message);
  if (!looksLikeSearchConfirmationUtterance(folded)) return null;

  // Required count/date slots still open: do not treat brief yes/ok as search.
  if (
    context.activeRequirement !== 'none' &&
    context.activeRequirement !== 'services' &&
    context.travelState.conversationComplete !== true
  ) {
    return null;
  }

  const semantic = emptySemanticInterpretation();
  semantic.intent = 'confirm';
  semantic.confirmation = true;
  semantic.conversationComplete = true;
  semantic.searchExecutionRequested = true;
  semantic.confidence = 0.92;
  return semantic;
}
