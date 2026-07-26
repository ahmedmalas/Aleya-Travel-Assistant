# Environment variable guide

## Public (Vite)

Only publishable values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optional: `VITE_ALEYA_ADMIN_EMAILS` (comma-separated allowlist for admin UI role resolution)
- Optional public supplier **enable flags** (never secrets) as documented in provider config

## Private (server / edge only)

Never prefix with `VITE_`:

- Amadeus / Duffel / Viator / hotel / car / cruise / transfer API keys
- AI provider keys
- Notification vendor keys
- Calendar OAuth client secrets
- Service-role Supabase key (admin/server only)

See `src/providers/config/secrets.ts` for the documented private key names.
