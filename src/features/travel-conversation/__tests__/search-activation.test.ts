import { describe, expect, it } from 'vitest';
import { isExplicitSearchRequest } from '../ui/searchActivation';

describe('explicit search activation (UI handoff)', () => {
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
  ])('activates search for: %s', (message) => {
    expect(isExplicitSearchRequest(message)).toBe(true);
  });

  it.each([
    'go ahead',
    'proceed',
    'continue',
    'all confirmed',
    'show me what you got',
    'Find me affordable flights to Bali',
    'I need a hotel in Singapore next weekend',
  ])('does not activate search for: %s', (message) => {
    expect(isExplicitSearchRequest(message)).toBe(false);
  });
});
