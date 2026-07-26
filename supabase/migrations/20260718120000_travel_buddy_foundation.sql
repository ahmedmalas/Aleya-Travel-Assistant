-- Travel Buddy Slices 53–57 foundation schema + RLS
-- Apply only to aleya travel assistant (jtktojbvbmiewpntpvhe)
-- Organisation: tasqkbrzxjralyelioyv (Aleya)
-- Never apply to ABoss, AI Invoicing, Aleya Logo Creator, or retired farnjmgwcayvkzuaoifk.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  notification_preferences jsonb not null default '{"departures":true,"documentExpiry":true,"unpaidExpenses":true,"bookingReminders":true,"itineraryConflicts":true,"packingDeadlines":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  favourite boolean not null default false,
  archived boolean not null default false,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_owner_id_idx on public.trips (owner_id);
create index if not exists trips_updated_at_idx on public.trips (updated_at desc);

create table if not exists public.trip_collaborators (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  name text not null default '',
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz,
  unique (trip_id, email)
);

create index if not exists trip_collaborators_trip_id_idx on public.trip_collaborators (trip_id);
create index if not exists trip_collaborators_email_idx on public.trip_collaborators (lower(email));

create table if not exists public.trip_templates (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  is_default boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_activity (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists trip_activity_trip_id_idx on public.trip_activity (trip_id, created_at desc);

create table if not exists public.sync_revisions (
  entity_type text not null,
  entity_id uuid not null,
  trip_id uuid references public.trips (id) on delete cascade,
  revision bigint not null,
  payload_digest text not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create table if not exists public.document_objects (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  doc_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  expiry_date date,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_objects_trip_id_idx on public.document_objects (trip_id);

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = target_trip_id
      and t.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.trip_collaborators c
    where c.trip_id = target_trip_id
      and c.status = 'accepted'
      and (
        c.user_id = auth.uid()
        or lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.trip_role(target_trip_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.trips t
      where t.id = target_trip_id and t.owner_id = auth.uid()
    ) then 'owner'
    else (
      select c.role
      from public.trip_collaborators c
      where c.trip_id = target_trip_id
        and c.status = 'accepted'
        and (
          c.user_id = auth.uid()
          or lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      order by case c.role when 'owner' then 1 when 'editor' then 2 else 3 end
      limit 1
    )
  end;
$$;

create or replace function public.can_edit_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.trip_role(target_trip_id) in ('owner', 'editor');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'traveller'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_collaborators enable row level security;
alter table public.trip_templates enable row level security;
alter table public.trip_activity enable row level security;
alter table public.sync_revisions enable row level security;
alter table public.document_objects enable row level security;

-- Profiles
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);

-- Trips
create policy trips_select_member on public.trips for select using (public.is_trip_member(id));
create policy trips_insert_owner on public.trips for insert with check (auth.uid() = owner_id);
create policy trips_update_editor on public.trips for update using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy trips_delete_owner on public.trips for delete using (auth.uid() = owner_id);

-- Collaborators
create policy collaborators_select_member on public.trip_collaborators for select using (public.is_trip_member(trip_id));
create policy collaborators_insert_owner on public.trip_collaborators for insert with check (public.trip_role(trip_id) = 'owner');
create policy collaborators_update_owner on public.trip_collaborators for update using (public.trip_role(trip_id) = 'owner') with check (public.trip_role(trip_id) = 'owner');
create policy collaborators_delete_owner on public.trip_collaborators for delete using (public.trip_role(trip_id) = 'owner');

-- Templates
create policy templates_select_own on public.trip_templates for select using (auth.uid() = owner_id);
create policy templates_insert_own on public.trip_templates for insert with check (auth.uid() = owner_id);
create policy templates_update_own on public.trip_templates for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy templates_delete_own on public.trip_templates for delete using (auth.uid() = owner_id);

-- Activity
create policy activity_select_member on public.trip_activity for select using (public.is_trip_member(trip_id));
create policy activity_insert_editor on public.trip_activity for insert with check (public.can_edit_trip(trip_id) or public.trip_role(trip_id) = 'viewer');

-- Sync revisions
create policy sync_revisions_select_member on public.sync_revisions for select using (
  trip_id is null or public.is_trip_member(trip_id)
);
create policy sync_revisions_upsert_editor on public.sync_revisions for insert with check (
  trip_id is null or public.can_edit_trip(trip_id)
);
create policy sync_revisions_update_editor on public.sync_revisions for update using (
  trip_id is null or public.can_edit_trip(trip_id)
) with check (
  trip_id is null or public.can_edit_trip(trip_id)
);

-- Document metadata
create policy documents_select_member on public.document_objects for select using (public.is_trip_member(trip_id));
create policy documents_insert_editor on public.document_objects for insert with check (public.can_edit_trip(trip_id) and auth.uid() = owner_id);
create policy documents_update_editor on public.document_objects for update using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy documents_delete_editor on public.document_objects for delete using (public.can_edit_trip(trip_id));
