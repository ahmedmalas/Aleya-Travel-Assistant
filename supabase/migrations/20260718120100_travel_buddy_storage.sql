-- Travel Buddy Slice 58 — private document storage bucket + policies
-- Apply only to aleya travel assistant (jtktojbvbmiewpntpvhe)
-- Organisation: tasqkbrzxjralyelioyv (Aleya)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'travel-documents',
  'travel-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {user_id}/{trip_id}/{document_id}/{filename}

create or replace function public.storage_trip_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 2), '')::uuid;
$$;

create policy travel_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'travel-documents'
    and public.is_trip_member(public.storage_trip_id(name))
  );

create policy travel_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'travel-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_edit_trip(public.storage_trip_id(name))
  );

create policy travel_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'travel-documents'
    and public.can_edit_trip(public.storage_trip_id(name))
  )
  with check (
    bucket_id = 'travel-documents'
    and public.can_edit_trip(public.storage_trip_id(name))
  );

create policy travel_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'travel-documents'
    and public.can_edit_trip(public.storage_trip_id(name))
  );
