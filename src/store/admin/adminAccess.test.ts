import { describe, expect, it } from 'vitest';
import { assertAdminCapability, capabilitiesForRole, resolveAppRole } from './adminAccess';

describe('admin access', () => {
  it('defaults unknown users to traveller', () => {
    expect(resolveAppRole({ email: 'user@example.com' })).toBe('traveller');
    expect(capabilitiesForRole('traveller')).toEqual([]);
  });

  it('honours explicit admin role claims', () => {
    expect(resolveAppRole({ appRole: 'admin' })).toBe('admin');
    expect(assertAdminCapability('admin', 'manage_feature_flags').ok).toBe(true);
    expect(assertAdminCapability('traveller', 'manage_feature_flags').ok).toBe(false);
  });
});
