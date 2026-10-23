-- Step 87: what pulls men back to Discover. Safe to run more than once.
-- Run it after 0018. If 0006, 0017 or 0018 is ever run again, run this file again after it
-- (they put back older versions of track_content, push_due and the feedback functions).
--
--   content_stats_daily  + hearts ("This helped"), shares, challenge starts and finishes. Counted per day,
--                        with NO link to who (like views and saves).
--   helped_counts()      "N men said this helped" for the cards: totals only, anyone can read them.
--   app_feedback         + share_ok: he ticked "you may share this as a story, without my name".
--   men_stories          real men's stories, written up by staff from feedback he agreed to share,
--                        without his name. Men see only published ones.
--   push_due()           + the daily drop: at the drop time set in Studio → Discover, men who want
--                        "new content" notifications hear that something new went live today (discreetly).
--   admin_hook_stats()   per card: hearts, shares, challenges started/finished, for Studio → Analytics.

-- ─────────────────────────────────────────────
-- 1. Counting hearts, shares and challenges (no link to who)
-- ─────────────────────────────────────────────
alter table public.content_stats_daily add column if not exists hearts int not null default 0;
alter table public.content_stats_daily add column if not exists shares int not null default 0;
alter table public.content_stats_daily add column if not exists challenge_starts int not null default 0;
alter table public.content_stats_daily add column if not exists challenge_finishes int not null default 0;

create or replace function public.track_content(p_id text, p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_id !~ '^[a-z0-9][a-z0-9-]{2,80}$' or p_event not in ('view', 'complete', 'save', 'helped_yes', 'helped_some', 'helped_no',
       'heart', 'unheart', 'share', 'challenge_start', 'challenge_finish') then return; end if;
  insert into public.content_stats_daily (content_id, day, views, completes, saves, helped_yes, helped_some, helped_no,
                                          hearts, shares, challenge_starts, challenge_finishes)
  values (p_id, current_date, (p_event = 'view')::int, (p_event = 'complete')::int, (p_event = 'save')::int,
          (p_event = 'helped_yes')::int, (p_event = 'helped_some')::int, (p_event = 'helped_no')::int,
          case p_event when 'heart' then 1 when 'unheart' then -1 else 0 end,
          (p_event = 'share')::int, (p_event = 'challenge_start')::int, (p_event = 'challenge_finish')::int)
  on conflict (content_id, day) do update set
    views = content_stats_daily.views + excluded.views,
    completes = content_stats_daily.completes + excluded.completes,
    saves = content_stats_daily.saves + excluded.saves,
    helped_yes = content_stats_daily.helped_yes + excluded.helped_yes,
    helped_some = content_stats_daily.helped_some + excluded.helped_some,
    helped_no = content_stats_daily.helped_no + excluded.helped_no,
    hearts = content_stats_daily.hearts + excluded.hearts,
    shares = content_stats_daily.shares + excluded.shares,
    challenge_starts = content_stats_daily.challenge_starts + excluded.challenge_starts,
    challenge_finishes = content_stats_daily.challenge_finishes + excluded.challenge_finishes;
end;
$$;

-- "N men said this helped": the total per card (only cards with at least one). Totals only, never who.
create or replace function public.helped_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(content_id, n), '{}'::jsonb)
    from (select content_id, sum(hearts)::int as n from public.content_stats_daily group by content_id having sum(hearts) > 0
          order by sum(hearts) desc limit 3000) x;
$$;

-- Studio → Analytics: per card over the last p_days days
create or replace function public.admin_hook_stats(p_days int default 30)
returns table (content_id text, views int, completes int, saves int, hearts int, shares int, challenge_starts int, challenge_finishes int,
               helped_yes int, helped_some int, helped_no int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.require_perm('analytics.view');
  return query
  select s.content_id, sum(s.views)::int, sum(s.completes)::int, sum(s.saves)::int, sum(s.hearts)::int, sum(s.shares)::int,
         sum(s.challenge_starts)::int, sum(s.challenge_finishes)::int, sum(s.helped_yes)::int, sum(s.helped_some)::int, sum(s.helped_no)::int
    from public.content_stats_daily s
   where s.day > current_date - least(greatest(coalesce(p_days, 30), 1), 365)
   group by s.content_id;
end;
$$;

-- ─────────────────────────────────────────────
-- 2. "You may share this as a story" on Tell us
-- ─────────────────────────────────────────────
alter table public.app_feedback add column if not exists share_ok boolean not null default false;

drop function if exists public.feedback_send(text, int, text, text, text);
create or replace function public.feedback_send(p_message text, p_rating int default null, p_place text default null, p_lang text default null,
                                                p_platform text default null, p_share_ok boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_msg text := btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if char_length(v_msg) < 2 then raise exception 'Write a few words first.' using errcode = '22023'; end if;
  if (select count(*) from public.app_feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Thank you! You have sent 5 messages today. Send more tomorrow.' using errcode = '22023';
  end if;
  insert into public.app_feedback (user_id, message, rating, place, lang, platform, share_ok)
  values (auth.uid(), left(v_msg, 1000),
          case when p_rating between 1 and 5 then p_rating end,
          nullif(left(btrim(coalesce(p_place, '')), 80), ''),
          case when p_lang in ('en', 'sw') then p_lang end,
          case when p_platform in ('web', 'pwa', 'android', 'ios') then p_platform end,
          coalesce(p_share_ok, false))
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.feedback_list(text, int);
create or replace function public.feedback_list(p_status text default 'open', p_limit int default 200)
returns table (id uuid, created_at timestamptz, message text, rating smallint, place text, lang text, platform text, status text, who text, share_ok boolean)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  perform public.require_perm('users.view');
  return query
  select f.id, f.created_at, f.message, f.rating, f.place, f.lang, f.platform, f.status,
         coalesce(nullif(u.email, ''), u.phone, 'deleted account')::text, f.share_ok
    from public.app_feedback f left join auth.users u on u.id = f.user_id
   where p_status = 'all' or (p_status = 'open' and f.status <> 'done') or f.status = p_status
      or (p_status = 'stories' and f.share_ok)
   order by f.created_at desc
   limit least(greatest(p_limit, 1), 500);
end;
$$;

-- ─────────────────────────────────────────────
-- 3. Men's stories
-- ─────────────────────────────────────────────
create table if not exists public.men_stories (
  id uuid primary key default gen_random_uuid(),
  text_en text check (text_en is null or char_length(text_en) <= 1200),
  text_sw text check (text_sw is null or char_length(text_sw) <= 1200),
  who_en text check (who_en is null or char_length(who_en) <= 80),
  who_sw text check (who_sw is null or char_length(who_sw) <= 80),
  circle text check (circle is null or circle in ('last', 'hard', 'her', 'mixes', 'train', 'reset', 'desire')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  feedback_id uuid references public.app_feedback (id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (char_length(coalesce(text_en, '')) + char_length(coalesce(text_sw, '')) >= 10)
);
create index if not exists men_stories_live on public.men_stories (status, published_at desc);
alter table public.men_stories enable row level security;
drop policy if exists "published stories" on public.men_stories;
create policy "published stories" on public.men_stories for select using (status = 'published' or public.admin_can('content.edit'));
-- No insert/update/delete policies: staff change stories through story_save / story_delete.

create or replace function public.story_save(p_id uuid, p_text_en text, p_text_sw text, p_who_en text, p_who_sw text, p_circle text,
                                             p_status text default 'draft', p_feedback_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_old text;
begin
  perform public.require_perm('content.edit');
  if p_status not in ('draft', 'published') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if p_status = 'published' then perform public.require_perm('content.publish'); end if;
  -- A story from a man's message only if he said it may be shared
  if p_feedback_id is not null and not exists (select 1 from public.app_feedback where id = p_feedback_id and share_ok) then
    raise exception 'He didn''t agree to share that message as a story.' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.men_stories (text_en, text_sw, who_en, who_sw, circle, status, feedback_id, created_by, published_at)
    values (nullif(btrim(p_text_en), ''), nullif(btrim(p_text_sw), ''), nullif(btrim(p_who_en), ''), nullif(btrim(p_who_sw), ''),
            nullif(p_circle, ''), p_status, p_feedback_id, auth.uid(), case when p_status = 'published' then now() end)
    returning id into v_id;
  else
    select status into v_old from public.men_stories where id = v_id;
    if v_old is null then raise exception 'Not found.' using errcode = '22023'; end if;
    if v_old = 'published' then perform public.require_perm('content.publish'); end if;
    update public.men_stories set text_en = nullif(btrim(p_text_en), ''), text_sw = nullif(btrim(p_text_sw), ''),
           who_en = nullif(btrim(p_who_en), ''), who_sw = nullif(btrim(p_who_sw), ''), circle = nullif(p_circle, ''),
           status = p_status, updated_at = now(),
           published_at = case when p_status = 'published' then coalesce(published_at, now()) else null end
     where id = v_id;
  end if;
  perform public.log_admin('story.' || p_status, v_id::text, '{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.story_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform public.require_perm('content.edit');
  select status into v_old from public.men_stories where id = p_id;
  if v_old is null then return; end if;
  if v_old = 'published' then perform public.require_perm('content.publish'); end if;
  delete from public.men_stories where id = p_id;
  perform public.log_admin('story.delete', p_id::text, '{}'::jsonb);
end;
$$;

-- ─────────────────────────────────────────────
-- 4. The daily drop notification
-- ─────────────────────────────────────────────
alter table public.push_log drop constraint if exists push_log_kind_check;
alter table public.push_log add constraint push_log_kind_check check (kind in ('campaign', 'reminder', 'drop'));

create or replace function public.push_due(p_now timestamptz default now())
returns table (subscription_id uuid, user_id uuid, endpoint text, p256dh text, auth text, kind text, ref text, title text, body text, link text)
language plpgsql stable security definer set search_path = public, auth, pg_catalog as $$
#variable_conflict use_column
declare
  v_drop text := (select value ->> 'dropAt' from public.app_settings where key = 'discover_config');
  v_new text;
begin
  if (select value from public.app_settings where key = 'notifications_enabled') = 'false'::jsonb then return; end if;
  -- The daily drop: only when a Studio card or reel went live in the last day
  if v_drop is null then v_drop := '20:00'; end if; -- the default in Studio → Discover
  if v_drop !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then v_drop := null; end if;
  select c.title into v_new from public.content_items c
   where c.status = 'published' and (c.action is not null or c.kind = 'reel')
     and c.published_at > p_now - interval '24 hours' and c.published_at <= p_now
   order by c.published_at desc limit 1;
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
     and not exists (select 1 from public.admins a where a.user_id = l.uid)
  union all
  -- The daily drop (Step 86): at the drop time his time (within 2 hours), once a day, if something new went live
  select l.sid, l.uid, l.ep, l.k1, l.k2, 'drop'::text, (l.here)::date::text,
         'Men''s Social'::text,
         case when l.show_text then 'New tonight: ' || v_new else 'Something new is waiting for you.' end,
         '/social?drop=1'
    from local l
   where v_drop is not null and v_new is not null
     and coalesce((l.prefs).new_content, true)
     and l.here::time >= v_drop::time and l.here::time < v_drop::time + interval '2 hours'
     and l.here::time >= '07:00' and l.here::time < '22:30'
     and not exists (select 1 from public.push_log g where g.user_id = l.uid and g.kind = 'drop' and g.ref = (l.here)::date::text)
     and not exists (select 1 from public.admins a where a.user_id = l.uid);
end;
$$;

-- ─────────────────────────────────────────────
-- 5. Who may call what
-- ─────────────────────────────────────────────
revoke execute on function public.helped_counts() from public;
grant execute on function public.helped_counts() to anon, authenticated;
revoke execute on function public.admin_hook_stats(int) from public, anon;
grant execute on function public.admin_hook_stats(int) to authenticated;
revoke execute on function public.feedback_send(text, int, text, text, text, boolean) from public, anon;
grant execute on function public.feedback_send(text, int, text, text, text, boolean) to authenticated;
revoke execute on function public.feedback_list(text, int) from public, anon;
grant execute on function public.feedback_list(text, int) to authenticated;
revoke all on public.men_stories from anon;
grant select on public.men_stories to anon;
revoke insert, update, delete on public.men_stories from anon, authenticated;
revoke execute on function public.story_save(uuid, text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.story_save(uuid, text, text, text, text, text, text, uuid) to authenticated;
revoke execute on function public.story_delete(uuid) from public, anon;
grant execute on function public.story_delete(uuid) to authenticated;
revoke execute on function public.push_due(timestamptz) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.push_due(timestamptz) to service_role;
  end if;
end $$;
