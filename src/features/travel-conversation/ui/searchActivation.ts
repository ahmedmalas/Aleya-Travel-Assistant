/**
 * UI-layer search activation — not a conversation phase.
 * Requirements ready/locked only means the snapshot is complete; search starts
 * on explicit request (or the Continue to search button).
 */

const EXPLICIT_SEARCH_RE =
  /^(?:please\s+)?(?:search now|find flights|show flights|search hotels|search accommodation|find hotels|search car hire|start searching|begin search)\s*[!.?]*$/i;

/** True when the user message is an explicit request to open/run search. */
export function isExplicitSearchRequest(message: string): boolean {
  return EXPLICIT_SEARCH_RE.test(message.trim());
}
