-- Step 100: My Journey — his assessment and plan, saved in his account like his other data.
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run more than once.
--
-- What it does: lets public.user_data hold one more kind of row, 'journey', next to 'progress', 'feed'
-- and 'social'. That's all.
-- What it does NOT do: change or delete any row, or change who can see what. The existing rules still
-- apply: each man reads and changes only his own rows; staff have no access. The staff "his records"
-- view (admin_user_private, only when he shares) is NOT changed, so his assessment is never part of it.

alter table public.user_data drop constraint if exists user_data_kind_check;
alter table public.user_data
  add constraint user_data_kind_check check (kind in ('progress', 'feed', 'social', 'journey'));
