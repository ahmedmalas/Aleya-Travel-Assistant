# RLS and storage security guide

1. Apply migrations in order under `supabase/migrations/`.
2. Confirm RLS enabled on trips, profiles, collaboration, documents.
3. Confirm storage bucket is private.
4. Verify Account A cannot read Account B trip rows or storage objects (REST + signed URL negative tests).
5. Verify collaborator accept grants scoped access; revoke removes access immediately.
6. Never log full passport numbers, document binaries, or supplier secrets.
7. Document metadata stores last-4 + expiry only.
