import { describe, expect, it } from 'vitest';
import { isSearchApprovalMessage } from '../postRequirements';

describe('search approval phrases', () => {
  it.each([
    'search now',
    'find flights',
    'show flights',
    'search hotels',
    'search accommodation',
    'find hotels',
    'search car hire',
    'start searching',
    'begin search',
    'Please search now',
    'ready for live options',
    'go ahead',
    'proceed',
    'continue',
    'find everything',
    "let's do it",
  ])('treats as search approval: %s', (message) => {
    expect(isSearchApprovalMessage(message)).toBe(true);
  });

  it.each([
    'go ahead and change the destination to Brisbane',
    'continue but remove car hire',
    'show me a summary',
    "I'm not ready yet",
    'Find me affordable flights to Bali',
    'all confirmed',
  ])('does not treat as bare search approval: %s', (message) => {
    expect(isSearchApprovalMessage(message)).toBe(false);
  });
});
