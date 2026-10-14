-- Men's Social — Step 26
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run more than once.
--
-- 1. Fixes "Delete your account" failing with
--    update or delete on table "users" violates foreign key constraint "content_items_created_by_fkey"
--    (it happened when the account had written content in the Studio).
--    Now the content stays in the app and simply forgets who wrote it.
-- 2. Content Studio: pin an item as the Featured card on Discover, attach a real video to videos,
--    and give the summary a Kiswahili version (the app now switches fully to Kiswahili).

-- ─────────────────────────────────────────────
-- 1. Deleting an account keeps the content it wrote
-- ─────────────────────────────────────────────
alter table public.content_items drop constraint if exists content_items_created_by_fkey;
alter table public.content_items
  add constraint content_items_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.content_items drop constraint if exists content_items_updated_by_fkey;
alter table public.content_items
  add constraint content_items_updated_by_fkey
  foreign key (updated_by) references auth.users (id) on delete set null;

-- The "who changed it" trigger must not put the deleted person straight back
-- while the database is clearing their name from the content.
create or replace function public.content_items_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and ((old.created_by is not null and new.created_by is null)
          or (old.updated_by is not null and new.updated_by is null)) then
    return new; -- an account is being deleted: leave the content as it is
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 2. Studio places: Featured pin and real videos
-- ─────────────────────────────────────────────
alter table public.content_items add column if not exists featured boolean not null default false;
alter table public.content_items add column if not exists video_url text;
alter table public.content_items add column if not exists summary_sw text;

-- Videos for "Quick learning" (public to watch, only admins upload). Max 50 MB each.
insert into storage.buckets (id, name, public)
values ('content-videos', 'content-videos', true)
on conflict (id) do nothing;

drop policy if exists "anyone can view content videos" on storage.objects;
create policy "anyone can view content videos" on storage.objects
  for select using (bucket_id = 'content-videos');

drop policy if exists "admins can upload content videos" on storage.objects;
create policy "admins can upload content videos" on storage.objects
  for insert with check (bucket_id = 'content-videos' and public.is_admin());

drop policy if exists "admins can change content videos" on storage.objects;
create policy "admins can change content videos" on storage.objects
  for update using (bucket_id = 'content-videos' and public.is_admin());

drop policy if exists "admins can delete content videos" on storage.objects;
create policy "admins can delete content videos" on storage.objects
  for delete using (bucket_id = 'content-videos' and public.is_admin());
