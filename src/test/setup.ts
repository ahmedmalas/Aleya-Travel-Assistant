import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { __resetSupabaseClientForTests } from '../lib/supabase/client';

beforeEach(() => {
  localStorage.clear();
  __resetSupabaseClientForTests();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  __resetSupabaseClientForTests();
});
