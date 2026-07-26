/**
 * Server-side / RLS-oriented admin role helpers.
 * UI hiding alone is never sufficient — callers must enforce these checks before mutations.
 */

export type AppRole = 'traveller' | 'support' | 'admin';

export type AdminCapability =
  | 'view_users'
  | 'view_trips'
  | 'manage_feature_flags'
  | 'view_audit_logs'
  | 'view_provider_health'
  | 'manage_system_notices'
  | 'view_support_cases';

const ADMIN_CAPABILITIES: AdminCapability[] = [
  'view_users',
  'view_trips',
  'manage_feature_flags',
  'view_audit_logs',
  'view_provider_health',
  'manage_system_notices',
  'view_support_cases',
];

const SUPPORT_CAPABILITIES: AdminCapability[] = [
  'view_support_cases',
  'view_provider_health',
  'view_audit_logs',
];

/** Profiles may expose `app_role` via Supabase; default is traveller. */
export function resolveAppRole(input: { email?: string | null; appRole?: string | null; claims?: Record<string, unknown> }): AppRole {
  const claimed =
    (typeof input.appRole === 'string' && input.appRole) ||
    (typeof input.claims?.app_role === 'string' ? String(input.claims.app_role) : '') ||
    (typeof input.claims?.role === 'string' ? String(input.claims.role) : '');
  const normalized = claimed.toLowerCase().trim();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'support') return 'support';
  // Local/dev allowlist via explicit env only — never bake secrets.
  const allowlist = (import.meta.env.VITE_ALEYA_ADMIN_EMAILS as string | undefined)
    ?.split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (input.email && allowlist?.includes(input.email.toLowerCase())) {
    return 'admin';
  }
  return 'traveller';
}

export function capabilitiesForRole(role: AppRole): AdminCapability[] {
  if (role === 'admin') return [...ADMIN_CAPABILITIES];
  if (role === 'support') return [...SUPPORT_CAPABILITIES];
  return [];
}

export function assertAdminCapability(
  role: AppRole,
  capability: AdminCapability,
): { ok: true } | { ok: false; message: string } {
  if (!capabilitiesForRole(role).includes(capability)) {
    return { ok: false, message: `Role "${role}" cannot perform "${capability}".` };
  }
  return { ok: true };
}

export type AdminAuditEntry = {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  details: string;
};

export const ADMIN_AUDIT_STORAGE_KEY = 'travel-buddy:admin-audit:v1';

export function appendAdminAudit(entry: Omit<AdminAuditEntry, 'id' | 'at'>): AdminAuditEntry {
  const full: AdminAuditEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...entry,
  };
  try {
    const raw = window.localStorage.getItem(ADMIN_AUDIT_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as AdminAuditEntry[]) : [];
    const next = [full, ...(Array.isArray(existing) ? existing : [])].slice(0, 200);
    window.localStorage.setItem(ADMIN_AUDIT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore.
  }
  return full;
}

export function loadAdminAudit(): AdminAuditEntry[] {
  try {
    const raw = window.localStorage.getItem(ADMIN_AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminAuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
