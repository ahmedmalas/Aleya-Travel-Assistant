import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_SUPABASE_PROJECTS,
  SUPABASE_TARGET_VERIFICATION,
  TRAVEL_BUDDY_SUPABASE_ORG,
  validateSupabaseEnv,
} from './env';

describe('validateSupabaseEnv', () => {
  it('falls back to local-demo when env is missing', () => {
    const result = validateSupabaseEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.mode).toBe('local-demo');
      expect(result.missing).toContain('VITE_SUPABASE_URL');
      expect(result.missing).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    }
  });

  it('accepts publishable key for the verified aleya project', () => {
    const result = validateSupabaseEnv({
      VITE_SUPABASE_URL: 'https://jtktojbvbmiewpntpvhe.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_123',
      VITE_SUPABASE_PROJECT_REF: 'jtktojbvbmiewpntpvhe',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe('cloud-ready');
      expect(result.config.projectRef).toBe('jtktojbvbmiewpntpvhe');
    }
  });

  it('accepts legacy VITE_SUPABASE_ANON_KEY alias for the verified project', () => {
    const result = validateSupabaseEnv({
      VITE_SUPABASE_URL: 'https://jtktojbvbmiewpntpvhe.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_test_key_123',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-verified supabase project URL when target is locked', () => {
    const result = validateSupabaseEnv({
      VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_123',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects the retired travel-buddy-production project ref', () => {
    const result = validateSupabaseEnv({
      VITE_SUPABASE_URL: 'https://farnjmgwcayvkzuaoifk.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_123',
    });
    expect(result.ok).toBe(false);
  });

  it('records verified aleya travel assistant production target', () => {
    expect(SUPABASE_TARGET_VERIFICATION.verified).toBe(true);
    expect(SUPABASE_TARGET_VERIFICATION.projectRef).toBe('jtktojbvbmiewpntpvhe');
    expect(TRAVEL_BUDDY_SUPABASE_ORG.id).toBe('tasqkbrzxjralyelioyv');
    expect(TRAVEL_BUDDY_SUPABASE_ORG.expectedProjectName).toBe('aleya travel assistant');
    expect(FORBIDDEN_SUPABASE_PROJECTS.map((p) => p.id)).toContain('farnjmgwcayvkzuaoifk');
    expect(SUPABASE_TARGET_VERIFICATION.vercel.project).toBe('travel-buddy-assistant-ai');
    expect(SUPABASE_TARGET_VERIFICATION.remoteMigrationsApplied).toBe(true);
    expect(SUPABASE_TARGET_VERIFICATION.migrationsApplied.length).toBeGreaterThanOrEqual(4);
  });
});
