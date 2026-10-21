-- 0012 · Admin → Users: the full picture of each account (Step 65)
--
-- 1. The app now tells the database which language he reads in and whether he uses the
--    Android app, the home-screen app or the browser (once a day, with the active-day count).
-- 2. "Share my records with Kayani support": a switch HE turns on in Me → Settings.
--    Until he does, his check-ins, sleep, water, notes, profile, topics and the content he
--    opened stay private, as the app promises. He can turn it off any time.
-- 3. admin_user_profile(): everything about his account and how he uses the app
--    (no health records). Anyone with users.view.
-- 4. admin_user_private(): his records, only while he shares them, only for owners,
--    with a reason, and every look is written in the audit log.
-- 5. admin_users_extra(): language, app and sharing for the Users list.
--
-- Safe to run more than once. Run it in Supabase → SQL Editor (or ask Claude to apply it).

-- ─────────────────────────────────────────────
-- 1. Language and app
-- ─────────────────────────────────────────────
create table if not exists public.user_app_info (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lang text check (lang in ('en', 'sw')),
  platform text check (platform in ('web', 'pwa', 'android', 'ios')),
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_app_info enable row level security; -- no policies: only through functions

-- New version of touch_activity with his language and app. The old one (no arguments) stays for old phones.
create or replace function public.touch_activity(p_lang text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.user_activity_days (user_id, day) values (auth.uid(), current_date) on conflict do nothing;
  insert into public.user_app_info (user_id, lang, platform)
  values (auth.uid(),
          case when p_lang in ('en', 'sw') then p_lang end,
          case when p_platform in ('web', 'pwa', 'android', 'ios') then p_platform end)
  on conflict (user_id) do update
    set lang = coalesce(excluded.lang, user_app_info.lang),
        platform = coalesce(excluded.platform, user_app_info.platform),
        updated_at = now();
end;
$$;
revoke execute on function public.touch_activity(text, text) from public, anon;
grant execute on function public.touch_activity(text, text) to authenticated;

-- ─────────────────────────────────────────────
-- 2. He chooses to share his records with support
-- ─────────────────────────────────────────────
create table if not exists public.support_shares (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  shared_at timestamptz not null default now()
);
alter table public.support_shares enable row level security;
drop policy if exists "men see their own share" on public.support_shares;
create policy "men see their own share" on public.support_shares for select using (user_id = auth.uid());
drop policy if exists "men turn sharing on" on public.support_shares;
create policy "men turn sharing on" on public.support_shares for insert with check (user_id = auth.uid());
drop policy if exists "men turn sharing off" on public.support_shares;
create policy "men turn sharing off" on public.support_shares for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 3. Everything about the account (no health records)
-- ─────────────────────────────────────────────
create or replace function public.admin_user_profile(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  u auth.users;
  v_social jsonb;
  v_feed jsonb;
  v_mod boolean := public.admin_can('community.moderate');
  v_full boolean := public.admin_role() in ('owner', 'moderator');
  r jsonb;
begin
  perform public.require_perm('users.view');
  select * into u from auth.users where id = p_user;
  if not found then raise exception 'User not found.' using errcode = '22023'; end if;
  select data into v_social from public.user_data where user_id = p_user and kind = 'social';
  select data into v_feed from public.user_data where user_id = p_user and kind = 'feed';

  select jsonb_build_object(
    'account', jsonb_build_object(
      'id', u.id,
      'email', public.mask_email(u.email),
      'phone', case when u.phone is null or u.phone = '' then null
                    when v_full then u.phone
                    else left(u.phone, 4) || '•••' || right(u.phone, 2) end,
      'providers', coalesce(u.raw_app_meta_data -> 'providers', to_jsonb(array[u.raw_app_meta_data ->> 'provider'])),
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'confirmed_at', u.email_confirmed_at,
      'restricted_until', case when u.banned_until > now() then u.banned_until end,
      'admin_role', (select role from public.admins where user_id = p_user)
    ),
    'app', (select jsonb_build_object('lang', i.lang, 'platform', i.platform, 'first_seen', i.first_seen, 'updated_at', i.updated_at)
              from public.user_app_info i where i.user_id = p_user),
    'activity', jsonb_build_object(
      'days_total', (select count(*) from public.user_activity_days where user_id = p_user),
      'days_30', (select count(*) from public.user_activity_days where user_id = p_user and day > current_date - 30),
      'days_7', (select count(*) from public.user_activity_days where user_id = p_user and day > current_date - 7),
      'last_day', (select max(day) from public.user_activity_days where user_id = p_user),
      'days', (select coalesce(jsonb_agg(day order by day), '[]') from public.user_activity_days
                where user_id = p_user and day > current_date - 120)
    ),
    'synced', (select coalesce(jsonb_object_agg(kind, jsonb_build_object('updated_at', updated_at, 'bytes', pg_column_size(data))), '{}')
                 from public.user_data where user_id = p_user),
    'nickname', nullif(v_social ->> 'nickname', ''),
    'discreet', coalesce((v_feed -> 'settings' ->> 'discreet')::boolean, false),
    'usage', jsonb_build_object(
      'opened', (select count(*) from jsonb_object_keys(coalesce(v_social -> 'history', '{}'))),
      'saved', (select count(*) from jsonb_object_keys(coalesce(v_social -> 'bookmarks', '{}'))),
      'topics', jsonb_array_length(coalesce(v_social -> 'interests', '[]')),
      'lessons', (select count(*) from jsonb_object_keys(coalesce(v_feed -> 'lessons', '{}'))),
      'activity_days', (select count(*) from jsonb_object_keys(coalesce(v_feed -> 'days', '{}'))),
      'activities_done', (select count(*) from jsonb_each(coalesce(v_feed -> 'days', '{}')) d, jsonb_each(d.value) a
                           where a.value ->> 'status' = 'done'),
      'activities_skipped', (select count(*) from jsonb_each(coalesce(v_feed -> 'days', '{}')) d, jsonb_each(d.value) a
                              where a.value ->> 'status' = 'skipped')
    ),
    -- The course (Wazimu etc.): where he is in each lesson he started
    'course', coalesce(v_feed -> 'course', '{}'),
    'community', jsonb_build_object(
      'posts', (select count(*) from public.community_posts where author = p_user),
      'replies', (select count(*) from public.community_replies where author = p_user),
      'reactions', (select count(*) from public.community_reactions where user_id = p_user),
      'reports_made', (select count(*) from public.community_reports where reporter = p_user),
      'reported', (select count(*) from public.community_reports r
                    where r.target_id in (select id from public.community_posts where author = p_user
                                          union all select id from public.community_replies where author = p_user)),
      'hidden', (select count(*) from public.community_posts where author = p_user and status <> 'visible')
              + (select count(*) from public.community_replies where author = p_user and status <> 'visible'),
      -- Moderators (and owners) see what he wrote, like on the Community page
      'items', case when v_mod then (
        select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
          select 'post' as type, p.id, p.title, p.body, p.topic, p.status, p.anonymous, p.created_at,
                 (select count(*) from public.community_replies where post_id = p.id) as reply_count
            from public.community_posts p where p.author = p_user
          union all
          select 'reply', r.id, (select title from public.community_posts where id = r.post_id), r.body, null, r.status, r.anonymous, r.created_at, 0
            from public.community_replies r where r.author = p_user
          order by 8 desc limit 50) x) end
    ),
    'warnings', (select coalesce(jsonb_agg(jsonb_build_object('message', message, 'created_at', created_at) order by created_at desc), '[]')
                   from public.user_warnings where user_id = p_user),
    'notifications', jsonb_build_object(
      'prefs', (select jsonb_build_object('announcements', announcements, 'new_content', new_content, 'tips', tips, 'community', community)
                  from public.notification_prefs where user_id = p_user),
      'received', (select count(*) from public.notification_receipts where user_id = p_user),
      'opened', (select count(*) from public.notification_receipts where user_id = p_user and opened_at is not null),
      'recent', (select coalesce(jsonb_agg(x order by x.delivered_at desc), '[]') from (
                   select c.title, c.kind, r.delivered_at, r.opened_at
                     from public.notification_receipts r join public.notification_campaigns c on c.id = r.campaign_id
                    where r.user_id = p_user order by r.delivered_at desc limit 10) x)
    ),
    'audit', case when public.admin_can('audit.view') then (
      select coalesce(jsonb_agg(x order by x.at desc), '[]') from (
        select a.action, a.actor_role, a.details, a.at from public.admin_audit a
         where a.target = p_user::text order by a.at desc limit 20) x) end,
    'share', (select jsonb_build_object('shared_at', shared_at) from public.support_shares where user_id = p_user),
    'can_open_private', public.admin_can('users.private')
  ) into r;
  return r;
end;
$$;

-- ─────────────────────────────────────────────
-- 4. His records: only while he shares them, owners only, logged
-- ─────────────────────────────────────────────
create or replace function public.admin_user_private(p_user uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_social jsonb; v_feed jsonb; v_progress jsonb;
begin
  perform public.require_perm('users.private');
  if not exists (select 1 from public.support_shares where user_id = p_user) then
    raise exception 'He hasn''t chosen to share his records with support.' using errcode = '42501';
  end if;
  if char_length(coalesce(btrim(p_reason), '')) < 5 then
    raise exception 'Say why you need to see them (at least 5 letters).' using errcode = '22023';
  end if;
  select data into v_social from public.user_data where user_id = p_user and kind = 'social';
  select data into v_feed from public.user_data where user_id = p_user and kind = 'feed';
  select data into v_progress from public.user_data where user_id = p_user and kind = 'progress';
  perform public.log_admin('user.private_view', p_user::text, jsonb_build_object('reason', left(btrim(p_reason), 300)));
  return jsonb_build_object(
    'profile', coalesce(v_social -> 'profile', '{}'),
    'interests', coalesce(v_social -> 'interests', '[]'),
    'history', coalesce(v_social -> 'history', '{}'),
    'bookmarks', coalesce(v_social -> 'bookmarks', '{}'),
    'records', coalesce(v_progress -> 'records', '[]'),
    'goals', coalesce(v_progress -> 'goals', '[]'),
    'days', coalesce(v_feed -> 'days', '{}'),
    'lessons', coalesce(v_feed -> 'lessons', '{}')
  );
end;
$$;

-- ─────────────────────────────────────────────
-- 5. Language, app and sharing for the Users list
-- ─────────────────────────────────────────────
create or replace function public.admin_users_extra(p_ids uuid[])
returns table (id uuid, lang text, platform text, shared boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.require_perm('users.view');
  return query
  select x.id, i.lang, i.platform, exists (select 1 from public.support_shares s where s.user_id = x.id)
    from unnest(p_ids[1:100]) x(id) left join public.user_app_info i on i.user_id = x.id;
end;
$$;

do $$
declare f record; has_service boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_user_profile', 'admin_user_private', 'admin_users_extra')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    if has_service then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;
