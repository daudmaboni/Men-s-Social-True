-- 0010 · The course is for members only, checked by the database (Step 59)
--
-- Before: the course screens were locked for guests, but anyone could still read the published
-- course (with every audio link) straight from the database, and the lesson files sat in public
-- folders where anyone could list and download them.
--
-- After:
--   1. Only signed-in men (and staff) can read the published course.
--   2. Lesson files live in a PRIVATE folder, "course-media". Signed-in men get links that work
--      for one day only; guests get nothing.
--   3. The lesson files already uploaded are moved by the Studio: Studio → Courses shows
--      "Make lesson files private" (copies them, updates the course, removes the public copies).
--      This file only prepares the folder and the rules; it doesn't move any files itself.
--
-- ORDER: deploy the Step 59 code first, then run this file, then press the Studio button.
-- (Run before the code, men can't play lessons from the new private folder yet.)
-- If 0006 is ever run again, run this file again after it (0006 re-opens the old audio rule).
-- Safe to run more than once. Run it in Supabase → SQL Editor (or ask Claude to apply it).

-- 1. Course: signed-in men and staff only
drop policy if exists "everyone reads live courses" on public.course_versions;
drop policy if exists "members read live courses" on public.course_versions;
create policy "members read live courses" on public.course_versions
  for select using (
    (state = 'published' and auth.uid() is not null)
    or public.admin_can('content.edit')
    or public.admin_can('analytics.view')
  );

-- 2. The private folder for lesson audio and video
insert into storage.buckets (id, name, public)
values ('course-media', 'course-media', false)
on conflict (id) do update set public = false;

update storage.buckets
   set file_size_limit = 50 * 1024 * 1024,
       allowed_mime_types = array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm',
                                  'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'course-media';

-- Signed-in men can open lesson files (that's what making a one-day link needs); guests can't
drop policy if exists "members open lesson files" on storage.objects;
create policy "members open lesson files" on storage.objects
  for select using (bucket_id = 'course-media' and auth.uid() is not null);

drop policy if exists "content editors upload lesson files" on storage.objects;
create policy "content editors upload lesson files" on storage.objects
  for insert with check (bucket_id = 'course-media' and public.admin_can('content.edit'));

drop policy if exists "content editors change lesson files" on storage.objects;
create policy "content editors change lesson files" on storage.objects
  for update using (bucket_id = 'course-media' and public.admin_can('content.edit'));

drop policy if exists "content editors delete lesson files" on storage.objects;
create policy "content editors delete lesson files" on storage.objects
  for delete using (bucket_id = 'course-media' and public.admin_can('content.edit'));

-- Old lesson files still in the public folders (courses/…) can no longer be listed by guests.
-- (They stay downloadable by exact link until the Studio button moves them.)
drop policy if exists "anyone can listen to content audio" on storage.objects;
create policy "anyone can listen to content audio" on storage.objects
  for select using (bucket_id = 'content-audio' and (name not like 'courses/%' or auth.uid() is not null));

drop policy if exists "anyone can view content videos" on storage.objects;
create policy "anyone can view content videos" on storage.objects
  for select using (bucket_id = 'content-videos' and (name not like 'courses/%' or auth.uid() is not null));

-- 3. After the Studio copies a file into the private folder, it swaps the link in every saved
--    version of the course (draft, live and history) in one go. Exact links only.
create or replace function public.course_media_moved(p_map jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  pair record;
  changed integer := 0;
  n integer;
begin
  perform public.require_perm('content.publish');
  if jsonb_typeof(p_map) <> 'object' then raise exception 'Expected {"old link": "new link"}'; end if;
  for pair in select key, value #>> '{}' as val from jsonb_each(p_map) loop
    if pair.val not like 'private:course-media/%' then raise exception 'Not a private lesson file: %', pair.val; end if;
    update public.course_versions
       set data = replace(data::text, to_jsonb(pair.key)::text, to_jsonb(pair.val)::text)::jsonb
     where data::text like '%' || to_jsonb(pair.key)::text || '%';
    get diagnostics n = row_count;
    changed := changed + n;
  end loop;
  perform public.log_admin('course.media_private', null, jsonb_build_object('files', (select count(*) from jsonb_object_keys(p_map)), 'versions', changed));
  return changed;
end;
$$;

do $$
declare
  has_service boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  revoke execute on function public.course_media_moved(jsonb) from public, anon;
  grant execute on function public.course_media_moved(jsonb) to authenticated;
  if has_service then grant execute on function public.course_media_moved(jsonb) to service_role; end if;
end;
$$;
