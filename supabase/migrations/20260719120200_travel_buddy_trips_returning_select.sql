-- Fix trips INSERT ... RETURNING under RLS for PostgREST Prefer: return=representation.
-- public.is_trip_member() re-queries public.trips and cannot see the in-flight inserted row,
-- so authenticated inserts that return the row were rejected even when owner_id = auth.uid().
-- Project: aleya travel assistant (jtktojbvbmiewpntpvhe)

drop policy if exists trips_select_member on public.trips;
create policy trips_select_member on public.trips
  for select using (
    (select auth.uid()) = owner_id
    or public.is_trip_member(id)
  );
