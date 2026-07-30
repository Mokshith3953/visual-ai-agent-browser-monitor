-- Storage bucket + policies for raw screenshots.
-- The bucket is PRIVATE; images are served to the dashboard via short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do nothing;

-- Object keys are namespaced by user id: `<user_id>/<capture_id>.jpg`.
-- Access is mediated by the backend (service role), which signs URLs per request,
-- so we keep direct client policies locked down to the owner's own folder only.

create policy "own_folder_read" on storage.objects
  for select using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = nullif(current_setting('app.user_id', true), '')
  );

create policy "own_folder_write" on storage.objects
  for insert with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = nullif(current_setting('app.user_id', true), '')
  );

create policy "own_folder_delete" on storage.objects
  for delete using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = nullif(current_setting('app.user_id', true), '')
  );
