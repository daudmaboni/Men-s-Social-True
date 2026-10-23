-- Step 79: phone notifications (web push), daily reminder, and "Did it help?" counts.
-- Safe to run more than once. If 0006 is ever run again, run this file again after it
-- (0006 puts back the old track_content).
--
-- What's stored:
--   push_subscriptions  one row per phone that allowed notifications (the address the push service gave it;
--                       no message content, no health data)
--   notification_prefs  + daily reminder on/off, the time he chose, his time zone,
--                       and whether the message text may show on his lock screen (off by default)
--   push_log            what was pushed to whom and when, so nothing is sent twice
--   content_stats_daily + helped_yes / helped_some / helped_no, counted per day with NO link to who
--
-- Only the sender (the server, with the service role key) can read the subscriptions of other men
-- or call push_due / push_mark. Men only ever see and change their own.

-- ─────────────────────────────────────────────
-- 1. Phones that allowed notifications
-- ─────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) < 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  failures int not null default 0
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own phones" on public.push_subscriptions;
create policy "own phones" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "remove own phone" on public.push_subscriptions;
create policy "remove own phone" on public.push_subscriptions for delete using (user_id = auth.uid());

-- A phone can move between accounts (he signs out, a brother signs in): the newest sign-up owns it.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, failures = 0;
end;
$$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- ─────────────────────────────────────────────
-- 2. His reminder choices (added to his notification choices from 0006)
-- ─────────────────────────────────────────────
alter table public.notification_prefs add column if not exists daily_reminder boolean not null default true;
alter table public.notification_prefs add column if not exists remind_at time not null default '19:00';
alter table public.notification_prefs add column if not exists tz text not null default 'Africa/Dar_es_Salaam';
alter table public.notification_prefs add column if not exists lock_text boolean not null default false;
do $$ begin
  alter table public.notification_prefs add constraint notification_prefs_tz_ok check (char_length(tz) between 3 and 60 and tz ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- 3. What was pushed (nothing twice)
-- ─────────────────────────────────────────────
create table if not exists public.push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('campaign', 'reminder')),
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.push_log enable row level security;
-- No policies: men and staff can't read it through the app; only the sender (service role) uses it.

/** A zone name Postgres knows, or Dar es Salaam. */
create or replace function public.push_zone(p_tz text)
returns text language sql stable set search_path = public, pg_catalog as $$
  select case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'Africa/Dar_es_Salaam' end;
$$;

-- Everything due to be pushed right now, one row per phone.
--  campaigns: live Studio messages (not warnings) from the last day, for men they're meant for, matching
--             his choices; held back during quiet hours (22:00–07:00 his time) and sent after.
--  reminder:  once a day at the time he chose (within 2 hours after it), only if he hasn't opened the app today.
--             On Sundays it says his week is ready.
-- The text is discreet unless he allowed it on his lock screen.
create or replace function public.push_due(p_now timestamptz default now())
returns table (subscription_id uuid, user_id uuid, endpoint text, p256dh text, auth text, kind text, ref text, title text, body text, link text)
language plpgsql stable security definer set search_path = public, auth, pg_catalog as $$
#variable_conflict use_column
begin
  if (select value from public.app_settings where key = 'notifications_enabled') = 'false'::jsonb then return; end if;
  return query
  with men as (
    select s.id as sid, s.user_id as uid, s.endpoint as ep, s.p256dh as k1, s.auth as k2,
           coalesce(p.daily_reminder, true) as remind, coalesce(p.remind_at, '19:00'::time) as at,
           public.push_zone(coalesce(p.tz, 'Africa/Dar_es_Salaam')) as zone, coalesce(p.lock_text, false) as show_text,
           p as prefs
      from public.push_subscriptions s
      left join public.notification_prefs p on p.user_id = s.user_id
     where s.failures < 5
  ), local as (
    select m.*, (p_now at time zone m.zone) as here from men m
  )
  -- Studio messages
  select l.sid, l.uid, l.ep, l.k1, l.k2, 'campaign'::text, c.id::text,
         'Men''s Social'::text,
         case when l.show_text then c.title else 'You have a new message.' end,
         coalesce(c.link, '/social')
    from local l
    join public.notification_campaigns c on c.status = 'scheduled' and c.kind <> 'warning'
         and c.send_at <= p_now and c.send_at > p_now - interval '1 day'
   where public.notification_targets(c, l.uid)
     and extract(hour from l.here) between 7 and 21
     and ((c.kind in ('announcement', 'reengagement') and coalesce((l.prefs).announcements, true))
          or (c.kind = 'new_content' and coalesce((l.prefs).new_content, true))
          or (c.kind = 'tip' and coalesce((l.prefs).tips, true))
          or (c.kind = 'community' and coalesce((l.prefs).community, true)))
     and not exists (select 1 from public.push_log g where g.user_id = l.uid and g.kind = 'campaign' and g.ref = c.id::text)
  union all
  -- The daily reminder
  select l.sid, l.uid, l.ep, l.k1, l.k2, 'reminder'::text, (l.here)::date::text,
         'Men''s Social'::text,
         case when extract(isodow from l.here) = 7 then 'Your week in review is ready.'
              else 'Your day is ready: a quick check-in and one thing to try.' end,
         case when extract(isodow from l.here) = 7 then '/man?week=1' else '/man' end
    from local l
   where l.remind
     and l.here::time >= l.at and l.here::time < l.at + interval '2 hours'
     and l.here::time >= '07:00' and l.here::time < '22:00'
     and not exists (select 1 from public.push_log g where g.user_id = l.uid and g.kind = 'reminder' and g.ref = (l.here)::date::text)
     and not exists (select 1 from public.user_activity_days d where d.user_id = l.uid and d.day = (l.here)::date)
     and not exists (select 1 from public.admins a where a.user_id = l.uid);
end;
$$;

-- After sending: note what went (once per man, even with two phones), and drop phones the push service
-- says are gone (after 5 failures in a row, or straight away when the service says "gone").
create or replace function public.push_mark(p_sent jsonb, p_failed jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_log (user_id, kind, ref)
  select (x ->> 'user_id')::uuid, x ->> 'kind', x ->> 'ref' from jsonb_array_elements(coalesce(p_sent, '[]'::jsonb)) x
  on conflict do nothing;
  update public.push_subscriptions s set last_ok_at = now(), failures = 0
   where s.id in (select (x ->> 'subscription_id')::uuid from jsonb_array_elements(coalesce(p_sent, '[]'::jsonb)) x);
  delete from public.push_subscriptions s
   where s.id in (select (x ->> 'subscription_id')::uuid from jsonb_array_elements(coalesce(p_failed, '[]'::jsonb)) x where (x ->> 'gone')::boolean);
  update public.push_subscriptions s set failures = failures + 1
   where s.id in (select (x ->> 'subscription_id')::uuid from jsonb_array_elements(coalesce(p_failed, '[]'::jsonb)) x where not coalesce((x ->> 'gone')::boolean, false));
  delete from public.push_log where sent_at < now() - interval '45 days';
end;
$$;

-- ─────────────────────────────────────────────
-- 4. "Did it help?" counts (no link to who)
-- ─────────────────────────────────────────────
alter table public.content_stats_daily add column if not exists helped_yes int not null default 0;
alter table public.content_stats_daily add column if not exists helped_some int not null default 0;
alter table public.content_stats_daily add column if not exists helped_no int not null default 0;

create or replace function public.track_content(p_id text, p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_id !~ '^[a-z0-9][a-z0-9-]{2,80}$' or p_event not in ('view', 'complete', 'save', 'helped_yes', 'helped_some', 'helped_no') then return; end if;
  insert into public.content_stats_daily (content_id, day, views, completes, saves, helped_yes, helped_some, helped_no)
  values (p_id, current_date, (p_event = 'view')::int, (p_event = 'complete')::int, (p_event = 'save')::int,
          (p_event = 'helped_yes')::int, (p_event = 'helped_some')::int, (p_event = 'helped_no')::int)
  on conflict (content_id, day) do update set
    views = content_stats_daily.views + excluded.views,
    completes = content_stats_daily.completes + excluded.completes,
    saves = content_stats_daily.saves + excluded.saves,
    helped_yes = content_stats_daily.helped_yes + excluded.helped_yes,
    helped_some = content_stats_daily.helped_some + excluded.helped_some,
    helped_no = content_stats_daily.helped_no + excluded.helped_no;
end;
$$;

-- ─────────────────────────────────────────────
-- 5. Who may call what
-- ─────────────────────────────────────────────
revoke all on public.push_subscriptions from anon;
revoke all on public.push_log from anon, authenticated;
revoke insert, update on public.push_subscriptions from authenticated;
revoke execute on function public.push_subscribe(text, text, text) from public, anon;
revoke execute on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_subscribe(text, text, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
revoke execute on function public.push_due(timestamptz) from public, anon, authenticated;
revoke execute on function public.push_mark(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.push_zone(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.push_due(timestamptz) to service_role;
    grant execute on function public.push_mark(jsonb, jsonb) to service_role;
    grant execute on function public.push_zone(text) to service_role;
    grant select, delete on public.push_subscriptions to service_role;
    grant select, insert, delete on public.push_log to service_role;
  end if;
end $$;
