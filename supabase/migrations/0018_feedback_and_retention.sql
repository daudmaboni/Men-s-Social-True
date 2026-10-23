-- Step 85: "Tell us" feedback from men, and retention numbers for the Studio. Safe to run more than once.
--
--   app_feedback        what men send from Me → Tell us (one line, optional 1–5 rating, where they were).
--                       Men can only send (at most 5 a day); staff who can see users read it and mark it done.
--   admin_retention()   counts only: how many men who signed up each week came back the next day and in
--                       their second week, and what they did first. Never who.

-- ─────────────────────────────────────────────
-- 1. Feedback
-- ─────────────────────────────────────────────
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  message text not null check (char_length(message) between 2 and 1000),
  rating smallint check (rating between 1 and 5),
  place text check (place is null or char_length(place) <= 80),
  lang text check (lang is null or lang in ('en', 'sw')),
  platform text check (platform is null or platform in ('web', 'pwa', 'android', 'ios')),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now(),
  handled_by uuid,
  handled_at timestamptz
);
create index if not exists app_feedback_new on public.app_feedback (status, created_at desc);
alter table public.app_feedback enable row level security;
drop policy if exists "staff read feedback" on public.app_feedback;
create policy "staff read feedback" on public.app_feedback for select using (public.admin_can('users.view'));
-- No insert/update policies: men send through feedback_send, staff change status through feedback_mark.

create or replace function public.feedback_send(p_message text, p_rating int default null, p_place text default null, p_lang text default null, p_platform text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_msg text := btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if char_length(v_msg) < 2 then raise exception 'Write a few words first.' using errcode = '22023'; end if;
  if (select count(*) from public.app_feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Thank you! You have sent 5 messages today. Send more tomorrow.' using errcode = '22023';
  end if;
  insert into public.app_feedback (user_id, message, rating, place, lang, platform)
  values (auth.uid(), left(v_msg, 1000),
          case when p_rating between 1 and 5 then p_rating end,
          nullif(left(btrim(coalesce(p_place, '')), 80), ''),
          case when p_lang in ('en', 'sw') then p_lang end,
          case when p_platform in ('web', 'pwa', 'android', 'ios') then p_platform end)
  returning id into v_id;
  return v_id;
end;
$$;

-- The Studio list: newest first, with who sent it (staff who can see users can see this anyway)
create or replace function public.feedback_list(p_status text default 'open', p_limit int default 200)
returns table (id uuid, created_at timestamptz, message text, rating smallint, place text, lang text, platform text, status text, who text)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  perform public.require_perm('users.view');
  return query
  select f.id, f.created_at, f.message, f.rating, f.place, f.lang, f.platform, f.status,
         coalesce(nullif(u.email, ''), u.phone, 'deleted account')::text
    from public.app_feedback f left join auth.users u on u.id = f.user_id
   where p_status = 'all' or (p_status = 'open' and f.status <> 'done') or f.status = p_status
   order by f.created_at desc
   limit least(greatest(p_limit, 1), 500);
end;
$$;

create or replace function public.feedback_mark(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('users.view');
  if p_status not in ('new', 'read', 'done') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  update public.app_feedback set status = p_status, handled_by = auth.uid(), handled_at = now() where id = p_id;
  if not found then raise exception 'Not found.' using errcode = '22023'; end if;
  perform public.log_admin('feedback.' || p_status, p_id::text, '{}'::jsonb);
end;
$$;

-- ─────────────────────────────────────────────
-- 2. Retention (counts only)
-- ─────────────────────────────────────────────
/** A time from his saved data, or null if it isn't one. */
create or replace function public.try_ts(p text)
returns timestamptz language plpgsql immutable as $$
begin
  return p::timestamptz;
exception when others then
  return null;
end;
$$;

-- For men who signed up in the last p_weeks weeks (staff left out):
--   cohorts:  per sign-up week (Monday), how many signed up, how many came back the day after sign-up,
--             and how many came back in their second week (days 7–13). A rate is only given once the
--             day/week is over for everyone in that group ("eligible").
--   first:    what each man did first in his first 7 days, counted: an activity on Man, a Discover card
--             ("I did it"), a lesson, a water/sleep log, a check-in, or nothing yet.
create or replace function public.admin_retention(p_weeks int default 8)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare r jsonb; v_weeks int := least(greatest(coalesce(p_weeks, 8), 1), 26);
begin
  perform public.require_perm('analytics.view');
  with men as (
    select u.id, u.created_at, (u.created_at at time zone 'Africa/Dar_es_Salaam')::date as d0
      from auth.users u
     where u.created_at > now() - make_interval(weeks => v_weeks)
       and not exists (select 1 from public.admins a where a.user_id = u.id)
  ), back as (
    select m.id, m.d0,
           exists (select 1 from public.user_activity_days a where a.user_id = m.id and a.day = m.d0 + 1) as day1,
           exists (select 1 from public.user_activity_days a where a.user_id = m.id and a.day between m.d0 + 7 and m.d0 + 13) as week2
      from men m
  ), cohorts as (
    select date_trunc('week', d0)::date as week,
           count(*) as signed_up,
           count(*) filter (where d0 + 1 < current_date) as day1_eligible,
           count(*) filter (where d0 + 1 < current_date and day1) as day1,
           count(*) filter (where d0 + 13 < current_date) as week2_eligible,
           count(*) filter (where d0 + 13 < current_date and week2) as week2
      from back group by 1
  ), events as (
    -- activity done on Man
    select f.user_id, 'activity'::text as what, public.try_ts(c.value ->> 'at') as at
      from public.user_data f, jsonb_each(coalesce(f.data -> 'days', '{}'::jsonb)) d, jsonb_each(case when jsonb_typeof(d.value) = 'object' then d.value else '{}'::jsonb end) c
     where f.kind = 'feed' and c.value ->> 'status' = 'done'
    union all
    -- Discover card "I did it" (Step 79)
    select f.user_id, 'card', public.try_ts(t.value ->> 'at')
      from public.user_data f, jsonb_each(coalesce(f.data -> 'tried', '{}'::jsonb)) t where f.kind = 'feed'
    union all
    -- lessons (feed lessons and course lessons finished)
    select f.user_id, 'lesson', public.try_ts(l.value ->> 'at')
      from public.user_data f, jsonb_each(coalesce(f.data -> 'lessons', '{}'::jsonb)) l where f.kind = 'feed'
    union all
    select f.user_id, 'lesson', public.try_ts(c.value -> 'done' ->> 'at')
      from public.user_data f, jsonb_each(coalesce(f.data -> 'course', '{}'::jsonb)) c where f.kind = 'feed' and c.value ? 'done'
    union all
    -- trackers: water/sleep logs and check-ins
    select p.user_id, case when e ->> 'metric' in ('energy', 'mood') then 'checkin' else 'tracker' end, public.try_ts(e ->> 'createdAt')
      from public.user_data p, jsonb_array_elements(coalesce(p.data -> 'records', '[]'::jsonb)) e where p.kind = 'progress'
  ), firsts as (
    select distinct on (m.id) m.id, e.what
      from men m left join events e on e.user_id = m.id and e.at is not null and e.at >= m.created_at - interval '1 hour' and e.at < m.created_at + interval '7 days'
     order by m.id, e.at nulls last
  )
  select jsonb_build_object(
    'weeks', v_weeks,
    'cohorts', coalesce((select jsonb_agg(to_jsonb(c) order by c.week desc) from cohorts c), '[]'::jsonb),
    'first', coalesce((select jsonb_object_agg(coalesce(what, 'nothing'), n) from (select what, count(*) n from firsts group by what) x), '{}'::jsonb),
    'signed_up', (select count(*) from men)
  ) into r;
  return r;
end;
$$;

-- ─────────────────────────────────────────────
-- 3. Who may call what
-- ─────────────────────────────────────────────
revoke all on public.app_feedback from anon;
revoke insert, update, delete on public.app_feedback from authenticated;
revoke execute on function public.feedback_send(text, int, text, text, text) from public, anon;
grant execute on function public.feedback_send(text, int, text, text, text) to authenticated;
revoke execute on function public.feedback_list(text, int) from public, anon;
grant execute on function public.feedback_list(text, int) to authenticated;
revoke execute on function public.feedback_mark(uuid, text) from public, anon;
grant execute on function public.feedback_mark(uuid, text) to authenticated;
revoke execute on function public.admin_retention(int) from public, anon;
grant execute on function public.admin_retention(int) to authenticated;
