-- Men's Social — accounts for men: their own data, saved safely in the cloud
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- PRIVACY: each man can only read and change HIS OWN rows.
-- Admins (Content Studio) get NO access to these rows. Health journals stay private.

-- ─────────────────────────────────────────────
-- 1. His saved data: progress (water, sleep, check-ins), daily activities, social (bookmarks, topics, name)
-- ─────────────────────────────────────────────
create table if not exists public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('progress', 'feed', 'social')),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 1000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.user_data enable row level security;

drop policy if exists "men read their own data" on public.user_data;
create policy "men read their own data" on public.user_data
  for select using (user_id = auth.uid());

drop policy if exists "men add their own data" on public.user_data;
create policy "men add their own data" on public.user_data
  for insert with check (user_id = auth.uid());

drop policy if exists "men change their own data" on public.user_data;
create policy "men change their own data" on public.user_data
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "men delete their own data" on public.user_data;
create policy "men delete their own data" on public.user_data
  for delete using (user_id = auth.uid());

create or replace function public.user_data_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch
  before insert or update on public.user_data
  for each row execute function public.user_data_touch();

-- ─────────────────────────────────────────────
-- 2. "Delete my account": removes his login and (through cascade) all his data
-- ─────────────────────────────────────────────
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.user_data where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
