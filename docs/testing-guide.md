# Testing guide

## Required gates

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright test
npm audit --omit=dev
# Validate migrations against linked Supabase project (CLI / MCP)
```

## Focus areas

- Provider contract tests (`src/providers`)
- Vault / collaboration / packing / budget / AI / ICS unit tests
- RLS and storage isolation (manual REST + evidence docs)
- Playwright responsive + Account A/B collaboration flows

## Evidence locations

- `docs/evidence/`
- `docs/platform-completion.md`
