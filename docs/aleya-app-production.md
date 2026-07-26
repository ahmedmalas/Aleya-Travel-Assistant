# Aleya app production wiring

Depends on cloud schema from PR #19 (`jtktojbvbmiewpntpvhe`).

## What this branch adds

1. **Trip brief → draft plan** — deterministic planning flow (`Trip brief` tab) that can apply a day outline to the active trip.
2. **Cloud auto-persist** — when Supabase env is configured, migrations are marked applied, and the user is signed in, vault changes debounce-save through repositories.
3. **Session recovery** — `onAuthStateChange` keeps auth shell aligned with Supabase session refresh/sign-out.
4. **Documents** — `storagePath` on document metadata; save+upload is atomic; delete/signed URL use the stored path.
5. **Demo gate** — Demo/local auth escape hatch is hidden when cloud env is configured.
6. **E2E smoke** — Playwright (`npm run test:e2e`) covers platform load, trip brief, and auth panel.

## Required Vercel env

- `VITE_SUPABASE_URL=https://jtktojbvbmiewpntpvhe.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=…`
- Optional: `VITE_SUPABASE_PROJECT_REF=jtktojbvbmiewpntpvhe`

## Still out of scope

- Live deal/partner inventory (mock adapters remain)
- Generative LLM assistant (roadmap only; brief→plan is rule-based)
- Merging PR #19 (schema apply evidence) — keep that draft until human merge
