-- Men's Social — Admin Control Center (Step 27)
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run more than once.
-- Needs 0001–0005 first.
--
-- Everything an admin can do is checked HERE, in the database (not just hidden in the screens):
--   roles → permissions → row-level security and admin-only functions → audit log.
-- Privacy: admins never get men's check-ins, sleep/water records, notes or private profile details.
-- Analytics are counted as totals; anything about fewer than 5 men is not shown.

-- ═════════════════════════════════════════════
-- 1. Admin roles and permissions
-- ═════════════════════════════════════════════
--   owner     everything, incl. admins, settings, deleting accounts
--   editor    content (incl. publish), homepage, notifications, AI, analytics, audit
--   writer    content drafts + submit for review, homepage drafts, AI; cannot publish
--   moderator community, user restrictions & warnings, notifications, analytics, audit
--   analyst   analytics and user list (read only)
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins
  add constraint admins_role_check check (role in ('owner', 'editor', 'writer', 'moderator', 'analyst'));
alter table public.admins add column if not exists display_name text check (char_length(display_name) <= 40);
alter table public.admins add column if not exists added_by uuid;

create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admins where user_id = auth.uid();
$$;

create or replace function public.admin_can(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case a.role
      when 'owner' then true
      when 'editor' then perm in ('content.edit', 'content.publish', 'homepage.edit', 'homepage.publish',
                                  'notifications.send', 'ai.use', 'analytics.view', 'audit.view', 'users.view')
      when 'writer' then perm in ('content.edit', 'homepage.edit', 'ai.use', 'analytics.view')
      when 'moderator' then perm in ('community.moderate', 'users.view', 'users.restrict',
                                     'notifications.send', 'analytics.view', 'audit.view')
      when 'analyst' then perm in ('analytics.view', 'users.view')
      else false end
    from public.admins a where a.user_id = auth.uid()), false);
$$;

create or replace function public.require_perm(perm text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_can(perm) then
    raise exception 'Not allowed: your admin role can''t do this (%).', perm using errcode = '42501';
  end if;
end;
$$;

-- Admins can see the admin list (owners see emails through admin_list())
drop policy if exists "admins can see admins" on public.admins;
create policy "admins can see admins" on public.admins for select using (public.is_admin());

-- ═════════════════════════════════════════════
-- 2. Audit log (every important admin action)
-- ═════════════════════════════════════════════
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor uuid,
  actor_role text,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;
drop policy if exists "audit readers" on public.admin_audit;
create policy "audit readers" on public.admin_audit for select using (public.admin_can('audit.view'));

create or replace function public.log_admin(p_action text, p_target text default null, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin' using errcode = '42501'; end if;
  insert into public.admin_audit (actor, actor_role, action, target, details)
  values (auth.uid(), public.admin_role(), left(p_action, 60), left(p_target, 200), coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ═════════════════════════════════════════════
-- 3. Content workflow: review, scheduling, audio/infographic, versions
-- ═════════════════════════════════════════════
alter table public.content_items drop constraint if exists content_items_status_check;
alter table public.content_items
  add constraint content_items_status_check check (status in ('draft', 'review', 'published', 'archived'));
alter table public.content_items drop constraint if exists content_items_kind_check;
alter table public.content_items
  add constraint content_items_kind_check check (kind in ('guide', 'article', 'video', 'quiz', 'tool', 'expert', 'audio', 'infographic'));
alter table public.content_items add column if not exists publish_at timestamptz;      -- later = scheduled
alter table public.content_items add column if not exists review_note text;
alter table public.content_items add column if not exists ai_generated boolean not null default false;
alter table public.content_items add column if not exists audio_url text;

-- Men see published items whose time has come; admins see everything
drop policy if exists "anyone can read published content" on public.content_items;
create policy "anyone can read published content" on public.content_items
  for select using ((status = 'published' and (publish_at is null or publish_at <= now())) or public.is_admin());

drop policy if exists "admins can insert content" on public.content_items;
create policy "admins can insert content" on public.content_items
  for insert with check (public.admin_can('content.edit'));
drop policy if exists "admins can update content" on public.content_items;
create policy "admins can update content" on public.content_items
  for update using (public.admin_can('content.edit')) with check (public.admin_can('content.edit'));
drop policy if exists "admins can delete content" on public.content_items;
create policy "admins can delete content" on public.content_items
  for delete using (public.admin_can('content.edit') and (status <> 'published' or public.admin_can('content.publish')));

create or replace function public.content_items_touch()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and ((old.created_by is not null and new.created_by is null)
          or (old.updated_by is not null and new.updated_by is null)) then
    return new; -- an account is being deleted: leave the content as it is
  end if;
  -- Only editors and owners can make something live or change live content (writers submit for review).
  -- (Changes made directly in the Supabase SQL editor have no signed-in admin and are allowed.)
  if auth.uid() is not null and not public.admin_can('content.publish')
     and (new.status = 'published' or (tg_op = 'UPDATE' and old.status = 'published')) then
    raise exception 'Only editors and owners can publish or change live content. Submit it for review instead.' using errcode = '42501';
  end if;
  -- AI drafts never go live unchecked
  if new.status = 'published' and new.ai_generated and new.review <> 'reviewed' then
    raise exception 'AI-assisted content must be checked by a qualified health professional (tick "Checked") before publishing.' using errcode = '23514';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.publish_at, now());
  end if;
  return new;
end;
$$;

-- Version history: the previous version is kept on every change (last 30 per item)
create table if not exists public.content_versions (
  id bigint generated always as identity primary key,
  content_id text not null,
  snapshot jsonb not null,
  status text,
  saved_by uuid,
  saved_at timestamptz not null default now()
);
create index if not exists content_versions_item_idx on public.content_versions (content_id, saved_at desc);
alter table public.content_versions enable row level security;
drop policy if exists "content editors read versions" on public.content_versions;
create policy "content editors read versions" on public.content_versions for select using (public.admin_can('content.edit'));

create or replace function public.content_items_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.created_by is not null and new.created_by is null) or (old.updated_by is not null and new.updated_by is null) then
    return new;
  end if;
  if (to_jsonb(old) - 'updated_at' - 'updated_by') is distinct from (to_jsonb(new) - 'updated_at' - 'updated_by') then
    insert into public.content_versions (content_id, snapshot, status, saved_by) values (old.id, to_jsonb(old), old.status, auth.uid());
    delete from public.content_versions where content_id = old.id and id not in
      (select id from public.content_versions where content_id = old.id order by saved_at desc, id desc limit 30);
  end if;
  return new;
end;
$$;
drop trigger if exists content_items_version on public.content_items;
create trigger content_items_version after update on public.content_items
  for each row execute function public.content_items_version();

-- Content actions go into the main audit log too
create or replace function public.content_items_admin_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    insert into public.admin_audit (actor, actor_role, action, target, details)
    values (auth.uid(), public.admin_role(), 'content.create', new.id, jsonb_build_object('status', new.status, 'title', new.title));
  elsif tg_op = 'DELETE' then
    insert into public.admin_audit (actor, actor_role, action, target, details)
    values (auth.uid(), public.admin_role(), 'content.delete', old.id, jsonb_build_object('title', old.title));
  elsif old.status is distinct from new.status then
    insert into public.admin_audit (actor, actor_role, action, target, details)
    values (auth.uid(), public.admin_role(), 'content.' || new.status, new.id,
            jsonb_build_object('from', old.status, 'title', new.title, 'publish_at', new.publish_at));
  elsif old.featured is distinct from new.featured then
    insert into public.admin_audit (actor, actor_role, action, target, details)
    values (auth.uid(), public.admin_role(), case when new.featured then 'content.pin' else 'content.unpin' end, new.id, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists content_items_admin_audit on public.content_items;
create trigger content_items_admin_audit after insert or update or delete on public.content_items
  for each row execute function public.content_items_admin_audit();

-- Audio files (podcasts, audio lessons)
insert into storage.buckets (id, name, public) values ('content-audio', 'content-audio', true) on conflict (id) do nothing;
drop policy if exists "anyone can listen to content audio" on storage.objects;
create policy "anyone can listen to content audio" on storage.objects for select using (bucket_id = 'content-audio');
drop policy if exists "content editors upload audio" on storage.objects;
create policy "content editors upload audio" on storage.objects
  for insert with check (bucket_id = 'content-audio' and public.admin_can('content.edit'));
drop policy if exists "content editors change audio" on storage.objects;
create policy "content editors change audio" on storage.objects
  for update using (bucket_id = 'content-audio' and public.admin_can('content.edit'));
drop policy if exists "content editors delete audio" on storage.objects;
create policy "content editors delete audio" on storage.objects
  for delete using (bucket_id = 'content-audio' and public.admin_can('content.edit'));

-- ═════════════════════════════════════════════
-- 4. Homepage / Discover layout: draft → publish → history
-- ═════════════════════════════════════════════
create table if not exists public.homepage_configs (
  id bigint generated always as identity primary key,
  state text not null check (state in ('draft', 'published', 'archived')),
  config jsonb not null,
  note text check (char_length(note) <= 200),
  created_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid
);
create unique index if not exists homepage_one_draft on public.homepage_configs (state) where state = 'draft';
create unique index if not exists homepage_one_live on public.homepage_configs (state) where state = 'published';
alter table public.homepage_configs enable row level security;
drop policy if exists "everyone reads the live homepage" on public.homepage_configs;
create policy "everyone reads the live homepage" on public.homepage_configs
  for select using (state = 'published' or public.admin_can('homepage.edit') or public.admin_can('analytics.view'));

create or replace function public.homepage_check(p jsonb)
returns void language plpgsql immutable as $$
begin
  if jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'sections') <> 'array' then
    raise exception 'Homepage layout must have a list of sections.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'sections') s
             where coalesce(s ->> 'id', '') not in ('featured', 'for_you', 'videos', 'question', 'topics')) then
    raise exception 'Unknown homepage section.' using errcode = '22023';
  end if;
  if pg_column_size(p) > 50000 then raise exception 'Homepage layout is too large.' using errcode = '22023'; end if;
end;
$$;

create or replace function public.homepage_save_draft(p_config jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.require_perm('homepage.edit');
  perform public.homepage_check(p_config);
  update public.homepage_configs set config = p_config, created_by = auth.uid(), created_at = now()
    where state = 'draft' returning id into v_id;
  if v_id is null then
    insert into public.homepage_configs (state, config, created_by) values ('draft', p_config, auth.uid()) returning id into v_id;
  end if;
  perform public.log_admin('homepage.save_draft', v_id::text, '{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.homepage_publish(p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_draft public.homepage_configs; v_id bigint;
begin
  perform public.require_perm('homepage.publish');
  select * into v_draft from public.homepage_configs where state = 'draft';
  if v_draft.id is null then raise exception 'There are no unpublished changes.' using errcode = '22023'; end if;
  perform public.homepage_check(v_draft.config);
  update public.homepage_configs set state = 'archived' where state = 'published';
  insert into public.homepage_configs (state, config, note, created_by, created_at, published_at, published_by)
    values ('published', v_draft.config, left(p_note, 200), v_draft.created_by, v_draft.created_at, now(), auth.uid())
    returning id into v_id;
  delete from public.homepage_configs where id = v_draft.id;
  perform public.log_admin('homepage.publish', v_id::text, jsonb_build_object('note', p_note));
  return v_id;
end;
$$;

create or replace function public.homepage_discard_draft()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('homepage.edit');
  delete from public.homepage_configs where state = 'draft';
  perform public.log_admin('homepage.discard_draft', null, '{}'::jsonb);
end;
$$;

-- Restore an earlier layout as a draft (you still review and publish it)
create or replace function public.homepage_restore(p_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_cfg jsonb;
begin
  perform public.require_perm('homepage.edit');
  select config into v_cfg from public.homepage_configs where id = p_id and state in ('published', 'archived');
  if v_cfg is null then raise exception 'That version doesn''t exist.' using errcode = '22023'; end if;
  perform public.log_admin('homepage.restore', p_id::text, '{}'::jsonb);
  return public.homepage_save_draft(v_cfg);
end;
$$;

-- ═════════════════════════════════════════════
-- 5. Activity and engagement tracking (privacy-first)
-- ═════════════════════════════════════════════
-- Which days a signed-in man opened the app (for daily/monthly active users and retention). Nothing else.
create table if not exists public.user_activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.user_activity_days enable row level security;  -- no policies: only through functions

create or replace function public.touch_activity()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.user_activity_days (user_id, day) values (auth.uid(), current_date) on conflict do nothing;
end;
$$;

-- Content counters per day, with no link to who (views, finished, saved)
create table if not exists public.content_stats_daily (
  content_id text not null,
  day date not null default current_date,
  views int not null default 0,
  completes int not null default 0,
  saves int not null default 0,
  primary key (content_id, day)
);
alter table public.content_stats_daily enable row level security;
drop policy if exists "analytics readers" on public.content_stats_daily;
create policy "analytics readers" on public.content_stats_daily for select using (public.admin_can('analytics.view'));

create or replace function public.track_content(p_id text, p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_id !~ '^[a-z0-9][a-z0-9-]{2,80}$' or p_event not in ('view', 'complete', 'save') then return; end if;
  insert into public.content_stats_daily (content_id, day, views, completes, saves)
  values (p_id, current_date, (p_event = 'view')::int, (p_event = 'complete')::int, (p_event = 'save')::int)
  on conflict (content_id, day) do update set
    views = content_stats_daily.views + excluded.views,
    completes = content_stats_daily.completes + excluded.completes,
    saves = content_stats_daily.saves + excluded.saves;
end;
$$;

-- Search words per day (no link to who). Phone numbers and emails are never stored.
create table if not exists public.search_stats_daily (
  term text not null,
  day date not null default current_date,
  searches int not null default 0,
  no_results int not null default 0,
  primary key (term, day)
);
alter table public.search_stats_daily enable row level security;
drop policy if exists "analytics readers" on public.search_stats_daily;
create policy "analytics readers" on public.search_stats_daily for select using (public.admin_can('analytics.view'));

create or replace function public.track_search(p_term text, p_results int)
returns void language plpgsql security definer set search_path = public as $$
declare v text := lower(btrim(regexp_replace(coalesce(p_term, ''), '\s+', ' ', 'g')));
begin
  if char_length(v) < 2 or char_length(v) > 60 or v ~ '\d{5,}' or v ~ '@' or v ~ 'https?:|www\.' then return; end if;
  insert into public.search_stats_daily (term, day, searches, no_results)
  values (v, current_date, 1, (coalesce(p_results, 0) = 0)::int)
  on conflict (term, day) do update set
    searches = search_stats_daily.searches + 1,
    no_results = search_stats_daily.no_results + excluded.no_results;
end;
$$;

-- ═════════════════════════════════════════════
-- 6. Shared Community (posts, replies, reactions, reports) + moderation
-- ═════════════════════════════════════════════
-- Men never read these tables directly: the functions below return only safe fields
-- (never who wrote an anonymous post).
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users (id) on delete cascade,
  topic text not null check (topic in ('general', 'erection', 'ejaculation', 'libido', 'fertility', 'confidence', 'intimacy', 'wellbeing')),
  title text not null check (char_length(title) between 8 and 120),
  body text not null default '' check (char_length(body) <= 1000),
  anonymous boolean not null default true,
  display_name text check (char_length(display_name) <= 24),
  wants_expert boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  pinned boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid
);
create index if not exists community_posts_created_idx on public.community_posts (created_at desc);
create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 600),
  anonymous boolean not null default true,
  display_name text check (char_length(display_name) <= 24),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid
);
create index if not exists community_replies_post_idx on public.community_replies (post_id, created_at);
create table if not exists public.community_reactions (
  target_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('support', 'helpful', 'same')),
  primary key (target_id, user_id, kind)
);
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'reply')),
  target_id uuid not null,
  reporter uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) <= 120),
  urgent boolean not null default false,
  auto boolean not null default false,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text check (char_length(resolution) <= 300),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists community_reports_status_idx on public.community_reports (status, urgent desc, created_at);
create table if not exists public.user_warnings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 5 and 300),
  given_by uuid,
  created_at timestamptz not null default now()
);
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;
alter table public.user_warnings enable row level security;
drop policy if exists "men see their own warnings" on public.user_warnings;
create policy "men see their own warnings" on public.user_warnings for select using (user_id = auth.uid() or public.admin_can('users.view'));

create or replace function public.is_restricted(p_user uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((select banned_until > now() from auth.users where id = p_user), false);
$$;

-- Same safety rules as the app: protects men from scams and keeps contact details private
create or replace function public.community_text_problem(p text)
returns text language sql immutable as $$
  select case
    when p ~ '(\+?\d[\d\s-]{7,}\d)' then 'Phone numbers can''t be shared here, to protect everyone''s privacy.'
    when p ~* '(https?://|www\.|\.com\M|\.co\.tz\M|wa\.me|t\.me/)' then 'Links can''t be shared in the community.'
    when p ~* '\m(whats ?app|call me|inbox me|dm me|nipigie|nitumie|namba yangu|my number)\M' then 'Please keep conversations in the community — no private contact requests.'
    when p ~* '\m(tsh|tzs|shilingi|price|bei|order now|buy now|nunua|for sale|inauzwa|delivery|discount)\M' then 'Selling and prices aren''t allowed in the community.'
    else null end;
$$;

-- Words that suggest possibly dangerous health advice: the post stays up but goes to moderators as urgent
create or replace function public.community_risky(p text)
returns boolean language sql immutable as $$
  select p ~* '(stop taking|double (the|your) dose|without (a )?prescription|guaranteed (cure|results)|cures? (it )?(100|completely)|instead of (a |your )?doctor|don''t see a doctor|acha dawa|bila daktari)';
$$;

create or replace function public.community_create_post(p_topic text, p_title text, p_body text, p_anonymous boolean, p_name text, p_wants_expert boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_problem text; v_settings jsonb;
begin
  if auth.uid() is null then raise exception 'Please sign in to post.' using errcode = '42501'; end if;
  select value into v_settings from public.app_settings where key = 'community_enabled';
  if v_settings = 'false'::jsonb then raise exception 'Community is paused right now.' using errcode = '42501'; end if;
  if public.is_restricted(auth.uid()) then raise exception 'Your account is restricted from posting right now.' using errcode = '42501'; end if;
  v_problem := public.community_text_problem(coalesce(p_title, '') || ' ' || coalesce(p_body, ''));
  if v_problem is not null then raise exception '%', v_problem using errcode = '22023'; end if;
  if not p_anonymous and (p_name is null or char_length(btrim(p_name)) < 3) then
    raise exception 'Choose a nickname of at least 3 letters, or post anonymously.' using errcode = '22023';
  end if;
  if (select count(*) from public.community_posts where author = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You''ve posted a lot in the last hour. Please wait a little.' using errcode = '22023';
  end if;
  insert into public.community_posts (author, topic, title, body, anonymous, display_name, wants_expert)
  values (auth.uid(), p_topic, btrim(p_title), btrim(coalesce(p_body, '')), p_anonymous,
          case when p_anonymous then null else btrim(p_name) end, coalesce(p_wants_expert, false))
  returning id into v_id;
  if public.community_risky(coalesce(p_title, '') || ' ' || coalesce(p_body, '')) then
    insert into public.community_reports (target_type, target_id, reason, urgent, auto)
    values ('post', v_id, 'Possibly dangerous health advice (automatic check)', true, true);
  end if;
  return v_id;
end;
$$;

create or replace function public.community_create_reply(p_post uuid, p_body text, p_anonymous boolean, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_problem text;
begin
  if auth.uid() is null then raise exception 'Please sign in to reply.' using errcode = '42501'; end if;
  if public.is_restricted(auth.uid()) then raise exception 'Your account is restricted from posting right now.' using errcode = '42501'; end if;
  if not exists (select 1 from public.community_posts where id = p_post and status = 'visible') then
    raise exception 'This conversation isn''t available.' using errcode = '22023';
  end if;
  v_problem := public.community_text_problem(coalesce(p_body, ''));
  if v_problem is not null then raise exception '%', v_problem using errcode = '22023'; end if;
  insert into public.community_replies (post_id, author, body, anonymous, display_name)
  values (p_post, auth.uid(), btrim(p_body), p_anonymous or p_name is null or char_length(btrim(p_name)) < 3,
          case when p_anonymous or p_name is null or char_length(btrim(p_name)) < 3 then null else btrim(p_name) end)
  returning id into v_id;
  if public.community_risky(p_body) then
    insert into public.community_reports (target_type, target_id, reason, urgent, auto)
    values ('reply', v_id, 'Possibly dangerous health advice (automatic check)', true, true);
  end if;
  return v_id;
end;
$$;

create or replace function public.community_react(p_target uuid, p_kind text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.' using errcode = '42501'; end if;
  if exists (select 1 from public.community_reactions where target_id = p_target and user_id = auth.uid() and kind = p_kind) then
    delete from public.community_reactions where target_id = p_target and user_id = auth.uid() and kind = p_kind;
    return false;
  end if;
  insert into public.community_reactions (target_id, user_id, kind) values (p_target, auth.uid(), p_kind);
  return true;
end;
$$;

create or replace function public.community_report(p_type text, p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.' using errcode = '42501'; end if;
  if exists (select 1 from public.community_reports where target_id = p_target and reporter = auth.uid()) then return; end if;
  insert into public.community_reports (target_type, target_id, reporter, reason, urgent)
  values (p_type, p_target, auth.uid(), left(p_reason, 120),
          p_reason in ('Medical misinformation', 'Harassment or disrespect', 'Sharing someone''s private information'));
end;
$$;

create or replace function public.community_undo_report(p_target uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.community_reports where target_id = p_target and reporter = auth.uid() and status = 'open';
$$;

create or replace function public.community_delete_mine(p_type text, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type = 'post' then delete from public.community_posts where id = p_target and author = auth.uid();
  else delete from public.community_replies where id = p_target and author = auth.uid(); end if;
end;
$$;

-- The feed he sees: visible posts (plus his own), without what he reported
create or replace function public.community_list(p_topic text default 'all', p_sort text default 'active', p_limit int default 50)
returns table (id uuid, topic text, title text, body text, anonymous boolean, display_name text, wants_expert boolean,
               pinned boolean, featured boolean, status text, created_at timestamptz, mine boolean, reply_count int,
               reactions jsonb, my_reactions text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.topic, p.title, p.body, p.anonymous, p.display_name, p.wants_expert, p.pinned, p.featured, p.status,
         p.created_at, p.author = auth.uid(),
         (select count(*)::int from public.community_replies r where r.post_id = p.id and r.status = 'visible'),
         coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.community_reactions where target_id = p.id group by kind) x), '{}'::jsonb),
         coalesce((select array_agg(kind) from public.community_reactions where target_id = p.id and user_id = auth.uid()), '{}')
  from public.community_posts p
  where (p.status = 'visible' or p.author = auth.uid())
    and (p_topic = 'all' or p.topic = p_topic)
    and not exists (select 1 from public.community_reports rep where rep.target_id = p.id and rep.reporter = auth.uid())
    and auth.uid() is not null
  order by p.pinned desc,
           case when p_sort = 'active' then (select count(*) from public.community_replies r where r.post_id = p.id) * 3
             + (select count(*) from public.community_reactions c where c.target_id = p.id) else 0 end desc,
           p.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.community_replies_for(p_post uuid)
returns table (id uuid, body text, anonymous boolean, display_name text, status text, created_at timestamptz, mine boolean, reactions jsonb, my_reactions text[])
language sql stable security definer set search_path = public as $$
  select r.id, r.body, r.anonymous, r.display_name, r.status, r.created_at, r.author = auth.uid(),
         coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.community_reactions where target_id = r.id group by kind) x), '{}'::jsonb),
         coalesce((select array_agg(kind) from public.community_reactions where target_id = r.id and user_id = auth.uid()), '{}')
  from public.community_replies r
  where r.post_id = p_post and (r.status = 'visible' or r.author = auth.uid())
    and not exists (select 1 from public.community_reports rep where rep.target_id = r.id and rep.reporter = auth.uid())
    and auth.uid() is not null
  order by r.created_at;
$$;

-- Moderation workspace
create or replace function public.mod_items(p_filter text default 'all', p_limit int default 100)
returns table (type text, id uuid, post_id uuid, title text, body text, topic text, status text, pinned boolean, featured boolean,
               anonymous boolean, display_name text, author_label text, author_id uuid, created_at timestamptz,
               open_reports int, urgent boolean, reply_count int)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  perform public.require_perm('community.moderate');
  return query
  select * from (
    select 'post'::text, p.id, p.id, p.title, p.body, p.topic, p.status, p.pinned, p.featured, p.anonymous, p.display_name,
           public.mask_email(u.email), p.author, p.created_at,
           (select count(*)::int from public.community_reports r where r.target_id = p.id and r.status = 'open'),
           exists (select 1 from public.community_reports r where r.target_id = p.id and r.status = 'open' and r.urgent),
           (select count(*)::int from public.community_replies x where x.post_id = p.id)
    from public.community_posts p left join auth.users u on u.id = p.author
    union all
    select 'reply', r.id, r.post_id, (select title from public.community_posts where id = r.post_id), r.body, null::text, r.status, false, false,
           r.anonymous, r.display_name, public.mask_email(u.email), r.author, r.created_at,
           (select count(*)::int from public.community_reports x where x.target_id = r.id and x.status = 'open'),
           exists (select 1 from public.community_reports x where x.target_id = r.id and x.status = 'open' and x.urgent), 0
    from public.community_replies r left join auth.users u on u.id = r.author
  ) t (type, id, post_id, title, body, topic, status, pinned, featured, anonymous, display_name, author_label, author_id, created_at, open_reports, urgent, reply_count)
  where case p_filter
          when 'reported' then t.open_reports > 0
          when 'urgent' then t.urgent
          when 'hidden' then t.status <> 'visible'
          when 'pinned' then t.pinned or t.featured
          when 'posts' then t.type = 'post'
          when 'replies' then t.type = 'reply'
          else true end
  order by t.urgent desc, t.open_reports desc, t.created_at desc
  limit least(greatest(p_limit, 1), 300);
end;
$$;

create or replace function public.mod_reports(p_status text default 'open')
returns table (id uuid, target_type text, target_id uuid, reason text, urgent boolean, auto boolean, status text, resolution text,
               created_at timestamptz, resolved_at timestamptz, excerpt text, target_status text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.require_perm('community.moderate');
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.urgent, r.auto, r.status, r.resolution, r.created_at, r.resolved_at,
         left(coalesce((select title || ' — ' || body from public.community_posts where id = r.target_id),
                       (select body from public.community_replies where id = r.target_id), '(deleted)'), 200),
         coalesce((select status from public.community_posts where id = r.target_id),
                  (select status from public.community_replies where id = r.target_id), 'deleted')
  from public.community_reports r
  where p_status = 'all' or r.status = p_status
  order by r.urgent desc, r.created_at
  limit 300;
end;
$$;

create or replace function public.mod_set_status(p_type text, p_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('community.moderate');
  if p_status not in ('visible', 'hidden', 'removed') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  if p_type = 'post' then
    update public.community_posts set status = p_status, moderated_at = now(), moderated_by = auth.uid() where id = p_id;
  else
    update public.community_replies set status = p_status, moderated_at = now(), moderated_by = auth.uid() where id = p_id;
  end if;
  if not found then raise exception 'Not found.' using errcode = '22023'; end if;
  -- Acting on an item resolves its open reports
  update public.community_reports set status = 'resolved', resolution = coalesce(left(p_reason, 300), 'Set to ' || p_status),
         resolved_by = auth.uid(), resolved_at = now()
   where target_id = p_id and status = 'open';
  perform public.log_admin('community.' || p_status, p_type || ':' || p_id, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.mod_flag(p_id uuid, p_flag text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('community.moderate');
  if p_flag = 'pinned' then update public.community_posts set pinned = p_on where id = p_id;
  elsif p_flag = 'featured' then update public.community_posts set featured = p_on where id = p_id;
  else raise exception 'Unknown flag.' using errcode = '22023'; end if;
  if not found then raise exception 'Not found.' using errcode = '22023'; end if;
  perform public.log_admin('community.' || case when p_on then '' else 'un' end || p_flag, 'post:' || p_id, '{}'::jsonb);
end;
$$;

create or replace function public.mod_resolve_report(p_id uuid, p_status text, p_resolution text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('community.moderate');
  if p_status not in ('open', 'resolved', 'dismissed') then raise exception 'Unknown status.' using errcode = '22023'; end if;
  update public.community_reports set status = p_status, resolution = left(p_resolution, 300),
         resolved_by = case when p_status = 'open' then null else auth.uid() end,
         resolved_at = case when p_status = 'open' then null else now() end
   where id = p_id;
  if not found then raise exception 'Not found.' using errcode = '22023'; end if;
  perform public.log_admin('report.' || p_status, p_id::text, jsonb_build_object('resolution', p_resolution));
end;
$$;

-- ═════════════════════════════════════════════
-- 7. Users (no health data, no private notes, no profile details)
-- ═════════════════════════════════════════════
create or replace function public.mask_email(p text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p is null then null
    when public.admin_role() in ('owner', 'moderator') then p
    else left(split_part(p, '@', 1), 2) || '•••@' || split_part(p, '@', 2) end;
$$;

create table if not exists public.user_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  author uuid default auth.uid(),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.user_notes enable row level security;
drop policy if exists "support notes read" on public.user_notes;
create policy "support notes read" on public.user_notes for select using (public.admin_can('users.restrict'));
drop policy if exists "support notes write" on public.user_notes;
create policy "support notes write" on public.user_notes for insert with check (public.admin_can('users.restrict') and author = auth.uid());
drop policy if exists "support notes delete own" on public.user_notes;
create policy "support notes delete own" on public.user_notes for delete using (author = auth.uid() or public.admin_role() = 'owner');

create or replace function public.admin_users(p_search text default '', p_filter text default 'all', p_limit int default 25, p_offset int default 0)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, last_active date, restricted_until timestamptz,
               onboarded boolean, opened int, saved int, lessons int, posts int, admin_role text, notes int, warnings int, total bigint)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  perform public.require_perm('users.view');
  return query
  with base as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
           (select max(d.day) from public.user_activity_days d where d.user_id = u.id) as last_day,
           (select data from public.user_data where user_id = u.id and kind = 'social') as social,
           (select data from public.user_data where user_id = u.id and kind = 'feed') as feed,
           (select a.role from public.admins a where a.user_id = u.id) as role
    from auth.users u
    where p_search = '' or u.email ilike '%' || p_search || '%' or u.id::text = p_search
  )
  select b.id, public.mask_email(b.email), b.created_at, b.last_sign_in_at, b.last_day,
         case when b.banned_until > now() then b.banned_until end,
         coalesce(jsonb_array_length(coalesce(b.social -> 'interests', '[]'::jsonb)) > 0 or coalesce(b.social ->> 'nickname', '') <> '', false),
         coalesce((select count(*) from jsonb_object_keys(coalesce(b.social -> 'history', '{}'::jsonb)))::int, 0),
         coalesce((select count(*) from jsonb_object_keys(coalesce(b.social -> 'bookmarks', '{}'::jsonb)))::int, 0),
         coalesce((select count(*) from jsonb_object_keys(coalesce(b.feed -> 'lessons', '{}'::jsonb)))::int, 0),
         (select count(*)::int from public.community_posts p where p.author = b.id),
         b.role,
         (select count(*)::int from public.user_notes n where n.user_id = b.id),
         (select count(*)::int from public.user_warnings w where w.user_id = b.id),
         count(*) over ()
  from base b
  where case p_filter
          when 'new7' then b.created_at > now() - interval '7 days'
          when 'active30' then b.last_day >= current_date - 30
          when 'inactive30' then b.last_day is null or b.last_day < current_date - 30
          when 'restricted' then b.banned_until > now()
          when 'admins' then b.role is not null
          else true end
  order by b.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_restrict_user(p_user uuid, p_days int, p_reason text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.require_perm('users.restrict');
  if p_user = auth.uid() then raise exception 'You can''t restrict your own account.' using errcode = '22023'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then
    raise exception 'Admins can''t be restricted. Remove their admin role first.' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Give a reason.' using errcode = '22023'; end if;
  update auth.users set banned_until = case when coalesce(p_days, 0) <= 0 then null else now() + make_interval(days => p_days) end
   where id = p_user;
  if not found then raise exception 'User not found.' using errcode = '22023'; end if;
  insert into public.user_notes (user_id, author, body)
  values (p_user, auth.uid(), case when coalesce(p_days, 0) <= 0 then 'Restriction lifted: ' else 'Restricted for ' || p_days || ' days: ' end || left(p_reason, 900));
  perform public.log_admin(case when coalesce(p_days, 0) <= 0 then 'user.unrestrict' else 'user.restrict' end, p_user::text,
                           jsonb_build_object('days', p_days, 'reason', p_reason));
end;
$$;

create or replace function public.admin_warn_user(p_user uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.admin_can('users.restrict') or public.admin_can('community.moderate')) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  insert into public.user_warnings (user_id, message, given_by) values (p_user, btrim(p_message), auth.uid());
  -- He sees it in his app inbox
  insert into public.notification_campaigns (title, body, kind, segment, status, send_at, created_by)
  values ('A note from the Men''s Social team', btrim(p_message), 'warning', 'user:' || p_user, 'scheduled', now(), auth.uid());
  perform public.log_admin('user.warn', p_user::text, jsonb_build_object('message', p_message));
end;
$$;

create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.require_perm('users.delete');
  if p_user = auth.uid() then raise exception 'Use "Delete account" on your own Me page instead.' using errcode = '22023'; end if;
  if exists (select 1 from public.admins where user_id = p_user and role = 'owner') then
    raise exception 'Owners can''t be deleted here.' using errcode = '22023';
  end if;
  delete from public.user_data where user_id = p_user;
  delete from auth.users where id = p_user;
  if not found then raise exception 'User not found.' using errcode = '22023'; end if;
  perform public.log_admin('user.delete', p_user::text, '{}'::jsonb);
end;
$$;

-- ═════════════════════════════════════════════
-- 8. Notifications (in-app inbox; push needs a separate sender)
-- ═════════════════════════════════════════════
create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 3 and 300),
  kind text not null default 'announcement' check (kind in ('announcement', 'new_content', 'tip', 'community', 'reengagement', 'warning')),
  link text check (link is null or link ~ '^/[a-zA-Z0-9/_?=&.-]*$'),
  segment text not null default 'all' check (segment in ('all', 'new_7d', 'active_7d', 'inactive_7d') or segment ~ '^topic:[a-z]+$' or segment ~ '^user:[0-9a-f-]{36}$'),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'cancelled')),
  send_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.notification_receipts (
  campaign_id uuid not null references public.notification_campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  delivered_at timestamptz not null default now(),
  opened_at timestamptz,
  primary key (campaign_id, user_id)
);
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  announcements boolean not null default true,
  new_content boolean not null default true,
  tips boolean not null default true,
  community boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_campaigns enable row level security;
alter table public.notification_receipts enable row level security;
alter table public.notification_prefs enable row level security;
drop policy if exists "senders read campaigns" on public.notification_campaigns;
create policy "senders read campaigns" on public.notification_campaigns for select using (public.admin_can('notifications.send') or public.admin_can('analytics.view'));
drop policy if exists "own prefs" on public.notification_prefs;
create policy "own prefs" on public.notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notification_targets(c public.notification_campaigns, p_user uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  -- Group messages are for men: staff (admin) accounts aren't counted or sent them. A single-man message (user:) always goes.
  select case
    when c.segment like 'user:%' then substr(c.segment, 6)::uuid = p_user
    when exists (select 1 from public.admins a where a.user_id = p_user) then false
    when c.segment = 'all' then true
    when c.segment = 'new_7d' then (select created_at > c.send_at - interval '7 days' from auth.users where id = p_user)
    when c.segment = 'active_7d' then exists (select 1 from public.user_activity_days d where d.user_id = p_user and d.day >= (c.send_at - interval '7 days')::date and d.day < c.send_at::date)
    when c.segment = 'inactive_7d' then not exists (select 1 from public.user_activity_days d where d.user_id = p_user and d.day >= (c.send_at - interval '7 days')::date and d.day < c.send_at::date)
    when c.segment like 'topic:%' then coalesce((select (data -> 'interests') ? substr(c.segment, 7) from public.user_data where user_id = p_user and kind = 'social'), false)
    when c.segment like 'user:%' then substr(c.segment, 6)::uuid = p_user
    else false end;
$$;

-- His inbox: live campaigns meant for him (last 30 days), respecting his choices. Opening the inbox counts as delivered.
create or replace function public.my_notifications()
returns table (id uuid, title text, body text, kind text, link text, sent_at timestamptz, opened boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_prefs public.notification_prefs; v_ids uuid[];
begin
  if auth.uid() is null then return; end if;
  if (select value from public.app_settings where key = 'notifications_enabled') = 'false'::jsonb then return; end if;
  select * into v_prefs from public.notification_prefs where user_id = auth.uid();
  select coalesce(array_agg(x.id), '{}') into v_ids from (
    select c.id from public.notification_campaigns c
    where c.status = 'scheduled' and c.send_at <= now() and c.send_at > now() - interval '30 days'
      and public.notification_targets(c, auth.uid())
      and (c.kind = 'warning'
           or (c.kind in ('announcement', 'reengagement') and coalesce(v_prefs.announcements, true))
           or (c.kind = 'new_content' and coalesce(v_prefs.new_content, true))
           or (c.kind = 'tip' and coalesce(v_prefs.tips, true))
           or (c.kind = 'community' and coalesce(v_prefs.community, true)))
    order by c.send_at desc limit 30) x;
  insert into public.notification_receipts (campaign_id, user_id) select unnest(v_ids), auth.uid() on conflict do nothing;
  return query
  select c.id, c.title, c.body, c.kind, c.link, c.send_at, r.opened_at is not null
  from public.notification_campaigns c
  left join public.notification_receipts r on r.campaign_id = c.id and r.user_id = auth.uid()
  where c.id = any (v_ids)
  order by c.send_at desc;
end;
$$;

create or replace function public.my_notification_opened(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notification_receipts set opened_at = coalesce(opened_at, now()) where campaign_id = p_id and user_id = auth.uid();
$$;

create or replace function public.notif_save(p_id uuid, p_title text, p_body text, p_kind text, p_link text, p_segment text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_perm('notifications.send');
  if p_kind = 'warning' then raise exception 'Warnings are sent from Users or Community.' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.notification_campaigns (title, body, kind, link, segment, created_by)
    values (btrim(p_title), btrim(p_body), p_kind, nullif(btrim(p_link), ''), p_segment, auth.uid()) returning id into v_id;
  else
    update public.notification_campaigns set title = btrim(p_title), body = btrim(p_body), kind = p_kind,
           link = nullif(btrim(p_link), ''), segment = p_segment, updated_at = now()
     where id = p_id and status = 'draft' returning id into v_id;
    if v_id is null then raise exception 'Only drafts can be edited.' using errcode = '22023'; end if;
  end if;
  perform public.log_admin('notification.save', v_id::text, jsonb_build_object('title', p_title));
  return v_id;
end;
$$;

-- Schedule (or send now when p_at is null). Protects against duplicates and too many messages.
create or replace function public.notif_schedule(p_id uuid, p_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.notification_campaigns; v_at timestamptz := coalesce(p_at, now());
begin
  perform public.require_perm('notifications.send');
  select * into c from public.notification_campaigns where id = p_id;
  if c.id is null or c.status <> 'draft' then raise exception 'Only drafts can be sent.' using errcode = '22023'; end if;
  if v_at < now() - interval '1 minute' then raise exception 'Choose a time in the future.' using errcode = '22023'; end if;
  if exists (select 1 from public.notification_campaigns x where x.id <> c.id and x.status = 'scheduled'
             and lower(x.title) = lower(c.title) and lower(x.body) = lower(c.body)
             and x.send_at > v_at - interval '24 hours' and x.send_at < v_at + interval '24 hours') then
    raise exception 'The same message is already sent or scheduled within 24 hours of this time.' using errcode = '22023';
  end if;
  if (select count(*) from public.notification_campaigns x where x.status = 'scheduled' and x.kind <> 'warning'
      and x.send_at > v_at - interval '24 hours' and x.send_at <= v_at + interval '24 hours') >= 3 then
    raise exception 'Limit reached: at most 3 messages in any 24 hours, so men aren''t bothered too often.' using errcode = '22023';
  end if;
  update public.notification_campaigns set status = 'scheduled', send_at = v_at, updated_at = now() where id = p_id;
  perform public.log_admin(case when p_at is null then 'notification.send' else 'notification.schedule' end, p_id::text,
                           jsonb_build_object('send_at', v_at, 'segment', c.segment));
end;
$$;

create or replace function public.notif_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('notifications.send');
  update public.notification_campaigns set status = 'cancelled', updated_at = now()
   where id = p_id and (status = 'draft' or (status = 'scheduled' and send_at > now()));
  if not found then raise exception 'Only drafts and messages not yet sent can be cancelled.' using errcode = '22023'; end if;
  perform public.log_admin('notification.cancel', p_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.notif_stats()
returns table (id uuid, delivered int, opened int, audience int)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  if not (public.admin_can('notifications.send') or public.admin_can('analytics.view')) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
  select c.id,
         (select count(*)::int from public.notification_receipts r where r.campaign_id = c.id),
         (select count(*)::int from public.notification_receipts r where r.campaign_id = c.id and r.opened_at is not null),
         (select count(*)::int from auth.users u where public.notification_targets(c, u.id))
  from public.notification_campaigns c where c.kind <> 'warning' or public.admin_can('users.view');
end;
$$;

-- ═════════════════════════════════════════════
-- 9. App settings / feature switches (no secrets ever stored here)
-- ═════════════════════════════════════════════
create table if not exists public.app_settings (
  key text primary key check (key ~ '^[a-z_]{3,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.app_settings enable row level security;
drop policy if exists "everyone reads switches" on public.app_settings;
create policy "everyone reads switches" on public.app_settings for select using (true);
insert into public.app_settings (key, value) values
  ('community_enabled', 'true'), ('notifications_enabled', 'true'),
  ('ai_config', '{"enabled": false, "tone": "warm, clear, non-judgemental, simple English", "rules": ""}'),
  ('schema_version', '6')
on conflict (key) do nothing;
update public.app_settings set value = '6' where key = 'schema_version';

create or replace function public.settings_set(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_key = 'ai_config' then perform public.require_perm('ai.use');
  else perform public.require_perm('settings.manage'); end if;
  if p_key not in ('community_enabled', 'notifications_enabled', 'ai_config') then raise exception 'Unknown setting.' using errcode = '22023'; end if;
  if p_key = 'ai_config' and not public.admin_can('settings.manage') and (p_value ->> 'enabled') is distinct from
     (select value ->> 'enabled' from public.app_settings where key = 'ai_config') then
    raise exception 'Only owners can switch AI on or off.' using errcode = '42501';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public.log_admin('settings.' || p_key, p_key, jsonb_build_object('value', p_value));
end;
$$;

-- ═════════════════════════════════════════════
-- 10. AI workspace: approved sources and usage log (the API key lives only on the server)
-- ═════════════════════════════════════════════
create table if not exists public.ai_sources (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 160),
  url text check (url is null or url ~ '^https://'),
  notes text check (char_length(notes) <= 1000),
  approved boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.ai_sources enable row level security;
drop policy if exists "ai sources read" on public.ai_sources;
create policy "ai sources read" on public.ai_sources for select using (public.admin_can('ai.use'));
drop policy if exists "ai sources write" on public.ai_sources;
create policy "ai sources write" on public.ai_sources for all using (public.admin_can('content.publish')) with check (public.admin_can('content.publish'));

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  actor uuid default auth.uid(),
  action text not null check (char_length(action) <= 40),
  ok boolean not null,
  error text check (char_length(error) <= 300),
  input_chars int,
  output_chars int,
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai usage read" on public.ai_usage;
create policy "ai usage read" on public.ai_usage for select using (public.admin_can('ai.use') or public.admin_can('analytics.view'));
drop policy if exists "ai usage write" on public.ai_usage;
create policy "ai usage write" on public.ai_usage for insert with check (public.admin_can('ai.use') and actor = auth.uid());

-- ═════════════════════════════════════════════
-- 11. Admin management (owners only) and admin profile
-- ═════════════════════════════════════════════
create or replace function public.admin_list()
returns table (user_id uuid, email text, role text, display_name text, created_at timestamptz, last_sign_in_at timestamptz, me boolean)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Not an admin' using errcode = '42501'; end if;
  return query
  select a.user_id, public.mask_email(u.email), a.role, a.display_name, a.created_at, u.last_sign_in_at, a.user_id = auth.uid()
  from public.admins a left join auth.users u on u.id = a.user_id
  order by case a.role when 'owner' then 0 when 'editor' then 1 when 'writer' then 2 when 'moderator' then 3 else 4 end, a.created_at;
end;
$$;

create or replace function public.admin_add(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  perform public.require_perm('admins.manage');
  if p_role not in ('owner', 'editor', 'writer', 'moderator', 'analyst') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then raise exception 'No account with that email. They must sign up (or be created in Supabase) first.' using errcode = '22023'; end if;
  insert into public.admins (user_id, role, added_by) values (v_id, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role;
  update auth.users set banned_until = null where id = v_id;
  perform public.log_admin('admin.add', v_id::text, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('admins.manage');
  if p_role not in ('owner', 'editor', 'writer', 'moderator', 'analyst') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  if p_role <> 'owner' and (select role from public.admins where user_id = p_user) = 'owner'
     and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception 'There must always be at least one owner.' using errcode = '22023';
  end if;
  update public.admins set role = p_role where user_id = p_user;
  if not found then raise exception 'Not an admin.' using errcode = '22023'; end if;
  perform public.log_admin('admin.role', p_user::text, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_remove(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('admins.manage');
  if (select role from public.admins where user_id = p_user) = 'owner' and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception 'There must always be at least one owner.' using errcode = '22023';
  end if;
  delete from public.admins where user_id = p_user;
  if not found then raise exception 'Not an admin.' using errcode = '22023'; end if;
  perform public.log_admin('admin.remove', p_user::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_display_name(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin' using errcode = '42501'; end if;
  update public.admins set display_name = nullif(left(btrim(p_name), 40), '') where user_id = auth.uid();
  perform public.log_admin('admin.profile', auth.uid()::text, '{}'::jsonb);
end;
$$;

-- ═════════════════════════════════════════════
-- 12. Dashboard numbers (all totals; groups under 5 men are hidden)
-- ═════════════════════════════════════════════
-- "Men" here means accounts that aren't admins.
create or replace function public.admin_overview(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365); r jsonb;
begin
  perform public.require_perm('analytics.view');
  select jsonb_build_object(
    'days', d,
    'generated_at', now(),
    'users_total', (select count(*) from auth.users u where true and not exists (select 1 from public.admins x where x.user_id = u.id)),
    'users_new', (select count(*) from auth.users u where created_at > now() - make_interval(days => d) and not exists (select 1 from public.admins x where x.user_id = u.id)),
    'users_new_prev', (select count(*) from auth.users u where created_at <= now() - make_interval(days => d) and created_at > now() - make_interval(days => 2 * d) and not exists (select 1 from public.admins x where x.user_id = u.id)),
    'tracking_since', (select min(day) from public.user_activity_days),
    'dau', (select count(*) from public.user_activity_days where day = current_date),
    'wau', (select count(distinct user_id) from public.user_activity_days where day > current_date - 7),
    'mau', (select count(distinct user_id) from public.user_activity_days where day > current_date - 30),
    'signups_series', (select coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'n', (select count(*) from auth.users u where u.created_at::date = g::date and not exists (select 1 from public.admins x where x.user_id = u.id))) order by g), '[]')
                       from generate_series(current_date - (d - 1), current_date, interval '1 day') g),
    'active_series', (select coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'n', (select count(*) from public.user_activity_days a where a.day = g::date)) order by g), '[]')
                      from generate_series(current_date - (d - 1), current_date, interval '1 day') g),
    'retention_7d', (select case when count(*) = 0 then null else jsonb_build_object(
                         'cohort', count(*),
                         'returned', count(*) filter (where exists (select 1 from public.user_activity_days a where a.user_id = u.id
                                                       and a.day between u.created_at::date + 7 and u.created_at::date + 30)))
                      end
                     from auth.users u
                     where u.created_at::date between greatest(current_date - 37, coalesce((select min(day) from public.user_activity_days), current_date))
                                                  and current_date - 7 and not exists (select 1 from public.admins x where x.user_id = u.id)),
    'content', jsonb_build_object(
       'published', (select count(*) from public.content_items where status = 'published' and (publish_at is null or publish_at <= now())),
       'scheduled', (select count(*) from public.content_items where status = 'published' and publish_at > now()),
       'review', (select count(*) from public.content_items where status = 'review'),
       'drafts', (select count(*) from public.content_items where status = 'draft'),
       'archived', (select count(*) from public.content_items where status = 'archived')),
    'engagement_tracking_since', (select min(day) from public.content_stats_daily),
    'views', (select coalesce(sum(views), 0) from public.content_stats_daily where day > current_date - d),
    'views_prev', (select coalesce(sum(views), 0) from public.content_stats_daily where day <= current_date - d and day > current_date - 2 * d),
    'completes', (select coalesce(sum(completes), 0) from public.content_stats_daily where day > current_date - d),
    'saves', (select coalesce(sum(saves), 0) from public.content_stats_daily where day > current_date - d),
    'views_series', (select coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'n', (select coalesce(sum(views), 0) from public.content_stats_daily s where s.day = g::date)) order by g), '[]')
                     from generate_series(current_date - (d - 1), current_date, interval '1 day') g),
    'community', jsonb_build_object(
       'posts', (select count(*) from public.community_posts where created_at > now() - make_interval(days => d)),
       'replies', (select count(*) from public.community_replies where created_at > now() - make_interval(days => d)),
       'open_reports', (select count(*) from public.community_reports where status = 'open'),
       'urgent_reports', (select count(*) from public.community_reports where status = 'open' and urgent)),
    'notifications', jsonb_build_object(
       'sent', (select count(*) from public.notification_campaigns where status = 'scheduled' and send_at <= now() and send_at > now() - make_interval(days => d) and kind <> 'warning'),
       'delivered', (select count(*) from public.notification_receipts r join public.notification_campaigns c on c.id = r.campaign_id
                     where c.kind <> 'warning' and c.send_at > now() - make_interval(days => d)),
       'opened', (select count(*) from public.notification_receipts r join public.notification_campaigns c on c.id = r.campaign_id
                  where c.kind <> 'warning' and r.opened_at is not null and c.send_at > now() - make_interval(days => d)),
       'scheduled', (select count(*) from public.notification_campaigns where status = 'scheduled' and send_at > now())),
    'homepage', jsonb_build_object(
       'has_draft', exists (select 1 from public.homepage_configs where state = 'draft'),
       'live_since', (select published_at from public.homepage_configs where state = 'published')),
    'ai_errors_24h', (select count(*) from public.ai_usage where not ok and created_at > now() - interval '24 hours')
  ) into r;
  return r;
end;
$$;

-- Adoption of features, from the data men save (counts only, never values)
create or replace function public.admin_adoption()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; k int := 5;
begin
  perform public.require_perm('analytics.view');
  with p as (select user_id, data from public.user_data where kind = 'progress'),
       f as (select user_id, data from public.user_data where kind = 'feed'),
       s as (select user_id, data from public.user_data where kind = 'social'),
       topics as (select t.topic, count(*) n from s, jsonb_array_elements_text(coalesce(s.data -> 'interests', '[]')) t(topic) group by t.topic)
  select jsonb_build_object(
    'synced_users', (select count(distinct user_id) from public.user_data),
    'water', (select count(*) from p where exists (select 1 from jsonb_array_elements(coalesce(p.data -> 'records', '[]')) e where e ->> 'metric' = 'water')),
    'sleep', (select count(*) from p where exists (select 1 from jsonb_array_elements(coalesce(p.data -> 'records', '[]')) e where e ->> 'metric' = 'sleep')),
    'checkin', (select count(*) from p where exists (select 1 from jsonb_array_elements(coalesce(p.data -> 'records', '[]')) e where e ->> 'metric' in ('energy', 'mood'))),
    'activities', (select count(*) from f where f.data -> 'days' <> '{}'::jsonb),
    'lessons', (select count(*) from f where coalesce(f.data -> 'lessons', '{}'::jsonb) <> '{}'::jsonb),
    'saved', (select count(*) from s where coalesce(s.data -> 'bookmarks', '{}'::jsonb) <> '{}'::jsonb),
    'topics_followed', (select coalesce(jsonb_object_agg(topic, case when n >= k then n else null end), '{}') from topics),
    'min_group', k
  ) into r;
  return r;
end;
$$;

-- System health: what's set up (no secrets)
create or replace function public.admin_health()
returns jsonb language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.is_admin() then raise exception 'Not an admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'schema_version', (select value from public.app_settings where key = 'schema_version'),
    'database_time', now(),
    'buckets', (select coalesce(jsonb_agg(id order by id), '[]') from storage.buckets),
    'content_rows', (select count(*) from public.content_items),
    'admins', (select count(*) from public.admins),
    'owners', (select count(*) from public.admins where role = 'owner'),
    'audit_rows', (select count(*) from public.admin_audit));
end;
$$;

-- Old (0001) audit table is kept; new actions go to admin_audit.

-- ---------------------------------------------------------------------------------------------
-- Re-run safety (added in Step 34): if two-step sign-in (0007) is already installed, running this
-- older file again must NOT switch it off. Put the 0007 versions of the admin checks back.
do $guard$
begin
  if to_regprocedure('public.mfa_ok()') is null then return; end if;
  execute $f$
    create or replace function public.is_admin()
    returns boolean language sql stable security definer set search_path = public as $b$
      select public.mfa_ok() and exists (select 1 from public.admins where user_id = auth.uid());
    $b$ $f$;
  if to_regclass('public.admins') is not null and exists (
       select 1 from information_schema.columns where table_schema = 'public' and table_name = 'admins' and column_name = 'role') then
    execute $f$
      create or replace function public.admin_role()
      returns text language sql stable security definer set search_path = public as $b$
        select role from public.admins where user_id = auth.uid() and public.mfa_ok();
      $b$ $f$;
    execute $f$
      create or replace function public.admin_can(perm text)
      returns boolean language sql stable security definer set search_path = public as $b$
        select public.mfa_ok() and coalesce((
          select case a.role
            when 'owner' then true
            when 'editor' then perm in ('content.edit', 'content.publish', 'homepage.edit', 'homepage.publish',
                                        'notifications.send', 'ai.use', 'analytics.view', 'audit.view', 'users.view')
            when 'writer' then perm in ('content.edit', 'homepage.edit', 'ai.use', 'analytics.view')
            when 'moderator' then perm in ('community.moderate', 'users.view', 'users.restrict',
                                           'notifications.send', 'analytics.view', 'audit.view')
            when 'analyst' then perm in ('analytics.view', 'users.view')
            else false end
          from public.admins a where a.user_id = auth.uid()), false);
      $b$ $f$;
  end if;
end $guard$;
