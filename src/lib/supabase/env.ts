export type SupabaseEnvConfig = {
  url: string;
  anonKey: string;
  projectRef: string | null;
};

export type SupabaseEnvValidation =
  | { ok: true; config: SupabaseEnvConfig; mode: 'cloud-ready' }
  | { ok: false; mode: 'local-demo'; reason: string; missing: string[] };

/** Approved Travel Buddy organisation and production project. */
export const TRAVEL_BUDDY_SUPABASE_ORG = {
  id: 'tasqkbrzxjralyelioyv',
  name: 'Aleya (approved Travel Buddy org)',
  expectedProjectName: 'aleya travel assistant',
  projectRef: 'jtktojbvbmiewpntpvhe',
  url: 'https://jtktojbvbmiewpntpvhe.supabase.co',
} as const;

/**
 * Forbidden projects / refs — never apply Travel Buddy migrations or use these.
 * Includes the retired Peptides Guy travel-buddy-production project.
 */
export const FORBIDDEN_SUPABASE_PROJECTS = [
  { id: 'farnjmgwcayvkzuaoifk', name: 'travel-buddy-production (retired — do not use)' },
  { id: 'iwmloenntlzyzvguwfsn', name: 'aboss-production' },
  { id: 'bmfpclozzmeekazmoaxw', name: 'ai-invoicing-app-production' },
  { id: 'wrmwthsfbpkjsxsqigpw', name: 'aleya-logo-creator' },
] as const;

const FORBIDDEN_REFS = new Set<string>(FORBIDDEN_SUPABASE_PROJECTS.map((project) => project.id));

const readPublishableKey = (env: Record<string, string | undefined>): string => {
  const publishable = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (publishable) return publishable;
  return (env.VITE_SUPABASE_ANON_KEY ?? '').trim();
};

export const validateSupabaseEnv = (
  env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>,
): SupabaseEnvValidation => {
  const url = (env.VITE_SUPABASE_URL ?? '').trim();
  const anonKey = readPublishableKey(env);
  const projectRef = (env.VITE_SUPABASE_PROJECT_REF ?? '').trim() || null;
  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!anonKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');

  if (missing.length > 0) {
    return {
      ok: false,
      mode: 'local-demo',
      reason: 'Supabase env is incomplete; local/demo mode remains active.',
      missing,
    };
  }

  if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url) && !url.includes('127.0.0.1') && !url.includes('localhost')) {
    return {
      ok: false,
      mode: 'local-demo',
      reason: 'VITE_SUPABASE_URL must be an https://*.supabase.co URL (or local Supabase).',
      missing: ['VITE_SUPABASE_URL'],
    };
  }

  if (anonKey.startsWith('eyJ') === false && anonKey.startsWith('sb_publishable_') === false) {
    return {
      ok: false,
      mode: 'local-demo',
      reason: 'VITE_SUPABASE_PUBLISHABLE_KEY does not look like a publishable/anon key.',
      missing: ['VITE_SUPABASE_PUBLISHABLE_KEY'],
    };
  }

  const urlRefMatch = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  const urlRef = urlRefMatch?.[1] ?? null;
  if (urlRef && FORBIDDEN_REFS.has(urlRef)) {
    return {
      ok: false,
      mode: 'local-demo',
      reason: `VITE_SUPABASE_URL points at forbidden project ${urlRef}. Use organisation ${TRAVEL_BUDDY_SUPABASE_ORG.id} project "${TRAVEL_BUDDY_SUPABASE_ORG.expectedProjectName}" only.`,
      missing: ['VITE_SUPABASE_URL'],
    };
  }

  if (projectRef && FORBIDDEN_REFS.has(projectRef)) {
    return {
      ok: false,
      mode: 'local-demo',
      reason: `VITE_SUPABASE_PROJECT_REF ${projectRef} is forbidden. Wait for verified "aleya travel assistant" project ref.`,
      missing: ['VITE_SUPABASE_PROJECT_REF'],
    };
  }

  if (
    SUPABASE_TARGET_VERIFICATION.verified &&
    SUPABASE_TARGET_VERIFICATION.projectRef &&
    urlRef &&
    urlRef !== SUPABASE_TARGET_VERIFICATION.projectRef
  ) {
    return {
      ok: false,
      mode: 'local-demo',
      reason: `VITE_SUPABASE_URL must point at verified project ${SUPABASE_TARGET_VERIFICATION.projectRef}.`,
      missing: ['VITE_SUPABASE_URL'],
    };
  }

  if (
    SUPABASE_TARGET_VERIFICATION.verified &&
    SUPABASE_TARGET_VERIFICATION.projectRef &&
    projectRef &&
    projectRef !== SUPABASE_TARGET_VERIFICATION.projectRef
  ) {
    return {
      ok: false,
      mode: 'local-demo',
      reason: `VITE_SUPABASE_PROJECT_REF must be ${SUPABASE_TARGET_VERIFICATION.projectRef}.`,
      missing: ['VITE_SUPABASE_PROJECT_REF'],
    };
  }

  return {
    ok: true,
    mode: 'cloud-ready',
    config: { url: url.replace(/\/$/, ''), anonKey, projectRef },
  };
};

/** @deprecated Prefer TRAVEL_BUDDY_SUPABASE_ORG + SUPABASE_TARGET_VERIFICATION */
export const TRAVEL_BUDDY_SUPABASE_PROJECT = {
  organization: TRAVEL_BUDDY_SUPABASE_ORG.name,
  organizationId: TRAVEL_BUDDY_SUPABASE_ORG.id,
  name: TRAVEL_BUDDY_SUPABASE_ORG.expectedProjectName,
  ref: TRAVEL_BUDDY_SUPABASE_ORG.projectRef,
  region: 'production',
  url: TRAVEL_BUDDY_SUPABASE_ORG.url,
} as const;

/** @deprecated Use FORBIDDEN_SUPABASE_PROJECTS */
export const ACCESSIBLE_SUPABASE_PROJECTS = FORBIDDEN_SUPABASE_PROJECTS;

export const SUPABASE_TARGET_VERIFICATION = {
  verified: true as const,
  organization: `${TRAVEL_BUDDY_SUPABASE_ORG.name} (${TRAVEL_BUDDY_SUPABASE_ORG.id})`,
  projectName: TRAVEL_BUDDY_SUPABASE_ORG.expectedProjectName,
  projectRef: TRAVEL_BUDDY_SUPABASE_ORG.projectRef,
  reason:
    'Production target is aleya travel assistant (jtktojbvbmiewpntpvhe) under organisation tasqkbrzxjralyelioyv. Vercel must set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (ANON_KEY accepted as alias). Retired ref farnjmgwcayvkzuaoifk must not be used.',
  accessibleProjects: [TRAVEL_BUDDY_SUPABASE_ORG.expectedProjectName],
  forbiddenProjects: FORBIDDEN_SUPABASE_PROJECTS.map((project) => project.name),
  localMigrationsPath: 'supabase/migrations/',
  fallbackMode: 'local-demo',
  /** Applied on jtktojbvbmiewpntpvhe via PR #19 CLI evidence (2026-07-19). */
  remoteMigrationsApplied: true as const,
  migrationsApplied: [
    '20260718120000_travel_buddy_foundation',
    '20260718120100_travel_buddy_storage',
    '20260719120000_travel_buddy_security_hardening',
    '20260719120100_travel_buddy_launch_grants',
    '20260719120200_travel_buddy_trips_returning_select',
  ] as const,
  isolationProof: {
    passed: true as const,
    checks: 4,
    summary:
      'URL/project-ref must equal jtktojbvbmiewpntpvhe; forbidden refs rejected; publishable/anon key shape validated; Vercel project travel-buddy-assistant-ai.',
  },
  vercel: {
    team: 'ahmedmalas-projects',
    project: 'travel-buddy-assistant-ai',
  },
} as const;
