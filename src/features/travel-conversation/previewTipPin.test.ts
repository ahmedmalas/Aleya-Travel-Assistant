import { describe, expect, it } from 'vitest';
import {
  AUTHORITATIVE_HOST,
  AUTHORITATIVE_TEST_URL,
  isSupersededPreviewHost,
} from './previewTipPin';

describe('previewTipPin', () => {
  it('keeps the sole tip URL on the authoritative host', () => {
    expect(AUTHORITATIVE_TEST_URL).toContain('58jmbjjc2');
    expect(isSupersededPreviewHost(AUTHORITATIVE_HOST)).toBe(false);
  });

  it('flags known superseded immutable host markers', () => {
    expect(
      isSupersededPreviewHost(
        'travel-buddy-assistant-40wg4wfhx-ahmedmalas-projects.vercel.app',
      ),
    ).toBe(true);
    expect(
      isSupersededPreviewHost(
        'travel-buddy-assistant-q3fvjxed4-ahmedmalas-projects.vercel.app',
      ),
    ).toBe(true);
  });

  it('flags the moving branch alias so Preview-button tips redirect to the pin', () => {
    expect(
      isSupersededPreviewHost(
        'travel-buddy-assistant-ai-git-cursor-5147e3-ahmedmalas-projects.vercel.app',
      ),
    ).toBe(true);
  });

  it('does not flag fresh immutable tips (pin may lag one deploy)', () => {
    expect(
      isSupersededPreviewHost(
        'travel-buddy-assistant-fresh12345-ahmedmalas-projects.vercel.app',
      ),
    ).toBe(false);
  });

  it('does not flag production or local hosts', () => {
    expect(isSupersededPreviewHost('travel-buddy-assistant-ai.vercel.app')).toBe(
      false,
    );
    expect(isSupersededPreviewHost('localhost')).toBe(false);
  });
});
