-- Travel Buddy production hardening
-- Apply only to verified project: aleya travel assistant (jtktojbvbmiewpntpvhe)
-- Organisation: tasqkbrzxjralyelioyv (Aleya)
-- Do not apply to aboss-production, ai-invoicing-app-production,
-- aleya-logo-creator, or retired travel-buddy-production (farnjmgwcayvkzuaoifk).

-- Revoke EXECUTE on SECURITY DEFINER helpers from anon (RLS still works for authenticated).
revoke execute on function public.is_trip_member(uuid) from anon, public;
revoke execute on function public.can_edit_trip(uuid) from anon, public;
revoke execute on function public.trip_role(uuid) from anon, public;

-- Harden storage path helper (search_path + revoke anon/public).
create or replace function public.storage_trip_id(object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select nullif(split_part(object_name, '/', 2), '')::uuid;
$$;

revoke execute on function public.storage_trip_id(text) from anon, public;
grant execute on function public.storage_trip_id(text) to authenticated, service_role;

-- FK / lookup indexes for advisor performance guidance
create index if not exists trip_templates_owner_id_idx on public.trip_templates (owner_id);
create index if not exists document_objects_owner_id_idx on public.document_objects (owner_id);
create index if not exists sync_revisions_trip_id_idx on public.sync_revisions (trip_id);
create index if not exists trip_collaborators_user_id_idx on public.trip_collaborators (user_id);

-- RLS initplan-friendly policies (profiles / trips insert / templates / documents insert)
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists trips_insert_owner on public.trips;
create policy trips_insert_owner on public.trips
  for insert with check ((select auth.uid()) = owner_id);

-- Foundation created templates_insert_own; replace with initplan-friendly policy.
drop policy if exists templates_insert_own on public.trip_templates;
drop policy if exists templates_insert_owner on public.trip_templates;
create policy templates_insert_own on public.trip_templates
  for insert with check ((select auth.uid()) = owner_id);

drop policy if exists documents_insert_editor on public.document_objects;
create policy documents_insert_editor on public.document_objects
  for insert with check (
    public.can_edit_trip(trip_id)
    and (select auth.uid()) = owner_id
  );
