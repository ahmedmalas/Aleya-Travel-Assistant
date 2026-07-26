import { describe, expect, it } from 'vitest';
import { createSupportTicket, FAQ_ENTRIES, getSystemStatus } from './supportCentre';

describe('support centre', () => {
  it('creates open tickets and exposes FAQ/status', () => {
    const ticket = createSupportTicket({
      kind: 'bug',
      subject: 'Calendar export',
      body: 'ICS download failed',
      contactEmail: 'traveller@example.com',
    });
    expect(ticket.status).toBe('open');
    expect(FAQ_ENTRIES.length).toBeGreaterThan(0);
    expect(getSystemStatus().components.length).toBeGreaterThan(0);
  });
});
