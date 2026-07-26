# Deployment guide

1. Ensure Supabase project `jtktojbvbmiewpntpvhe` has migrations applied.
2. Configure Vercel env: public Supabase URL/anon key only in frontend.
3. Deploy preview from completion branch; wait for READY (record rate-limit blockers if any).
4. Smoke: sign-in, create trip, mock flight/hotel save, share/revoke, admin forbidden for travellers.
5. Production promote only after gates green and launch checklist complete.
